import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import pkg from "./package.json";

export default defineConfig({
  base: "./",
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __APP_LICENSE__: JSON.stringify(pkg.license),
    __APP_REPOSITORY__: JSON.stringify(pkg.homepage),
  },
  build: {
    outDir: "dist/renderer",
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
});
