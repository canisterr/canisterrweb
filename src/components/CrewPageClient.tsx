"use client";

import { useMemo, useState } from "react";
import PageLayout from "@/components/PageLayout";
import CrewCreditsSection from "@/components/CrewCreditsSection";
import CrewFilters from "@/components/CrewFilters";
import CrewHeader from "@/components/CrewHeader";
import CrewRoleTabs from "@/components/CrewRoleTabs";
import CrewSort from "@/components/CrewSort";
import {
  filterCrewItems,
  sortCrewItems,
  type CrewMediaFilter,
  type CrewProfile,
  type CrewRoleKey,
  type CrewSortKey,
} from "@/lib/crew";

type CrewPageClientProps = {
  profile: CrewProfile;
};

export default function CrewPageClient({ profile }: CrewPageClientProps) {
  const [roleFilter, setRoleFilter] = useState<"all" | CrewRoleKey>("all");
  const [mediaFilter, setMediaFilter] = useState<CrewMediaFilter>("all");
  const [sort, setSort] = useState<CrewSortKey>("newest");

  const visibleSections = useMemo(
    () =>
      profile.sections
        .filter((section) => roleFilter === "all" || section.key === roleFilter)
        .map((section) => ({
          ...section,
          items: sortCrewItems(filterCrewItems(section.items, mediaFilter), sort),
        }))
        .filter((section) => section.items.length > 0),
    [mediaFilter, profile.sections, roleFilter, sort]
  );

  const totalVisibleWorks = visibleSections.reduce((count, section) => count + section.items.length, 0);

  return (
    <PageLayout user={null} theme="brutalist">
      <main className="mx-auto min-h-screen w-full max-w-[1180px] px-1 pb-10 pt-2 text-[#f5f0de] sm:px-3 sm:pt-4">
        <CrewHeader profile={profile} />

        <section className="mt-8 border-y border-white/10 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-white/40">Filter The Timeline</p>
              <p className="mt-2 text-sm text-white/58">
                {totalVisibleWorks} visible {totalVisibleWorks === 1 ? "credit" : "credits"} across{" "}
                {visibleSections.length} {visibleSections.length === 1 ? "section" : "sections"}.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <CrewFilters activeFilter={mediaFilter} onChange={setMediaFilter} />
              <CrewSort value={sort} onChange={setSort} />
            </div>
          </div>

          <div className="mt-4">
            <CrewRoleTabs sections={profile.sections} activeRole={roleFilter} onChange={setRoleFilter} />
          </div>
        </section>

        {visibleSections.length > 0 ? (
          <div className="mt-6 space-y-6">
            {visibleSections.map((section) => (
              <CrewCreditsSection
                key={section.key}
                section={section}
                items={section.items}
                sort={sort}
              />
            ))}
          </div>
        ) : (
          <section className="mt-6 border-y border-dashed border-white/10 px-6 py-14 text-center">
            <p className="text-sm uppercase tracking-[0.22em] text-white/40">No Matches</p>
            <h2 className="mt-3 text-2xl font-semibold text-[#f5f0de]">No credits match these filters yet.</h2>
            <p className="mt-2 text-sm text-white/55">
              Try switching the role tab, media filter, or sort order to explore the full archive.
            </p>
          </section>
        )}
      </main>
    </PageLayout>
  );
}
