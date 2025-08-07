import { Effect, Context } from "effect";

export class Core extends Context.Tag("GithubActionsCore")<
  Core,
  {
    readonly get_input: (
      name: string,
      options?: { required: boolean }
    ) => string;
    readonly set_secret: (secret: string) => void;
    readonly set_output: (name: string, value: string) => void;
    readonly warning: (message: string) => void;
    readonly info: (message: string) => void;
  }
>() {}
