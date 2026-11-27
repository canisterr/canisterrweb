import Link from "next/link";
import Image from "@/components/AppImage";
import { landingPosters } from "@/components/home/landing-data";
import LetterboxdMark from "@/components/LetterboxdMark";

const verdicts = [
  { label: "Bad", color: "#77746e" },
  { label: "Average", color: "#aaa294" },
  { label: "Good", color: "#f5f0de" },
  { label: "Masterpiece", color: "#ff7a1a" },
];

export default function NewUserGuide() {
  return (
    <section className="mb-8 overflow-hidden border-y border-white/10 py-5 sm:py-6" aria-labelledby="new-user-guide-title">
      <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_minmax(250px,0.8fr)] sm:items-center sm:gap-10 lg:gap-14">
        <div className="min-w-0 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#ff9b52]">A film diary with your point of view</p>
          <h2 id="new-user-guide-title" className="mx-auto mt-2 max-w-2xl text-2xl font-bold leading-tight tracking-tight text-[#f5f0de] sm:text-3xl">
            Every watch leaves a mark.
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-white/60 sm:text-base">
            Log what you watched, give it a Canisterr verdict, and build a taste profile that gets more personal over time.
          </p>
        </div>

        <div className="min-w-0">
          <div className="mx-auto flex h-[220px] max-w-[420px] items-center justify-center gap-[3%] px-2">
            <span className="relative aspect-[2/3] w-[26%] max-w-[112px] shrink-0 -rotate-[4deg] overflow-hidden border border-[#f5f0de]/35 bg-[#191919] shadow-xl">
              <Image src={landingPosters.parasite.url} alt="Parasite" fill sizes="(max-width: 640px) 90px, 112px" className="object-contain" />
            </span>
            <span className="relative aspect-[2/3] w-[30%] max-w-[128px] shrink-0 overflow-hidden border border-[#ff7a1a]/80 bg-[#191919] shadow-xl">
              <Image src={landingPosters.interstellar.url} alt="Interstellar" fill sizes="(max-width: 640px) 100px, 128px" className="object-contain" />
            </span>
            <span className="relative aspect-[2/3] w-[26%] max-w-[112px] shrink-0 rotate-[4deg] overflow-hidden border border-[#f5f0de]/35 bg-[#191919] shadow-xl">
              <Image src="https://image.tmdb.org/t/p/w342/anFx9aTOOYqgS3v7x3R84Kz67ly.jpg" alt="Breaking Bad TV series" fill sizes="(max-width: 640px) 90px, 112px" className="object-contain" />
            </span>
          </div>
          <div className="mx-auto mt-4 max-w-[420px]">
            <div className="flex gap-1.5" aria-label="Canisterr verdicts: Bad, Average, Good, Masterpiece">
              {verdicts.map((verdict) => (
                <span key={verdict.label} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: verdict.color }} />
              ))}
            </div>
            <div className="mt-1.5 flex justify-between text-[9px] font-semibold text-white/45 sm:text-[10px]">
              {verdicts.map((verdict) => <span key={verdict.label} style={{ color: verdict.label === "Masterpiece" ? verdict.color : undefined }}>{verdict.label}</span>)}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-2.5">
        <Link href="/logs" className="inline-flex items-center justify-center rounded-full bg-[#ff7a1a] px-5 py-2.5 text-sm font-bold text-[#101010] transition hover:bg-[#ff9142]">Log your first title</Link>
        <Link href="/profile/settings/import" className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2.5 text-sm font-semibold text-[#f5f0de] transition hover:border-[#ff7a1a]/70 hover:bg-white/[0.04]">
          <LetterboxdMark className="h-4 w-10 shrink-0" />
          Import from Letterboxd
        </Link>
      </div>
    </section>
  );
}
