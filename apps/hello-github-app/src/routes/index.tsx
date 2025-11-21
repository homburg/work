import * as fs from "node:fs";
import { NodeSdk, Tracer } from "@effect/opentelemetry";
import { FileSystem } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import { metrics } from "@opentelemetry/api";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { createServerFn, createServerOnlyFn } from "@tanstack/react-start";
import { Effect } from "effect";
import { processors } from "@/instrumentation";
import { tracer } from "@/tracer";

const filePath = "count.txt";

const counter = metrics.getMeter("default").createCounter("my_count_counter");

const getCountEffect = Effect.gen(function* () {
  yield* Effect.logDebug("getCount");

  const fs = yield* FileSystem.FileSystem;

  const data = yield* fs.readFileString(filePath);

  const n = parseInt(data, 10);

  counter.add(n, { time: new Date().toISOString() });

  return n;
}).pipe(Effect.withSpan("getCountEffect"));

const NodeSdkLive = NodeSdk.layer(() => {
  return {
    ...processors,
  };
});

async function readCount() {
  return tracer.startActiveSpan("readCount", async (span) => {
    try {
      const val = await Effect.runPromise(
        getCountEffect.pipe(
          Effect.provide(NodeSdkLive),
          Tracer.withSpanContext(span.spanContext()),
          Effect.provide(NodeContext.layer),
        ),
      );

      console.log("after getCountEffect", val);
      return val;
    } catch (error) {
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}

const getCount = createServerFn({
  method: "GET",
}).handler(async () => {
  return {
    count: await readCount(),
    cwd: getCwd(),
  };
});

const updateCount = createServerFn({ method: "POST" })
  .inputValidator((d: number) => d)
  .handler(async ({ data }) => {
    const count = await readCount();
    await fs.promises.writeFile(filePath, `${count + data}`);
  });

export const Route = createFileRoute("/")({
  component: Home,
  loader: async () => await getCount(),
});

function Home() {
  const router = useRouter();
  const state = Route.useLoaderData();

  return (
    <>
      <pre>{state.cwd}</pre>
      <button
        type="button"
        onClick={() => {
          updateCount({ data: 1 }).then(() => {
            router.invalidate();
          });
        }}
      >
        Add 1 to {state.count}?
      </button>
    </>
  );
}

const getCwd = createServerOnlyFn(() => {
  return process.cwd();
});
