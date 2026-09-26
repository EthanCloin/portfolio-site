// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";

// https://astro.build/config
export default defineConfig({
  site: "https://ethancloin.xyz",
  // Directory output: /blog/index.html, /blog/<slug>/index.html. Plays well with nginx.
  build: { format: "directory" },
  trailingSlash: "ignore",
  integrations: [sitemap()],
  markdown: {
    shikiConfig: { theme: "github-light" },
  },
});
