import { GENRE_MAP } from "@/lib/tmdb";
import type { DiscoverShelfQuery, SectionMood, ShelfDefinition, StoreSectionConfig } from "@/types/store";

const GENRE_LABELS: Record<string, string> = {
  action: "Action",
  adventure: "Adventure",
  animation: "Animation",
  comedy: "Comedy",
  crime: "Crime",
  documentary: "Documentary",
  drama: "Drama",
  family: "Family",
  fantasy: "Fantasy",
  history: "History",
  horror: "Horror",
  music: "Music",
  mystery: "Mystery",
  romance: "Romance",
  scifi: "Science Fiction",
  thriller: "Thriller",
  war: "War",
  western: "Western",
};

/** Per-genre atmosphere per the "coherent whole, subtle mood shifts" brief — not theme-park swings. */
const GENRE_MOODS: Record<string, SectionMood> = {
  horror: "dark",
  scifi: "cool",
  romance: "warm",
  animation: "vibrant",
  documentary: "vintage",
  western: "vintage",
  history: "vintage",
};

const CURRENT_YEAR = new Date().getFullYear();
const RECENT_QUALITY_VOTE_COUNT = 150;

function buildGenreShelves(genreId: number): ShelfDefinition[] {
  // Kept to two shelves per genre wall — decade/classics browsing already lives in the
  // Collections "Through the Decades" area, so genre aisles stay a fast, non-overlapping sampler.
  return [
    {
      id: `popular`,
      label: "Popular",
      query: {
        kind: "discover",
        with_genres: [genreId],
        sort_by: "popularity.desc",
        voteCountGte: RECENT_QUALITY_VOTE_COUNT,
      } satisfies DiscoverShelfQuery,
    },
    {
      id: `top-rated`,
      label: "Top Rated",
      query: {
        kind: "discover",
        with_genres: [genreId],
        sort_by: "vote_average.desc",
        voteCountGte: 800,
      } satisfies DiscoverShelfQuery,
    },
  ];
}

/** The Main Genre Hall: one section per TMDB genre, data-driven from GENRE_MAP — never manually placed. */
export const GENRE_SECTIONS: StoreSectionConfig[] = Object.entries(GENRE_MAP).map(([key, genreId]) => ({
  id: `genre-${key}`,
  kind: "genre",
  label: GENRE_LABELS[key] || key,
  signage: (GENRE_LABELS[key] || key).toUpperCase(),
  mood: GENRE_MOODS[key] || "neutral",
  shelves: buildGenreShelves(genreId),
}));

function decadeShelf(label: string, startYear: number, endYear: number): ShelfDefinition {
  return {
    id: `decade-${startYear}`,
    label,
    query: {
      kind: "discover",
      sort_by: "popularity.desc",
      releaseDateGte: `${startYear}-01-01`,
      releaseDateLte: `${endYear}-12-31`,
      voteCountGte: 150,
    } satisfies DiscoverShelfQuery,
  };
}

/** Edit this list to hand-curate the Staff Picks shelf. Safe to leave empty. */
const STAFF_PICK_MOVIE_IDS: number[] = [];

/**
 * Collections area. Subjective moods (Date Night, Mind-Bending, Feel Good,
 * Late Night, Cult Classics) are documented heuristic blends — a genuinely
 * clean seam to swap in real editorial curation or Canisterr community data
 * later without touching any rendering code.
 */
export const COLLECTION_SECTIONS: StoreSectionConfig[] = [
  {
    id: "collection-spotlight",
    kind: "collection",
    label: "Trending & Popular",
    signage: "TRENDING",
    mood: "vibrant",
    shelves: [
      { id: "trending", label: "Trending This Week", query: { kind: "catalog", source: "trending_week" } },
      { id: "popular-now", label: "Popular Now", query: { kind: "catalog", source: "popular" } },
      {
        id: "new-releases",
        label: "New Releases",
        query: {
          kind: "discover",
          sort_by: "primary_release_date.desc",
          releaseDateGte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          releaseDateLte: new Date().toISOString().slice(0, 10),
          voteCountGte: 10,
        },
      },
    ],
  },
  {
    id: "collection-acclaimed",
    kind: "collection",
    label: "Acclaimed",
    signage: "TOP RATED",
    mood: "neutral",
    shelves: [
      {
        id: "top-rated",
        label: "Top Rated",
        query: { kind: "discover", sort_by: "vote_average.desc", voteCountGte: 3000 },
      },
      {
        id: "cult-classics",
        label: "Cult Classics",
        query: {
          kind: "discover",
          sort_by: "vote_average.desc",
          voteAverageGte: 7.2,
          voteCountGte: 2000,
          releaseDateLte: "2010-12-31",
        },
      },
    ],
  },
  {
    id: "collection-decades",
    kind: "collection",
    label: "Through the Decades",
    signage: "DECADES",
    mood: "vintage",
    shelves: [
      decadeShelf("80s", 1980, 1989),
      decadeShelf("90s", 1990, 1999),
      decadeShelf("2000s", 2000, 2009),
      decadeShelf("2010s", 2010, 2019),
      decadeShelf("2020s", 2020, CURRENT_YEAR),
    ],
  },
  {
    id: "collection-moods",
    kind: "collection",
    label: "Set the Mood",
    signage: "MOODS",
    mood: "warm",
    shelves: [
      {
        id: "date-night",
        label: "Date Night",
        query: {
          kind: "discover",
          with_genres: [GENRE_MAP.romance, GENRE_MAP.comedy],
          genreLogic: "or",
          sort_by: "popularity.desc",
          voteAverageGte: 6.5,
          voteCountGte: 300,
        },
      },
      {
        id: "feel-good",
        label: "Feel Good",
        query: {
          kind: "discover",
          with_genres: [GENRE_MAP.comedy, GENRE_MAP.family, GENRE_MAP.animation],
          genreLogic: "or",
          sort_by: "popularity.desc",
          voteAverageGte: 6.5,
          voteCountGte: 300,
        },
      },
      {
        id: "late-night",
        label: "Late Night",
        query: {
          kind: "discover",
          with_genres: [GENRE_MAP.horror, GENRE_MAP.thriller],
          genreLogic: "or",
          sort_by: "popularity.desc",
          voteCountGte: 200,
        },
      },
      {
        id: "mind-bending",
        label: "Mind-Bending",
        query: {
          kind: "discover",
          with_genres: [GENRE_MAP.scifi, GENRE_MAP.mystery, GENRE_MAP.thriller],
          genreLogic: "or",
          sort_by: "vote_average.desc",
          voteAverageGte: 7,
          voteCountGte: 500,
        },
      },
      {
        id: "under-2-hours",
        label: "Under 2 Hours",
        query: {
          kind: "discover",
          sort_by: "vote_average.desc",
          runtimeLte: 120,
          voteAverageGte: 6.5,
          voteCountGte: 500,
        },
      },
    ],
  },
  {
    id: "collection-staff-picks",
    kind: "collection",
    label: "Canisterr Staff Picks",
    signage: "STAFF PICKS",
    mood: "neutral",
    shelves: [
      {
        id: "staff-picks",
        label: "Staff Picks",
        // Empty by default — an editable, empty-safe seam for manual curation.
        query: { kind: "static", ids: STAFF_PICK_MOVIE_IDS },
      },
    ],
  },
];

export const STORE_SECTIONS: StoreSectionConfig[] = [...COLLECTION_SECTIONS, ...GENRE_SECTIONS];

export function findSectionById(sectionId: string): StoreSectionConfig | undefined {
  return STORE_SECTIONS.find((section) => section.id === sectionId);
}
