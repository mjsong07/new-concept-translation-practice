import { defineConfig } from "vitest/config";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  base: "./",
  plugins: [vue()],
  test: {
    environment: "jsdom"
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vue: ["vue"],
          element: ["element-plus", "@element-plus/icons-vue"]
        }
      }
    }
  }
});
