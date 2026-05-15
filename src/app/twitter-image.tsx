/**
 * Twitter-card image. Identical to the Open Graph image — Twitter and
 * Facebook share the same 1200×630 spec, but Next.js requires a
 * separate file so it knows to inject `<meta name="twitter:image">`
 * rather than `<meta property="og:image">`. Re-exports keep them in
 * lockstep: edit `opengraph-image.tsx`, both cards update.
 */
export {
  default,
  runtime,
  alt,
  size,
  contentType,
} from "./opengraph-image";
