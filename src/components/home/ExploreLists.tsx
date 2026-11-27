"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Film } from "lucide-react";
import { auth } from "@/lib/firebase";
import type { List, ListItem } from "@/types";
import { getMovieCardSummary } from "@/lib/tmdb";
import { getShowCardSummary } from "@/lib/tvmaze";

type ListItemWithPoster = ListItem & { poster_url_snapshot?: string | null };
type ExploreList = List & { posters: string[]; titleCount: number };
type AuthorizedListData = {
  lists: Record<string, List>;
  items: Record<string, ListItemWithPoster>;
};

let cachedRequest: { userId: string; promise: Promise<ExploreList[]> } | null = null;

async function loadPublicLists(userId: string): Promise<ExploreList[]> {
  if (cachedRequest?.userId === userId) return cachedRequest.promise;
  const promise = (async () => {
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== userId) return [];
    const token = await currentUser.getIdToken();
    const response = await fetch("/api/lists/access", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const data = await response.json() as AuthorizedListData;
    const itemsByList = new Map<string, ListItemWithPoster[]>();
    Object.values(data.items || {}).forEach((item) => {
      const items = itemsByList.get(item.list_id) || [];
      items.push(item);
      itemsByList.set(item.list_id, items);
    });

    const publicLists = Object.values(data.lists || {})
      .filter((list) => list.privacy === "public")
      .sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at))
      .map((list) => ({ list, items: (itemsByList.get(list.id) || []).sort((a, b) => a.position - b.position) }))
      .filter(({ items }) => items.length > 0)
      .slice(0, 3);

    return Promise.all(publicLists.map(async ({ list, items }) => {
      const itemPosters = await Promise.all(items.slice(0, 3).map(async (item) => {
        if (item.poster_url_snapshot) return item.poster_url_snapshot;
        try {
          const content = item.content_type === "tv"
            ? await getShowCardSummary(item.content_id)
            : await getMovieCardSummary(item.content_id);
          return content?.poster_url || null;
        } catch {
          return null;
        }
      }));
      const posters = list.cover_type === "custom" && list.cover_image_url
        ? [list.cover_image_url, ...itemPosters.filter((poster): poster is string => Boolean(poster))]
        : itemPosters.filter((poster): poster is string => Boolean(poster));
      return { ...list, posters: posters.slice(0, 3), titleCount: items.length };
    }));
  })();
  cachedRequest = { userId, promise };
  try {
    const result = await promise;
    if (cachedRequest?.promise === promise) cachedRequest = null;
    return result;
  } catch {
    if (cachedRequest?.promise === promise) cachedRequest = null;
    return [];
  }
}

export default function ExploreLists({ userId }: { userId: string }) {
  const [lists, setLists] = useState<ExploreList[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const shelfRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    void loadPublicLists(userId).then((result) => {
      if (active) setLists(result);
    });
    return () => { active = false; };
  }, [userId]);

  const updateActiveIndex = useCallback(() => {
    const shelf = shelfRef.current;
    const firstCard = shelf?.firstElementChild as HTMLElement | null;
    if (!shelf || !firstCard) return;
    const gap = Number.parseFloat(getComputedStyle(shelf).columnGap || "0");
    setActiveIndex(Math.min(lists.length - 1, Math.round(shelf.scrollLeft / (firstCard.offsetWidth + gap))));
  }, [lists.length]);

  if (lists.length === 0) return null;

  return (
    <section className="mb-8" aria-labelledby="explore-lists-title">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 id="explore-lists-title" className="mt-1 text-xl font-black tracking-tight text-[#f5f0de] sm:text-2xl">Explore lists</h2>
        </div>
        <Link href="/lists" className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[#ffb36b] transition hover:text-[#ff7a1a] sm:text-sm">See all <ArrowRight className="h-4 w-4" /></Link>
      </div>

      <div
        ref={shelfRef}
        onScroll={updateActiveIndex}
        className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {lists.map((list) => (
          <Link key={list.id} href={`/lists/${list.id}`} prefetch={false} className="group w-[min(84vw,340px)] shrink-0 snap-start overflow-hidden rounded-xl border border-white/10 bg-[#111111] transition hover:border-[#ff7a1a]/50">
            <div className="flex h-28 items-end gap-2 overflow-hidden bg-[#191613] px-3 pt-3 sm:h-32">
              {list.posters.length > 0 ? list.posters.map((poster, index) => (
                <div key={`${list.id}-${index}`} className="relative h-full min-w-0 flex-1 overflow-hidden rounded-t-sm bg-black/50">
                  <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />
                </div>
              )) : (
                <div className="flex h-full w-full items-center justify-center text-[#ff9b52]/60"><Film className="h-7 w-7" /></div>
              )}
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-[#f5f0de] group-hover:text-[#ffb36b]">{list.name}</h3>
                <p className="mt-1 text-xs text-white/50">{list.titleCount} {list.titleCount === 1 ? "title" : "titles"}</p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-white/40 transition group-hover:translate-x-0.5 group-hover:text-[#ff9b52]" />
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-center gap-2" aria-label={`List ${activeIndex + 1} of ${lists.length}`}>
        {lists.map((list, index) => (
          <button
            key={list.id}
            type="button"
            onClick={() => shelfRef.current?.children[index]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" })}
            aria-label={`Show list ${index + 1}: ${list.name}`}
            aria-current={activeIndex === index ? "true" : undefined}
            className={`h-1.5 rounded-full transition-all ${activeIndex === index ? "w-5 bg-[#ff7a1a]" : "w-1.5 bg-white/25 hover:bg-white/50"}`}
          />
        ))}
        <span className="ml-1 text-[10px] tabular-nums text-white/45">{String(activeIndex + 1).padStart(2, "0")} / {String(lists.length).padStart(2, "0")}</span>
      </div>
    </section>
  );
}
