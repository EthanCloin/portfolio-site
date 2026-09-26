// End-to-end test of the git phase against a throwaway bare remote:
// first publish, republish after a merge, and a no-op republish.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "publish-git-"));
const remote = path.join(tmp, "remote.git");
const work = path.join(tmp, "work");
const vault = path.join(tmp, "vault");

const git = (args, cwd = work) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const run = (args) => spawnSync("node", [path.join(work, "scripts/publish/index.mjs"), ...args, "--vault", vault, "--no-build"], {
  cwd: work, encoding: "utf8", env: { ...process.env, PATH: path.join(tmp, "nogh") + path.delimiter + process.env.PATH },
});

test("setup throwaway remote and clone", () => {
  fs.mkdirSync(path.join(tmp, "nogh")); // keep gh off PATH: no real PRs from a test
  fs.writeFileSync(path.join(tmp, "nogh", "gh"), "#!/bin/sh\nexit 127\n", { mode: 0o755 });
  execFileSync("git", ["init", "--bare", "-q", "-b", "main", remote]);
  // A minimal repo: just what the publisher needs (its own scripts, package.json, a content dir).
  fs.mkdirSync(path.join(work, "src/content/blog"), { recursive: true });
  fs.cpSync(path.join(repoRoot, "scripts/publish"), path.join(work, "scripts/publish"), { recursive: true });
  fs.copyFileSync(path.join(repoRoot, "package.json"), path.join(work, "package.json"));
  fs.writeFileSync(path.join(work, "README.md"), "test repo\n");
  fs.writeFileSync(path.join(work, ".gitignore"), "node_modules\n");
  fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(work, "node_modules"), "dir");
  execFileSync("git", ["init", "-q", "-b", "main", work]);
  git(["config", "user.email", "test@example.com"]);
  git(["config", "user.name", "Test"]);
  git(["add", "-A"]);
  git(["commit", "-q", "-m", "init"]);
  git(["remote", "add", "origin", remote]);
  git(["push", "-q", "-u", "origin", "main"]);
  fs.cpSync(path.join(here, "fixtures", "vault"), vault, { recursive: true });
});

test("first publish creates and pushes publish/<slug>", () => {
  const r = run(["Hello World"]);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /compare\/main\.\.\.publish\/hello-world/);
  assert.equal(git(["log", "-1", "--format=%s", "origin/publish/hello-world"]), "Publish: Hello, world");
  assert.equal(git(["rev-parse", "--abbrev-ref", "HEAD"]), "main", "returns to the original branch");
  assert.equal(git(["status", "--porcelain", "--untracked-files=no"]), "", "tree is clean afterwards");
});

test("republish after the PR merged starts fresh from main and commits an update", () => {
  // Simulate the merge on the remote.
  git(["push", "-q", "origin", "origin/publish/hello-world:main"]);
  git(["pull", "-q", "--ff-only", "origin", "main"]);
  const note = path.join(vault, "Blog", "Hello World.md");
  fs.writeFileSync(note, fs.readFileSync(note, "utf8") + "\nA new closing paragraph.\n");
  const r = run(["Hello World"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(git(["log", "-1", "--format=%s", "origin/publish/hello-world"]), "Update: Hello, world");
  assert.equal(git(["rev-list", "--count", "origin/main..origin/publish/hello-world"]), "1", "exactly one commit on top of main");
  assert.match(git(["show", "origin/publish/hello-world:src/content/blog/hello-world.md"]), /A new closing paragraph/);
  assert.equal(git(["rev-parse", "--abbrev-ref", "HEAD"]), "main");
  assert.equal(git(["status", "--porcelain", "--untracked-files=no"]), "");
});

test("republish with no changes is refused and leaves the tree clean", () => {
  git(["push", "-q", "origin", "origin/publish/hello-world:main"]);
  git(["pull", "-q", "--ff-only", "origin", "main"]);
  const r = run(["Hello World"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /nothing changed/);
  assert.equal(git(["rev-parse", "--abbrev-ref", "HEAD"]), "main");
  assert.equal(git(["status", "--porcelain", "--untracked-files=no"]), "");
});

test("refuses to run on a dirty tree", () => {
  fs.appendFileSync(path.join(work, "README.md"), "\nlocal edit\n");
  const r = run(["Hello World"]);
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /uncommitted changes/);
  git(["checkout", "--", "README.md"]);
  fs.rmSync(tmp, { recursive: true, force: true });
});
