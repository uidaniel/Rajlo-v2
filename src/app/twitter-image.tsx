/**
 * Twitter-card image. Twitter/X and Facebook share the same 1200×630
 * spec, so the actual image is the `default` render function imported
 * from `opengraph-image.tsx` — edit that one file and both cards
 * update together.
 *
 * The metadata exports (`alt`, `size`, `contentType`) are declared
 * directly here rather than re-exported: Next.js statically parses
 * metadata config at compile time and can't follow a re-export chain.
 */
export { default } from "./opengraph-image";

export const alt = "Rajlo — Jamaica's rideshare platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
