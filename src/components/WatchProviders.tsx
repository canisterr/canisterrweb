"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { WatchProvider, WatchProviderRegions } from "@/lib/watch-providers";

const REGION_STORAGE_KEY = "canisterr:watch-region";

function regionName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

function providerLogo(path: string): string {
  return `https://image.tmdb.org/t/p/w92${path}`;
}

function ProviderGroup({ title, providers }: { title: string; providers: WatchProvider[] }) {
  if (providers.length === 0) return null;
  const unique = Array.from(new Map(providers.map((provider) => [provider.provider_id, provider])).values())
    .sort((a, b) => (a.display_priority ?? 999) - (b.display_priority ?? 999));

  return (
    <div className="grid gap-2 sm:grid-cols-[5rem_minmax(0,1fr)] sm:gap-5">
      <h3 className="pt-1 text-xs font-medium text-white/45">{title}</h3>
      <div className="flex flex-wrap items-center gap-3">
        {unique.map((provider) => (
          <span key={provider.provider_id} title={provider.provider_name} aria-label={provider.provider_name} className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/10">
            {provider.logo_path ? (
              <img src={providerLogo(provider.logo_path)} alt={provider.provider_name} loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden="true" className="text-sm font-bold text-[#f5f0de]">{provider.provider_name.charAt(0)}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function WatchProviders({ regions }: { regions?: WatchProviderRegions | null }) {
  const [selectedRegion, setSelectedRegion] = useState("IN");
  const availableRegions = useMemo(() => Object.keys(regions || {})
    .filter((code) => {
      const region = regions?.[code];
      return Boolean(region && [region.flatrate, region.free, region.ads, region.rent, region.buy].some((list) => list?.length));
    })
    .sort((a, b) => regionName(a).localeCompare(regionName(b))), [regions]);

  useEffect(() => {
    const saved = window.localStorage.getItem(REGION_STORAGE_KEY);
    const browserRegion = window.navigator.language.split("-")[1]?.toUpperCase();
    const frame = window.requestAnimationFrame(() => setSelectedRegion(saved || browserRegion || "IN"));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  if (availableRegions.length === 0) return null;

  const region = regions?.[selectedRegion];
  const stream = [...(region?.flatrate || [])];
  const free = [...(region?.free || []), ...(region?.ads || [])];
  const rent = region?.rent || [];
  const buy = region?.buy || [];
  const hasOffers = stream.length + free.length + rent.length + buy.length > 0;
  const regionOptions = availableRegions.includes(selectedRegion)
    ? availableRegions
    : [selectedRegion, ...availableRegions];
  const tmdbLink = region?.link && /^https:\/\//i.test(region.link) ? region.link : null;

  return (
    <section aria-label="Where to watch" className="mx-auto w-full max-w-3xl">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold tracking-tight text-[#f5f0de]">Where to watch</h2>
        <label className="relative inline-flex min-w-0 items-center text-sm font-semibold text-[#ffb36b]">
          <select
            aria-label="Watch region"
            value={selectedRegion}
            onChange={(event) => {
              setSelectedRegion(event.target.value);
              window.localStorage.setItem(REGION_STORAGE_KEY, event.target.value);
            }}
            className="max-w-36 cursor-pointer appearance-none border-0 bg-transparent py-1 pl-1 pr-5 text-right text-sm font-semibold text-[#ffb36b] outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a1a]"
          >
            {regionOptions.map((code) => <option key={code} value={code}>{regionName(code)}</option>)}
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-0 h-4 w-4" strokeWidth={1.8} />
        </label>
      </div>
      {hasOffers ? (
        <div className="mt-4 space-y-4">
          <ProviderGroup title="Streaming" providers={stream} />
          <ProviderGroup title="Free / ads" providers={free} />
          <ProviderGroup title="Rent" providers={rent} />
          <ProviderGroup title="Buy" providers={buy} />
        </div>
      ) : (
        <p className="mt-4 text-sm text-white/50">No watch options listed for {regionName(selectedRegion)}.</p>
      )}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-white/35">
        <span>JustWatch data via TMDB</span>
        {tmdbLink && <a href={tmdbLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#ffb36b] hover:underline">Watch links ↗</a>}
      </div>
    </section>
  );
}
