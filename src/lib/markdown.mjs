// Markdown pipeline plugins for the Sätteri processor (Astro 7's default).
import katex from "katex";
import { defineMdastPlugin, defineHastPlugin } from "satteri";

/**
 * Obsidian's default reading view treats a single newline as a line break
 * ("strict line breaks" off). CommonMark would join the lines into one paragraph.
 * Match Obsidian so what the author sees in the vault is what the post shows.
 */
export const obsidianLineBreaks = defineMdastPlugin({
  name: "obsidian-line-breaks",
  text(node, ctx) {
    if (!node.value.includes("\n")) return;
    const nodes = [];
    node.value.split("\n").forEach((part, i) => {
      if (i) nodes.push({ type: "break" });
      if (part) nodes.push({ type: "text", value: part });
    });
    ctx.replaceNode(node, nodes);
  },
});

/** Render `$inline$` and `$$display$$` math to HTML at build time with KaTeX. */
export const katexMath = defineHastPlugin({
  name: "katex-math",
  element: {
    filter: ["code"],
    visit(node, ctx) {
    const classes = Array.isArray(node.properties?.className) ? node.properties.className : [];
    const inline = classes.includes("math-inline");
    const display = classes.includes("math-display");
    if (!inline && !display) return;
    const tex = (node.children ?? []).map((c) => (c.type === "text" ? c.value : "")).join("");
    const html = katex.renderToString(tex, { displayMode: display, throwOnError: false, output: "html" });
    ctx.replaceNode(node, { type: "raw", value: html });
    },
  },
});
