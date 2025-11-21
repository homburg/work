import { Effect, Context, Data } from "effect";

export class MissingInputError extends Data.TaggedError("MissingInputError")<{
  name: string;
}> {}

export class Core extends Context.Tag("GithubActionsCore")<
  Core,
  {
    readonly get_input: (name: string) => string;
    readonly get_required_input: (
      name: string
    ) => Effect.Effect<string, MissingInputError>;
    readonly set_secret: (secret: string) => void;
    readonly set_output: (name: string, value: string) => void;
    readonly warning: (message: string) => void;
    readonly info: (message: string) => void;
  }
>() {}
