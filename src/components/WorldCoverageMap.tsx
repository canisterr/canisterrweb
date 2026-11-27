"use client";

import { useMemo } from "react";
import type { StatDistributionItem } from "@/lib/profile";
import { getCountryCode } from "@/lib/passport";
import { WORLD_COUNTRIES } from "@/lib/world-map-data";
import { INDIA_KASHMIR_OVERLAY } from "@/lib/india-kashmir-overlay";
import CountryFlag from "@/components/passport/CountryFlag";

interface WorldCoverageMapProps {
  countries: Array<StatDistributionItem & { code?: string | null }>;
  onCountryClick?: (name: string) => void;
}

function colorForCount(count: number) {
  if (count >= 50) return "#ffab61";
  if (count >= 25) return "#ee8736";
  if (count >= 10) return "#d76b28";
  if (count >= 5) return "#ad5528";
  if (count >= 3) return "#874626";
  if (count >= 1) return "#633d2a";
  return "#252522";
}

export default function WorldCoverageMap({ countries, onCountryClick }: WorldCoverageMapProps) {
  const watchedByCode = useMemo(() => new Map(countries.map((country) => [country.code || getCountryCode(country.label), country])), [countries]);

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0f0f0f]">
      <div className="bg-[#111110]">
        <svg viewBox="0 0 1000 480" className="pointer-events-none block h-auto w-full" role="img" aria-label="World map colored by watched films per country">
          <g stroke="#10100f" strokeWidth="0.65" strokeLinejoin="round">
            {WORLD_COUNTRIES.map((shape) => {
              const watched = watchedByCode.get(shape.code);
              return (
                <path
                  key={`${shape.code}-${shape.name}`}
                  d={shape.path}
                  fill={colorForCount(watched?.count || 0)}
                  fillRule="evenodd"
                />
              );
            })}
          </g>
          <g aria-label="Kashmir shown with India">
            {INDIA_KASHMIR_OVERLAY.map((area) => {
              const india = watchedByCode.get("IN");
              const fill = colorForCount(india?.count || 0);
              return (
                <path
                  key={area.name}
                  d={area.path}
                  fill={fill}
                  fillRule="evenodd"
                  stroke={fill}
                  strokeWidth={1.2}
                />
              );
            })}
          </g>
          {WORLD_COUNTRIES.filter((shape) => shape.small && watchedByCode.has(shape.code)).map((shape) => (
            <circle
              key={`pin-${shape.code}-${shape.name}`}
              cx={shape.x}
              cy={shape.y}
              r={5}
              fill="#ff9b52"
              stroke="#17110d"
              strokeWidth={2}
            />
          ))}
        </svg>
      </div>

      <div className="divide-y divide-white/10 border-t border-white/10 md:hidden">
        {countries.length ? countries.map((country) => (
          <button key={country.code || country.label} type="button" onClick={() => onCountryClick?.(country.label)} className="flex w-full min-w-0 items-center gap-3 px-4 py-4 text-left transition hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-2 focus-visible:outline-[#ff7a1a]">
            <CountryFlag code={country.code || getCountryCode(country.label)} className="h-8 w-11 rounded-sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-[#f5f0de]">{country.label}</span>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-[#ff7a1a]" style={{ width: `${Math.max(4, country.percentage)}%` }} /></span>
            </span>
            <span className="shrink-0 text-right"><span className="block text-lg font-black text-[#f5f0de]">{country.count}</span><span className="block text-[10px] uppercase tracking-wider text-white/40">films</span></span>
          </button>
        )) : <p className="px-4 py-8 text-center text-sm text-white/45">Log a film to explore its country.</p>}
      </div>

    </div>
  );
}
