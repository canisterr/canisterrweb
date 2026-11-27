import Link from "next/link";
import { Link2 } from "lucide-react";

const games = [
  { name: "Reveal", href: "/games/reveal", mark: "?" },
  { name: "Connection", href: "/games/connection", mark: "link" },
  { name: "Cinema Grid", href: "/games/grid", mark: "grid" },
] as const;

export default function HomeGamesStrip() {
  return (
    <section className="mb-7" aria-labelledby="home-games-heading">
      <h2 id="home-games-heading" className="mb-3 text-base font-black tracking-[-0.04em] text-[#f5f0de] sm:text-lg">Games</h2>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {games.map((game) => (
          <Link
            key={game.name}
            href={game.href}
            aria-label={`Play ${game.name}`}
            className="group flex min-h-[82px] items-center justify-center gap-2 rounded-xl border border-white/15 bg-[#12110f] px-2 py-3 text-[#f5f0de] transition-colors hover:border-[#d46b35]/70 hover:bg-[#171512] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d46b35] sm:min-h-[94px] sm:gap-3 sm:px-4"
          >
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
