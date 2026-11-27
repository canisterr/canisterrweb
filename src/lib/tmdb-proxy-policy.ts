const ALLOWED_PATHS = [
  /^(?:search\/(?:movie|tv|person|company|multi)|discover\/(?:movie|tv))$/,
  /^(?:trending\/(?:movie|tv)\/(?:day|week)|movie\/(?:popular|upcoming|top_rated|now_playing)|watch\/providers\/movie|genre\/(?:movie|tv)\/list)$/,
  /^(?:movie|tv)\/\d{1,10}(?:\/similar)?$/,
  /^tv\/\d{1,10}\/season\/\d{1,3}$/,
  /^person\/\d{1,10}(?:\/(?:movie_credits|tv_credits|combined_credits|external_ids))?$/,
];

const ALLOWED_PARAMS = new Set([
  "query", "page", "language", "region", "year", "primary_release_year", "append_to_response",
  "include_adult", "include_video", "sort_by", "with_genres", "without_genres",
  "with_cast", "with_crew", "with_companies", "with_original_language", "with_origin_country",
  "watch_region", "with_watch_providers", "vote_count.gte", "vote_average.gte",
  "release_date.gte", "release_date.lte", "primary_release_date.gte", "primary_release_date.lte",
  "with_runtime.gte", "with_runtime.lte",
]);

const ALLOWED_APPENDS = new Set(["credits", "videos", "keywords", "images", "watch/providers"]);

export function validateTmdbProxyRequest(path: string, params: URLSearchParams): string | null {
  if (!ALLOWED_PATHS.some((pattern) => pattern.test(path))) return "Unsupported TMDB endpoint";
  if (params.toString().length > 1600) return "TMDB query is too long";
  for (const [key, value] of params) {
    if (!ALLOWED_PARAMS.has(key) || value.length > 250) return "Unsupported TMDB parameter";
    if (key === "page" && (!/^\d{1,3}$/.test(value) || Number(value) < 1 || Number(value) > 500)) return "Invalid page";
    if (key === "query" && !value.trim()) return "Invalid search query";
    if (key === "append_to_response" && value.split(",").some((part) => !ALLOWED_APPENDS.has(part))) return "Unsupported appended endpoint";
  }
  return null;
}
