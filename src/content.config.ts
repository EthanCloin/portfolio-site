import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// Contract shared with scripts/publish: a note is publishable only when its
// Obsidian frontmatter carries `status: ready` plus slug, date, description, tags.
const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.md" }),
  schema: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case"),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    description: z.string().min(1).max(300),
    tags: z.array(z.string()).default([]),
    image: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
