"use client";

import { useMemo, useState } from "react";
import Image from "@/components/AppImage";
import { ExternalLink } from "lucide-react";
import type { CrewProfile } from "@/lib/crew";

type CrewHeaderProps = {
  profile: CrewProfile;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  const monthLabel = MONTHS[Math.max(0, Math.min(11, Number(month) - 1))] || month;
  return `${day} ${monthLabel} ${year}`;
}

function getBiographyPreview(text: string, maxLength: number = 420): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= maxLength) return clean;

  const sliced = clean.slice(0, maxLength);
  const sentenceBreak = Math.max(sliced.lastIndexOf(". "), sliced.lastIndexOf("! "), sliced.lastIndexOf("? "));
  const wordBreak = sliced.lastIndexOf(" ");
  const cutIndex = sentenceBreak > maxLength * 0.6 ? sentenceBreak + 1 : wordBreak;

  return `${clean.slice(0, cutIndex > 0 ? cutIndex : maxLength).trim()}...`;
}

export default function CrewHeader({ profile }: CrewHeaderProps) {
  const [showFullBio, setShowFullBio] = useState(false);
  const biography = profile.biography || "No biography has been added on TMDB yet.";
  const previewBiography = useMemo(() => getBiographyPreview(biography), [biography]);
  const shouldShowToggle = biography !== previewBiography;

  return (
    <section className="border-b border-white/10 pb-8">
      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="relative mx-auto h-44 w-32 flex-shrink-0 overflow-hidden border border-white/10 bg-[#171717] sm:h-56 sm:w-40 lg:mx-0">
          {profile.profileImageUrl ? (
            <Image
              src={profile.profileImageUrl}
              alt={profile.name}
              fill
              sizes="(max-width: 1024px) 160px, 180px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl font-semibold text-white/45">
              {profile.name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#ffb36b]">Career Archive</p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[#f5f0de] sm:text-4xl">
                {profile.name}
              </h1>
              <p className="mt-2 text-sm uppercase tracking-[0.16em] text-[#ffb36b]">
                {profile.knownDepartment || "Film / TV"}
              </p>
              <p className="mt-3 text-sm leading-6 text-white/58">
                {[formatDate(profile.birthday), profile.placeOfBirth].filter(Boolean).join("  •  ")}
              </p>
            </div>

            {profile.externalLinks.length > 0 ? (
              <div className="flex flex-wrap justify-start gap-x-5 gap-y-2 lg:justify-end">
                {profile.externalLinks.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-[#f5f0de] transition hover:text-[#ffb36b]"
                  >
                    {link.label}
                    <ExternalLink className="h-3.5 w-3.5 text-white/45" />
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="mt-6 border-t border-white/10 pt-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Biography</p>
              {shouldShowToggle ? (
                <button
                  type="button"
                  onClick={() => setShowFullBio((current) => !current)}
                  className="text-xs font-medium uppercase tracking-[0.16em] text-[#ffb36b] transition hover:text-[#ffd1a6]"
                >
                  {showFullBio ? "Show less" : "Show more"}
                </button>
              ) : null}
            </div>
            <p className="mt-3 whitespace-pre-line text-sm leading-7 text-white/72 sm:text-[15px]">
              {showFullBio ? biography : previewBiography}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
