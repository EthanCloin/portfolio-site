# Writing guide: what survives the vault → blog conversion

The publisher (`scripts/publish/`) turns an Obsidian note into plain Markdown, then Astro renders it.
This is the contract. If something you use is not listed, assume it comes through as literal text
and ask for it to be added.

## Frontmatter

```yaml
status: ready                 # required; the human decision to publish
slug: from-programmer-to-director   # required; kebab-case; becomes /blog/<slug>
date: 2026-09-26              # required
description: One or two sentences (≤300 chars) for the listing and link previews.  # required
tags: [agents, engineering]   # required (may be [])
title: From Programmer to Director   # optional; defaults to the file name
subtitle: What changes when the code stops being yours   # optional; shown under the title
updated: 2026-10-01           # optional; shown as "updated" and in article meta tags
image: cover.png              # optional; an attachment name, used for the link-preview image
```

`private: true` or a `#private` tag makes the publisher refuse the note even if `status: ready`.

## Supported, converted or rendered

| You write | You get |
|---|---|
| `# Title` as the first line, matching the title | Dropped (the page already shows the title). Any other headings are kept. |
| `## Heading`, `### Heading` | Headings with anchor ids, so `[[#Heading]]` and `[text](#heading)` work. |
| Single newline inside a paragraph | A line break, like Obsidian's reading view. A blank line is a new paragraph. |
| `**bold**`, `*italic*`, `~~strike~~`, `==highlight==` | bold, italic, strikethrough, `<mark>` highlight |
| `` `inline code` ``, fenced code blocks with a language | Syntax-highlighted code (Shiki, GitHub-light). Contents are never transformed. |
| `> quote` | Blockquote |
| `> [!note] Title` / `[!tip]` `[!warning]` `[!quote]` etc., with body lines | Styled aside with the title; body stays Markdown. Nested callouts become a bold line inside the parent. |
| `[[Note]]`, `[[Note\|alias]]`, `[[Note#Heading]]` | A link to `/blog/<slug>` if that note is published or marked ready; otherwise just the alias/name as plain text. |
| `[[#Heading]]` | In-page anchor link |
| `[[Note#^block-id]]`, `[[#^block-id]]` | Plain text (block references have no HTML equivalent) |
| `![[image.png]]`, `![[image.png\|alt text]]` | Image copied to `/blog/images/<slug>/` and embedded. A width like `\|300` is dropped. |
| `![alt](Wiki/raw/image.png)` (Markdown-style vault path) | Same as above |
| `![[Other Note]]`, `![[Other Note#Section]]` | That note's body (or just that section) inlined, once, non-recursively |
| `![[file.pdf]]`, `![[audio.m4a]]` | Copied and linked (not embedded) |
| `[text](Note.md)`, `[text](Folder/Note.md#Heading)` | Same rules as wikilinks |
| `[text](https://…)`, `![alt](https://…)` | Left as is |
| `%% comment %%` and `%% multi-line %%` blocks | Removed |
| ` ^block-id` at the end of a paragraph | Removed |
| `[^1]` … `[^1]: note` and inline `^[note]` | Footnotes at the end of the post |
| Tables, `- [ ]` task lists | GFM tables; checkboxes rendered read-only |
| `$x^2$`, `$$ … $$` | KaTeX math, rendered at build time |
| Raw HTML (`<u>`, `<kbd>`, `<details>`, `<figure>`) | Passed through |
| Straight quotes, `--`, `...` | Smart quotes, dashes, ellipses |
| Emoji, Unicode | As is |

## Not supported (comes through as text or a code block)

- **Mermaid diagrams** render as a code block, not a diagram. Export to an image and embed that.
- **Dataview / Templater / Tasks queries** (`\`\`\`dataview`, `<% %>`) are not evaluated.
- **Inline `#tags`** stay as literal text. Use frontmatter `tags:`.
- **Image sizing** (`![[img.png|300]]`) is ignored; images scale to the column width.
- **Obsidian comments in frontmatter**, `cssclasses`, `aliases` are ignored.
- **Nested callouts** flatten to one level.
- **Canvas files, Excalidraw, embedded PDFs as viewers**: link only.

## Preview before publishing

```bash
npm run publish-note -- "From Programmer to Director" --dry-run
```

Prints the converted Markdown and any `warning:` lines (missing images, links to notes that are ready but not yet published). Nothing is written or committed.
