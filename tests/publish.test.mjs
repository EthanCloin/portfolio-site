import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publish } from "../scripts/publish/index.mjs";
import { Vault } from "../scripts/publish/vault.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const vaultPath = path.join(here, "fixtures", "vault");

test("vault lookup by name, path, and ambiguity", () => {
  const v = new Vault(vaultPath);
  assert.ok(v.findNote("Hello World").endsWith("Blog/Hello World.md"));
  assert.ok(v.findNote("hello world.md").endsWith("Blog/Hello World.md"));
  assert.ok(v.findNote("Blog/Hello World").endsWith("Blog/Hello World.md"));
  assert.equal(v.findNote("Does Not Exist"), null);
  assert.ok(v.findAttachment("diagram.png").endsWith("Attachments/diagram.png"));
});

test("dry-run publish of the fixture note", () => {
  const logs = [];
  const r = publish({ noteRef: "Hello World", vaultPath, dryRun: true, log: (m) => logs.push(m) });
  const out = r.output;
  assert.match(out, /^---\ntitle: "Hello, world"\nslug: hello-world\ndate: 2026-09-26\n/);
  assert.match(out, /tags: \["meta", "writing"\]/);
  assert.match(out, /source: "Blog\/Hello World.md"/);
  assert.ok(!out.includes("private aside"), "comments removed");
  assert.ok(!out.includes("block comment"), "block comments removed");
  assert.ok(!/^# Hello, world/m.test(out), "duplicate H1 removed");
  assert.match(out, /<mark>deploys it<\/mark>/);
  assert.match(out, /<aside class="callout callout-note">\n<p class="callout-title">Why not just write in a CMS\?<\/p>/);
  assert.match(out, /!\[How a note becomes a post\]\(\/blog\/images\/hello-world\/diagram.png\)/);
  assert.match(out, /\[the second post\]\(\/blog\/second-post\)/);
  assert.match(out, /Private Note \(unpublished\)/);
  assert.match(out, /\[Details\]\(#details\)/);
  assert.match(out, /\[\[not a link\]\] and ==not a highlight== inside code/);
  assert.match(out, /`\[\[brackets\]\]`/);
  assert.match(out, /This section gets transcluded\./);
  assert.ok(!out.includes("Not this one"));
  assert.equal(r.copies.length, 1);
  assert.ok(r.copies[0][1].endsWith(path.join("public", "blog", "images", "hello-world", "diagram.png")));
  assert.ok(r.warnings.some((w) => w.includes("Second Post")), "warns about linking to a ready-but-unpublished note");
});

test("refuses notes that are not ready", () => {
  assert.throws(() => publish({ noteRef: "Not Ready", vaultPath, dryRun: true, log: () => {} }), /not publishable[\s\S]*status must be "ready"[\s\S]*slug must be kebab-case/);
  assert.throws(() => publish({ noteRef: "Nope", vaultPath, dryRun: true, log: () => {} }), /note not found/);
});
