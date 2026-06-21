"use client";

import CrewWorkCard from "@/components/CrewWorkCard";
import type { CrewRoleSection, CrewSortKey, CrewWorkCardData } from "@/lib/crew";

type CrewCreditsSectionProps = {
  section: CrewRoleSection;
  items: CrewWorkCardData[];
  sort: CrewSortKey;
};

function groupByYear(items: CrewWorkCardData[], sort: CrewSortKey) {
  const groups = new Map<string, CrewWorkCardData[]>();

  items.forEach((item) => {
    const key = item.yearLabel;
    const existing = groups.get(key) || [];
    existing.push(item);
    groups.set(key, existing);
  });

  const orderedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (a === "Unknown Year") return 1;
    if (b === "Unknown Year") return -1;
    const aYear = Number(a);
    const bYear = Number(b);
    return sort === "oldest" ? aYear - bYear : bYear - aYear;
  });

  return orderedKeys.map((key) => ({
    year: key,
    items: groups.get(key) || [],
  }));
}

export default function CrewCreditsSection({ section, items, sort }: CrewCreditsSectionProps) {
  if (items.length === 0) return null;

  const showYearGroups = sort === "newest" || sort === "oldest";
  const yearGroups = showYearGroups ? groupByYear(items, sort) : [];

  return (
    <section className="border-t border-white/10 pt-6">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-[#f5f0de]">{section.label}</h2>
          <p className="mt-1 text-sm text-white/52">{section.description}</p>
        </div>
        <p className="text-sm text-white/45">
          {items.length} {items.length === 1 ? "work" : "works"}
        </p>
      </div>

      {showYearGroups ? (
        <div className="mt-5 space-y-8">
          {yearGroups.map((group) => (
            <div key={`${section.key}-${group.year}`} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-white/10" />
                <p className="text-xs uppercase tracking-[0.2em] text-white/45">{group.year}</p>
                <div className="h-px flex-1 bg-white/10" />
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                {group.items.map((item) => (
                  <CrewWorkCard key={`${section.key}-${item.mediaType}-${item.id}`} item={item} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <CrewWorkCard key={`${section.key}-${item.mediaType}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
