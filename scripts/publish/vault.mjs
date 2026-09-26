// Filesystem side: locate notes and attachments inside an Obsidian vault.
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const SKIP_DIRS = new Set([".obsidian", ".trash", ".git", "node_modules", ".claude"]);

export function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Split "---\n...\n---\nbody" into { frontmatter: object, body: string }. */
export function parseNote(raw) {
  const m = raw.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { frontmatter: {}, body: raw };
  let frontmatter = {};
  try {
    frontmatter = YAML.parse(m[1]) ?? {};
  } catch (e) {
    throw new Error(`invalid YAML frontmatter: ${e.message}`);
  }
  return { frontmatter, body: raw.slice(m[0].length) };
}

export class Vault {
  constructor(root) {
    if (!fs.existsSync(root)) throw new Error(`vault not found: ${root}`);
    this.root = path.resolve(root);
    this.files = walk(this.root);
    this.notes = this.files.filter((f) => f.toLowerCase().endsWith(".md"));
  }

  relative(p) {
    return path.relative(this.root, p);
  }

  /**
   * Find a note by: absolute path, vault-relative path, or bare name ("My Note" / "My Note.md").
   * Bare names match on basename, case-insensitively; ambiguity is an error.
   */
  findNote(ref) {
    const withExt = ref.toLowerCase().endsWith(".md") ? ref : `${ref}.md`;
    const abs = path.resolve(withExt);
    if (abs.startsWith(this.root + path.sep) && fs.existsSync(abs)) return abs;
    const rel = path.join(this.root, withExt);
    if (fs.existsSync(rel)) return rel;
    const want = path.basename(withExt).toLowerCase();
    const matches = this.notes.filter((n) => path.basename(n).toLowerCase() === want);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new Error(`ambiguous note "${ref}"; matches:\n  ${matches.map((m) => this.relative(m)).join("\n  ")}`);
    }
    return null;
  }

  /** Find an attachment by basename (Obsidian's "shortest path" resolution). */
  findAttachment(name) {
    const want = path.basename(name).toLowerCase();
    const matches = this.files.filter((f) => path.basename(f).toLowerCase() === want);
    if (matches.length === 0) return null;
    // Prefer files in a folder named like an attachments folder.
    matches.sort((a, b) => Number(/attach|asset|image|media/i.test(b)) - Number(/attach|asset|image|media/i.test(a)));
    return matches[0];
  }

  readNote(file) {
    return parseNote(fs.readFileSync(file, "utf8"));
  }
}

/** Extract the section under a heading (until the next heading of same or higher level). */
export function extractSection(body, heading) {
  const lines = body.split("\n");
  const idx = lines.findIndex((l) => {
    const m = l.match(/^(#{1,6})\s+(.+?)\s*$/);
    return m && m[2].toLowerCase() === heading.toLowerCase();
  });
  if (idx < 0) return null;
  const level = lines[idx].match(/^#+/)[0].length;
  const out = [];
  for (let i = idx + 1; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,6})\s/);
    if (m && m[1].length <= level) break;
    out.push(lines[i]);
  }
  return out.join("\n");
}
