#!/usr/bin/env node
// Publish an Obsidian note as a blog post.
//
//   npm run publish-note -- "<note name or path>" [--vault <dir>] [--dry-run] [--no-git] [--no-build]
//
// 1. Finds the note in the vault and validates its frontmatter (status: ready, slug, date, description, tags).
// 2. Converts Obsidian syntax to plain Markdown, copies referenced images into public/blog/images/<slug>/.
// 3. Writes src/content/blog/<slug>.md, builds the site to prove it renders.
// 4. Commits on publish/<slug>, pushes, and opens a pull request (gh CLI). Merging deploys.
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Vault, extractSection } from "./vault.mjs";
import { transformBody, validateFrontmatter, renderFrontmatter } from "./transform.mjs";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const CONTENT_DIR = path.join(REPO, "src", "content", "blog");
const IMAGES_DIR = path.join(REPO, "public", "blog", "images");

function parseArgs(argv) {
  const args = { flags: new Set(), vault: null, note: null, base: "main" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--vault") args.vault = argv[++i];
    else if (a === "--base") args.base = argv[++i];
    else if (a.startsWith("--")) args.flags.add(a.slice(2));
    else if (!args.note) args.note = a;
    else throw new Error(`unexpected argument: ${a}`);
  }
  return args;
}

function loadConfig() {
  const file = path.join(REPO, "publish.config.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
}

function resolveVaultPath(cli, config) {
  const candidates = [cli, process.env.OBSIDIAN_VAULT, config.vaultPath, "/srv/vault"].filter(Boolean);
  for (const c of candidates) if (fs.existsSync(c)) return c;
  throw new Error(
    `no vault found. Pass --vault <dir>, set OBSIDIAN_VAULT, or add "vaultPath" to publish.config.json (tried: ${candidates.join(", ") || "nothing"})`,
  );
}

function git(args, opts = {}) {
  return execFileSync("git", args, { cwd: REPO, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"], ...opts }).trim();
}

export function publish({ noteRef, vaultPath, dryRun = false, doGit = true, doBuild = true, base = "main", log = console.error }) {
  const vault = new Vault(vaultPath);
  const file = vault.findNote(noteRef);
  if (!file) throw new Error(`note not found in vault ${vault.root}: ${noteRef}`);
  const source = vault.relative(file);
  log(`note: ${source}`);

  const { frontmatter, body } = vault.readNote(file);
  const fallbackTitle = path.basename(file, ".md");
  const { ok, errors, meta } = validateFrontmatter(frontmatter, { fallbackTitle });
  if (!ok) throw new Error(`frontmatter of "${source}" is not publishable:\n  - ${errors.join("\n  - ")}`);

  const copies = []; // [from, to]
  const imagesPublic = `/blog/images/${meta.slug}`;
  const warnings = [];

  const resolveAttachment = (name) => {
    const src = vault.findAttachment(name);
    if (!src) return null;
    const fileName = path.basename(src);
    copies.push([src, path.join(IMAGES_DIR, meta.slug, fileName)]);
    return { src, publicPath: `${imagesPublic}/${encodeURIComponent(fileName)}` };
  };

  const resolvePostLink = (name) => {
    const target = vault.findNote(name);
    if (!target) return null;
    const { frontmatter: fm } = vault.readNote(target);
    if (!fm.slug) return null;
    const slug = String(fm.slug);
    const alreadyPublished = fs.existsSync(path.join(CONTENT_DIR, `${slug}.md`));
    if (alreadyPublished || slug === meta.slug) return { slug };
    if (fm.status === "ready") {
      warnings.push(`links to "${name}" (slug ${slug}) which is ready but not yet published; linking anyway`);
      return { slug };
    }
    return null;
  };

  const resolveTransclusion = (name, heading) => {
    const target = vault.findNote(name);
    if (!target) return null;
    const { body: tb } = vault.readNote(target);
    return heading ? extractSection(tb, heading) : tb;
  };

  const markdown = transformBody(body, {
    title: meta.title,
    resolveAttachment,
    resolvePostLink,
    resolveTransclusion,
    warn: (m) => warnings.push(m),
  });

  if (meta.image && !/^https?:\/\//.test(meta.image) && !meta.image.startsWith("/")) {
    const att = resolveAttachment(meta.image.replace(/^!?\[\[|\]\]$/g, ""));
    if (att) meta.image = att.publicPath;
    else warnings.push(`cover image not found: ${meta.image}`);
  }

  const output = renderFrontmatter(meta, { source }) + "\n" + markdown;
  const outFile = path.join(CONTENT_DIR, `${meta.slug}.md`);
  for (const w of warnings) log(`warning: ${w}`);

  if (dryRun) {
    log(`--- would write ${path.relative(REPO, outFile)} and copy ${copies.length} attachment(s) ---`);
    process.stdout.write(output);
    return { outFile, copies, meta, output, warnings };
  }

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, output);
  for (const [from, to] of copies) {
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
  }
  log(`wrote ${path.relative(REPO, outFile)} (+${copies.length} attachment(s))`);

  if (doBuild) {
    log("building site to validate the post...");
    const r = spawnSync("npm", ["run", "build", "--silent"], { cwd: REPO, stdio: "inherit" });
    if (r.status !== 0) throw new Error("astro build failed; the post was written but not committed");
  }

  if (!doGit) return { outFile, copies, meta, output, warnings };

  const branch = `publish/${meta.slug}`;
  const changed = [path.relative(REPO, outFile), ...copies.map(([, to]) => path.relative(REPO, to))];
  const dirty = git(["status", "--porcelain", "--untracked-files=no"]);
  if (dirty) throw new Error(`working tree has uncommitted changes; commit or stash them first:\n${dirty}`);

  git(["fetch", "origin", base]);
  const current = git(["rev-parse", "--abbrev-ref", "HEAD"]);
  const hasGh = spawnSync("gh", ["--version"], { stdio: "ignore" }).status === 0;
  // Reuse the branch only while its pull request is still open; otherwise start fresh from the base.
  let openPr = null;
  if (hasGh) {
    const r = spawnSync("gh", ["pr", "list", "--head", branch, "--state", "open", "--json", "url", "-q", ".[0].url"], { cwd: REPO, encoding: "utf8" });
    if (r.status === 0 && r.stdout.trim()) openPr = r.stdout.trim();
  }
  if (openPr) {
    git(["checkout", branch]);
    spawnSync("git", ["pull", "--ff-only", "origin", branch], { cwd: REPO, stdio: "ignore" });
  } else {
    git(["checkout", "-B", branch, `origin/${base}`]);
  }
  // The generated files were written on the previous branch's tree; they are untracked/modified, so they carry over.
  git(["add", "--", ...changed]);
  if (!git(["status", "--porcelain", "--", ...changed])) {
    throw new Error("nothing changed: the published post already matches the note");
  }
  const isUpdate = spawnSync("git", ["cat-file", "-e", `origin/${base}:${changed[0]}`], { cwd: REPO }).status === 0;
  const subject = `${isUpdate ? "Update" : "Publish"}: ${meta.title}`;
  git(["commit", "-m", `${subject}\n\nSource: ${source}`]);
  // A fresh branch after a merged PR diverges from the old remote branch; --force-with-lease keeps that safe.
  git(["push", "-u", "--force-with-lease", "origin", branch], { stdio: "inherit" });

  let prUrl = null;
  if (hasGh) {
    if (openPr) {
      prUrl = openPr;
      log(`pull request already open: ${prUrl}`);
    } else {
      const bodyText = [
        `${isUpdate ? "Updates" : "Publishes"} **${meta.title}** at \`/blog/${meta.slug}\`.`,
        "",
        `- Source note: \`${source}\``,
        `- Date: ${meta.date.toISOString().slice(0, 10)}`,
        `- Tags: ${meta.tags.map((t) => `#${t}`).join(" ") || "none"}`,
        `- Attachments copied: ${copies.length}`,
        warnings.length ? `\nWarnings:\n${warnings.map((w) => `- ${w}`).join("\n")}` : "",
        "",
        "Merging deploys to https://ethancloin.xyz/blog.",
      ].join("\n");
      const r = spawnSync("gh", ["pr", "create", "--base", base, "--head", branch, "--title", subject, "--body", bodyText], {
        cwd: REPO,
        encoding: "utf8",
      });
      if (r.status === 0) prUrl = r.stdout.trim();
      else log(`gh pr create failed:\n${r.stderr}`);
    }
  }
  if (!prUrl) {
    prUrl = `https://github.com/EthanCloin/portfolio-site/compare/${base}...${branch}?expand=1`;
    log(`open the pull request here: ${prUrl}`);
  }
  if (current !== branch) git(["checkout", current]);
  console.log(prUrl);
  return { outFile, copies, meta, output, warnings, branch, prUrl };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs(process.argv.slice(2));
    if (!args.note) {
      console.error('usage: npm run publish-note -- "<note>" [--vault <dir>] [--dry-run] [--no-git] [--no-build] [--base main]');
      process.exit(2);
    }
    const config = loadConfig();
    publish({
      noteRef: args.note,
      vaultPath: resolveVaultPath(args.vault, config),
      dryRun: args.flags.has("dry-run"),
      doGit: !args.flags.has("no-git") && !args.flags.has("dry-run"),
      doBuild: !args.flags.has("no-build") && !args.flags.has("dry-run"),
      base: args.base,
    });
  } catch (e) {
    console.error(`error: ${e.message}`);
    process.exit(1);
  }
}
