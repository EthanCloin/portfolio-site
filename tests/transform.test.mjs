import { test } from "node:test";
import assert from "node:assert/strict";
import {
  stripComments, convertHighlights, convertCallouts, convertLinks, protectCode, transformBody,
  validateFrontmatter, parseWikiTarget, stripLeadingTitle,
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
});
