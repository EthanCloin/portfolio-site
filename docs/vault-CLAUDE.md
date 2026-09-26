# Vault guide for agents

> Copy this file to the root of the Obsidian vault as `CLAUDE.md` (and optionally `AGENTS.md`).
> Obsidian Sync carries it to every device and to the droplet, so every agent session,
> wherever it runs, gets the same instructions. Edit it in Obsidian like any other note.

This folder is Ethan's Obsidian vault. It is the canonical home for his notes and the source
of his blog posts. Treat it as a writing space: read freely, edit carefully, never delete.

## Layout

| Folder | Purpose | Agent guidance |
|---|---|---|
| `Blog/` | Articles. A note is publishable when its frontmatter has `status: ready`, `slug`, `date`, `description`, `tags`. | Draft and edit here. Publishing is done from the portfolio-site repo with `/publish <note>`. |
| `LLM Wiki/` | Voice-note transcripts and the pages built from them: to-do lists, upcoming priorities, things to remember. | This is the folder to read when asked "what's on my plate", "what did I say about X", or to build/refresh a wiki page. |
| `Attachments/` | Images and files embedded in notes. | Reference by filename with `![[name.png]]`. |
| `.obsidian/` | App configuration. | Do not edit. |

Adjust the folder names above to match the vault.

## Conventions

- Frontmatter is YAML between `---` fences. Keep existing keys; add new ones at the end.
- Links between notes use `[[Note Name]]`. Images use `![[file.png]]`. Callouts use `> [!note] Title`.
- Dates are `YYYY-MM-DD`. Tags are a YAML list without `#`.
- When summarising voice notes into wiki pages, keep the original transcript untouched and link
  back to it from the page you build.
- Never run `ob sync` or touch the sync service; the daemon handles synchronisation.
- Do not publish (`status: ready`) on the user's behalf unless asked; flipping that field is a
  human decision.

## Publishing flow

1. Set `status: ready` plus `slug`, `date`, `description`, `tags` on the note.
2. In the portfolio-site repository run `/publish <note>` (or `npm run publish-note -- "<note>"`).
3. Review and merge the pull request; GitHub Actions deploys to https://ethancloin.xyz/blog.
