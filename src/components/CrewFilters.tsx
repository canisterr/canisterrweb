"use client";

import type { CrewMediaFilter } from "@/lib/crew";

type CrewFiltersProps = {
  activeFilter: CrewMediaFilter;
  onChange: (nextFilter: CrewMediaFilter) => void;
};

const FILTERS: Array<{ key: CrewMediaFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "movie", label: "Movies" },
  { key: "tv", label: "TV Shows" },
];

export default function CrewFilters({ activeFilter, onChange }: CrewFiltersProps) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {FILTERS.map((filter) => (
        <button
          key={filter.key}
          type="button"
          onClick={() => onChange(filter.key)}
          className={`border-b px-0 py-1 text-sm font-medium transition ${
            activeFilter === filter.key
              ? "border-[#f5f0de] text-[#f5f0de]"
              : "border-transparent text-[#f5f0de]/68 hover:border-white/35 hover:text-[#f5f0de]"
          }`}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
