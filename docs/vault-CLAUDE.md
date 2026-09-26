# Publishing section for the vault's CLAUDE.md

The vault already has a `CLAUDE.md` describing the LLM-wiki system (ACE layout, page schema,
ingest/surface/lint operations). Append the section below to it so agents on any device know
how a note becomes a blog post. Obsidian Sync carries the file everywhere.

```markdown
## Publishing to ethancloin.xyz

Some notes become public posts at https://ethancloin.xyz/blog. The site's repository
(github.com/EthanCloin/portfolio-site) does the conversion; nothing in this vault is public
until Ethan merges a pull request there.

A note is publishable when its frontmatter has:

```yaml
status: ready            # the human decision; never set this on Ethan's behalf
slug: kebab-case-slug    # becomes /blog/<slug>
date: YYYY-MM-DD
description: One or two sentences for the listing, RSS, and link previews (≤300 chars).
tags: [lowercase, topical]
title: Optional; defaults to the filename
image: optional-cover.png   # an attachment name, for link previews
```

Notes carrying `private: true` or `#private` are refused by the publisher even if `status: ready`.

Conversion rules: `[[wikilinks]]` to other published posts become links, otherwise plain text;
`![[image.png]]` embeds are copied; `> [!type]` callouts, `==highlights==` and `%% comments %%`
are handled; code blocks are untouched. Draft anywhere in the vault; the publisher finds notes by name.

To publish: in the portfolio-site repository run `/publish <note name>` (Claude Code) or
`npm run publish-note -- "<note name>"`. It opens a pull request; merging deploys.
```
