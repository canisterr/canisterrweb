"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Search } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import CountryFlag from "@/components/passport/CountryFlag";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import { getDiscoveryCountryHref } from "@/lib/passport-discovery";

export default function CountryBrowser({ initialCountries }: { initialCountries: { code: string; name: string }[] }) {
  const { user } = useCurrentUser();
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(36);
  const countries = useMemo(() => initialCountries.filter((country) =>
    country.name.toLowerCase().includes(query.trim().toLowerCase())
  ), [initialCountries, query]);

  return (
    <PageLayout user={user}>
      <main className="mx-auto max-w-6xl pb-24 pt-8 text-[#f5f0de]">
        <Link href="/passport" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/50 hover:text-[#ff9b52]"><ArrowLeft size={15} /> Cine Passport</Link>
        <header className="mt-10 border-b border-white/10 pb-8">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-[#ff7a1a]">Country discovery</p>
          <h1 className="mt-3 whitespace-nowrap text-[clamp(1.3rem,5.5vw,4.5rem)] font-black uppercase tracking-tight">Explore movies by country<span className="text-[#ff7a1a]">.</span></h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-white/50">Choose a country to find films, then narrow the results by genre and release year.</p>
        </header>

        <div className="relative mt-8 max-w-lg">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search countries" aria-label="Search countries" className="w-full rounded-full border border-white/15 bg-white/5 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-[#ff7a1a]" />
        </div>
        <p className="mt-4 text-xs font-bold uppercase tracking-widest text-white/40">{countries.length} countries and regions</p>
        {countries.length ? <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {countries.slice(0, visibleCount).map((country) => <Link key={country.code} href={getDiscoveryCountryHref(country.code)} prefetch={false} className="group flex min-h-20 items-center gap-4 border border-white/10 bg-white/[0.035] px-5 py-4 transition hover:border-[#ff7a1a]/60 hover:bg-[#ff7a1a]/10 focus-visible:outline-2 focus-visible:outline-[#ff7a1a]">
            <CountryFlag code={country.code} className="h-8 w-12 rounded-sm" />
            <span className="min-w-0 flex-1 font-black uppercase tracking-tight">{country.name}</span>
            <ArrowRight size={17} className="shrink-0 text-white/35 transition group-hover:translate-x-1 group-hover:text-[#ff9b52]" />
          </Link>)}
        </div> : <p className="mt-10 text-sm text-white/50">No countries match your search.</p>}
        {countries.length > visibleCount && <button type="button" onClick={() => setVisibleCount((count) => count + 36)} className="mt-8 rounded-full border border-white/20 px-5 py-3 text-xs font-black uppercase tracking-widest text-[#ff9b52] hover:border-[#ff7a1a]/60">Show more countries</button>}
      </main>
    </PageLayout>
  );
}
