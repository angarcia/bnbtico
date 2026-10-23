import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const buildId = process.env.GITHUB_SHA?.slice(0, 12) ?? Date.now().toString(36);

export default defineConfig({
  plugins: [react(), cloudflare()],
  define: { __BUILD_ID__: JSON.stringify(buildId) },
});
