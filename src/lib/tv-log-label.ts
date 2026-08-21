import type { MovieLog } from "@/types";

export function getTvEpisodeBadgeLabel(
  log: Pick<MovieLog, "content_type" | "season" | "episode">
): string {
  if (log.content_type !== "tv") return "";

  const hasSeason = typeof log.season === "number" && Number.isFinite(log.season);
  const hasEpisode = typeof log.episode === "number" && Number.isFinite(log.episode);

  if (hasSeason && hasEpisode) {
    return `S${log.season}EP${log.episode}`;
  }

  if (hasSeason) {
    return `S${log.season}`;
  }

  if (hasEpisode) {
    return `EP${log.episode}`;
  }

  return "";
}
