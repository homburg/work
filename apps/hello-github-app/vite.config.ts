// vite.config.ts
import { devtools } from "@tanstack/devtools-vite";
import { nitroV2Plugin } from "@tanstack/nitro-v2-vite-plugin";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	server: {
		port: 3000,
	},
	// optimizeDeps: {
	// 	exclude: ["@effect/rpc", "@effect/sql"],
	// },
	plugins: [
		devtools(),
		tsConfigPaths(),
		tanstackStart(),
		nitroV2Plugin(
			// nitro config goes here, e.g.
			{ preset: "node-server", compatibilityDate: "2025-10-15" },
		),
		// react's vite plugin must come after start's vite plugin
		viteReact(),
	],
});
