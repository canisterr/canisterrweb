"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";

type SearchResult = { id: number; type: "movie" | "person"; name: string; image: string | null; year?: string };
const IMAGE_BASE = "https://image.tmdb.org/t/p/w92";
const cache = new Map<string, SearchResult[]>();

export default function TmdbSearchInput({
  value,
  onChange,
  kind,
  placeholder,
  label,
  className = "",
  inputClassName = "",
  showSelectedPoster = false,
}: {
  value: string;
  onChange: (value: string) => void;
  kind: "title" | "person";
  placeholder?: string;
  label: string;
  className?: string;
  inputClassName?: string;
  showSelectedPoster?: boolean;
}) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [picked, setPicked] = useState<SearchResult | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const query = value.trim();

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    const cacheKey = `${kind}:${query.toLowerCase()}`;
    const cached = cache.get(cacheKey);
    if (cached) {
      setResults(cached);
      setOpen(true);
      setLoading(false);
      return;
    }
    setResults([]);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`/api/games/search?type=${kind}&q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search unavailable");
        const items = await response.json() as SearchResult[];
        cache.set(cacheKey, items);
        setResults(items);
        setOpen(true);
        setActiveIndex(-1);
      } catch {
        if (!controller.signal.aborted) setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 280);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [kind, query]);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function choose(item: SearchResult) {
    onChange(item.name);
    setPicked(item);
    setOpen(false);
    setResults([]);
  }

  return <div className={`relative min-w-0 ${className}`} ref={root}>
    <input
      role="combobox"
      aria-label={label}
      aria-controls={listboxId}
      aria-expanded={open && (results.length > 0 || loading)}
      aria-autocomplete="list"
      value={value}
      onFocus={() => { if (results.length) setOpen(true); }}
      onChange={(event) => { onChange(event.target.value); setPicked(null); setOpen(true); }}
      onKeyDown={(event) => {
        if (!open || !results.length) return;
        if (event.key === "ArrowDown") { event.preventDefault(); setActiveIndex((index) => (index + 1) % results.length); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => (index - 1 + results.length) % results.length); }
        if (event.key === "Enter" && activeIndex >= 0) { event.preventDefault(); choose(results[activeIndex]); }
        if (event.key === "Escape") setOpen(false);
      }}
      autoComplete="off"
      maxLength={100}
      placeholder={placeholder}
      className={`w-full min-w-0 bg-transparent text-[#f5f0de] outline-none placeholder:text-white/45 focus:placeholder:text-white/65 ${inputClassName}`}
    />
    {open && (results.length > 0 || loading) && <ul id={listboxId} role="listbox" aria-label={`${kind === "person" ? "People" : "Movie titles"} from TMDB`} className="absolute left-0 top-[calc(100%+8px)] z-[60] max-h-72 w-[min(24rem,calc(100vw-3rem))] overflow-y-auto rounded-xl border border-white/15 bg-[#171512] p-1.5 text-left shadow-2xl">
      {loading && !results.length && <li className="px-3 py-2 text-xs text-white/50">Searching…</li>}
      {results.map((item, index) => <li key={`${item.type}:${item.id}`}>
        <button type="button" role="option" aria-selected={index === activeIndex} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(item)} className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/[0.07] ${index === activeIndex ? "bg-white/[0.07]" : ""}`}>
          <span className="relative h-12 w-8 shrink-0 overflow-hidden rounded bg-white/10">{item.image && <Image src={`${IMAGE_BASE}${item.image}`} alt="" fill sizes="32px" className="object-cover" />}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-[#f5f0de]">{item.name}</span><span className="mt-0.5 block text-[11px] text-white/45">{item.type === "person" ? "Actor" : "Movie"}{item.year ? ` · ${item.year}` : ""}</span></span>
        </button>
      </li>)}
    </ul>}
    {showSelectedPoster && picked && <span className="mt-1 flex min-w-0 items-center justify-center gap-1.5 text-[10px] text-white/60"><span className="relative h-8 w-5 shrink-0 overflow-hidden rounded bg-white/10">{picked.image && <Image src={`${IMAGE_BASE}${picked.image}`} alt="" fill sizes="20px" className="object-cover" />}</span><span className="truncate">{picked.name}</span></span>}
  </div>;
}
