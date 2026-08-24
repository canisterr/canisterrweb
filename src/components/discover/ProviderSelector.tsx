"use client";

import Image from "next/image";
import type { WatchProvider } from "@/lib/discovery/discoveryTypes";
import { providerLogoUrl } from "@/lib/discovery/watchProviders";

export default function ProviderSelector({
  providers,
  selectedIds,
  onToggle,
  anyProvider,
  onAnyProvider,
}: {
  providers: WatchProvider[];
  selectedIds: number[];
  onToggle: (providerId: number) => void;
  anyProvider: boolean;
  onAnyProvider: () => void;
}) {
  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.26em] text-[#ff7a1a]">Step 2</p>
        <h2 className="mt-3 text-3xl font-black text-[#f5f0de]">Where can you watch?</h2>
        <p className="mt-2 text-sm text-white/50">Pick one or more services, or keep it wide open.</p>
      </div>

      <button
        type="button"
        onClick={onAnyProvider}
        className={`w-full rounded-[1.25rem] border px-4 py-4 text-left text-base font-black transition ${
          anyProvider ? "border-[#f5f0de]/70 bg-[#f5f0de] text-[#0a0a0a]" : "border-white/10 bg-white/[0.04] text-[#f5f0de]"
        }`}
      >
        Any streaming service
      </button>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {providers.map((provider) => {
          const selected = selectedIds.includes(provider.id);
          const logo = providerLogoUrl(provider.logoPath);
          return (
            <button
              key={provider.id}
              type="button"
              onClick={() => onToggle(provider.id)}
              className={`flex min-h-16 items-center gap-3 rounded-[1.1rem] border px-3 py-3 text-left transition ${
                selected ? "border-[#0a84ff] bg-[#0a84ff]/16" : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
              }`}
            >
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white/10">
                {logo ? <Image src={logo} alt="" fill sizes="32px" className="object-cover" /> : <span className="text-xs font-black">{provider.name.charAt(0)}</span>}
              </span>
              <span className="min-w-0 truncate text-sm font-semibold text-[#f5f0de]">{provider.name}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
