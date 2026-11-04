import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  appType: "mpa",
  build: {
    rollupOptions: {
      input: {
        index: resolve(process.cwd(), "index.html"),
        menu: resolve(process.cwd(), "menu.html"),
        order: resolve(process.cwd(), "order.html"),
      },
    },
  },
});
