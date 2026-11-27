"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Clapperboard, Flame, LoaderCircle, Search, X } from "lucide-react";
import { GAME_CATEGORIES, utcGameDate, type GameCategoryId } from "@/lib/games/types";
import { getTmdbPosterUrl } from "@/lib/performance";

type Movie = { id: number; type: "movie"; name: string; image: string | null; year: string };
type Preview = { movies: Array<{ id: number; title: string; posterPath: string | null; year: string }>; actors: string[]; clues: string[] };
type Props = { requestHeaders: () => Promise<Record<string, string>> };

async function readBody(response: Response): Promise<Record<string, unknown>> {
  try { return await response.json() as Record<string, unknown>; } catch { return {}; }
}

export default function AdminDailyGames({ requestHeaders }: Props) {
  const [date, setDate] = useState(utcGameDate());
  const [category, setCategory] = useState<GameCategoryId>("english");
  const [kind, setKind] = useState<"reveal" | "connection">("reveal");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Movie[]>([]);
  const [selected, setSelected] = useState<Movie[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [scheduled, setScheduled] = useState<{ reveal?: Record<string, unknown> | null; connection?: Record<string, unknown> | null }>({});
  const [searching, setSearching] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      if (query.trim().length < 2) { setResults([]); setSearching(false); return; }
      setSearching(true);
      setResults([]);
      void fetch(`/api/games/search?q=${encodeURIComponent(query.trim())}&type=title`, { cache: "force-cache" })
        .then(async (response) => {
          const body = await response.json() as unknown;
          if (!response.ok) throw new Error("Movie search is temporarily unavailable.");
          if (live) setResults(Array.isArray(body) ? (body as Movie[]).filter((item) => item.type === "movie") : []);
        })
        .catch((caught) => { if (live) setError(caught instanceof Error ? caught.message : "Movie search is temporarily unavailable."); })
        .finally(() => { if (live) setSearching(false); });
    }, 300);
    return () => { live = false; window.clearTimeout(timer); };
  }, [query]);

  useEffect(() => {
    let live = true;
    setSelected([]); setPreview(null); setError(""); setNotice("");
    void (async () => {
      try {
        const response = await fetch(`/api/admin/games?date=${encodeURIComponent(date)}&category=${category}`, { headers: await requestHeaders(), cache: "no-store" });
        const body = await readBody(response);
        if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not load scheduled games.");
        if (live) setScheduled(body.games as typeof scheduled || {});
      } catch (caught) { if (live) setError(caught instanceof Error ? caught.message : "Could not load scheduled games."); }
    })();
    return () => { live = false; };
  }, [date, category, requestHeaders]);

  const needed = kind === "connection" ? 2 : 1;
  const currentPuzzle = scheduled[kind];

  function chooseKind(next: "reveal" | "connection") {
    setKind(next); setSelected([]); setPreview(null); setError(""); setNotice("");
  }

  function selectMovie(movie: Movie) {
    setSelected((current) => {
      const already = current.some((item) => item.id === movie.id);
      return already ? current.filter((item) => item.id !== movie.id) : current.length >= needed ? current : [...current, movie];
    });
    setPreview(null); setError(""); setNotice("");
  }

  async function inspectSelection() {
    if (selected.length !== needed) return;
    setChecking(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/games", { method: "POST", headers: await requestHeaders(), body: JSON.stringify({ action: "preview", date, category, kind, movieIds: selected.map((item) => item.id) }) });
      const body = await readBody(response);
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not check these movies.");
      setPreview(body as unknown as Preview);
    } catch (caught) { setPreview(null); setError(caught instanceof Error ? caught.message : "Could not check these movies."); }
    finally { setChecking(false); }
  }

  async function scheduleGame() {
    if (!preview || selected.length !== needed) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/games", { method: "POST", headers: await requestHeaders(), body: JSON.stringify({ action: "schedule", date, category, kind, movieIds: selected.map((item) => item.id) }) });
      const body = await readBody(response);
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not schedule this game.");
      setNotice(`${kind === "reveal" ? "Reveal" : "Connection"} scheduled for ${date}.`);
      setSelected([]); setPreview(null);
      const refresh = await fetch(`/api/admin/games?date=${encodeURIComponent(date)}&category=${category}`, { headers: await requestHeaders(), cache: "no-store" });
      const latest = await readBody(refresh);
      if (refresh.ok) setScheduled(latest.games as typeof scheduled || {});
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not schedule this game."); }
    finally { setSaving(false); }
  }

  return <section className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(280px,.9fr)]">
    <div className="border border-white/10 bg-[#10100f] p-4 sm:p-6">
      <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#ff9b52]"><Clapperboard size={15}/> Daily game desk</p>
      <h2 className="mt-2 text-xl font-bold">Set a film for the day</h2>
      <p className="mt-1 text-sm text-white/45">Choose a cinema and date, then check the clue or shared actor before scheduling.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-semibold text-white/55">Date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0e0e0d] px-3 py-3 text-sm text-[#f4efdf] outline-none focus:border-[#ff7a1a]/65" /></label>
        <label className="text-xs font-semibold text-white/55">Cinema<select value={category} onChange={(event) => setCategory(event.target.value as GameCategoryId)} className="mt-1 w-full rounded-lg border border-white/10 bg-[#0e0e0d] px-3 py-3 text-sm text-[#f4efdf] outline-none focus:border-[#ff7a1a]/65">{GAME_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {(["reveal", "connection"] as const).map((item) => <button key={item} type="button" onClick={() => chooseKind(item)} className={`rounded-lg border px-3 py-3 text-sm font-bold capitalize transition ${kind === item ? "border-[#d46b35] bg-[#d46b35]/10 text-[#ffb078]" : "border-white/10 text-white/50 hover:border-white/25"}`}>{item}</button>)}
      </div>
      <label className="mt-4 block text-xs font-semibold text-white/55" htmlFor="admin-game-search">{kind === "connection" ? "Search and select two films" : "Search and select a film"}</label>
      <div className="relative mt-1"><Search size={16} className="absolute left-3 top-3.5 text-white/35"/><input id="admin-game-search" value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-lg border border-white/10 bg-[#0e0e0d] py-3 pl-10 pr-4 text-sm text-[#f4efdf] outline-none placeholder:text-white/30 focus:border-[#ff7a1a]/65" placeholder="Search movie titles" /></div>
      <p className="mt-2 text-[11px] text-white/35">{selected.length} of {needed} selected · movies must match the chosen cinema</p>
      {(searching || results.length > 0) && <div className="mt-3 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">{searching && <p className="col-span-full flex items-center gap-2 py-3 text-xs text-white/45"><LoaderCircle size={14} className="animate-spin"/>Searching films…</p>}{results.map((movie) => {
        const isSelected = selected.some((item) => item.id === movie.id);
        return <button key={movie.id} type="button" onClick={() => selectMovie(movie)} className={`relative flex min-w-0 items-center gap-2 border p-2 text-left transition ${isSelected ? "border-[#d46b35] bg-[#d46b35]/10" : "border-white/10 bg-black/20 hover:border-white/25"}`}>
          <span className="relative size-10 shrink-0 overflow-hidden bg-white/5">{getTmdbPosterUrl(movie.image, "w185") && <Image src={getTmdbPosterUrl(movie.image, "w185")!} alt="" fill sizes="40px" className="object-cover"/>}</span>
          <span className="min-w-0"><strong className="block truncate text-xs text-[#f4efdf]">{movie.name}</strong><span className="text-[10px] text-white/40">{movie.year || "Release year unknown"}</span></span>
          {isSelected && <Check size={14} className="absolute right-1 top-1 text-[#ff9b52]"/>}
        </button>;
      })}</div>}
      {selected.length > 0 && <div className="mt-3 flex flex-wrap gap-2">{selected.map((movie) => <button key={movie.id} type="button" onClick={() => selectMovie(movie)} className="inline-flex items-center gap-2 rounded-full border border-[#d46b35]/45 px-3 py-1.5 text-xs text-[#f4efdf]"><span>{movie.name}</span><X size={13}/></button>)}</div>}
      <div className="mt-5 flex flex-wrap gap-2">
        <button type="button" onClick={() => void inspectSelection()} disabled={selected.length !== needed || checking} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-[#f4efdf] transition hover:border-[#d46b35] disabled:cursor-not-allowed disabled:opacity-35">{checking ? <LoaderCircle size={15} className="animate-spin"/> : <Check size={15}/>}Check selection</button>
        {preview && <button type="button" onClick={() => void scheduleGame()} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-[#ff7a1a] px-4 py-2.5 text-sm font-bold text-black transition hover:bg-[#ff9142] disabled:opacity-50">{saving && <LoaderCircle size={15} className="animate-spin"/>}{saving ? "Scheduling…" : "Schedule game"}</button>}
      </div>
      {error && <p role="alert" className="mt-4 text-sm text-red-200">{error}</p>}
      {notice && <p role="status" className="mt-4 text-sm text-[#ffb36b]">{notice}</p>}
    </div>
    <aside className="border border-white/10 bg-[#10100f] p-4 sm:p-6">
      <h3 className="font-bold">{preview ? "Checked game" : "Scheduled for this cinema"}</h3>
      <p className="mt-1 text-xs text-white/40">{date} · {GAME_CATEGORIES.find((item) => item.id === category)?.label}</p>
      {preview ? <>
        <div className="mt-4 grid grid-cols-2 gap-3">{preview.movies.map((movie) => <div key={movie.id} className="text-center"><div className="relative mx-auto aspect-[2/3] w-24 overflow-hidden border border-white/10 bg-black/30">{getTmdbPosterUrl(movie.posterPath, "w185") && <Image src={getTmdbPosterUrl(movie.posterPath, "w185")!} alt={`${movie.title} poster`} fill sizes="96px" className="object-cover"/>}</div><p className="mt-2 text-xs font-bold">{movie.title}</p></div>)}</div>
        {kind === "connection" ? <div className="mt-4 border-l-2 border-[#d46b35] pl-3"><p className="text-[10px] font-bold uppercase tracking-wider text-[#ff9b52]">Shared actor</p><p className="mt-1 text-sm font-bold">{preview.actors.join(", ") || "No actor in common"}</p></div> : null}
        <div className="mt-4 border-t border-white/10 pt-3"><p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Clues</p><ol className="mt-2 space-y-2">{preview.clues.map((clue, index) => <li key={clue} className="flex gap-2 text-xs leading-relaxed text-white/70"><span className="font-bold tabular-nums text-[#ff9b52]">{String(index + 1).padStart(2, "0")}</span>{clue}</li>)}</ol></div>
      </> : currentPuzzle ? <div className="mt-4 border-t border-white/10 pt-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#ff9b52]">{currentPuzzle.adminSet === true ? "Admin scheduled" : "Auto selected"}</p><p className="mt-2 text-lg font-bold">{typeof currentPuzzle.answer === "string" ? currentPuzzle.answer : "Connection puzzle"}</p>{Array.isArray(currentPuzzle.pair) && <p className="mt-1 text-xs leading-relaxed text-white/50">{currentPuzzle.pair.map((item) => item && typeof item === "object" && "title" in item ? String(item.title) : "").filter(Boolean).join(" · ")}</p>}</div> : <div className="mt-8 text-center text-sm text-white/35">No puzzle is scheduled yet.</div>}
      <p className="mt-6 flex items-start gap-2 border-t border-white/10 pt-4 text-[11px] leading-relaxed text-white/35"><Flame size={14} className="mt-0.5 shrink-0 text-[#d46b35]"/>Reveal clues are built from the selected film. Connection requires a shared credited cast member. Scheduled films stay reserved from the other games for that date.</p>
    </aside>
  </section>;
}
