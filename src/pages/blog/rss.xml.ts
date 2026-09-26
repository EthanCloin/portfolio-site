import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { SITE } from "../../site";
import { getPosts, postPath } from "../../lib/posts";

export async function GET(context: APIContext) {
  const posts = await getPosts();
  return rss({
    title: SITE.blogTitle,
    description: SITE.description,
    site: context.site!,
    items: posts.map((post) => ({
      title: post.data.title,
      description: post.data.description,
      pubDate: post.data.date,
      link: postPath(post),
      categories: post.data.tags,
      author: SITE.author,
    })),
    customData: `<language>en-us</language>`,
  });
}
