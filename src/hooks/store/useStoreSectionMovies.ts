"use client";

import { useEffect, useState } from "react";
import { fetchShelfMovies, pageForRefreshSeed } from "@/lib/store/discover";
import { useStoreScene } from "@/lib/store/store-state";
import { QUALITY_PRESETS } from "@/lib/store/quality";
import type { PersonalizedSectionConfig, StoreMovieSummary, StoreSectionConfig } from "@/types/store";

export interface ResolvedShelf {
  id: string;
  label: string;
  movies: StoreMovieSummary[];
}

export interface ResolvedSection {
  shelves: ResolvedShelf[];
  loading: boolean;
  /** True only for personalized sections when there's no signed-in user. */
  requiresSignIn: boolean;
}

const EMPTY: ResolvedSection = { shelves: [], loading: false, requiresSignIn: false };

function isPersonalized(
  section: StoreSectionConfig | PersonalizedSectionConfig
): section is PersonalizedSectionConfig {
  return "fetch" in section;
}

/**
 * Resolves the movies for one store section. Only fetches while `active`
 * (proximity-gated by the caller) — this is the seam that keeps the store
 * from loading its entire catalogue up front.
 */
export function useStoreSectionMovies(
  section: StoreSectionConfig | PersonalizedSectionConfig,
  userId: string | null,
  active: boolean
): ResolvedSection {
  const [state, setState] = useState<ResolvedSection>(EMPTY);
  const maxShelfItems = useStoreScene((s) => QUALITY_PRESETS[s.qualityTier].maxShelfItems);
  const refreshSeed = useStoreScene((s) => s.shelfRefreshSeed);

  useEffect(() => {
    if (!active) return;

    if (isPersonalized(section)) {
      if (!userId) {
        setState({ shelves: [], loading: false, requiresSignIn: true });
        return;
      }

      let cancelled = false;
      setState((prev) => ({ ...prev, loading: true, requiresSignIn: false }));
      section
        .fetch(userId)
        .then((movies) => {
          if (cancelled) return;
          setState({ shelves: [{ id: section.id, label: section.label, movies }], loading: false, requiresSignIn: false });
        })
        .catch((error) => {
          console.error(`Store personalized section "${section.id}" error:`, error);
          if (!cancelled) setState({ shelves: [], loading: false, requiresSignIn: false });
        });
      return () => {
        cancelled = true;
      };
    }

    let cancelled = false;
    const page = pageForRefreshSeed(refreshSeed);
    setState((prev) => ({ ...prev, loading: true, requiresSignIn: false }));
    Promise.all(
      section.shelves.map(async (shelf) => ({
        id: shelf.id,
        label: shelf.label,
        movies: await fetchShelfMovies(`${section.id}:${shelf.id}`, shelf.query, maxShelfItems, page),
      }))
    )
      .then((shelves) => {
        if (!cancelled) setState({ shelves, loading: false, requiresSignIn: false });
      })
      .catch((error) => {
        console.error(`Store section "${section.id}" error:`, error);
        if (!cancelled) setState({ shelves: [], loading: false, requiresSignIn: false });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id, userId, active, refreshSeed]);

  return state;
}
