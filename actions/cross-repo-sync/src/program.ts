import { Effect } from "effect";
import { FileSystem } from "@effect/platform/FileSystem";
import { Core } from "./Core.ts";
import { Git, type GitRepo } from "./Git.ts";
import { Path } from "@effect/platform";

// Types for our domain
interface ActionInputs {
  readonly personal_access_token: string;
  readonly sync_paths: ReadonlyArray<readonly [string, string]>;
  readonly source_repo: string;
  readonly destination_repo: string;
  readonly dry_run: boolean;
}

interface GitConfig {
  readonly username: string;
  readonly email: string;
}

// Parse action inputs
const parse_inputs = Effect.withSpan("parse_inputs")(
  Effect.gen(function* () {
    const core = yield* Core;
    const personal_access_token = core.get_input("personal_access_token", {
      required: true,
    });
    const sync_paths_input = core.get_input("sync_paths", { required: true });
    const source_repo = core.get_input("source_repo", { required: true });
    const destination_repo = core.get_input("destination_repo", {
      required: true,
    });
    const dry_run = core.get_input("dry_run", { required: false }) === "true";

    // Mask sensitive token in logs
    core.set_secret(personal_access_token);

    if (!personal_access_token) {
      return yield* Effect.fail(new Error("personal_access_token is required"));
    }

    if (!destination_repo) {
      return yield* Effect.fail(new Error("destination_repo is required"));
    }

    if (!source_repo) {
      return yield* Effect.fail(new Error("source_repo is required"));
    }

    // Validate repository format (owner/repo)
    if (!/^[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+$/.test(destination_repo)) {
      return yield* Effect.fail(
        new Error(
          `Invalid repository format: "${destination_repo}". Expected format: "owner/repo"`
        )
      );
    }

    if (!sync_paths_input.trim()) {
      return yield* Effect.fail(new Error("sync_paths is required"));
    }

    // Parse sync paths
    const sync_paths: Array<readonly [string, string]> = [];

    for (const line of sync_paths_input.split("\n")) {
      const trimmed_line = line.trim();
      if (!trimmed_line) continue;

      const colon_index = trimmed_line.indexOf(":");
      if (colon_index === -1) {
        // No destination specified, copy to root
        const clean_source = trimmed_line.replace(/^"(.*)"$/, "$1");

        // Validate path safety
        if (clean_source.includes("..") || clean_source.startsWith("/")) {
          core.warning(
            `Potentially unsafe path detected and skipped: ${clean_source}`
          );
          continue;
        }

        sync_paths.push([clean_source, clean_source]);
      } else {
        const source = trimmed_line.slice(0, colon_index).trim();
        const destination = trimmed_line.slice(colon_index + 1).trim();

        // Handle quoted paths
        const clean_source = source.replace(/^"(.*)"$/, "$1");
        const clean_destination = destination.replace(/^"(.*)"$/, "$1");

        // Validate path safety
        if (
          clean_source.includes("..") ||
          clean_source.startsWith("/") ||
          clean_destination.includes("..") ||
          clean_destination.startsWith("/")
        ) {
          core.warning(
            `Potentially unsafe path detected and skipped: ${clean_source} -> ${clean_destination}`
          );
          continue;
        }

        sync_paths.push([clean_source, clean_destination]);
      }
    }

    if (sync_paths.length === 0) {
      return yield* Effect.fail(new Error("No valid sync paths found"));
    }

    return {
      personal_access_token,
      sync_paths,
      destination_repo,
      dry_run,
      source_repo,
    } satisfies ActionInputs;
  })
);

// Configure git user
const configureGit = (config: GitConfig) =>
  Effect.gen(function* () {
    const git = yield* Git;
    yield* git.config({
      username: config.username,
      email: config.email,
    });
  });

// Clone destination repository
const clone_repo = ({
  access_token,
  repo,
  dir,
}: {
  access_token: string;
  repo: string;
  dir: string;
}) =>
  Effect.withSpan("clone_repo", {
    attributes: {
      repo,
      dir,
    },
  })(
    Effect.gen(function* () {
      // URL-encode the token to handle special characters (@, #, +, spaces, etc.)
      const repo_url = `https://${encodeURIComponent(
        access_token
      )}@github.com/${repo}.git`;

      const git = yield* Git;

      return yield* git.clone(repo_url, dir);
    })
  );

// Copy files according to sync paths
const move_paths = (
  inputs: ActionInputs,
  source_clone_dir: string,
  destination_clone_dir: string
) =>
  Effect.withSpan("move_paths", {
    attributes: {
      source_clone_dir,
      destination_clone_dir,
    },
  })(
    Effect.gen(function* () {
      const fs = yield* FileSystem;
      const path = yield* Path.Path;

      for (const [source, destination] of inputs.sync_paths) {
        const source_path = path.join(source_clone_dir, source);
        const destination_path = path.join(destination_clone_dir, destination);

        const destination_dir_path = path.dirname(destination_path);

        // Create destination containingdirectory if it doesn't exist
        yield* fs.makeDirectory(destination_dir_path, {
          recursive: true,
        });

        // Copy single file
        yield* fs.rename(source_path, destination_path);
      }
    })
  );

// Check for changes and commit/push if needed
const commit_and_push = (repo: GitRepo) =>
  Effect.withSpan("commit_and_push")(
    Effect.gen(function* () {
      const core = yield* Core;

      const status = yield* repo.status();

      if (!status.trim()) {
        core.info("No changes detected, skipping commit and push");
        return "";
      }

      // Add all changes
      yield* repo.add(["."]);

      // Commit changes
      const commit_message = "chore: Sync files from source repository";
      yield* repo.commit(commit_message);

      // Push changes
      yield* repo.push();

      // Get the commit hash
      const commit_hash = yield* repo.rev_parse("HEAD");

      core.info(`Successfully pushed changes with commit hash: ${commit_hash}`);
      return commit_hash;
    })
  );

// Main program
export const program = Effect.withSpan("program")(
  Effect.gen(function* () {
    const core = yield* Core;

    const inputs = yield* parse_inputs;

    for (const [key, value] of Object.entries(inputs)) {
      yield* Effect.annotateCurrentSpan(key, value);
    }

    // TODO: Structured logging
    core.info(
      `🚀 Starting cross-repo sync to ${inputs.destination_repo}${
        inputs.dry_run ? " (DRY RUN)" : ""
      }`
    );

    core.info(`📁 Found ${inputs.sync_paths.length} sync path(s):`);

    inputs.sync_paths.forEach(([source, destination], index) => {
      core.info(`   ${index + 1}. ${source} -> ${destination}`);
    });

    if (inputs.dry_run) {
      core.info("🧪 Running in dry-run mode - no actual changes will be made");
      return;
    }

    const fs = yield* FileSystem;

    const temp_dir = yield* fs.makeTempDirectory();

    const gitConfig: GitConfig = {
      username: "github-actions[bot]",
      email: "github-actions[bot]@users.noreply.github.com",
    };

    // Configure git
    yield* configureGit(gitConfig);

    const path = yield* Path.Path;

    const destination_repo_dir = path.join(temp_dir, "destination_repo");

    const source_repo_dir = path.join(temp_dir, "source_repo");

    const target_dir = path.join(temp_dir, "target");

    yield* fs.makeDirectory(target_dir, { recursive: true });

    // Clone destination repo
    const destination_repo = yield* clone_repo({
      access_token: inputs.personal_access_token,
      repo: inputs.destination_repo,
      dir: destination_repo_dir,
    });

    // Clone source repo
    const source_repo = yield* clone_repo({
      access_token: inputs.personal_access_token,
      repo: inputs.source_repo,
      dir: source_repo_dir,
    });

    const git = yield* Git;

    yield* fs.rename(
      path.join(destination_repo_dir, ".git"),
      path.join(target_dir, ".git")
    );

    const target_repo = yield* git.repo_from_path(target_dir);

    // Move files
    yield* move_paths(inputs, source_repo_dir, target_dir);

    // Commit and push changes
    const commit_hash = yield* commit_and_push(target_repo);

    // Set output
    core.set_output("commit_hash", commit_hash);

    core.info("✅ Cross-repo sync completed successfully");
  })
);
