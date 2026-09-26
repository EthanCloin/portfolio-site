---
title: "Hello, world"
status: ready
slug: hello-world
date: 2026-09-26
description: "This site is now the home for my writing. Here is how posts get here."
tags: [meta, writing]
---
# Hello, world

Posts on this blog start life as notes in my Obsidian vault. %% private aside %% When a note is marked
`status: ready`, a small script converts it to plain Markdown, copies its images, and opens a pull request
against this site's repository. Merging the pull request ==deploys it==.

> [!note] Why not just write in a CMS?
> Because the notes already live where I think.
> Publishing should be a side effect of writing, not a separate chore.

![[diagram.png|How a note becomes a post]]

See also [[Second Post|the second post]], [[Private Note]] (unpublished), and [[#Details]].

%%
A whole block comment that must vanish.
%%

## Details

```md
[[not a link]] and ==not a highlight== inside code stay as-is
```

Inline code keeps `[[brackets]]` too. ![[Second Post#Reusable]]
