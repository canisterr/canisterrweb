/**
 * Formats estimated watch time minutes as "Xh" or "Xd Yh", matching the
 * profile Stats page. Shared so the Stats page and the Movie Matcher report
 * display identical numbers identically formatted.
 */
export function formatWatchDuration(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m";

  const totalHours = Math.floor(minutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days === 0) return `${totalHours}h`;
  if (hours === 0) return `${days}d`;
  return `${days}d ${hours}h`;
}

/**
 * Formats a timestamp as a short relative label for recent dates, then falls
 * back to a compact calendar date for older entries.
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  const now = new Date();
  const sameYear = now.getFullYear() === date.getFullYear();
  const month = date.toLocaleString("en-US", { month: "short" }).toLowerCase();
  const day = date.getDate();

  return sameYear ? `${day} ${month}` : `${day} ${month} ${date.getFullYear()}`;
}

/**
 * Derives a PascalCase hashtag from a title, e.g. "Dune: Part Two" -> "#DunePartTwo".
 */
export function getLogHashtag(title: string): string {
  const pascal = title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");

  return pascal ? `#${pascal}` : "";
}
