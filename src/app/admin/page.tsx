"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "@/components/AppImage";
import Link from "next/link";
import { Activity, BarChart3, Check, Clapperboard, Film, ListPlus, LoaderCircle, Plus, RefreshCw, Search, Trash2, Tv, Users, X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import AdminDailyGames from "@/components/admin/AdminDailyGames";
import { searchMulti } from "@/lib/search-multi";
import { searchTVMazeShowsOnly, type ShowDetails } from "@/lib/tvmaze";
import { getMovieDetails } from "@/lib/tmdb";
import { getTmdbPosterUrl } from "@/lib/performance";
import type { FeaturedList, FeaturedTitle } from "@/lib/featured-lists";

type Candidate = FeaturedTitle & { year: string; source: string; key: string };
type Analytics = { totals: { users: number; newUsers30d: number; activeUsers30d: number; logs: number; movieLogs: number; tvLogs: number }; audience: { movieOnly: number; tvOnly: number; both: number; noLogs: number }; generatedAt: string };
type Health = { checkedAt: string; requests: Array<{ provider: string; ok: boolean; status: number; ms: number }>; totalMs: number };

async function parseJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const raw = await response.text();
  if (!raw.trim()) throw new Error(`The server returned an empty response (${response.status}). Please retry.`);
  try { return JSON.parse(raw) as Record<string, unknown>; }
  catch { throw new Error(`The server returned an unreadable response (${response.status}). Please retry.`); }
}

const input = "w-full rounded-lg border border-white/10 bg-[#0e0e0d] px-3.5 py-3 text-sm text-[#f4efdf] outline-none placeholder:text-white/30 focus:border-[#ff7a1a]/65";
const tabClass = (active: boolean) => `inline-flex items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold transition ${active ? "border-[#ff7a1a] text-[#f4efdf]" : "border-transparent text-white/45 hover:text-white/75"}`;

function titleCandidate(name: string, type: "movie" | "tv", id: number, poster: string | null | undefined, date: string, source: string): Candidate {
  const title = name.trim();
  const poster_url = type === "movie" ? getTmdbPosterUrl(poster, "w342") || "" : poster || "";
  return { title, href: `/${type}/${id}`, poster_url, media_type: type, media_id: id, release_year: date?.slice(0, 4) || "", year: date?.slice(0, 4) || "", source, key: `${type}:${id}` };
}

function showCandidate(show: ShowDetails): Candidate {
  const title = show.name || show.title || "Untitled";
  return titleCandidate(title, "tv", show.id, show.poster_url || show.poster_path, show.premiered || show.release_date || "", show.source === "tmdb" ? "TMDB TV" : "TVMaze");
}

function normalizeMatchTitle(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function asFeaturedTitle(candidate: Candidate): FeaturedTitle {
  return { title: candidate.title, href: candidate.href, poster_url: candidate.poster_url, media_type: candidate.media_type, media_id: candidate.media_id, release_year: candidate.release_year };
}

export default function AdminPage() {
  const { user, loading: sessionLoading } = useCurrentUser();
  const [tab, setTab] = useState<"lists" | "games" | "analytics" | "health">("lists");
  const [lists, setLists] = useState<FeaturedList[]>([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [signedInIdentity, setSignedInIdentity] = useState<{ email: string; uid: string } | null>(null);
  const [copiedAccessUid, setCopiedAccessUid] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [active, setActive] = useState(false);
  const [rawTitles, setRawTitles] = useState("");
  const [searching, setSearching] = useState(false);
  const [groups, setGroups] = useState<Array<{ query: string; candidates: Candidate[] }>>([]);
  const [selected, setSelected] = useState<FeaturedTitle[]>([]);
  const [frameOptions, setFrameOptions] = useState<Record<number, string[]>>({});
  const [savedLoginPoster, setSavedLoginPoster] = useState<{ title: string; poster_url: string } | null>(null);
  const [loginPosterChoice, setLoginPosterChoice] = useState("");
  const [loginPosterQuery, setLoginPosterQuery] = useState("");
  const [loginPosterResults, setLoginPosterResults] = useState<Candidate[]>([]);
  const [searchingLoginPosters, setSearchingLoginPosters] = useState(false);
  const [savingLoginPoster, setSavingLoginPoster] = useState(false);
  const [replacingKey, setReplacingKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const selectedMovieIds = selected.filter((item) => item.media_type === "movie").map((item) => item.media_id).join(",");

  const token = useCallback(async () => auth.currentUser?.getIdToken() || "", []);
  const requestHeaders = useCallback(async () => ({ Authorization: `Bearer ${await token()}`, "Content-Type": "application/json" }), [token]);
  const loadLists = useCallback(async () => {
    if (!auth.currentUser) { setLoading(false); return; }
    setLoading(true); setDenied(false); setError("");
    try {
      const headers = await requestHeaders();
      const response = await fetch("/api/admin/featured-lists", { headers, cache: "no-store" });
      const body = await parseJsonResponse(response);
      if (response.status === 403) {
        setSignedInIdentity({ email: auth.currentUser?.email || "", uid: auth.currentUser?.uid || "" });
        setDenied(true); return;
      }
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not load featured lists.");
      const loadedLists = Array.isArray(body.lists) ? body.lists as FeaturedList[] : [];
      setLists(loadedLists);
      const posterResponse = await fetch("/api/admin/login-poster", { headers, cache: "no-store" });
      if (posterResponse.ok) {
        const posterBody = await parseJsonResponse(posterResponse);
        const poster = posterBody.poster as { title?: string; poster_url?: string } | null;
        if (poster?.poster_url) {
          setSavedLoginPoster({ title: poster.title || "Featured film", poster_url: poster.poster_url });
          setLoginPosterChoice(poster.poster_url);
        }
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load featured lists."); }
    finally { setLoading(false); }
  }, [requestHeaders]);

  useEffect(() => { if (!sessionLoading && user) void loadLists(); else if (!sessionLoading) setLoading(false); }, [sessionLoading, user, loadLists]);

  const clearEditor = () => { setEditingId(""); setTitle(""); setDescription(""); setExpiresAt(""); setActive(false); setRawTitles(""); setGroups([]); setSelected([]); setFrameOptions({}); setReplacingKey(""); setError(""); setNotice(""); };
  const editList = (list: FeaturedList) => { setEditingId(list.id); setTitle(list.title); setDescription(list.description || ""); setExpiresAt(list.expires_at || ""); setActive(list.active); setSelected(list.items.map((item, index) => ({ ...item, show_in_preview: item.show_in_preview ?? (item.media_type === "movie" && list.items.slice(0, index).filter((previous) => previous.media_type === "movie").length < 3) }))); setGroups([]); setReplacingKey(""); setRawTitles(""); setError(""); setNotice(""); window.scrollTo({ top: 0, behavior: "smooth" }); };

  useEffect(() => {
    const ids = [...new Set(selectedMovieIds.split(",").filter(Boolean).map(Number))];
    let cancelled = false;
    void Promise.all(ids.map(async (id) => {
      try {
        const details = await getMovieDetails(id);
        const options = [...new Set([...(details?.backdrop_gallery_urls || []), details?.backdrop_url].filter((url): url is string => Boolean(url)))];
        return [id, options] as const;
      } catch { return [id, []] as const; }
    })).then((entries) => { if (!cancelled) setFrameOptions(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, [selectedMovieIds]);

  const fetchPicks = async (rawInput = rawTitles, replaceKey = replacingKey) => {
    const names = Array.from(new Set(rawInput.split(/[\n,]+/).map((name) => name.trim()).filter(Boolean)));
    if (!names.length) { setError("Paste one or more titles first."); return; }
    if (names.length > 50) { setError("Keep it to 50 titles per fetch."); return; }
    setSearching(true); setError(""); setNotice("");
    setGroups([]);
    const results: Array<{ query: string; candidates: Candidate[] }> = [];
    for (let index = 0; index < names.length; index += 3) {
      const batch = names.slice(index, index + 3);
      const batchResults = await Promise.all(batch.map(async (query) => {
        try {
          const [tmdb, tvmaze] = await Promise.all([searchMulti(query), searchTVMazeShowsOnly(query)]);
          const candidates = [
            ...tmdb.movies.slice(0, 5).map((movie) => titleCandidate(movie.title, "movie", movie.id, movie.poster_path, movie.release_date, "TMDB")),
            ...tmdb.shows.slice(0, 5).map(showCandidate),
            ...tvmaze.slice(0, 5).map(showCandidate),
          ].filter((item, i, all) => item.poster_url && all.findIndex((other) => other.key === item.key) === i)
            .sort((a, b) => {
              const queryTitle = normalizeMatchTitle(query);
              const score = (candidate: Candidate) => {
                const candidateTitle = normalizeMatchTitle(candidate.title);
                return (candidateTitle === queryTitle ? 100 : candidateTitle.startsWith(queryTitle) ? 60 : candidateTitle.includes(queryTitle) ? 30 : 0) + (candidate.source.startsWith("TMDB") ? 2 : 0);
              };
              return score(b) - score(a);
            }).slice(0, 5);
          return { query, candidates };
        } catch { return { query, candidates: [] }; }
      }));
      results.push(...batchResults);
      setGroups([...results]);
      const firstMatches = batchResults.map((group) => group.candidates[0]).filter((candidate): candidate is Candidate => Boolean(candidate));
      if (replaceKey && firstMatches[0]) {
        setSelected((current) => {
          const duplicateExists = current.some((item) => `${item.media_type}:${item.media_id}` === firstMatches[0].key && `${item.media_type}:${item.media_id}` !== replaceKey);
          return current.flatMap((item) => `${item.media_type}:${item.media_id}` === replaceKey ? (duplicateExists ? [] : [{ ...asFeaturedTitle(firstMatches[0]), show_in_preview: item.show_in_preview === true && firstMatches[0].media_type === "movie" }]) : [item]);
        });
        setReplacingKey(""); setRawTitles("");
      } else if (!replaceKey && firstMatches.length) {
        setSelected((current) => {
          const next = [...current];
          for (const candidate of firstMatches) {
            if (next.length >= 50) break;
            if (!next.some((item) => `${item.media_type}:${item.media_id}` === candidate.key)) next.push({ ...asFeaturedTitle(candidate), show_in_preview: candidate.media_type === "movie" && next.filter((item) => item.show_in_preview).length < 3 });
          }
          return next;
        });
      }
    }
    setGroups(results);
    setSearching(false);
    if (results.every((group) => !group.candidates.length)) setNotice("No poster matches came back. Try the title again with its year.");
    else if (replaceKey) setNotice(`Updated the pick to ${results[0]?.candidates[0]?.title || "the first match"}. You can use Edit to choose another match.`);
    else setNotice("First matches added to the list. Use Edit on any poster to choose another match.");
  };

  const toggleCandidate = (candidate: Candidate) => {
    const replacement = asFeaturedTitle(candidate);
    if (replacingKey) {
      setSelected((current) => {
        const alreadySelected = current.some((item) => `${item.media_type}:${item.media_id}` === candidate.key && `${item.media_type}:${item.media_id}` !== replacingKey);
        return current.flatMap((item) => `${item.media_type}:${item.media_id}` === replacingKey ? (alreadySelected ? [] : [{ ...replacement, show_in_preview: item.show_in_preview === true && replacement.media_type === "movie" }]) : [item]);
      });
      setReplacingKey(""); setRawTitles(""); setGroups([]); setNotice(`Updated pick to ${candidate.title}.`); return;
    }
    setSelected((current) => current.some((item) => item.media_type === candidate.media_type && item.media_id === candidate.media_id)
      ? current.filter((item) => !(item.media_type === candidate.media_type && item.media_id === candidate.media_id))
      : current.length >= 50 ? current : [...current, { ...replacement, show_in_preview: replacement.media_type === "movie" && current.filter((item) => item.show_in_preview).length < 3 }]);
  };

  const beginReplacing = (item: FeaturedTitle) => {
    setReplacingKey(`${item.media_type}:${item.media_id}`);
    setRawTitles(item.title);
    setGroups([]);
    setError("");
    setNotice(`Fetching alternatives for “${item.title}”.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
    void fetchPicks(item.title, `${item.media_type}:${item.media_id}`);
  };

  const saveList = async () => {
    if (!title.trim() || !selected.length) { setError("Add a list name and at least one title."); return; }
    setSaving(true); setError(""); setNotice("");
    try {
      const headers = await requestHeaders();
      const response = await fetch("/api/admin/featured-lists", { method: "POST", headers, body: JSON.stringify({ id: editingId || undefined, title, description, active, expires_at: expiresAt || undefined, items: selected }) });
      const body = await parseJsonResponse(response);
      if (!response.ok) throw new Error([typeof body.error === "string" ? body.error : "Could not save this list.", typeof body.detail === "string" ? body.detail : ""].filter(Boolean).join(" "));
      const savedList = body.list as FeaturedList;
      setLists((current) => [savedList, ...current.filter((item) => item.id !== savedList.id)]);
      clearEditor(); setNotice("List saved.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save this list."); }
    finally { setSaving(false); }
  };

  const deleteList = async (id: string) => {
    if (!window.confirm("Delete this featured list?")) return;
    try {
      const headers = await requestHeaders();
      const response = await fetch("/api/admin/featured-lists", { method: "DELETE", headers, body: JSON.stringify({ id }) });
      const body = await parseJsonResponse(response);
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not delete the list.");
      setLists((current) => current.filter((list) => list.id !== id));
      if (editingId === id) clearEditor();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not delete the list."); }
  };

  const loadAnalytics = async (force = false) => {
    setTab("analytics"); if (analytics && !force) return;
    setAnalyticsLoading(true);
    try { const response = await fetch("/api/admin/analytics", { headers: await requestHeaders(), cache: "no-store" }); const body = await parseJsonResponse(response); if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not load analytics."); setAnalytics(body as unknown as Analytics); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load analytics."); }
    finally { setAnalyticsLoading(false); }
  };

  const runHealth = async () => {
    setTab("health"); setHealthLoading(true); setError("");
    try { const response = await fetch("/api/admin/api-health", { method: "POST", headers: await requestHeaders() }); const body = await parseJsonResponse(response); if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not check providers."); setHealth(body as unknown as Health); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not check providers."); }
    finally { setHealthLoading(false); }
  };

  const tabChange = (value: "lists" | "games" | "analytics" | "health") => { setTab(value); setError(""); if (value === "analytics" && !analytics) void loadAnalytics(); };
  const selectedKeys = useMemo(() => new Set(selected.map((item) => `${item.media_type}:${item.media_id}`)), [selected]);
  const loginPosterOptions = useMemo(() => {
    const seen = new Set<string>();
    return [...lists.flatMap((list) => list.items), ...loginPosterResults]
      .filter((item) => item.media_type === "movie" && item.poster_url)
      .filter((item) => {
        const key = `${item.media_type}:${item.media_id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [lists, loginPosterResults]);
  const selectedLoginPoster = loginPosterOptions.find((item) => item.poster_url === loginPosterChoice);
  const loginPosterPreviewUrl = selectedLoginPoster?.poster_url || savedLoginPoster?.poster_url || "https://image.tmdb.org/t/p/w500/gknAq4pAuToh1Aq5CJfVkGQkExT.jpg";

  const searchLoginPosters = async () => {
    const query = loginPosterQuery.trim();
    if (!query) return;
    setSearchingLoginPosters(true); setError("");
    try {
      const result = await searchMulti(query);
      const matches = result.movies.slice(0, 10)
        .map((movie) => titleCandidate(movie.title, "movie", movie.id, movie.poster_path, movie.release_date, "TMDB"))
        .filter((movie) => movie.poster_url);
      setLoginPosterResults(matches);
      if (!matches.length) setNotice("No movie posters found. Try another title.");
      else setNotice("Choose a movie from the search results or the saved list.");
    } catch {
      setError("Could not search movie posters. Please try again.");
    } finally { setSearchingLoginPosters(false); }
  };

  const saveLoginPoster = async () => {
    const chosen = loginPosterOptions.find((item) => item.poster_url === loginPosterChoice);
    if (!chosen) { setError("Choose a movie poster from your saved featured lists first."); return; }
    setSavingLoginPoster(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/admin/login-poster", {
        method: "PUT",
        headers: await requestHeaders(),
        body: JSON.stringify({ title: chosen.title, poster_url: chosen.poster_url }),
      });
      const body = await parseJsonResponse(response);
      if (!response.ok) throw new Error(typeof body.error === "string" ? body.error : "Could not save the login poster.");
      const poster = body.poster as { title: string; poster_url: string };
      setSavedLoginPoster(poster);
      setLoginPosterChoice(poster.poster_url);
      setNotice("Login page poster updated.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not save the login poster."); }
    finally { setSavingLoginPoster(false); }
  };

  if (sessionLoading || loading) return null;
  if (!user) return <main className="min-h-screen bg-[#090909] p-6 text-[#f4efdf]"><div className="mx-auto mt-20 max-w-md border border-white/10 bg-[#111] p-8"><h1 className="font-serif text-3xl">Canisterr Studio</h1><p className="mt-3 text-sm text-white/50">Sign in with an authorized Canisterr account.</p><Link href="/auth/login?redirect=/admin" className="mt-6 inline-flex rounded-full bg-[#ff7a1a] px-5 py-3 font-bold text-black">Sign in</Link></div></main>;
  if (denied) return <main className="min-h-screen bg-[#090909] px-5 py-20 text-[#f4efdf]"><div className="mx-auto max-w-2xl border border-white/10 bg-[#111] p-8"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#ff9b52]">Canisterr Studio</p><h1 className="mt-2 font-serif text-3xl">Access unavailable</h1><p className="mt-4 text-sm leading-6 text-white/60">This account isn’t authorized for this workspace.</p>{signedInIdentity && <div className="mt-5 border border-white/10 bg-black/20 p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Current sign-in</p><p className="mt-2 text-sm text-[#f4efdf]">{signedInIdentity.email || "No email on this account"}</p><div className="mt-2 flex flex-wrap items-center gap-2"><code className="break-all text-xs text-white/50">{signedInIdentity.uid}</code><button type="button" onClick={() => { if (navigator.clipboard) void navigator.clipboard.writeText(signedInIdentity.uid).then(() => setCopiedAccessUid(true)); }} className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-white/65">{copiedAccessUid ? "Copied UID" : "Copy UID"}</button></div></div>}<p className="mt-3 text-xs text-white/40">Workspace access is managed by the service owner.</p></div></main>;

  return <main className="min-h-screen bg-[#090909] px-4 py-6 text-[#f4efdf] sm:px-8 sm:py-10"><div className="mx-auto max-w-7xl">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-5"><div><p className="text-[11px] font-bold uppercase tracking-[.2em] text-[#ff9b52]">Canisterr · Studio</p><h1 className="mt-2 font-serif text-3xl sm:text-4xl">Collection Studio</h1><p className="mt-2 text-sm text-white/45">Home picks, audience activity and provider health.</p></div><Link href="/dashboard" className="text-sm text-white/50 hover:text-white">← Home</Link></header>
    <nav aria-label="Admin sections" className="mt-5 flex gap-2 border-b border-white/10"><button onClick={() => tabChange("lists")} className={tabClass(tab === "lists")}><ListPlus size={16}/> Featured lists</button><button onClick={() => tabChange("games")} className={tabClass(tab === "games")}><Clapperboard size={16}/> Games</button><button onClick={() => tabChange("analytics")} className={tabClass(tab === "analytics")}><BarChart3 size={16}/> Analytics</button><button onClick={() => tabChange("health")} className={tabClass(tab === "health")}><Activity size={16}/> API health</button></nav>
    {error && <p role="alert" className="mt-4 border border-red-400/20 bg-red-400/5 px-4 py-3 text-sm text-red-200">{error}</p>}
    {notice && <p role="status" className="mt-4 text-sm text-[#ffb36b]">{notice}</p>}

    {tab === "games" && <AdminDailyGames requestHeaders={requestHeaders} />}

    {tab === "lists" && <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(350px,.85fr)]">
      <section className="space-y-6">
        <section className="border border-white/10 bg-[#10100f] p-4 sm:p-6">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ff9b52]">Sign-in screen</p>
          <h2 className="mt-1 text-xl font-bold">Choose the login poster</h2>
          <p className="mt-1 text-sm text-white/45">Search for a movie or choose one from your saved featured lists. Its poster appears on the desktop login and sign-up screens.</p>
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden border border-white/10 bg-black">
              <Image src={loginPosterPreviewUrl} alt="Selected login poster preview" fill sizes="112px" className="object-cover"/>
            </div>
            <div className="min-w-0 flex-1">
              <label htmlFor="login-poster-search" className="text-xs font-semibold text-white/65">Search movies</label>
              <div className="mt-1 flex gap-2"><input id="login-poster-search" value={loginPosterQuery} onChange={(event) => setLoginPosterQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchLoginPosters(); } }} className={`${input} min-w-0 flex-1`} placeholder="Search a movie title"/><button type="button" onClick={() => void searchLoginPosters()} disabled={searchingLoginPosters || !loginPosterQuery.trim()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-xs font-semibold text-white/70 disabled:opacity-40">{searchingLoginPosters ? <LoaderCircle size={14} className="animate-spin"/> : <Search size={14}/>} Search</button></div>
              <label htmlFor="login-poster-choice" className="text-xs font-semibold text-white/65">Movie poster</label>
              <select id="login-poster-choice" value={loginPosterChoice} onChange={(event) => setLoginPosterChoice(event.target.value)} className={`${input} mt-1`}>
                <option value="">{savedLoginPoster ? `Current: ${savedLoginPoster.title}` : "Choose a movie poster"}</option>
                {loginPosterOptions.map((item) => <option key={`${item.media_type}:${item.media_id}`} value={item.poster_url}>{item.title}</option>)}
              </select>
              <button type="button" onClick={() => void saveLoginPoster()} disabled={savingLoginPoster || !loginPosterChoice || loginPosterChoice === savedLoginPoster?.poster_url} className="mt-3 rounded-full bg-[#ff7a1a] px-4 py-2.5 text-xs font-bold text-black disabled:opacity-40">{savingLoginPoster ? "Saving…" : "Save login poster"}</button>
            </div>
          </div>
        </section>
        <div className="border border-white/10 bg-[#10100f] p-4 sm:p-6">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ff9b52]">Home placement</p><h2 className="mt-1 text-xl font-bold">Build a featured list</h2><p className="mt-1 text-sm text-white/45">Paste titles, check the matches, and choose what appears on the home screen.</p></div>{editingId && <button onClick={clearEditor} className="rounded-lg border border-white/10 p-2 text-white/55" aria-label="New list"><Plus size={17}/></button>}</div>
          <div className="mt-5 grid gap-3"><input value={title} onChange={(e) => setTitle(e.target.value)} className={input} placeholder="List title · e.g. After-hours thrillers" maxLength={100}/><textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${input} min-h-20 resize-y`} placeholder="One short line to introduce the picks" maxLength={280}/><label className="text-xs font-semibold text-white/60">Hide after (optional)<input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className={`${input} mt-1`} /></label>
            <div className="border border-white/10 bg-[#0a0a09] p-3 sm:p-4"><label className="text-xs font-semibold text-white/65" htmlFor="paste-titles">Paste titles separated by commas or new lines</label><textarea id="paste-titles" value={rawTitles} onChange={(e) => setRawTitles(e.target.value)} className={`${input} mt-2 min-h-24 resize-y`} placeholder="Arrival, Breaking Bad, The Bear"/><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><p className="text-[11px] text-white/35">Up to 50 titles · cached TMDB and TVMaze search</p><button type="button" onClick={() => void fetchPicks()} disabled={searching || !rawTitles.trim()} className="inline-flex items-center gap-2 rounded-full bg-[#ff7a1a] px-4 py-2 text-xs font-bold text-black disabled:opacity-45">{searching ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Search size={15}/>} {searching ? "Finding titles…" : "Fetch matches"}</button></div></div>
          </div>

          {groups.length > 0 && <div className="mt-5 space-y-4"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Pick the right match</h3><span className="text-xs text-white/40">{selected.length}/50 chosen</span></div>{groups.map((group, index) => <div key={`${group.query}-${index}`} className="border-t border-white/10 pt-3"><p className="mb-2 text-xs font-semibold text-white/65">“{group.query}”</p>{group.candidates.length ? <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">{group.candidates.map((candidate) => { const chosen = selectedKeys.has(candidate.key); return <button key={candidate.key} type="button" onClick={() => toggleCandidate(candidate)} className={`group relative w-[92px] shrink-0 text-left ${chosen ? "opacity-70" : ""}`} title={`${candidate.title} · ${candidate.year} · ${candidate.source}`}><div className={`relative aspect-[2/3] overflow-hidden border ${chosen ? "border-[#ff7a1a]" : "border-white/10 group-hover:border-white/40"}`}>{candidate.poster_url && <Image src={candidate.poster_url} alt="" fill sizes="92px" className="object-cover"/>}<span className="absolute left-1 top-1 rounded bg-black/75 px-1 py-0.5 text-[8px] uppercase text-white/80">{candidate.media_type === "tv" ? "TV" : "Film"}</span>{chosen && <span className="absolute inset-0 grid place-items-center bg-black/40"><Check className="text-[#ff7a1a]"/></span>}</div><span className="mt-1 block truncate text-[10px] font-medium">{candidate.title}</span><span className="block text-[9px] text-white/40">{candidate.year || candidate.source}</span></button>; })}</div> : <p className="text-xs text-white/35">No matches. Try a shorter title or add the release year.</p>}</div>)}</div>}

          {selected.length > 0 && <div className="mt-5 border-t border-white/10 pt-4"><div className="flex items-center justify-between"><h3 className="text-sm font-bold">Edit picks <span className="font-normal text-white/40">· {selected.length}</span></h3>{editingId && <button type="button" onClick={() => void deleteList(editingId)} className="inline-flex items-center gap-1 text-xs font-semibold text-red-300/80 hover:text-red-200"><Trash2 size={13}/> Delete entire list</button>}</div><p className="mt-1 text-xs text-white/40">Choose up to three movies and a still for each to show in the home film strip.</p><div className="mt-3 flex gap-3 overflow-x-auto pb-2">{selected.map((item, itemIndex) => { const key = `${item.media_type}:${item.media_id}`; const isPreview = item.show_in_preview ?? (item.media_type === "movie" && selected.slice(0, itemIndex).filter((entry) => entry.media_type === "movie").length < 3); const frame = item.frame_url || frameOptions[item.media_id]?.[0] || item.poster_url; return <div key={key} className="w-[190px] shrink-0 rounded-lg border border-white/10 bg-black/20 p-2"><div className="relative aspect-video overflow-hidden border border-[#ff7a1a]/50 bg-[#181818]">{frame && <Image src={frame} alt="" fill sizes="190px" className="object-cover"/>}</div><span className="mt-2 block truncate text-[11px] font-medium" title={`${item.title} · ${item.media_type}`}>{item.title}</span>{item.media_type === "movie" ? <label className="mt-2 flex items-center gap-1.5 text-[10px] text-white/65"><input type="checkbox" checked={isPreview} disabled={!isPreview && selected.filter((entry) => entry.show_in_preview).length >= 3} onChange={(event) => setSelected((curr) => curr.map((entry) => `${entry.media_type}:${entry.media_id}` === key ? { ...entry, show_in_preview: event.target.checked } : entry))} className="accent-[#ff7a1a]"/>Show in top 3</label> : <p className="mt-2 text-[9px] text-white/35">TV titles won’t appear in the movie strip.</p>}{item.media_type === "movie" && frameOptions[item.media_id]?.length ? <label className="mt-2 block text-[9px] text-white/45">Frame<select value={item.frame_url || frameOptions[item.media_id][0]} onChange={(event) => setSelected((curr) => curr.map((entry) => `${entry.media_type}:${entry.media_id}` === key ? { ...entry, frame_url: event.target.value } : entry))} className="mt-1 w-full rounded border border-white/10 bg-[#0e0e0d] p-1.5 text-[10px] text-white/80"><option value={frameOptions[item.media_id][0]}>Still 1</option>{frameOptions[item.media_id].slice(1).map((url, index) => <option key={url} value={url}>Still {index + 2}</option>)}</select></label> : item.media_type === "movie" ? <p className="mt-2 text-[9px] text-white/35">Loading still options…</p> : null}<div className="mt-2 flex gap-1"><button type="button" onClick={() => beginReplacing(item)} className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-1 text-[9px] text-white/55 hover:border-[#ff7a1a]/50 hover:text-[#ffb36b]" aria-label={`Replace ${item.title}`} title="Find a replacement"><RefreshCw size={10}/> Edit</button><button type="button" onClick={() => setSelected((curr) => curr.filter((entry) => `${entry.media_type}:${entry.media_id}` !== key))} className="inline-flex items-center gap-1 rounded border border-white/10 px-1.5 py-1 text-[9px] text-white/55 hover:border-red-300/50 hover:text-red-200" aria-label={`Delete ${item.title}`} title="Delete from list"><X size={10}/> Del</button></div></div>; })}</div></div>}
          <label className="mt-4 flex cursor-pointer items-center gap-2 border-t border-white/10 pt-4 text-sm"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="accent-[#ff7a1a]"/>Show this list on the home screen</label>
          <div className="mt-4 flex gap-2"><button onClick={() => void saveList()} disabled={saving || selected.length === 0} className="rounded-full bg-[#ff7a1a] px-5 py-3 text-sm font-bold text-black disabled:opacity-40">{saving ? "Saving…" : editingId ? "Save changes" : "Save list"}</button>{editingId && <button onClick={clearEditor} className="rounded-full border border-white/15 px-5 py-3 text-sm font-semibold text-white/60">Cancel</button>}</div>
        </div>
      </section>

      <section><div className="mb-3 flex items-end justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ff9b52]">Saved shelves</p><h2 className="mt-1 text-xl font-bold">Your lists</h2></div><span className="text-xs text-white/40">{lists.length} total</span></div>{loading ? <p className="py-10 text-center text-sm text-white/40">Loading lists…</p> : lists.length ? <div className="space-y-3">{lists.map((list) => <article key={list.id} className="border border-white/10 bg-[#10100f] p-4"><div className="flex gap-4"><div className="flex h-[76px] w-[124px] shrink-0 items-center justify-center">{list.items.slice(0, 3).map((item, i) => <div key={`${item.media_type}:${item.media_id}`} className={`relative h-[68px] w-[46px] shrink-0 overflow-hidden border border-[#f4efdf]/25 bg-[#1a1a1a] ${i ? "-ml-5" : ""} ${i === 0 ? "-rotate-[7deg]" : i === 1 ? "z-[2] -translate-y-[3px]" : "z-[1] rotate-[8deg]"}`} style={{ zIndex: i === 1 ? 2 : i === 2 ? 1 : 3 }}>{item.poster_url && <Image src={item.poster_url} alt="" fill sizes="46px" className="object-cover"/>}</div>)}</div><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><div className="flex items-center gap-2"><span className={`h-1.5 w-1.5 rounded-full ${list.active ? "bg-[#ff7a1a]" : "bg-white/25"}`}/><span className="text-[9px] font-bold uppercase tracking-wider text-white/45">{list.active ? "On home" : "Draft"}</span></div><h3 className="mt-1 truncate font-bold">{list.title}</h3><p className="mt-0.5 text-xs text-white/40">{list.items.length} titles{list.description ? ` · ${list.description}` : ""}{list.expires_at ? ` · expires ${list.expires_at}` : ""}</p></div><div className="flex shrink-0 gap-1"><button onClick={() => editList(list)} className="rounded-md border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold">Edit</button><button onClick={() => void deleteList(list.id)} className="rounded-md border border-white/10 p-1.5 text-white/40 hover:text-red-300" aria-label={`Delete ${list.title}`}><Trash2 size={14}/></button></div></div></div></div></article>)}</div> : <div className="border border-dashed border-white/15 p-8 text-center"><Clapperboard className="mx-auto h-7 w-7 text-white/20"/><p className="mt-3 text-sm font-semibold">No lists yet</p><p className="mt-1 text-xs text-white/40">Create a shelf and it’ll appear below Friends Activity.</p></div>}</section>
    </div>}

    {tab === "analytics" && <section className="mt-6">{analyticsLoading ? <p className="py-12 text-center text-sm text-white/40">Reading recent activity…</p> : analytics ? <><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-bold">Audience overview</h2><p className="mt-1 text-xs text-white/40">Private totals only · refreshed {new Date(analytics.generatedAt).toLocaleString()}</p></div><button onClick={() => void loadAnalytics(true)} className="rounded-full border border-white/15 px-4 py-2 text-xs font-semibold text-white/65">Refresh</button></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[{ label: "Users", value: analytics.totals.users, Icon: Users }, { label: "New · 30 days", value: analytics.totals.newUsers30d, Icon: Plus }, { label: "Active · 30 days", value: analytics.totals.activeUsers30d, Icon: Activity }, { label: "Watch logs", value: analytics.totals.logs, Icon: Clapperboard }, { label: "Movie logs", value: analytics.totals.movieLogs, Icon: Film }, { label: "TV logs", value: analytics.totals.tvLogs, Icon: Tv }].map((metric) => <article key={metric.label} className="border border-white/10 bg-[#10100f] p-5"><metric.Icon size={17} className="text-[#ff9b52]"/><p className="mt-4 text-3xl font-bold tabular-nums">{metric.value.toLocaleString()}</p><p className="mt-1 text-xs text-white/45">{metric.label}</p></article>)}</div><div className="mt-5 border border-white/10 bg-[#10100f] p-5"><h3 className="font-bold">Movie and TV mix</h3><p className="mt-1 text-xs text-white/40">Accounts grouped by which log types they have used.</p><div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">{[["Movies only",analytics.audience.movieOnly],["TV only",analytics.audience.tvOnly],["Both",analytics.audience.both],["No logs",analytics.audience.noLogs]].map(([label,value])=><div key={String(label)} className="border-l border-[#ff7a1a]/55 pl-3"><p className="text-2xl font-bold tabular-nums">{Number(value).toLocaleString()}</p><p className="text-xs text-white/45">{String(label)}</p></div>)}</div></div></> : <div className="py-12 text-center"><button onClick={() => void loadAnalytics()} className="rounded-full bg-[#ff7a1a] px-5 py-3 text-sm font-bold text-black">Load analytics</button></div>}</section>}

    {tab === "health" && <section className="mt-6 max-w-3xl"><div className="border border-white/10 bg-[#10100f] p-5 sm:p-7"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#ff9b52]">One check · two requests</p><h2 className="mt-1 text-xl font-bold">Search provider response</h2><p className="mt-2 text-sm leading-6 text-white/45">Run this only when you want to check search availability and response time. It sends one small lookup to TMDB and one to TVMaze.</p><button onClick={() => void runHealth()} disabled={healthLoading} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#ff7a1a] px-5 py-3 text-sm font-bold text-black disabled:opacity-45">{healthLoading ? <LoaderCircle size={16} className="animate-spin"/> : <Activity size={16}/>} {healthLoading ? "Checking…" : "Run provider check"}</button>{health && <div className="mt-6 border-t border-white/10 pt-4"><div className="grid gap-2 sm:grid-cols-2">{health.requests.map((row) => <div key={row.provider} className="flex items-center justify-between border border-white/10 px-4 py-3"><span className="flex items-center gap-2 text-sm"><span className={`h-2 w-2 rounded-full ${row.ok ? "bg-emerald-400" : "bg-red-400"}`}/>{row.provider}</span><span className="text-xs tabular-nums text-white/55">{row.ok ? `OK · ${row.ms} ms` : `Failed · ${row.status || "timeout"}`}</span></div>)}</div><p className="mt-3 text-xs text-white/40">2 requests · {health.totalMs} ms combined · {new Date(health.checkedAt).toLocaleTimeString()}</p></div>}</div></section>}
  </div></main>;
}
