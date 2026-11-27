"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight, Compass, Film, Share2, X } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import WorldCoverageMap from "@/components/WorldCoverageMap";
import CountryFlag from "@/components/passport/CountryFlag";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import { getPassportLogs } from "@/lib/passport-data";
import { calculatePassportStats, type PassportCountry } from "@/lib/passport";
import { getDiscoveryCountryHref } from "@/lib/passport-discovery";
import type { MovieLogWithContent } from "@/types";

const ink = "text-[#f5f0de]";

function formatStampDate(date: string) {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? date : new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
}

export default function PassportPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useCurrentUser();
  const [logs, setLogs] = useState<MovieLogWithContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const stats = useMemo(() => calculatePassportStats(logs), [logs]);
  const selectedCountry = stats.countries.find((country) => country.name === selected) || null;

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      router.replace("/auth/login");
      return;
    }
    let cancelled = false;
    getPassportLogs(user)
      .then((result) => { if (!cancelled) setLogs(result); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [router, sessionLoading, user]);

  useEffect(() => {
    if (!selected) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [selected]);

  const sharePassport = () => {
    if (!user) return;
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#0b0b0b";
    ctx.fillRect(0, 0, 1080, 1920);
    ctx.strokeStyle = "#ba6027";
    ctx.lineWidth = 4;
    ctx.strokeRect(70, 70, 940, 1780);
    ctx.fillStyle = "#ff7a1a";
    ctx.font = "bold 42px sans-serif";
    ctx.fillText("CANISTERR", 120, 170);
    ctx.fillStyle = "#f5f0de";
    ctx.font = "bold 96px sans-serif";
    ctx.fillText("MY CINE", 120, 345);
    ctx.fillText("PASSPORT", 120, 455);
    ctx.fillStyle = "#ff7a1a";
    ctx.font = "bold 240px sans-serif";
    ctx.fillText(String(stats.countries.length), 120, 760);
    ctx.fillStyle = "#f5f0de";
    ctx.font = "bold 48px sans-serif";
    ctx.fillText("COUNTRIES EXPLORED", 120, 830);
    ctx.font = "32px sans-serif";
    ctx.fillText(`${stats.worldPercentage.toFixed(1)}% OF THE WORLD`, 120, 895);
    ctx.strokeStyle = "#ffffff44";
    ctx.beginPath(); ctx.moveTo(120, 955); ctx.lineTo(960, 955); ctx.stroke();
    ctx.fillStyle = "#ff7a1a";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText("FILM NATIONALITY", 120, 1050);
    ctx.fillStyle = "#f5f0de";
    ctx.font = "bold 65px sans-serif";
    ctx.fillText((stats.nationality || "UNSTAMPED").toUpperCase().slice(0, 21), 120, 1140);
    ctx.fillStyle = "#ff7a1a";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText("LATEST STAMP", 120, 1280);
    ctx.fillStyle = "#f5f0de";
    ctx.font = "bold 56px sans-serif";
    ctx.fillText((stats.latest?.name || "YOUR NEXT FILM").toUpperCase().slice(0, 25), 120, 1360);
    ctx.fillStyle = "#ff7a1a";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText("MOST EXPLORED", 120, 1500);
    ctx.fillStyle = "#f5f0de";
    ctx.font = "bold 46px sans-serif";
    ctx.fillText((stats.countries[0]?.name || "THE WORLD").toUpperCase().slice(0, 27), 120, 1580);
    ctx.font = "36px sans-serif";
    ctx.fillText(`@${user.username}`, 120, 1770);
    const download = document.createElement("a");
    download.href = canvas.toDataURL("image/png");
    download.download = "cine-passport.png";
    download.click();
  };

  return (
    <PageLayout user={user}>
      <main className={`mx-auto max-w-6xl pb-24 pt-6 ${ink}`}>
        <Link href="/profile" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-white/50 hover:text-[#ff9b52]"><ArrowLeft size={15} /> Profile</Link>
        <h1 className="mt-8 whitespace-nowrap text-[clamp(2.4rem,9vw,6rem)] font-black uppercase leading-none tracking-[-0.07em]">Cine Passport<span className="text-[#ff7a1a]">.</span></h1>

        {loading || sessionLoading ? <p className="py-20 text-center text-white/50">Preparing your passport…</p> : error ? <p className="py-20 text-center text-white/50">Your passport could not be loaded right now.</p> : (
          <>
            <section className="grid gap-8 border-b border-white/10 py-10 md:grid-cols-[1fr_auto] md:items-end">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.3em] text-white/45">Most watched country</p>
                <h2 className="mt-3 flex items-center gap-3 break-words text-4xl font-black uppercase tracking-[-0.05em] sm:text-6xl">{stats.countries[0] && <CountryFlag code={stats.countries[0].code} className="h-8 w-12 rounded-sm sm:h-11 sm:w-16" />}{stats.countries[0]?.name || "Yet to be discovered"}</h2>
                {!stats.countries[0] && <p className="mt-3 text-sm text-white/55">Log a film to get started.</p>}
              </div>
              <div className="flex gap-5 md:text-right">
                <div><strong className="block text-3xl font-black">{stats.totalMovies}</strong><span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Films</span></div>
              </div>
            </section>

            <section className="py-10">
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div><h2 className="text-3xl font-black uppercase tracking-tight sm:text-5xl">Countries explored</h2></div>
                <p className="text-5xl font-black text-[#ff7a1a]">{stats.countries.length}<span className="text-xl text-white/30"> / 195</span></p>
              </div>
              <WorldCoverageMap countries={stats.countries.map((country) => ({ code: country.code, label: country.name, count: country.count, percentage: stats.totalMovies ? Math.round(country.count / stats.totalMovies * 100) : 0 }))} onCountryClick={setSelected} />
              <p className="mt-4 text-xs text-white/40">Based on the origin of your watched films.</p>
            </section>

            <section className="hidden border-t border-white/10 py-10 md:block">
              <div className="flex items-end justify-between gap-4"><h2 className="text-3xl font-black uppercase tracking-tight">Passport stamps</h2><Film className="text-[#ff7a1a]" /></div>
              {stats.countries.length ? <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{stats.countries.map((country, index) => <button key={country.name} type="button" onClick={() => setSelected(country.name)} className={`min-h-44 border-2 border-dashed border-[#ff7a1a]/55 bg-[#ff7a1a]/[0.04] p-4 text-left transition hover:bg-[#ff7a1a]/10 ${index % 2 ? "rotate-[1deg]" : "-rotate-[1deg]"}`}><span className="text-xs font-black uppercase tracking-[0.25em] text-[#ff9b52]">{country.level}</span><CountryFlag code={country.code} className="mt-5 h-9 w-14 rounded-sm" /><span className="mt-2 block text-lg font-black uppercase">{country.name}</span><span className="mt-2 block text-[11px] font-semibold uppercase tracking-widest text-white/45">{country.count} films</span></button>)}</div> : <p className="mt-6 text-sm text-white/45">Log a film to collect a stamp.</p>}
            </section>

            <section className="relative mb-8 overflow-hidden border-t border-white/10 bg-[#ff7a1a] p-6 text-black sm:p-8"><Compass className="absolute -right-5 -top-5 h-36 w-36 opacity-10" /><h2 className="relative text-4xl font-black uppercase tracking-tight">Discover films</h2><Link href="/passport/discover" className="relative mt-8 inline-flex items-center gap-2 border-b border-black pb-1 text-xs font-black uppercase tracking-[0.2em]">Browse countries <ArrowRight size={15} /></Link></section>
            <button type="button" onClick={sharePassport} className="mt-2 inline-flex items-center gap-2 rounded-full border border-[#ff7a1a]/45 bg-[#ff7a1a]/10 px-5 py-3 text-xs font-black uppercase tracking-[0.2em] text-[#ffb36b] transition hover:bg-[#ff7a1a]/20"><Share2 size={16} /> Save passport card</button>
          </>
        )}
      </main>
      {selectedCountry && <CountrySheet country={selectedCountry} onClose={() => setSelected(null)} />}
    </PageLayout>
  );
}

function CountrySheet({ country, onClose }: { country: PassportCountry; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const recentFilms = useMemo(
    () => [...country.films].sort((a, b) =>
      b.watched_date.localeCompare(a.watched_date) ||
      (b.created_at || "").localeCompare(a.created_at || "") ||
      (b.updated_at || "").localeCompare(a.updated_at || "")
    ),
    [country.films]
  );
  const topGenre = useMemo(() => {
    const counts = new Map<string, number>();
    country.films.forEach((film) => film.content.genres?.forEach((genre) => counts.set(genre, (counts.get(genre) || 0) + 1)));
    return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] || "Not enough data";
  }, [country.films]);

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/85 backdrop-blur-md sm:items-center sm:p-5"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="passport-country-title"
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }}
        className="flex h-dvh w-full min-w-0 flex-col overflow-hidden bg-[#111110] text-[#f5f0de] shadow-[0_30px_100px_rgba(0,0,0,0.65)] sm:h-auto sm:max-h-[calc(100dvh-2.5rem)] sm:max-w-2xl sm:rounded-[2rem] sm:border sm:border-white/15"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] sm:px-8 sm:pt-6">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.26em] text-[#ff9b52]">Cine Passport</p>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={onClose}
            aria-label="Close country details"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition hover:border-white/30 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff9b52]"
          >
            <X size={21} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="relative overflow-hidden border-b border-white/10 px-5 pb-9 pt-8 sm:px-8 sm:pb-10 sm:pt-10">
            <CountryFlag code={country.code} position="absolute" className="pointer-events-none right-4 top-7 h-24 w-36 rounded-sm opacity-[0.12] sm:right-6 sm:top-8 sm:h-32 sm:w-48" />
            <p className="relative text-xs font-black uppercase tracking-[0.28em] text-[#ff9b52]">{country.level}</p>
            <h2 id="passport-country-title" className="relative mt-5 max-w-[90%] break-words text-[clamp(2.65rem,10vw,4.75rem)] font-black uppercase leading-[0.92] tracking-[-0.065em]">
              {country.name}
            </h2>
            <div className="relative mt-8 flex items-end gap-3">
              <span className="text-6xl font-black leading-none tracking-[-0.08em] text-[#ff8a2a] sm:text-7xl">{country.count}</span>
              <span className="pb-1 text-sm font-bold uppercase tracking-[0.18em] text-white/60">film{country.count === 1 ? "" : "s"}<br />watched</span>
            </div>
          </div>

          <div className="grid grid-cols-2 border-y border-white/10 px-5 py-6 sm:px-8">
            <div className="min-w-0 border-r border-white/10 pr-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/40">First visited</p>
              <p className="mt-2 break-words text-base font-bold leading-6">{country.firstFilm.content.title}</p>
              <p className="mt-1 text-sm text-white/50">{formatStampDate(country.firstDate)}</p>
            </div>
            <div className="min-w-0 pl-5">
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/40">Top genre</p>
              <p className="mt-2 break-words text-base font-bold leading-6">{topGenre}</p>
            </div>
          </div>

          <div className="px-5 pb-8 pt-8 sm:px-8">
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h3 className="text-2xl font-black uppercase tracking-tight">Your films</h3>
              <span className="text-sm font-semibold text-white/40">{country.count} total</span>
            </div>
            <div className="divide-y divide-white/10 border-t border-white/10">
              {recentFilms.map((film) => (
                <Link
                  key={film.id}
                  href={`/movie/${film.content_id}`}
                  className="group flex gap-4 py-4 transition hover:bg-white/[0.035] focus-visible:outline-2 focus-visible:outline-[#ff9b52]"
                >
                  <div className="h-24 w-16 shrink-0 overflow-hidden rounded-lg bg-white/5 sm:h-28 sm:w-[74px]">
                    {film.content.poster_url ? (
                      <Image src={film.content.poster_url} alt="" width={148} height={224} sizes="74px" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-white/30"><Film size={24} /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 py-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-base font-bold leading-6 text-[#f5f0de] transition group-hover:text-[#ffb36b]">{film.content.title}</p>
                      <ArrowUpRight size={18} className="mt-1 shrink-0 text-white/30 transition group-hover:text-[#ffb36b]" />
                    </div>
                    <p className="mt-1 text-sm text-white/60">Watched {formatStampDate(film.watched_date)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-white/10 bg-[#141413] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-8 sm:pb-6">
          <Link
            href={country.code ? getDiscoveryCountryHref(country.code) : "/passport/discover"}
            className="flex min-h-12 w-full items-center justify-between gap-3 rounded-full bg-[#ff7a1a] px-5 py-3 text-sm font-black uppercase tracking-[0.08em] text-black transition hover:bg-[#ff9b52] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff9b52]"
          >
            Discover more from {country.name}
            <ArrowRight size={18} className="shrink-0" />
          </Link>
        </div>
      </section>
    </div>
  );
}
