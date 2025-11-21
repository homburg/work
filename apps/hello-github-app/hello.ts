import { NodeSdk, Resource } from "@effect/opentelemetry";
import { NodeRuntime } from "@effect/platform-node";
import { metrics } from "@opentelemetry/api";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getSpanProcessorsFromEnv } from "@opentelemetry/sdk-node/build/src/utils.js";

import {
	ConsoleSpanExporter,
	SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import { Effect } from "effect";

const sdk = new NodeSDK();

sdk.start();

const logRecordProcessors = sdk._loggerProviderConfig?.logRecordProcessors;

const processors = {
	logRecordProcessors,
	spanProcessor: getSpanProcessorsFromEnv(),
	// metricReader: sdk._meterProvider._sharedState.metricCollectors.map(
	// 	(c) => c._metricReader,
	// ),
};

const NodeSdkLive = NodeSdk.layer(() => {
	return {
		...processors,
	};
});

const counter = metrics.getMeter("default").createCounter("foo");

const program = Effect.gen(function* () {
	const r = yield* Resource.Resource;

	counter.add(1, { time: new Date().toISOString() });

	yield* Effect.log("hello effect", r);
}).pipe(Effect.withSpan("hello effect"));

NodeRuntime.runMain(program.pipe(Effect.provide(NodeSdkLive)));
