'use client';

interface ReactionDistributionBarProps {
  badCount: number;
  averageCount: number;
  goodCount: number;
  masterpieceCount: number;
  showLabels?: boolean;
  theme?: "dark" | "light";
  onSegmentClick?: (segment: "bad" | "average" | "good" | "masterpiece") => void;
}

export default function ReactionDistributionBar({
  badCount,
  averageCount,
  goodCount,
  masterpieceCount,
  showLabels = true,
  theme = "dark",
  onSegmentClick,
}: ReactionDistributionBarProps) {
  const total = badCount + averageCount + goodCount + masterpieceCount;
  const badPercent = total > 0 ? (badCount / total) * 100 : 0;
  const averagePercent = total > 0 ? (averageCount / total) * 100 : 0;
  const goodPercent = total > 0 ? (goodCount / total) * 100 : 0;
  const masterpiecePercent = total > 0 ? (masterpieceCount / total) * 100 : 0;

  if (total === 0) {
    return (
      <div className={`flex items-center justify-center px-4 py-5 ${theme === "light" ? "border border-black/10 bg-black/5" : "border border-white/8 bg-black/20"}`}>
        <span className={`text-sm ${theme === "light" ? "text-black/45" : "text-white/40"}`}>No reactions yet</span>
      </div>
    );
  }

  const segments = [
    { name: "Bad", key: "bad" as const, count: badCount, percent: badPercent, color: "#fb7185" },
    { name: "Average", key: "average" as const, count: averageCount, percent: averagePercent, color: "#facc15" },
    { name: "Good", key: "good" as const, count: goodCount, percent: goodPercent, color: "#4ade80" },
    { name: "Masterpiece", key: "masterpiece" as const, count: masterpieceCount, percent: masterpiecePercent, color: "#ff7a1a" },
  ];

  return (
    <div className="space-y-4">
      <div className={`overflow-hidden rounded-full ${theme === "light" ? "bg-black/10 ring-1 ring-inset ring-black/8" : "bg-white/[0.06] ring-1 ring-inset ring-white/[0.07]"}`}>
        <div className="flex h-3 w-full">
          {segments.map((segment) => (
            onSegmentClick ? (
              <button
                key={segment.name}
                type="button"
                className="h-full transition-all"
                style={{
                  width: `${Math.max(segment.percent, 3)}%`,
                  backgroundColor: segment.color,
                }}
                onClick={() => onSegmentClick(segment.key)}
                aria-label={`${segment.name} ${segment.percent.toFixed(1)} percent`}
              />
            ) : (
              <div
                key={segment.name}
                className="h-full transition-all"
                style={{
                  width: `${Math.max(segment.percent, 3)}%`,
                  backgroundColor: segment.color,
                }}
              />
            )
          ))}
        </div>
      </div>
      {showLabels && (
        <div className="flex flex-wrap gap-x-6 gap-y-3 text-sm">
          {segments.map((segment) => (
            onSegmentClick ? (
              <button key={segment.name} type="button" className="flex items-center gap-2 text-left" onClick={() => onSegmentClick(segment.key)}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                <span className={theme === "light" ? "text-black/70" : "text-white/65"}>{segment.name}</span>
                <span className={theme === "light" ? "font-semibold text-black" : "font-semibold text-[#f5f0de]"}>{segment.percent.toFixed(1)}%</span>
              </button>
            ) : (
              <div key={segment.name} className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: segment.color }} />
                <span className={theme === "light" ? "text-black/70" : "text-white/65"}>{segment.name}</span>
                <span className={theme === "light" ? "font-semibold text-black" : "font-semibold text-[#f5f0de]"}>{segment.percent.toFixed(1)}%</span>
              </div>
            )
          ))}
        </div>
      )}
    </div>
  );
}
