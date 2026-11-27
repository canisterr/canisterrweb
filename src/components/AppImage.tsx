import Image, { type ImageProps } from "next/image";

function sourceString(source: ImageProps["src"]): string {
  if (typeof source === "string") return source;
  if ("src" in source && typeof source.src === "string") return source.src;
  return "";
}

/** Use the TMDB CDN directly. This keeps poster delivery out of Vercel's image optimizer. */
export default function AppImage(props: ImageProps) {
  const source = sourceString(props.src);
  const isTmdbAsset = /^https:\/\/image\.tmdb\.org\/t\/p\//i.test(source);
  // These small, fixed brand assets do not benefit from per-request transforms.
  const isBrandAsset = source === "/logo-ui.webp";

  return <Image {...props} alt={props.alt} unoptimized={isTmdbAsset || isBrandAsset || props.unoptimized} />;
}
