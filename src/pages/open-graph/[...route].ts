import { OGImageRoute } from "astro-og-canvas";
import { getPosts } from "../../lib/posts";
import { postCard, siteCard, SITE_CARD } from "../../lib/og";

const posts = await getPosts();

// One card per published post, keyed by slug, plus the site-wide brand card.
const pages = {
  [SITE_CARD]: null,
  ...Object.fromEntries(posts.map((post) => [post.data.slug, post.data])),
};

export const { getStaticPaths, GET } = await OGImageRoute({
  param: "route",
  pages,
  getSlug: (key) => `${key}.png`,
  getImageOptions: (key, page) => (page ? postCard(page.title, page.description) : siteCard()),
});
