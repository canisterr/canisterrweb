"use client";

import type { DiscoveryFilters, EraFilter, RuntimeFilter } from "@/lib/discovery/discoveryTypes";

const runtimeOptions: Array<{ value: RuntimeFilter; label: string }> = [
  { value: "any", label: "Any length" },
  { value: "under90", label: "Under 90 min" },
  { value: "under120", label: "Under 2 hours" },
];

const eraOptions: Array<{ value: EraFilter; label: string }> = [
  { value: "any", label: "Any era" },
  { value: "recent", label: "Recent" },
  { value: "2010s", label: "2010s+" },
  { value: "classics", label: "Classics" },
];

function SegmentedOption<T extends string>({
  value,
  label,
  active,
  onClick,
}: {
  value: T;
  label: string;
  active: boolean;
  onClick: (value: T) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`rounded-full px-3 py-2 text-xs font-bold transition ${
        active ? "bg-[#f5f0de] text-[#0a0a0a]" : "bg-white/[0.05] text-[#f5f0de] hover:bg-white/[0.09]"
      }`}
    >
      {label}
    </button>
  );
}

export default function QuickFilters({
  filters,
  onChange,
}: {
  filters: DiscoveryFilters;
  onChange: (filters: DiscoveryFilters) => void;
}) {
  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.26em] text-[#ff7a1a]">Quick filters</p>
        <h2 className="mt-3 text-3xl font-black text-[#f5f0de]">Keep it simple.</h2>
      </div>

      <div className="space-y-4 rounded-[1.35rem] border border-white/10 bg-white/[0.035] p-4">
        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-white/38">Runtime</p>
          <div className="flex flex-wrap gap-2">
            {runtimeOptions.map((option) => (
              <SegmentedOption
                key={option.value}
                value={option.value}
                label={option.label}
                active={filters.runtime === option.value}
                onClick={(runtime) => onChange({ ...filters, runtime })}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-white/38">Era</p>
          <div className="flex flex-wrap gap-2">
            {eraOptions.map((option) => (
              <SegmentedOption
                key={option.value}
                value={option.value}
                label={option.label}
                active={filters.era === option.value}
                onClick={(era) => onChange({ ...filters, era })}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
