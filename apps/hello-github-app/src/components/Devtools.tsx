import { TanStackDevtools } from "@tanstack/react-devtools";
// import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import { ReactQueryDevtoolsPanel } from "@tanstack/react-query-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";

import { ClientPlugin } from "./ClientPlugin";

// import { StudioPlugin } from "./prisma-plugin";

// const queryClient = new QueryClient();

export function Devtools() {
	return (
		<>
			{/* <QueryClientProvider client={queryClient}> */}
			<TanStackDevtools
				eventBusConfig={{
					debug: false,
					connectToServerBus: true,
				}}
				plugins={[
					// {
					// 	name: "TanStack Query",
					// 	render: <ReactQueryDevtoolsPanel />,
					// },
					{
						name: "TanStack Router",
						render: <TanStackRouterDevtoolsPanel />,
					},
					// {
					// 	name: "Prisma Studio",
					// 	render: <StudioPlugin />,
					// },
					{
						name: "Client Plugin",
						render: <ClientPlugin />,
					},
				]}
			/>
			{/* </QueryClientProvider> */}
		</>
	);
}
