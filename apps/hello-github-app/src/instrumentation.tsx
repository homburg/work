// instrumentation.ts - Initialize before your app
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { getSpanProcessorsFromEnv } from "@opentelemetry/sdk-node/build/src/utils.js";

const sdk = new NodeSDK({
	instrumentations: [getNodeAutoInstrumentations()],
});

// Initialize BEFORE importing your app
sdk.start();

const logRecordProcessors = sdk._loggerProviderConfig?.logRecordProcessors;

export const processors = {
	logRecordProcessors,
	spanProcessor: getSpanProcessorsFromEnv(),
	// metricReader: sdk._meterProvider._sharedState.metricCollectors.map(
	// 	(c) => c._metricReader,
	// ),
};
