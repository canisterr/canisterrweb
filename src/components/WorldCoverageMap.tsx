"use client";

import { useState } from "react";
import type { StatDistributionItem } from "@/lib/profile";

interface WorldCoverageMapProps {
  countries: StatDistributionItem[];
}

type MarkerPosition = {
  x: number;
  y: number;
};

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "united states",
  "united states of america": "united states",
  uk: "united kingdom",
  uae: "united arab emirates",
  "south korea": "korea south",
  "republic of korea": "korea south",
  "north korea": "korea north",
  "czechia": "czech republic",
};

const COUNTRY_MARKERS: Record<string, MarkerPosition> = {
  argentina: { x: 28, y: 78 },
  australia: { x: 84, y: 76 },
  austria: { x: 54.5, y: 35.5 },
  bangladesh: { x: 72.2, y: 46.2 },
  belgium: { x: 50.8, y: 32.8 },
  brazil: { x: 31.5, y: 64.5 },
  canada: { x: 18.5, y: 22.5 },
  chile: { x: 27.2, y: 78.5 },
  china: { x: 74.5, y: 38.5 },
  "czech republic": { x: 54.3, y: 34.5 },
  denmark: { x: 52.5, y: 28.5 },
  egypt: { x: 56.8, y: 44.8 },
  finland: { x: 57.8, y: 24.2 },
  france: { x: 50.5, y: 35.8 },
  germany: { x: 53, y: 33.2 },
  greece: { x: 56, y: 39.5 },
  "hong kong": { x: 76.8, y: 44.2 },
  india: { x: 68.5, y: 45.5 },
  indonesia: { x: 77.5, y: 57.5 },
  iran: { x: 63.5, y: 41 },
  ireland: { x: 47.5, y: 31.5 },
  italy: { x: 53.8, y: 37.8 },
  japan: { x: 83.5, y: 39.2 },
  "korea south": { x: 80.5, y: 39.2 },
  "korea north": { x: 79.5, y: 36.5 },
  malaysia: { x: 75.2, y: 53 },
  mexico: { x: 17.5, y: 38.8 },
  morocco: { x: 47.2, y: 43.2 },
  netherlands: { x: 51.2, y: 31.5 },
  "new zealand": { x: 91.5, y: 82.5 },
  nigeria: { x: 50.8, y: 50.5 },
  norway: { x: 53.5, y: 23.8 },
  pakistan: { x: 66.2, y: 43.5 },
  philippines: { x: 80.8, y: 52.2 },
  poland: { x: 55.5, y: 32.8 },
  portugal: { x: 46.8, y: 38.8 },
  russia: { x: 68.2, y: 21.8 },
  "saudi arabia": { x: 61.8, y: 46.8 },
  singapore: { x: 75.5, y: 56.2 },
  "south africa": { x: 56.2, y: 73.5 },
  spain: { x: 47.2, y: 38.5 },
  sweden: { x: 55.5, y: 25.5 },
  switzerland: { x: 52.2, y: 35.5 },
  taiwan: { x: 79.2, y: 46.5 },
  thailand: { x: 74.5, y: 49.8 },
  turkey: { x: 58.5, y: 38.8 },
  "united arab emirates": { x: 63.8, y: 48.8 },
  "united kingdom": { x: 48.8, y: 29.8 },
  "united states": { x: 15.5, y: 34.5 },
};

const CONTINENT_PATHS = [
  "M72 112 L118 78 L176 64 L222 76 L258 108 L248 148 L202 164 L146 160 L102 148 Z",
  "M234 184 L266 206 L286 258 L276 330 L252 392 L226 372 L216 312 L220 244 Z",
  "M432 104 L462 84 L504 92 L522 118 L508 146 L468 146 L438 130 Z",
  "M456 162 L500 172 L530 216 L526 292 L492 344 L456 314 L442 250 Z",
  "M516 114 L598 82 L726 96 L830 142 L858 196 L826 232 L744 214 L694 232 L636 210 L582 194 L534 152 Z",
  "M780 286 L828 296 L860 334 L844 370 L796 360 L770 324 Z",
];

function normalizeCountryKey(value: string): string {
  const normalized = value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return COUNTRY_ALIASES[normalized] || normalized;
}

export default function WorldCoverageMap({ countries }: WorldCoverageMapProps) {
  const markers = countries
    .map((country) => {
      const key = normalizeCountryKey(country.label);
      const position = COUNTRY_MARKERS[key];
      if (!position) return null;
      return { ...country, key, position };
    })
    .filter((marker): marker is StatDistributionItem & { key: string; position: MarkerPosition } => Boolean(marker));

  const [activeKey, setActiveKey] = useState<string | null>(markers[0]?.key ?? null);
  const activeMarker = markers.find((marker) => marker.key === activeKey) || markers[0] || null;

  return (
    <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0f0f0f]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/35">World Map Coverage</p>
          <p className="mt-2 text-sm text-white/55">
            {activeMarker ? `${activeMarker.label} has ${activeMarker.count} logged movie${activeMarker.count === 1 ? "" : "s"}.` : "Tap a country dot to see your movie count."}
          </p>
        </div>
        <div className="rounded-full border border-[#ff7a1a]/20 bg-[#ff7a1a]/10 px-3 py-1.5 text-sm font-semibold text-[#ffcf9d]">
          {markers.length} mapped
        </div>
      </div>

      <div className="relative aspect-[16/9] min-h-[240px] bg-[radial-gradient(circle_at_top,rgba(255,122,26,0.12),transparent_45%),linear-gradient(180deg,#111111_0%,#090909_100%)]">
        <svg viewBox="0 0 1000 520" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {CONTINENT_PATHS.map((path) => (
            <path
              key={path}
              d={path}
              fill="rgba(245,240,222,0.08)"
              stroke="rgba(245,240,222,0.08)"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          ))}
        </svg>

        {markers.map((marker) => {
          const isActive = marker.key === activeMarker?.key;
          return (
            <button
              key={`${marker.key}-${marker.label}`}
              type="button"
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform duration-200 hover:scale-110 focus:outline-none"
              style={{ left: `${marker.position.x}%`, top: `${marker.position.y}%` }}
              onClick={() => setActiveKey(marker.key)}
              onMouseEnter={() => setActiveKey(marker.key)}
              onFocus={() => setActiveKey(marker.key)}
              aria-label={`${marker.label}: ${marker.count} logged movies`}
            >
              <span
                className={`block rounded-full border ${
                  isActive
                    ? "h-4 w-4 border-[#ffcf9d] bg-[#ff7a1a] shadow-[0_0_0_6px_rgba(255,122,26,0.16)]"
                    : "h-3 w-3 border-[#ffcf9d]/50 bg-[#ffcf9d]"
                }`}
              />
            </button>
          );
        })}

        <div className="absolute bottom-4 left-4 right-4 rounded-[1.25rem] border border-white/10 bg-black/65 px-4 py-3 backdrop-blur-sm sm:left-auto sm:right-4 sm:w-[280px]">
          {activeMarker ? (
            <>
              <p className="text-sm font-semibold text-[#f5f0de]">{activeMarker.label}</p>
              <p className="mt-1 text-sm text-white/60">
                {activeMarker.count} logged movie{activeMarker.count === 1 ? "" : "s"} • {activeMarker.percentage}% of your country-tagged watches
              </p>
            </>
          ) : (
            <p className="text-sm text-white/45">No mapped movie countries yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}
