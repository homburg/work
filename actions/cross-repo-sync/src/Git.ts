import type { PlatformError } from "@effect/platform/Error";
import { Context, type Effect } from "effect";

export interface GitRepo {
  config(config: {
    username: string;
    email: string;
  }): Effect.Effect<void, PlatformError>;
  add(paths: ReadonlyArray<string>): Effect.Effect<void, PlatformError>;
  commit(message: string): Effect.Effect<void, PlatformError>;
  push(): Effect.Effect<void, PlatformError>;
  status(): Effect.Effect<string, PlatformError>;
  rev_parse(ref: string): Effect.Effect<string, PlatformError>;
}

export class Git extends Context.Tag("Git")<
  Git,
  {
    readonly config: (config: {
      username: string;
      email: string;
    }) => Effect.Effect<void, PlatformError>;
    readonly repo_from_path: (
      dir: string
    ) => Effect.Effect<GitRepo, PlatformError>;
    readonly clone: (
      url: string,
      target_dir: string
    ) => Effect.Effect<GitRepo, PlatformError>;
  }
>() {}
