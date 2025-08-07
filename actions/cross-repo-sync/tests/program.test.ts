import { program } from "../src/program.ts";
import { Core } from "../src/Core.ts";
import * as Platform from "@effect/platform";
import { describe, it } from "node:test";
import * as assert from "node:assert";
import { Context, Effect, Exit, TestContext } from "effect";
import { NodeSdk } from "@effect/opentelemetry";

import { memfs } from "memfs";

import {
  BatchSpanProcessor,
  type SpanExporter,
  type ReadableSpan,
} from "@opentelemetry/sdk-trace-base";
import type { ExportResult } from "@opentelemetry/core";
import { Git, type GitRepo } from "../src/Git.ts";
import { Path } from "@effect/platform";
import path from "node:path";
import type { SnapshotOptions } from "memfs/lib/snapshot/types";

class TestSpanExporter implements SpanExporter {
  private _spans: ReadableSpan[] = [];

  get spans(): ReadableSpan[] {
    return this._spans;
  }

  export(
    spans: ReadableSpan[],
    resultCallback: (result: ExportResult) => void
  ): void {
    this._spans.push(...spans);
    resultCallback({ code: 0 });
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }
}

describe("program", () => {
  it("should exist", () => {
    assert.ok(program);
  });

  it("should run", async (t) => {
    const spanExporter = new TestSpanExporter();

    const fs = memfs({ tmp: {} });

    const mockFileSystemLayer = Platform.FileSystem.layerNoop({
      rename(source, destination) {
        return Effect.sync(() => fs.vol.renameSync(source, destination));
      },
      makeDirectory(path) {
        return Effect.sync(() => fs.vol.mkdirSync(path, { recursive: true }));
      },
      remove(path, options) {
        return Effect.sync(() => fs.vol.rmSync(path, options));
      },
      makeTempDirectory() {
        const temp_dir = "/tmp/cross-repo-sync";
        fs.vol.mkdirSync(temp_dir, { recursive: true });
        return Effect.succeed(temp_dir);
      },
    });

    class TestGitRepo implements GitRepo {
      private readonly _path: string;

      constructor(path: string) {
        this._path = path;
      }

      config(config: { username: string; email: string }) {
        return Effect.succeed(undefined);
      }
      add(paths: ReadonlyArray<string>, cwd?: string) {
        return Effect.succeed(undefined);
      }
      commit(message: string, cwd?: string) {
        return Effect.succeed(undefined);
      }
      push(cwd?: string) {
        return Effect.succeed(undefined);
      }
      status(cwd?: string) {
        return Effect.succeed(" - lots\n - of\n - changes");
      }
      rev_parse(ref: string, cwd?: string) {
        return Effect.succeed("test-rev-parse-hash");
      }
    }

    const TestGit = Git.of({
      config(config) {
        return Effect.succeed(undefined);
      },

      repo_from_path(dir) {
        return Effect.succeed(new TestGitRepo(dir));
      },

      clone(url: string, target_dir: string) {
        fs.vol.mkdirSync(path.join(target_dir, ".git"), { recursive: true });

        fs.vol.writeFileSync(
          path.join(target_dir, ".git", "config"),
          "origin: " + url
        );

        fs.vol.writeFileSync(
          path.join(target_dir, ".git", "HEAD"),
          "test-HEAD"
        );

        fs.vol.mkdirSync(path.join(target_dir, "test-sync-paths"), {
          recursive: true,
        });

        fs.vol.writeFileSync(
          path.join(target_dir, "test-sync-paths", "test-file"),
          "test-file from " + url
        );

        return Effect.succeed(new TestGitRepo(target_dir));
      },
    });

    const TestCore = Core.of({
      get_input(name, options) {
        switch (name) {
          case "personal_access_token":
            return "test-personal-access-token";
          case "sync_paths":
            return "test-sync-paths";
          case "source_repo":
            return "test-owner/test-source-repo";
          case "destination_repo":
            return "test-owner/test-destination-repo";
          case "dry_run":
            return "";
          default:
            throw new Error(`Unknown input: ${name}`);
        }
      },
      set_secret(secret) {
        console.log("core setSecret", secret);
        return Effect.succeed(secret);
      },
      set_output(name, value) {
        console.log("core setOutput", name, value);
        return Effect.succeed(value);
      },
      warning(message) {
        console.log("core warning", message);
        return Effect.succeed(message);
      },
      info(message) {
        console.log("core info", message);
        return Effect.succeed(message);
      },
    });

    const testContext = Context.empty().pipe(
      Context.add(Git, TestGit),
      Context.add(Core, TestCore)
    );

    const result = await Effect.runPromiseExit(
      program.pipe(
        Effect.provide(TestContext.TestContext),
        Effect.provide(testContext),
        Effect.provide(mockFileSystemLayer),
        Effect.provide(Path.layer),
        Effect.provide(
          NodeSdk.layer(() => ({
            resource: { serviceName: "program-test" },
            spanProcessor: [new BatchSpanProcessor(spanExporter)],
          }))
        )
      )
    );

    t.assert.snapshot(spanExporter.spans.map(spanSnapshotData));
    t.assert.snapshot(result);

    t.assert.snapshot(toSnapshotSync(fs));

    assert.ok(Exit.isSuccess(result), "Program should succeed");
  });
});

function spanSnapshotData(span: ReadableSpan) {
  return {
    name: span.name,
    kind: span.kind,
    // spanContext: span.spanContext(),
    // parentSpanContext: span.parentSpanContext?.spanId,
    // startTime: span.startTime,
    // endTime: span.endTime,
    status: span.status,
    attributes: span.attributes,
    links: span.links,
    events: span.events,
    // duration: span.duration,
    ended: span.ended,
  };
}

const toSnapshotSync = ({
  fs,
  path = "/",
  separator = "/",
}: SnapshotOptions) => {
  const stats = fs.lstatSync(path);
  if (stats.isDirectory()) {
    const list = fs.readdirSync(path);
    const entries: { [child: string]: any } = {};
    const dir = path.endsWith(separator) ? path : path + separator;
    for (const child of list) {
      const childSnapshot = toSnapshotSync({
        fs,
        path: `${dir}${child}`,
        separator,
      });
      if (childSnapshot) entries["" + child] = childSnapshot;
    }
    return entries;
  } else if (stats.isFile()) {
    const file_contents = fs.readFileSync(path).toString();
    return file_contents;
  } else if (stats.isSymbolicLink()) {
    return {
      symlink: fs.readlinkSync(path).toString(),
    };
  }
  return null;
};
