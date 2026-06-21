"use client";

import Link from "next/link";
import { normalizeCinePostContentId } from "@/lib/cineposts";
import { ListItemWithContent } from "@/types";
import { buildMoviePath, buildTvPath } from "@/lib/content-slugs";

type CinePostListStripProps = {
  items: ListItemWithContent[];
  theme?: "default" | "brutalist";
  className?: string;
};

function getContentHref(item: ListItemWithContent): string | null {
  const contentId = normalizeCinePostContentId(item.content.id);
  if (!contentId) return null;

  return item.content.type === "tv"
    ? buildTvPath({
        id: contentId,
        title: item.content.title || item.content.name || "Untitled",
        name: item.content.title || item.content.name || "Untitled",
        premiered: (item.content as any).premiered || item.content.release_date || undefined,
        release_date: item.content.release_date || undefined,
        language: item.content.language || (item.content as any).original_language || undefined,
        network: (item.content as any).network || undefined,
      })
    : buildMoviePath({
        id: contentId,
        title: item.content.title || "Untitled",
        director: item.content.director || null,
        release_date: item.content.release_date || null,
        language: item.content.language || undefined,
      });
}

export default function CinePostListStrip({
  items,
  theme = "default",
  className = "",
}: CinePostListStripProps) {
  const isBrutalist = theme === "brutalist";
  const visibleItems = items.slice(0, 8);

  if (visibleItems.length === 0) return null;

  return (
    <div className={`overflow-x-auto pb-1 ${className}`}>
      <div className="flex gap-2 pr-1">
        {visibleItems.map((item) => {
          const poster = item.content.poster_url;
          const itemTitle = item.content.title || (item.content as { name?: string }).name || "Untitled";
          const contentHref = getContentHref(item);

          const card = (
            <div
              className={`relative overflow-hidden border shadow-sm ${
                isBrutalist
                  ? "border-white/10 bg-[#0d0d0d]"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="relative aspect-[2/3] overflow-hidden bg-[#1a1a1a]">
                {poster ? (
                  <img
                    src={poster}
                    alt={itemTitle}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#1a1a1a] text-xs text-white/35">
                    No poster
                  </div>
                )}
              </div>
            </div>
          );

          if (!contentHref) {
            return (
              <div key={item.id} className="group shrink-0 w-[5.5rem] sm:w-[6.25rem]">
                {card}
              </div>
            );
          }

          return (
            <Link key={item.id} href={contentHref} className="group shrink-0 w-[5.5rem] sm:w-[6.25rem]">
              <div
                className={`relative overflow-hidden border shadow-sm ${
                  isBrutalist
                    ? "border-white/10 bg-[#0d0d0d]"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="relative aspect-[2/3] overflow-hidden bg-[#1a1a1a]">
                  {poster ? (
                    <img
                      src={poster}
                      alt={itemTitle}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[#1a1a1a] text-xs text-white/35">
                      No poster
                    </div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
