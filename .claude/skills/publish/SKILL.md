---
name: publish
description: Publish an Obsidian note as a blog post on ethancloin.xyz. Use when the user says "/publish <note>", "publish my note", "push this article to the blog", or wants to update an already published post. Converts the note, opens a pull request; merging deploys.
argument-hint: <note name or vault path>
---

# /publish <note>

Turn a note from the Obsidian vault into a post at `https://ethancloin.xyz/blog/<slug>` by opening a pull request.

## Preconditions

1. The note's frontmatter must have `status: ready`, a kebab-case `slug`, a `date`, a `description` (≤300 chars), and `tags` (a list; may be empty). `title` is optional (falls back to the file name).
2. The vault must be reachable: `--vault <dir>`, `OBSIDIAN_VAULT`, `vaultPath` in `publish.config.json`, or `/srv/vault` (the droplet default).
3. `gh` must be authenticated (`gh auth status`) for the PR to be opened automatically. Without it the script prints a compare URL instead.
4. The working tree must be clean (`git status --porcelain`). Commit or stash first.

## Steps

1. Preview first, always:
   ```bash
   npm run publish-note -- "$ARGUMENTS" --dry-run
   ```
   Read the generated Markdown and the `warning:` lines. Common warnings: an image the vault can't find, or a wikilink to a note that is `ready` but not yet published (it will be linked as if it were).
2. If the note fails validation, tell the user exactly which frontmatter fields are missing or wrong and stop. If the preview shows syntax that came through as literal text, point the user to `docs/writing-guide.md`. Do not edit the note yourself unless asked; the vault is the user's writing space.
3. If the preview looks right, publish:
   ```bash
   npm run publish-note -- "$ARGUMENTS"
   ```
   This writes `src/content/blog/<slug>.md`, copies images to `public/blog/images/<slug>/`, runs `astro build` to prove it renders, commits on `publish/<slug>` from `origin/main`, pushes, and opens the PR. The PR URL is printed on stdout (last line).
4. Report the PR URL. Merging it deploys via GitHub Actions within about a minute. Re-running `/publish` for the same note updates the same branch and PR.

## What the conversion does

- `[[Note]]` → link to `/blog/<slug>` if that note is published (or ready); otherwise the link text alone.
- `![[image.png|alt]]` → copied image; `![[Note#Heading]]` → that section inlined.
- `> [!type] Title` callouts → `<aside class="callout callout-type">`; `==text==` → `<mark>`; `%% comments %%` removed.
- Code blocks and inline code are never modified.
- A leading `# Title` that duplicates the title is dropped. `subtitle:` in frontmatter renders under the title.
- Full contract, including what is not supported (Mermaid, Dataview): `docs/writing-guide.md`.

## Do not

- Do not push to `main` directly, and do not merge the PR; the user merges.
- Do not run `ob sync` or modify anything under the vault.
