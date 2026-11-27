"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Link2 } from "lucide-react";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import { auth } from "@/lib/firebase";
import { getGuestId, loadDailyGames } from "@/lib/games/client";
import { GAME_CATEGORIES, type GameCategoryId } from "@/lib/games/types";

const games = [
  { name: "Reveal", href: "/games/reveal", kind: "reveal", mark: "?" },
  { name: "Connection", href: "/games/connection", kind: "connection", mark: "link" },
  { name: "Cinema Grid", href: "/games/grid", kind: "grid", mark: "grid" },
] as const;

export default function HomeGamesStrip() {
  const { user, loading } = useCurrentUser();
  const [playedToday, setPlayedToday] = useState<Record<(typeof games)[number]["kind"], boolean>>({
    reveal: false,
    connection: false,
    grid: false,
  });

  useEffect(() => {
    if (loading) return;
    let active = true;

    void (async () => {
      try {
        let category: GameCategoryId = "english";
        try {
          const savedCategory = localStorage.getItem("canisterr.games.category.v2") as GameCategoryId | null;
          if (savedCategory && GAME_CATEGORIES.some((item) => item.id === savedCategory)) category = savedCategory;
        } catch { /* Use the default cinema if storage is unavailable. */ }

        const token = await auth.currentUser?.getIdToken();
        const identity = auth.currentUser?.uid || getGuestId();
        const daily = await loadDailyGames(identity, category, token);
        if (!active) return;

        const todaySessions = daily.sessions?.[category];
        setPlayedToday({
          reveal: Number(todaySessions?.reveal?.attempts) > 0,
          connection: Number(todaySessions?.connection?.attempts) > 0,
          grid: daily.played?.grid === true,
        });
      } catch {
        // Keep the games available if the optional played-state lookup fails.
      }
    })();

    return () => { active = false; };
  }, [loading, user?.id]);

  return (
    <section className="mb-7" aria-labelledby="home-games-heading">
      <h2 id="home-games-heading" className="mb-3 text-base font-black tracking-[-0.04em] text-[#f5f0de] sm:text-lg">Games</h2>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {games.map((game) => (
          <Link
            key={game.name}
            href={game.href}
            prefetch={false}
            aria-label={`${playedToday[game.kind] ? "Played today · " : "Play "}${game.name}`}
            className="group relative flex min-h-[82px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#12110f] px-2 py-3 text-[#f5f0de] transition-colors hover:border-[#d46b35]/70 hover:bg-[#171512] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d46b35] sm:min-h-[94px] sm:gap-3 sm:px-4"
          >
            {playedToday[game.kind] && (
              <span aria-hidden="true" className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300 sm:right-3 sm:top-3">
                <Check className="size-3.5" strokeWidth={3} />
              </span>
            )}
            {game.mark === "?" ? (
              <span aria-hidden="true" className="text-4xl font-black leading-none text-[#d46b35] sm:text-5xl">?</span>
            ) : game.mark === "link" ? (
              <Link2 aria-hidden="true" className="size-8 shrink-0 -rotate-45 text-[#d46b35] sm:size-9" strokeWidth={3} />
            ) : (
              <span aria-hidden="true" className="grid size-8 shrink-0 grid-cols-3 grid-rows-3 gap-[2px] sm:size-9 sm:gap-[3px]">
                {Array.from({ length: 9 }, (_, index) => <i key={index} className={`border border-[#d46b35] ${index === 4 ? "bg-[#d46b35]" : "bg-transparent"}`} />)}
              </span>
            )}
            <span className="text-center text-[11px] font-bold leading-tight sm:text-sm">{game.name}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
