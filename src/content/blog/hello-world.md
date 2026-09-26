---
title: "Hello, world"
slug: hello-world
date: 2026-09-26
description: "This site is now the home for my writing. Here is how posts get here."
tags: ["meta", "writing"]
source: "Blog/Hello World.md"
---

Posts on this blog start life as notes in my Obsidian vault. When a note is marked
`status: ready`, a small script converts it to plain Markdown, copies its images, and opens a pull request
against this site's repository. Merging the pull request <mark>deploys it</mark>.

<aside class="callout callout-note">
<p class="callout-title">Why not just write in a CMS?</p>

Because the notes already live where I think.
Publishing should be a side effect of writing, not a separate chore.

</aside>

See the [details](#details) below for what the conversion handles.

## Details

```md
[[not a link]] and ==not a highlight== inside code stay as-is
```

Inline code keeps `[[brackets]]` too, and images, callouts, and links between published posts all come through.
