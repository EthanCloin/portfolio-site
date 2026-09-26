import type { OGImageOptions } from "astro-og-canvas";
import { SITE } from "../site";

type RGB = [number, number, number];

/** Brand palette from src/styles/blog.css, as RGB triples for canvas rendering. */
export const palette = {
  parchmentLight: [239, 239, 231] as RGB, // #efefe7
  parchment: [222, 221, 206] as RGB, // #deddce
  fern800: [84, 117, 67] as RGB, // #547543
  sage700: [99, 117, 94] as RGB, // #63755e
  sienna700: [193, 78, 54] as RGB, // #c14e36
};

/** Font files bundled with the site so the cards match the blog's typography. */
export const fonts = [
  "./src/assets/fonts/Domine-Bold.ttf",
  "./src/assets/fonts/Mulish-Regular.ttf",
  "./src/assets/fonts/Mulish-SemiBold.ttf",
];

/**
 * Wordmarks drawn in the card's logo slot. Rendered at 2x from the site's fonts
 * (Mulish 600 in fern with a sienna dot, matching the header brand link).
 */
const wordmark = { path: "./src/assets/og/wordmark.png", size: [300] as [number] };
const urlMark = { path: "./src/assets/og/url.png", size: [300] as [number] };

/** Route under which generated cards are served, e.g. /open-graph/site.png. */
export const OG_ROUTE = "/open-graph";

/** Key of the site-wide brand card, used by any page without its own card. */
export const SITE_CARD = "site";

export function ogImagePath(key: string): string {
  return `${OG_ROUTE}/${key}.png`;
}

/** Shared look for every card: parchment background, sienna edge, brand fonts. */
function baseOptions(): Omit<OGImageOptions, "title"> {
  return {
    bgGradient: [palette.parchmentLight, palette.parchment],
    border: { color: palette.sienna700, width: 18, side: "inline-start" },
    padding: 72,
    fonts,
    font: {
      title: { families: ["Domine"], weight: "Bold", color: palette.fern800, size: 64, lineHeight: 1.15 },
      description: { families: ["Mulish"], weight: "Normal", color: palette.sage700, size: 30, lineHeight: 1.4 },
    },
  };
}

/** Descriptions longer than this are cut at a word boundary so the card never overflows. */
const MAX_DESCRIPTION = 120;

/** Titles longer than this drop to a smaller size so three wrapped lines still fit. */
const LONG_TITLE = 40;

/** Card for an individual post: title, description, and the site URL. */
export function postCard(title: string, description: string): OGImageOptions {
  const base = baseOptions();
  const titleSize = title.length > LONG_TITLE ? 56 : 64;
  return {
    ...base,
    logo: wordmark,
    title,
    description: `${truncate(description, MAX_DESCRIPTION)}\n\n${siteHost()}`,
    font: { ...base.font, title: { ...base.font?.title, size: titleSize } },
  };
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const atWord = cut.lastIndexOf(" ");
  return `${(atWord > max / 2 ? cut.slice(0, atWord) : cut).replace(/[\s.,;:]+$/, "")}…`;
}

/** Site-wide brand card: the author's name and the blog's tagline. */
export function siteCard(): OGImageOptions {
  return {
    ...baseOptions(),
    logo: urlMark,
    title: SITE.author,
    description: SITE.description,
    font: {
      title: { families: ["Domine"], weight: "Bold", color: palette.fern800, size: 96, lineHeight: 1.1 },
      description: { families: ["Mulish"], weight: "Normal", color: palette.sage700, size: 32, lineHeight: 1.4 },
    },
  };
}

function siteHost(): string {
  return new URL(SITE.url).host;
}
