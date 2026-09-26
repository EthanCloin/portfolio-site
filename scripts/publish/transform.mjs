// Pure transforms from Obsidian-flavoured Markdown to plain Markdown + a little HTML
// that Astro renders. No filesystem access here; see vault.mjs for lookups.

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;

/**
 * Split fenced code blocks and inline code out so transforms never touch them.
 * Returns { text, restore } where text has placeholders.
 */
export function protectCode(src) {
  const stash = [];
  const put = (s) => {
    stash.push(s);
    return `\u0000CODE${stash.length - 1}\u0000`;
  };
  // Fenced blocks (``` or ~~~), then inline code spans.
  let text = src.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, put);
  text = text.replace(/(`+)([^`\n]|[^`\n][\s\S]*?[^`\n])\1(?!`)/g, put);
  const restore = (t) => t.replace(/\u0000CODE(\d+)\u0000/g, (_, i) => stash[Number(i)]);
  return { text, restore };
}

/** Remove Obsidian comments: %% inline %% and multi-line blocks. */
export function stripComments(text) {
  // Collapse the double space an inline comment leaves behind ("a %% x %% b" → "a b"),
  // without touching trailing two-space hard breaks or indentation.
  return text.replace(/%%[\s\S]*?%%/g, "").replace(/(\S) {2,}(?=\S)/g, "$1 ");
}

/** ==highlight== → <mark>highlight</mark> */
export function convertHighlights(text) {
  return text.replace(/==([^=\n][^\n]*?)==/g, "<mark>$1</mark>");
}

/** Drop a leading H1 that duplicates the title. */
export function stripLeadingTitle(text, title) {
  const m = text.match(/^\s*#\s+(.+?)\s*\n/);
  if (m && m[1].trim().toLowerCase() === title.trim().toLowerCase()) {
    return text.slice(m[0].length).replace(/^\n+/, "");
  }
  return text;
}

/** Parse the inside of a wikilink: "Note#Heading|Alias" → parts. */
export function parseWikiTarget(inner) {
  let [target, alias] = inner.split("|");
  let heading;
  const hash = target.indexOf("#");
  if (hash >= 0) {
    heading = target.slice(hash + 1);
    target = target.slice(0, hash);
  }
  target = target.trim();
  return { target, heading: heading?.trim() || undefined, alias: alias?.trim() || undefined };
}

export function headingToAnchor(heading) {
  return heading
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Convert callout blocks:
 *   > [!tip]+ Optional title
 *   > body lines
 * into <aside class="callout callout-tip"> with the body left as Markdown.
 */
export function convertCallouts(text) {
  const lines = text.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^>\s*\[!([\w-]+)\]([+-]?)\s*(.*)$/);
    if (!m) {
      out.push(lines[i]);
      continue;
    }
    const type = m[1].toLowerCase();
    const title = m[3].trim() || type.charAt(0).toUpperCase() + type.slice(1);
    const body = [];
    let j = i + 1;
    while (j < lines.length && /^>/.test(lines[j])) {
      body.push(lines[j].replace(/^>\s?/, ""));
      j++;
    }
    i = j - 1;
    // Nested callouts inside a callout are rendered as plain blockquotes.
    const inner = body.join("\n").replace(/^>\s*\[!([\w-]+)\][+-]?\s*(.*)$/gm, "> **$2**");
    out.push(
      `<aside class="callout callout-${type}">`,
      `<p class="callout-title">${escapeHtml(title)}</p>`,
      "",
      inner.trim(),
      "",
      "</aside>",
    );
  }
  return out.join("\n");
}

export function escapeHtml(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Resolve embeds and wikilinks.
 * @param {string} text
 * @param {object} opts
 * @param {(name: string) => ({ src: string, publicPath: string } | null)} opts.resolveAttachment
 *   Given "diagram.png" returns the URL it will be served from after copying, or null.
 * @param {(name: string) => ({ slug: string } | null)} opts.resolvePostLink
 *   Given a note name returns its published slug, or null if not published.
 * @param {(name: string, heading?: string) => (string | null)} opts.resolveTransclusion
 *   Given a note name returns its body Markdown to inline, or null.
 * @param {(msg: string) => void} [opts.warn]
 */
export function convertLinks(text, opts) {
  const warn = opts.warn ?? (() => {});

  // Embeds: ![[file]] / ![[file|alt or width]] / ![[Note#Heading]]
  text = text.replace(/!\[\[([^\]]+)\]\]/g, (_, inner) => {
    const { target, heading, alias } = parseWikiTarget(inner);
    if (IMAGE_EXT.test(target)) {
      const att = opts.resolveAttachment(target);
      if (!att) {
        warn(`image not found in vault: ${target}`);
        return "";
      }
      // Obsidian uses the alias slot for a pixel width ("|300"); don't use that as alt text.
      const alt = alias && !/^\d+(x\d+)?$/.test(alias) ? alias : target.replace(/\.[^.]+$/, "");
      return `![${alt}](${att.publicPath})`;
    }
    if (/\.(pdf|mp4|mp3|wav|ogg|webm|m4a)$/i.test(target)) {
      const att = opts.resolveAttachment(target);
      if (!att) {
        warn(`attachment not found in vault: ${target}`);
        return "";
      }
      return `[${alias ?? target}](${att.publicPath})`;
    }
    const body = opts.resolveTransclusion(target, heading);
    if (body == null) {
      warn(`transcluded note not found: ${target}`);
      return "";
    }
    return `\n${body.trim()}\n`;
  });

  // Wikilinks: [[Note]] / [[Note|Alias]] / [[Note#Heading]]
  text = text.replace(/\[\[([^\]]+)\]\]/g, (_, inner) => {
    const { target, heading, alias } = parseWikiTarget(inner);
    const label = alias ?? (heading && !target ? heading : target);
    if (!target) {
      // [[#Heading]] links within the same note.
      return heading ? `[${label}](#${headingToAnchor(heading)})` : label;
    }
    const post = opts.resolvePostLink(target);
    if (post) {
      const anchor = heading ? `#${headingToAnchor(heading)}` : "";
      return `[${label}](/blog/${post.slug}${anchor})`;
    }
    return label; // unpublished note: keep the words, drop the link
  });

  return text;
}

/** Full body pipeline. */
export function transformBody(body, { title, ...linkOpts }) {
  let text = body.replace(/\r\n?/g, "\n");
  text = stripLeadingTitle(text, title);
  const { text: protectedText, restore } = protectCode(text);
  let t = protectedText;
  t = stripComments(t);
  t = convertCallouts(t);
  t = convertLinks(t, linkOpts);
  t = convertHighlights(t);
  t = restore(t);
  return t.replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

/** Validate the frontmatter contract. Returns { ok, errors, meta }. */
export function validateFrontmatter(fm, { fallbackTitle }) {
  const errors = [];
  const meta = {};
  if (fm.status !== "ready") errors.push(`status must be "ready" (got ${JSON.stringify(fm.status ?? null)})`);
  const slug = String(fm.slug ?? "").trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) errors.push(`slug must be kebab-case (got ${JSON.stringify(fm.slug ?? null)})`);
  meta.slug = slug;
  const date = fm.date instanceof Date ? fm.date : new Date(String(fm.date ?? ""));
  if (!fm.date || Number.isNaN(date.getTime())) errors.push(`date must be a valid date (got ${JSON.stringify(fm.date ?? null)})`);
  meta.date = date;
  if (fm.updated) {
    const u = fm.updated instanceof Date ? fm.updated : new Date(String(fm.updated));
    if (Number.isNaN(u.getTime())) errors.push("updated must be a valid date");
    else meta.updated = u;
  }
  const description = String(fm.description ?? "").trim();
  if (!description) errors.push("description is required");
  else if (description.length > 300) errors.push("description must be 300 characters or fewer");
  meta.description = description;
  let tags = fm.tags ?? [];
  if (typeof tags === "string") tags = tags.split(/[,\s]+/).filter(Boolean);
  if (!Array.isArray(tags)) errors.push("tags must be a list");
  meta.tags = Array.isArray(tags) ? tags.map((t) => String(t).replace(/^#/, "").trim()).filter(Boolean) : [];
  meta.title = String(fm.title ?? fallbackTitle).trim();
  if (fm.image || fm.cover) meta.image = String(fm.image ?? fm.cover);
  return { ok: errors.length === 0, errors, meta };
}

export function toISODate(d) {
  return d.toISOString().slice(0, 10);
}

/** Frontmatter block for the generated post. */
export function renderFrontmatter(meta, { source }) {
  const q = (s) => JSON.stringify(String(s));
  const lines = [
    "---",
    `title: ${q(meta.title)}`,
    `slug: ${meta.slug}`,
    `date: ${toISODate(meta.date)}`,
  ];
  if (meta.updated) lines.push(`updated: ${toISODate(meta.updated)}`);
  lines.push(`description: ${q(meta.description)}`);
  lines.push(`tags: [${meta.tags.map(q).join(", ")}]`);
  if (meta.image) lines.push(`image: ${q(meta.image)}`);
  lines.push(`source: ${q(source)}`, "---", "");
  return lines.join("\n");
}
