import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/test")({
	server: {
		handlers: {
			GET: () => {
				return new Response("Hello, world!", {
					status: 200,
					headers: {
						"Content-Type": "text/plain",
					},
				});
			},
		},
	},
});
