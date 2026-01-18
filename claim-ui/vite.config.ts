import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/wf": {
        target: "http://localhost:8084",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/wf/, ""),
      },
      "/claim": {
        target: "http://localhost:8081",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/claim/, ""),
      },
    },
  },
});
