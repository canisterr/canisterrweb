"use client";

import type { CrewSortKey } from "@/lib/crew";

type CrewSortProps = {
  value: CrewSortKey;
  onChange: (nextValue: CrewSortKey) => void;
};

const OPTIONS: Array<{ value: CrewSortKey; label: string }> = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "rating", label: "Rating" },
  { value: "popularity", label: "Popularity" },
];

export default function CrewSort({ value, onChange }: CrewSortProps) {
  return (
    <label className="flex items-center gap-3 border-b border-white/10 px-0 py-1 text-sm text-[#f5f0de]">
      <span className="text-white/55">Sort</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as CrewSortKey)}
        className="bg-transparent text-sm text-[#f5f0de] outline-none"
      >
        {OPTIONS.map((option) => (
          <option key={option.value} value={option.value} className="bg-[#111111] text-[#f5f0de]">
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
