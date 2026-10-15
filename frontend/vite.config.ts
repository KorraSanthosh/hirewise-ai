import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev the React app (5173) proxies /api to the FastAPI server (8000).
export default defineConfig({
  plugins: [react()],
  css: { postcss: { plugins: [] } }, // do not pick up the old Next.js postcss.config.mjs in the parent folder
  server: { port: 5173, proxy: { "/api": { target: process.env.VITE_API_PROXY || "http://localhost:8000", changeOrigin: true } } },
});
