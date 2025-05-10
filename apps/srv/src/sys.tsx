import { Command } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";

const cmd = Command.make("uname", "-a");

export const program = Effect.gen(function* () {
  const result = yield* Command.string(cmd);
  return result;
});

export async function sys() {
  return Effect.runPromise(program.pipe(Effect.provide(NodeContext.layer)));
}
