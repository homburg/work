import * as githubActions from "@actions/core";
import { Context, Effect, Layer } from "effect";
import { NodeRuntime, NodeContext } from "@effect/platform-node";
import { program } from "./program.ts";
import { NodeSdk } from "@effect/opentelemetry";
import { ConsoleSpanExporter } from "@opentelemetry/sdk-trace-base";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Core } from "./Core.ts";
import { Git, type GitRepo } from "./Git.ts";
import { Command, CommandExecutor } from "@effect/platform";
import { workingDirectory } from "@effect/platform/Command";

const context = Context.empty().pipe(
  Context.add(Core, {
    get_input: (name, options) => {
      return githubActions.getInput(name, options);
    },
    set_secret: (secret) => githubActions.setSecret(secret),
    set_output: (name, value) => githubActions.setOutput(name, value),
    warning: (message) => githubActions.warning(message),
    info: (message) => githubActions.info(message),
  })
);

class GitRepoLive implements GitRepo {
  private readonly executor: CommandExecutor.CommandExecutor;
  private readonly path: string;

  constructor(path: string, executor: CommandExecutor.CommandExecutor) {
    this.executor = executor;
    this.path = path;
  }

  config(config: { username: string; email: string }) {
    const executor = this.executor;
    const path = this.path;

    return Effect.gen(function* () {
      yield* executor.string(
        Command.make("git", "config", "user.name", config.username).pipe(
          workingDirectory(path)
        )
      );
    });
  }

  add(paths: ReadonlyArray<string>) {
    const executor = this.executor;
    const path = this.path;
    return Effect.gen(function* () {
      yield* executor.string(
        Command.make("git", "add", ...paths).pipe(workingDirectory(path))
      );
    });
  }

  commit(message: string, cwd?: string) {
    const executor = this.executor;
    const path = this.path;
    return Effect.gen(function* () {
      yield* executor.string(
        Command.make("git", "commit", "-m", message).pipe(
          workingDirectory(path)
        )
      );
    });
  }

  push(cwd?: string) {
    const executor = this.executor;
    const path = this.path;
    return Effect.gen(function* () {
      yield* executor.string(
        Command.make("git", "push").pipe(workingDirectory(path))
      );
    });
  }

  status(cwd?: string) {
    const executor = this.executor;
    const path = this.path;
    return Effect.gen(function* () {
      return yield* executor.string(
        Command.make("git", "status").pipe(workingDirectory(path))
      );
    });
  }

  rev_parse(ref: string, cwd?: string) {
    const executor = this.executor;
    const path = this.path;
    return Effect.gen(function* () {
      return yield* executor.string(
        Command.make("git", "rev-parse", ref).pipe(workingDirectory(path))
      );
    });
  }
}

const GitLive = Layer.effect(
  Git,
  Effect.gen(function* () {
    const executor = yield* CommandExecutor.CommandExecutor;

    return {
      config: (config) =>
        Effect.gen(function* () {
          yield* executor.string(
            Command.make("git", "config", "user.name", config.username)
          );

          yield* executor.string(
            Command.make("git", "config", "user.email", config.email)
          );
        }),
      repo_from_path: null as any,
      clone: (url, target_dir) =>
        Effect.gen(function* () {
          yield* executor.string(Command.make("git", "clone", url, target_dir));

          return new GitRepoLive(target_dir, executor);
        }),
    };
  })
);

// Run the program
NodeRuntime.runMain(
  program.pipe(
    Effect.provide(GitLive),
    Effect.provide(NodeContext.layer),
    Effect.provide(context),
    Effect.provide(
      NodeSdk.layer(() => {
        return {
          resource: { serviceName: "cross-repo-sync" },
          spanProcessor: new BatchSpanProcessor(new ConsoleSpanExporter()),
        };
      })
    )
  )
);
