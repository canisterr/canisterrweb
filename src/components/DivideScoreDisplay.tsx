import { calculateDivideScore, type RatingCounts } from "@/lib/divide-score";

export default function DivideScoreDisplay({ counts }: { counts: RatingCounts }) {
  const result = calculateDivideScore(counts);
  const verdicts = [
    { label: "Bad", count: counts.bad, className: "text-rose-300" },
    { label: "Average", count: counts.average, className: "text-amber-200" },
    { label: "Good", count: counts.good, className: "text-[#f5f0de]" },
    { label: "Masterpiece", count: counts.masterpiece, className: "text-[#ff9b52]" },
  ];
  const verdict = verdicts.reduce((best, current) => current.count >= best.count ? current : best, verdicts[0]);

  return (
    <div className="mt-5 flex items-center justify-between gap-4 border-t border-white/10 pt-4 text-left">
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">Verdict</p>
        <p className={`mt-1 truncate text-base font-bold ${result ? verdict.className : "text-white/40"}`}>
          {result ? verdict.label : "No ratings yet"}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <div className="text-right">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/40">Divide score</p>
          <p className="mt-1 text-xl font-black leading-none text-[#f5f0de]">
            {result ? result.score : "—"}<span className="ml-0.5 text-[10px] font-semibold text-white/35">/100</span>
          </p>
        </div>
        <details className="group relative">
          <summary aria-label="About Divide Score" className="flex h-6 w-6 cursor-pointer list-none items-center justify-center rounded-full border border-white/20 text-[11px] font-bold text-white/55 transition hover:border-[#ff9b52]/60 hover:text-[#ffb36b] [&::-webkit-details-marker]:hidden">i</summary>
          <p className="absolute right-0 top-8 z-20 w-52 rounded-lg border border-white/10 bg-[#171717] p-3 text-left text-xs leading-5 text-white/75 shadow-xl">
            How much viewers disagree. Not a quality rating.
          </p>
        </details>
      </div>
    </div>
  );
}
