// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import { satteri } from "@astrojs/markdown-satteri";
import { obsidianLineBreaks, katexMath } from "./src/lib/markdown.mjs";

// https://astro.build/config
export default defineConfig({
  site: "https://ethancloin.xyz",
  // Directory output: /blog/index.html, /blog/<slug>/index.html. Plays well with nginx.
  build: { format: "directory" },
  trailingSlash: "ignore",
  integrations: [sitemap()],
  markdown: {
    processor: satteri({
      // GFM (tables, footnotes, strikethrough, task lists) is on by default.
      features: { math: true, superscript: false, subscript: false },
      mdastPlugins: [obsidianLineBreaks],
      hastPlugins: [katexMath],
    }),
    shikiConfig: { theme: "github-light" },
  },
});
