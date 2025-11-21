import "@/instrumentation";
import handler from "@tanstack/react-start/server-entry";
import { tracer } from "./tracer";

export default {
	fetch(request: Request) {
		return tracer.startActiveSpan(request.method, async (span) => {
			try {
				return await handler.fetch(request);
			} catch (error) {
				span.recordException(error);
				throw error;
			} finally {
				span.end();
			}
		});
	},
};
