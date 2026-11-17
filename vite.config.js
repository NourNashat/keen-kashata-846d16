import { defineConfig } from "vite";
import content from "./tools/content-plugin.js";

export default defineConfig({
  base: "./",
  plugins: [content()],
  build: { target: "es2020" },
  test: { environment: "jsdom", include: ["tests/**/*.test.js"] },
});
