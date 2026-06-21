import { getTmdbImageUrl, getTmdbPosterUrl } from "@/lib/performance";
import {
  getPersonCombinedCredits,
  getPersonDetails,
  getPersonExternalIds,
  type TMDBPersonCombinedCreditsResponse,
  type TMDBPersonCredit,
  type TMDBPersonDetails,
  type TMDBPersonExternalIds,
} from "@/lib/tmdb";
import { slugify } from "@/lib/seo";
import type { TMDBPersonSearchResult } from "@/types";

export type CrewRoleKey =
  | "actor"
  | "director"
  | "writer"
  | "producer"
  | "music"
  | "cinematographer"
  | "editor"
  | "other";

export type CrewMediaFilter = "all" | "movie" | "tv";
export type CrewSortKey = "newest" | "oldest" | "rating" | "popularity";

export type CrewExternalLink = {
  label: string;
  url: string;
};

export type CrewWorkCardData = {
  id: number;
  mediaType: "movie" | "tv";
  title: string;
  year: number | null;
  yearLabel: string;
  releaseDate: string | null;
  posterUrl: string | null;
  overview: string | null;
  rating: number | null;
  popularity: number | null;
  jobs: string[];
  characters: string[];
  href: string;
};

export type CrewRoleSection = {
  key: CrewRoleKey;
  label: string;
  description: string;
  items: CrewWorkCardData[];
};

export type CrewProfile = {
  id: number;
  name: string;
  slug: string;
  href: string;
  biography: string;
  birthday: string | null;
  deathday: string | null;
  placeOfBirth: string | null;
  knownDepartment: string | null;
  popularity: number | null;
  profileImageUrl: string | null;
  externalLinks: CrewExternalLink[];
  sections: CrewRoleSection[];
  availableRoleFilters: CrewRoleKey[];
};

const ROLE_CONFIG: Array<{ key: CrewRoleKey; label: string; description: string }> = [
  { key: "actor", label: "As Actor", description: "Acting credits and character work." },
  { key: "director", label: "As Director", description: "Directed films and series." },
  { key: "writer", label: "As Writer", description: "Screenplay, story, teleplay, and creator work." },
  { key: "producer", label: "As Producer", description: "Producer and executive producer credits." },
  { key: "music", label: "As Music / Singer / Composer", description: "Music, songs, and composer work." },
  {
    key: "cinematographer",
    label: "As Cinematographer",
    description: "Director of photography and cinematography credits.",
  },
  { key: "editor", label: "As Editor", description: "Editing and post-production credits." },
  { key: "other", label: "Other Crew", description: "Remaining departments and crew work." },
];

const WRITER_JOBS = [
  "screenplay",
  "writer",
  "written by",
  "story",
  "teleplay",
  "creator",
  "created by",
  "adaptation",
  "novel",
  "characters",
];

const PRODUCER_JOBS = [
  "producer",
  "executive producer",
  "co-producer",
  "coproducer",
  "associate producer",
  "line producer",
  "supervising producer",
  "consulting producer",
];

const MUSIC_JOBS = [
  "original music composer",
  "music",
  "composer",
  "music director",
  "playback singer",
  "singer",
  "songs",
  "vocals",
  "lyricist",
  "theme song",
  "score",
];

const CINEMATOGRAPHY_JOBS = ["director of photography", "cinematographer", "cinematography", "photography"];
const EDITOR_JOBS = ["editor", "editing"];

function normalizeValue(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function getYear(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})/);
  if (!match) return null;
  const year = Number(match[1]);
  return Number.isFinite(year) ? year : null;
}

function getYearLabel(value: string | null | undefined): string {
  const year = getYear(value);
  return year ? String(year) : "Unknown Year";
}

function getDisplayTitle(credit: TMDBPersonCredit): string {
  return credit.title || credit.name || "Untitled";
}

function getReleaseDate(credit: TMDBPersonCredit): string | null {
  return credit.release_date || credit.first_air_date || null;
}

function dedupeStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  values.forEach((value) => {
    const trimmed = (value || "").trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(trimmed);
  });

  return result;
}

function resolveRoleCategory(credit: TMDBPersonCredit, isCast: boolean): CrewRoleKey {
  if (isCast) {
    return "actor";
  }

  const job = normalizeValue(credit.job);
  const department = normalizeValue(credit.department);

  if (CINEMATOGRAPHY_JOBS.some((token) => job.includes(token)) || department.includes("camera")) {
    return "cinematographer";
  }

  if (EDITOR_JOBS.some((token) => job.includes(token)) || department.includes("editing")) {
    return "editor";
  }

  if (WRITER_JOBS.some((token) => job.includes(token)) || department.includes("writing")) {
    return "writer";
  }

  if (PRODUCER_JOBS.some((token) => job.includes(token)) || department.includes("production")) {
    return "producer";
  }

  if (MUSIC_JOBS.some((token) => job.includes(token)) || department.includes("sound") || department.includes("music")) {
    return "music";
  }

  if (job.includes("director") || department.includes("directing")) {
    return "director";
  }

  return "other";
}

function buildWorkHref(credit: TMDBPersonCredit): string {
  return credit.media_type === "tv" ? `/tv/${credit.id}` : `/movie/${credit.id}`;
}

type MutableWorkCard = CrewWorkCardData & {
  jobSet: Set<string>;
  characterSet: Set<string>;
};

function createWorkCard(credit: TMDBPersonCredit): MutableWorkCard | null {
  const mediaType = credit.media_type;
  if (mediaType !== "movie" && mediaType !== "tv") {
    return null;
  }

  const releaseDate = getReleaseDate(credit);

  return {
    id: credit.id,
    mediaType,
    title: getDisplayTitle(credit),
    year: getYear(releaseDate),
    yearLabel: getYearLabel(releaseDate),
    releaseDate,
    posterUrl: getTmdbPosterUrl(credit.poster_path || null, "w500"),
    overview: credit.overview || null,
    rating: typeof credit.vote_average === "number" ? credit.vote_average : null,
    popularity: typeof credit.popularity === "number" ? credit.popularity : null,
    jobs: [],
    characters: [],
    href: buildWorkHref(credit),
    jobSet: new Set<string>(),
    characterSet: new Set<string>(),
  };
}

function pushWorkMeta(target: MutableWorkCard, credit: TMDBPersonCredit, isCast: boolean) {
  if (isCast) {
    dedupeStrings([credit.character]).forEach((character) => {
      if (target.characterSet.has(character.toLowerCase())) return;
      target.characterSet.add(character.toLowerCase());
      target.characters.push(character);
    });

    if (!target.jobSet.has("actor")) {
      target.jobSet.add("actor");
      target.jobs.push("Actor");
    }
    return;
  }

  dedupeStrings([credit.job, credit.department]).forEach((job) => {
    const key = job.toLowerCase();
    if (target.jobSet.has(key)) return;
    target.jobSet.add(key);
    target.jobs.push(job);
  });
}

function compareNewest(a: CrewWorkCardData, b: CrewWorkCardData): number {
  const aTime = a.releaseDate ? Date.parse(a.releaseDate) : Number.NEGATIVE_INFINITY;
  const bTime = b.releaseDate ? Date.parse(b.releaseDate) : Number.NEGATIVE_INFINITY;
  if (aTime !== bTime) return bTime - aTime;
  return (b.popularity || 0) - (a.popularity || 0);
}

function compareOldest(a: CrewWorkCardData, b: CrewWorkCardData): number {
  const aTime = a.releaseDate ? Date.parse(a.releaseDate) : Number.POSITIVE_INFINITY;
  const bTime = b.releaseDate ? Date.parse(b.releaseDate) : Number.POSITIVE_INFINITY;
  if (aTime !== bTime) return aTime - bTime;
  return a.title.localeCompare(b.title);
}

export function sortCrewItems(items: CrewWorkCardData[], sort: CrewSortKey): CrewWorkCardData[] {
  const list = [...items];

  if (sort === "oldest") {
    return list.sort(compareOldest);
  }

  if (sort === "rating") {
    return list.sort((a, b) => {
      const ratingDiff = (b.rating || 0) - (a.rating || 0);
      if (ratingDiff !== 0) return ratingDiff;
      return compareNewest(a, b);
    });
  }

  if (sort === "popularity") {
    return list.sort((a, b) => {
      const popularityDiff = (b.popularity || 0) - (a.popularity || 0);
      if (popularityDiff !== 0) return popularityDiff;
      return compareNewest(a, b);
    });
  }

  return list.sort(compareNewest);
}

export function filterCrewItems(
  items: CrewWorkCardData[],
  mediaFilter: CrewMediaFilter
): CrewWorkCardData[] {
  if (mediaFilter === "all") {
    return items;
  }

  return items.filter((item) => item.mediaType === mediaFilter);
}

export function buildCrewSlug(name: string): string {
  return slugify(name) || "person";
}

export function buildCrewPath(person: Pick<TMDBPersonSearchResult, "id" | "name">): string {
  return `/crew/${person.id}-${buildCrewSlug(person.name)}`;
}

export function parseCrewRouteParam(param: string): { id: number; slug: string } | null {
  const cleaned = decodeURIComponent(param).trim();
  const match = cleaned.match(/^(\d+)(?:-(.+))?$/);
  if (!match) {
    return null;
  }

  const id = Number(match[1]);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  return {
    id,
    slug: match[2] || "",
  };
}

export function getCrewKnownWorks(person: Pick<TMDBPersonSearchResult, "known_for">, limit: number = 3): string[] {
  return dedupeStrings(
    (person.known_for || [])
      .slice(0, limit)
      .map((work) => work.title || work.name || "")
  );
}

export function formatCrewPopularity(value: number | null | undefined): string | null {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  return value.toFixed(value >= 100 ? 0 : 1);
}

export function buildCrewExternalLinks(externalIds: TMDBPersonExternalIds | null): CrewExternalLink[] {
  if (!externalIds) return [];

  return [
    externalIds.imdb_id ? { label: "IMDb", url: `https://www.imdb.com/name/${externalIds.imdb_id}` } : null,
    externalIds.instagram_id ? { label: "Instagram", url: `https://www.instagram.com/${externalIds.instagram_id}` } : null,
    externalIds.twitter_id ? { label: "X", url: `https://x.com/${externalIds.twitter_id}` } : null,
    externalIds.facebook_id ? { label: "Facebook", url: `https://www.facebook.com/${externalIds.facebook_id}` } : null,
    externalIds.youtube_id ? { label: "YouTube", url: `https://www.youtube.com/${externalIds.youtube_id}` } : null,
    externalIds.tiktok_id ? { label: "TikTok", url: `https://www.tiktok.com/@${externalIds.tiktok_id}` } : null,
    externalIds.wikidata_id ? { label: "Wikidata", url: `https://www.wikidata.org/wiki/${externalIds.wikidata_id}` } : null,
  ].filter((link): link is CrewExternalLink => Boolean(link));
}

function buildSections(credits: TMDBPersonCombinedCreditsResponse | null): CrewRoleSection[] {
  const buckets = new Map<CrewRoleKey, Map<string, MutableWorkCard>>();

  ROLE_CONFIG.forEach(({ key }) => {
    buckets.set(key, new Map<string, MutableWorkCard>());
  });

  const addCredit = (credit: TMDBPersonCredit, isCast: boolean) => {
    const item = createWorkCard(credit);
    if (!item) return;

    const category = resolveRoleCategory(credit, isCast);
    const categoryBucket = buckets.get(category);
    if (!categoryBucket) return;

    const identityKey = `${item.mediaType}:${item.id}`;
    const existing = categoryBucket.get(identityKey) || item;

    pushWorkMeta(existing, credit, isCast);
    categoryBucket.set(identityKey, existing);
  };

  (credits?.cast || []).forEach((credit) => addCredit(credit, true));
  (credits?.crew || []).forEach((credit) => addCredit(credit, false));

  return ROLE_CONFIG.map(({ key, label, description }) => ({
    key,
    label,
    description,
    items: Array.from(buckets.get(key)?.values() || []).map((item) => ({
      id: item.id,
      mediaType: item.mediaType,
      title: item.title,
      year: item.year,
      yearLabel: item.yearLabel,
      releaseDate: item.releaseDate,
      posterUrl: item.posterUrl,
      overview: item.overview,
      rating: item.rating,
      popularity: item.popularity,
      jobs: item.jobs,
      characters: item.characters,
      href: item.href,
    })),
  })).filter((section) => section.items.length > 0);
}

function getKnownDepartment(details: TMDBPersonDetails | null, sections: CrewRoleSection[]): string | null {
  if (details?.known_for_department) {
    return details.known_for_department;
  }

  const firstSection = sections[0];
  return firstSection ? firstSection.label.replace(/^As\s+/i, "") : null;
}

export async function getCrewProfile(personId: number): Promise<CrewProfile | null> {
  const [details, credits, externalIds] = await Promise.all([
    getPersonDetails(personId),
    getPersonCombinedCredits(personId),
    getPersonExternalIds(personId),
  ]);

  if (!details) {
    return null;
  }

  const sections = buildSections(credits);

  return {
    id: details.id,
    name: details.name,
    slug: buildCrewSlug(details.name),
    href: buildCrewPath({ id: details.id, name: details.name }),
    biography: details.biography || "",
    birthday: details.birthday || null,
    deathday: details.deathday || null,
    placeOfBirth: details.place_of_birth || null,
    knownDepartment: getKnownDepartment(details, sections),
    popularity: typeof details.popularity === "number" ? details.popularity : null,
    profileImageUrl: getTmdbImageUrl(details.profile_path || null, "w500"),
    externalLinks: buildCrewExternalLinks(externalIds),
    sections,
    availableRoleFilters: sections.map((section) => section.key),
  };
}

