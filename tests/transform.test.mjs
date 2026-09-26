import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stripComments, convertHighlights, convertCallouts, convertLinks, protectCode, transformBody,
  validateFrontmatter, parseWikiTarget, stripLeadingTitle, renderFrontmatter,
} from "../scripts/publish/transform.mjs";

test("strips inline and block comments", () => {
  assert.equal(stripComments("a %% hidden %% b\n%%\nblock\n%%\nc"), "a b\n\nc");
});

test("converts highlights", () => {
  assert.equal(convertHighlights("say ==hi== there"), "say <mark>hi</mark> there");
});

test("code blocks and inline code are protected", () => {
  const src = "x ==a==\n```\n==b== [[c]]\n```\nand `[[d]]` end";
  const { text, restore } = protectCode(src);
  assert.ok(!text.includes("==b=="));
  assert.equal(restore(text), src);
  const out = transformBody(src, { title: "t", resolveAttachment: () => null, resolvePostLink: () => null, resolveTransclusion: () => null });
  assert.match(out, /<mark>a<\/mark>/);
  assert.match(out, /==b== \[\[c\]\]/);
  assert.match(out, /`\[\[d\]\]`/);
});

test("callouts become asides with markdown bodies", () => {
  const out = convertCallouts("> [!tip]- Custom title\n> line one\n> line **two**\nafter");
  assert.equal(out, '<aside class="callout callout-tip">\n<p class="callout-title">Custom title</p>\n\nline one\nline **two**\n\n</aside>\nafter');
  assert.match(convertCallouts("> [!warning]\n> body"), /callout-title">Warning</);
});

test("parses wikilink targets", () => {
  assert.deepEqual(parseWikiTarget("Note#Head|Alias"), { target: "Note", heading: "Head", alias: "Alias" });
  assert.deepEqual(parseWikiTarget("#Head"), { target: "", heading: "Head", alias: undefined });
});

test("wikilinks resolve to published posts or plain text", () => {
  const opts = {
    resolveAttachment: (n) => (n === "pic.png" ? { publicPath: "/blog/images/s/pic.png" } : null),
    resolvePostLink: (n) => (n === "Pub" ? { slug: "pub" } : null),
    resolveTransclusion: (n, h) => (n === "Inc" ? `included ${h ?? "all"}` : null),
    warn: () => {},
  };
  assert.equal(convertLinks("[[Pub|see]] [[Pub#Some Heading]] [[Nope|gone]] [[#Local]]", opts),
    "[see](/blog/pub) [Pub](/blog/pub#some-heading) gone [Local](#local)");
  assert.equal(convertLinks("![[pic.png|300]] ![[pic.png|Alt text]] ![[missing.png]]", opts),
    "![pic](/blog/images/s/pic.png) ![Alt text](/blog/images/s/pic.png) ");
  assert.equal(convertLinks("a ![[Inc#Part]] b", opts).replace(/\n/g, "|"), "a |included Part| b");
});

test("leading H1 matching the title is removed", () => {
  assert.equal(stripLeadingTitle("# My Title\n\nbody", "my title"), "body");
  assert.equal(stripLeadingTitle("# Other\n\nbody", "My Title"), "# Other\n\nbody");
});

test("frontmatter contract", () => {
  const good = validateFrontmatter({ status: "ready", slug: "a-b", date: "2026-01-02", description: "d", tags: "#x, y" }, { fallbackTitle: "T" });
  assert.equal(good.ok, true);
  assert.deepEqual(good.meta.tags, ["x", "y"]);
  assert.equal(good.meta.title, "T");
  const bad = validateFrontmatter({ status: "draft", slug: "Bad Slug", date: "nope", description: "" }, { fallbackTitle: "T" });
  assert.equal(bad.ok, false);
  assert.equal(bad.errors.length, 4);
  const priv = validateFrontmatter({ status: "ready", slug: "a", date: "2026-01-02", description: "d", tags: ["x", "#private"] }, { fallbackTitle: "T" });
  assert.equal(priv.ok, false);
  assert.match(priv.errors[0], /private/);
  const priv2 = validateFrontmatter({ status: "ready", slug: "a", date: "2026-01-02", description: "d", private: true }, { fallbackTitle: "T" });
  assert.equal(priv2.ok, false);
});

import { stripBlockIds, convertInlineFootnotes, convertMarkdownLinks } from "../scripts/publish/transform.mjs";

test("block ids are stripped and block-ref links lose their anchor", () => {
  assert.equal(stripBlockIds("A paragraph. ^abc-123\nNext ^x\nno id here"), "A paragraph.\nNext\nno id here");
  const opts = { resolveAttachment: () => null, resolvePostLink: (n) => (n === "Pub" ? { slug: "pub" } : null), resolveTransclusion: () => null, warn: () => {} };
  assert.equal(convertLinks("[[Pub#^blockid|see]] [[#^local]]", opts), "[see](/blog/pub) local");
});

test("inline footnotes become numbered footnotes", () => {
  assert.equal(convertInlineFootnotes("Claim.^[Source here] More.^[Two]"),
    "Claim.[^inline-1] More.[^inline-2]\n\n[^inline-1]: Source here\n[^inline-2]: Two\n");
  assert.equal(convertInlineFootnotes("no notes"), "no notes");
});

test("markdown-style vault links and images are resolved", () => {
  const opts = {
    resolveAttachment: (n) => (n === "pic.png" ? { publicPath: "/blog/images/s/pic.png" } : null),
    resolvePostLink: (n) => (n === "Pub" ? { slug: "pub" } : null),
    warn: () => {},
  };
  assert.equal(convertMarkdownLinks("![](Wiki/raw/pic.png) ![x](https://e.com/a.png) ![y](nope.png)", opts),
    "![pic](/blog/images/s/pic.png) ![x](https://e.com/a.png) ![y](nope.png)");
  assert.equal(convertMarkdownLinks("[a](Pub.md) [b](Efforts/Pub.md#Some%20Heading) [c](Other.md) [d](https://x.y) [e](#anchor) [f](file.pdf)", opts),
    "[a](/blog/pub) [b](/blog/pub#some-heading) c [d](https://x.y) [e](#anchor) [f](file.pdf)");
});

test("subtitle passes through the frontmatter contract", () => {
  const r = validateFrontmatter({ status: "ready", slug: "a", date: "2026-01-02", description: "d", subtitle: " Sub " }, { fallbackTitle: "T" });
  assert.equal(r.meta.subtitle, "Sub");
  assert.match(renderFrontmatter(r.meta, { source: "x.md" }), /^---\ntitle: "T"\nsubtitle: "Sub"\nslug: a\n/);
});
