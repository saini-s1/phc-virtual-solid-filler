import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    // The ingredient-library API runs as a separate Express process locally
    // (`npm run server`, or both together via `npm run dev:full`). This proxy
    // lets the Vite dev server forward /api/* the same way Azure App Service
    // does in production (one origin, Express serves both dist/ and /api).
    proxy: {
      "/api": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});
