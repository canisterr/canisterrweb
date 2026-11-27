"use client";

import Image from "@/components/AppImage";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, ChevronDown, Flame, Lightbulb, Link2, RotateCcw, Search, Share2, X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import TmdbSearchInput from "@/components/games/TmdbSearchInput";
import PageLayout from "@/components/PageLayout";
import { GAME_CATEGORIES, type GameCategoryId, type PublicDailyGame } from "@/lib/games/types";
import { getGuestId, invalidateDailyGames, loadDailyGames, type DailyPayload, type SavedRun } from "@/lib/games/client";

type AttemptResult = SavedRun & { nextClue?: string | null; cluePosterPath?: string | null; answerProfilePath?: string | null; streak?: number; error?: string };
const CATEGORY_KEY = "canisterr.games.category.v2";
const IMAGE_ROOT = "https://image.tmdb.org/t/p/w342";
const PROFILE_IMAGE_ROOT = "https://image.tmdb.org/t/p/w185";

function posterUrl(path: string | null | undefined) {
  return path ? `${IMAGE_ROOT}${path}` : null;
}

function actorImageUrl(path: string | null | undefined) {
  return path ? `${PROFILE_IMAGE_ROOT}${path}` : null;
}

function formatGamesDate(date: string | undefined) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return "TODAY";
  const [year, month, day] = date.split("-");
  const monthName = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"][Number(month) - 1];
  return monthName ? `${day} ${monthName} ${year}` : "TODAY";
}

function ActorFace({ name, path }: { name: string; path?: string | null }) {
  const image = actorImageUrl(path);
  return <span className="games-actor-face" style={{ borderRadius: 2 }} aria-hidden="true">{image ? <Image src={image} alt="" fill sizes="48px" className="object-cover" /> : <span>{name.trim().charAt(0).toUpperCase()}</span>}</span>;
}

function GameDialog({ puzzle, onClose, onRunUpdate, onStreakUpdate, standalone = false, initialRun, streak = 0 }: { puzzle: PublicDailyGame; onClose: () => void; onRunUpdate: (run: SavedRun) => void; onStreakUpdate?: (value: number) => void; standalone?: boolean; initialRun?: SavedRun; streak?: number }) {
  const [run, setRun] = useState<SavedRun>(() => initialRun || { attempts: 0, complete: false, won: false, score: 0 });
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [poster, setPoster] = useState<string | null>(null);
  const [cluePoster, setCluePoster] = useState<string | null>(null);
  const maxAttempts = puzzle.kind === "reveal" ? 6 : 3;

  async function submit(value = guess) {
    if (!value.trim() || busy || run.complete) return;
    setBusy(true);
    setMessage("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/games/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ category: puzzle.category, kind: puzzle.kind, guess: value, sessionId: getGuestId() }),
      });
      const payload = await response.json() as AttemptResult;
      if (!response.ok) {
        setMessage(payload.error || "Could not check that guess. Try again.");
        if (typeof payload.attempts === "number" && payload.complete) {
          const nextRun = { ...run, attempts: payload.attempts, complete: true, won: false };
          setRun(nextRun);
          onRunUpdate(nextRun);
        }
        return;
      }
      // Refresh the in-memory daily payload so the home cards show the new played state.
      invalidateDailyGames(auth.currentUser?.uid || getGuestId(), puzzle.category);
      const nextRun: SavedRun = { attempts: payload.attempts, complete: payload.complete, won: payload.won, score: payload.score, answer: payload.answer || undefined, clue: payload.nextClue || undefined, answerTmdbId: payload.answerTmdbId, answerMediaType: payload.answerMediaType, answerPosterPath: payload.answerPosterPath, answerProfilePath: payload.answerProfilePath };
      if (typeof payload.streak === "number") onStreakUpdate?.(payload.streak);
      setRun(nextRun);
      setPoster(payload.answerPosterPath || null);
      setCluePoster(payload.cluePosterPath || null);
      onRunUpdate(nextRun);
      setGuess("");
      if (!payload.complete && payload.nextClue) setMessage(payload.nextClue);
      else if (payload.complete && payload.won) setMessage("That’s it.");
      else if (payload.complete) setMessage("Round over. The answer is below.");
    } catch {
      setMessage("Connection hiccup. Your attempt was not used; try again.");
    } finally {
      setBusy(false);
    }
  }

  const posterSrc = posterUrl(run.complete ? poster || run.answerPosterPath || puzzle.posterPath : puzzle.posterPath);
  async function shareResult() {
    const label = GAME_CATEGORIES.find((item) => item.id === puzzle.category)?.label || "Cinema";
    const squares = Array.from({ length: maxAttempts }, (_, index) => index < run.attempts - (run.won ? 1 : 0) ? "🟧" : index === run.attempts - 1 && run.won ? "🟩" : "⬛").join("");
    const summary = `Canisterr ${puzzle.kind === "reveal" ? "Reveal" : "Connection"} · ${label}\n${squares}\n${run.won ? `Solved in ${run.attempts}/${maxAttempts} attempts.` : "Played today."}\n${window.location.origin}/games`;
    try {
      if (navigator.share) await navigator.share({ text: summary });
      else await navigator.clipboard.writeText(summary);
      setMessage("Spoiler-free result ready to share.");
    } catch { /* The user may cancel the share sheet. */ }
  }
  return (
    <div className={standalone ? "mx-auto w-full max-w-3xl px-4 py-5 sm:px-7 sm:py-10" : "fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5"} role={standalone ? undefined : "presentation"} onMouseDown={standalone ? undefined : (event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role={standalone ? undefined : "dialog"} aria-modal={standalone ? undefined : true} aria-labelledby="game-dialog-title" className={`games-play-shell relative w-full overflow-y-visible text-[#f5f0de] ${standalone ? "games-play-shell--page max-w-3xl" : "max-h-[94dvh] max-w-xl rounded-t-3xl border border-white/10 bg-[#12110f] p-5 shadow-2xl sm:rounded-3xl sm:p-7"}`}>
        <button type="button" onClick={onClose} aria-label="Close game" className="absolute right-4 top-4 rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
        <header className="games-play-heading">
          <p className="games-play-kicker"><span>{puzzle.kind === "reveal" ? "DAILY FILM · 01" : "DAILY FILM · 02"}</span><i />{puzzle.kind === "reveal" ? "6 GUESSES" : "3 GUESSES"}</p>
          <h2 id="game-dialog-title">{puzzle.kind === "reveal" ? "The Reveal" : "The Connection"}</h2>
          <p>{GAME_CATEGORIES.find((item) => item.id === puzzle.category)?.label}</p>
          <p className="games-streak-label"><Flame aria-hidden="true" />{streak} {streak === 1 ? "day" : "days"} streak</p>
        </header>

        {puzzle.kind === "reveal" ? (
          <div className="games-clue-panel mt-6">
            <p className="text-[11px] font-bold uppercase tracking-[0.15em]">Clue {String(run.attempts + 1).padStart(2, "0")}</p>
            <p className="mt-2 text-lg font-semibold">{puzzle.firstClue || (puzzle.releaseDate ? `Released in ${puzzle.releaseDate.slice(0, 4)}` : "A movie from this category")}</p>
            {run.clue && <p className="mt-3 flex gap-2 text-sm text-[#f5f0de]/70"><Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#ff7a1a]" />{run.clue}</p>}
            {cluePoster && <div className="relative mx-auto mt-4 h-40 w-28 overflow-hidden rounded-lg"><Image src={posterUrl(cluePoster)!} alt="Blurred poster clue" fill sizes="112px" className="scale-110 object-cover blur-xl" /></div>}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3">
            {(puzzle.pair || []).map((item) => <div key={item.title} className="games-connection-title mx-auto w-full max-w-[11rem] min-w-0 overflow-hidden rounded-xl border border-white/10 bg-[#1c1a17]">
              <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#24221e]">
                {posterUrl(item.posterPath) ? <Image src={posterUrl(item.posterPath)!} alt={`${item.title} poster`} fill sizes="(max-width: 600px) 42vw, 220px" className="object-cover" /> : <div className="absolute inset-0 grid place-items-center p-4 text-center text-sm font-semibold">{item.title}</div>}
              </div>
              <div className="games-connection-caption p-3 text-center sm:p-4">
                <p className="line-clamp-2 text-sm font-bold leading-snug sm:text-base">{item.title}</p>
              </div>
            </div>)}
            {run.clue && <p className="col-span-2 flex gap-2 text-sm text-white/60"><Lightbulb className="h-4 w-4 text-[#ff7a1a]" />{run.clue}</p>}
          </div>
        )}

        <div className="games-progress-line"><span>GUESSES</span><span>{run.attempts} / {maxAttempts} USED</span></div>
        <div className="games-attempt-meter mt-2 flex items-center gap-2" aria-label={`${maxAttempts - run.attempts} attempts remaining`}>
          {Array.from({ length: maxAttempts }, (_, index) => <span key={index} className={`h-1.5 flex-1 rounded-full ${index < run.attempts ? run.won && index === run.attempts - 1 ? "bg-emerald-400" : "bg-[#d46b35]" : "bg-white/10"}`} />)}
        </div>

        {run.complete ? (
          <div className="games-answer-panel mt-6">
            <div className={`games-answer-art relative shrink-0 overflow-hidden bg-white/10 ${puzzle.kind === "connection" && run.answerProfilePath ? "games-answer-art--face" : ""}`}>
              {puzzle.kind === "connection" && run.answerProfilePath
                ? <Image src={actorImageUrl(run.answerProfilePath)!} alt={`${run.answer || "Shared actor"} portrait`} fill sizes="88px" className="object-contain" />
                : posterSrc && <Image src={posterSrc} alt="Answer poster" fill sizes="112px" className="object-cover" />}
            </div>
            <div className="min-w-0">
              <p className={`games-answer-label ${run.won ? "text-emerald-400" : "text-[#d46b35]"}`}>{run.won ? "SOLVED" : "TONIGHT'S FEATURE"}</p>
              <p className="games-answer-title mt-2">{run.answer || "Challenge complete"}</p>
              <p className="mt-2 text-sm text-white/50">{run.won ? `Solved in ${run.attempts} guesses.` : "Next round at midnight UTC."}</p>
              <div className="games-answer-actions mt-4">
                {run.answerTmdbId && run.answerMediaType && <Link href={`/${run.answerMediaType === "tv" ? "tv" : "movie"}/${run.answerTmdbId}`} onClick={onClose} className="inline-flex items-center gap-1.5 text-sm font-bold text-[#ff7a1a] hover:text-[#ff9a51]">Open film <ArrowRight className="h-4 w-4" /></Link>}
                <button type="button" onClick={() => void shareResult()} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-2 text-xs font-semibold text-white/65 hover:border-white/30 hover:text-white"><Share2 className="h-3.5 w-3.5" />Share score</button>
              </div>
            </div>
          </div>
        ) : (
          <form className="games-guess-form mt-6" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
            <label htmlFor="game-guess" className="mb-2 block text-sm font-semibold">{puzzle.kind === "reveal" ? "Your movie guess" : "Who appeared in both?"}</label>
            <div className="flex gap-2 rounded-xl border border-white/15 bg-black/30 px-4 py-3 focus-within:border-[#d46b35]">
              <TmdbSearchInput kind={puzzle.kind === "reveal" ? "title" : "person"} label={puzzle.kind === "reveal" ? "Search movie title" : "Search actor name"} value={guess} onChange={setGuess} className="flex-1 text-base text-[#f5f0de]" placeholder={puzzle.kind === "reveal" ? "Type a movie title" : "Search actors by name"} />
              <button type="submit" disabled={busy || !guess.trim()} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#ff7a1a] px-4 py-3 font-bold text-black transition hover:bg-[#ff8d35] disabled:opacity-50">{busy ? "Checking" : "Guess"}<ArrowRight className="h-4 w-4" /></button>
            </div>
            <button type="button" disabled={busy} onClick={() => void submit("__skip__")} className="mt-3 text-sm text-white/50 underline decoration-white/25 underline-offset-4 hover:text-white">Skip and reveal a clue</button>
          </form>
        )}
        {message && !run.complete && <p role="status" className="mt-3 text-sm text-white/65">{message}</p>}
        {message && run.complete && <p role="status" className="sr-only">{message}</p>}
      </section>
    </div>
  );
}

type GeneratedGrid = { id: string; category: string; difficulty: string; rows: string[]; rowProfiles?: Array<string | null>; rowActorIds?: Array<number | null>; columns: string[]; uniqueAnswers: boolean; mode: "matrix" | "clue-cells"; cellClues?: Array<{ actor: string; actorId?: number; actorProfilePath: string | null; genre: string }>; maxGuesses: number };
type GridResult = { correct: boolean; answer: { title: string; posterPath: string | null; tmdbId: number; mediaType: "movie" | "tv" } };

function GridDialog({ category, onClose, onStreakUpdate, standalone = false, streak = 0 }: { category: GameCategoryId; onClose: () => void; onStreakUpdate?: (value: number) => void; standalone?: boolean; streak?: number }) {
  const difficulty = "medium";
  const [grid, setGrid] = useState<GeneratedGrid | null>(null);
  const [guesses, setGuesses] = useState<string[]>(Array(9).fill(""));
  const [guessIds, setGuessIds] = useState<Array<number | null>>(Array(9).fill(null));
  const [results, setResults] = useState<GridResult[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const autoStarted = useRef(false);

  const startGrid = useCallback(async (nextDifficulty = difficulty) => {
    setBusy(true);
    setError("");
    setGrid(null);
    setResults(null);
    setGuesses(Array(9).fill(""));
    setGuessIds(Array(9).fill(null));
    try {
      const response = await fetch(`/api/games/grid?category=${encodeURIComponent(category)}&difficulty=${nextDifficulty}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Could not create a grid.");
      setGrid(payload as GeneratedGrid);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create a grid.");
    } finally {
      setBusy(false);
    }
  }, [category, difficulty]);

  useEffect(() => {
    if (standalone && !autoStarted.current) {
      autoStarted.current = true;
      void startGrid();
    }
  }, [standalone, startGrid]);

  async function checkGrid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!grid || guesses.some((guess) => !guess.trim()) || guessIds.some((id) => id === null)) {
      setError("Choose a movie from the search results in each square.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/games/grid", {
        method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ gridId: grid.id, movieIds: guessIds, sessionId: getGuestId() }),
      });
      const payload = await response.json() as { results?: GridResult[]; streak?: number; error?: string };
      if (!response.ok || !payload.results) throw new Error(payload.error || "Could not check the grid.");
      invalidateDailyGames(auth.currentUser?.uid || getGuestId(), category);
      setResults(payload.results);
      if (typeof payload.streak === "number") onStreakUpdate?.(payload.streak);
      try {
        const key = "canisterr.games.grid.best.v1";
        const previous = Number(localStorage.getItem(key) || 0);
        const score = payload.results.filter((item) => item.correct).length;
        if (score > previous) localStorage.setItem(key, String(score));
      } catch { /* Personal record is optional. */ }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not check the grid.");
    } finally {
      setBusy(false);
    }
  }

  return <div className={standalone ? "mx-auto w-full max-w-7xl px-4 py-5 sm:px-7 sm:py-10" : "fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-5"} role={standalone ? undefined : "presentation"} onMouseDown={standalone ? undefined : (event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role={standalone ? undefined : "dialog"} aria-modal={standalone ? undefined : true} aria-labelledby="grid-dialog-title" className={`games-grid-shell relative w-full overflow-y-visible text-[#f5f0de] ${standalone ? "games-grid-shell--page max-w-7xl" : "max-h-[94dvh] max-w-3xl rounded-t-3xl border border-white/10 bg-[#12110f] p-5 shadow-2xl sm:rounded-3xl sm:p-7 sm:max-h-[90dvh]"}`}>
      <button type="button" onClick={onClose} aria-label="Close grid" className="absolute right-4 top-4 rounded-full p-2 text-white/60 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
      <header className="games-grid-heading">
        <p>CANISTERR <i /> OPEN GRID</p>
        <h2 id="grid-dialog-title">Cinema Grid</h2>
        <span>{grid?.mode === "clue-cells" ? "Find one movie for each actor and genre." : "One movie for every actor × genre square."}</span>
        <strong className="games-streak-label"><Flame aria-hidden="true" />{streak} {streak === 1 ? "day" : "days"} streak</strong>
      </header>
      {!grid && <div className="mt-6">
        <button type="button" onClick={() => void startGrid()} disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#d46b35] px-4 py-3 font-bold text-black transition hover:bg-[#e17a43] disabled:opacity-50 sm:w-auto">{busy ? "Building a grid…" : error ? "Try again" : "Create grid"}<ArrowRight className="h-4 w-4" /></button>
      </div>}
      {grid && <form onSubmit={(event) => void checkGrid(event)} className="mt-6">
        {grid.mode === "clue-cells" ? <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {(grid.cellClues || []).map((clue, index) => {
            const result = results?.[index];
            return <div key={`${clue.actor}:${clue.genre}:${index}`} className={`games-grid-cell min-w-0 ${result ? result.correct ? "is-correct" : "is-checked" : ""}`}>
              <div className="games-grid-clue"><span className="games-grid-actor"><ActorFace name={clue.actor} path={clue.actorProfilePath} /><span>{clue.actor}</span></span><i>×</i><span className="games-grid-genre">{clue.genre}</span></div>
              {result ? <>
                <div className="relative mx-auto mt-3 aspect-[2/3] w-16 overflow-hidden rounded-sm bg-black/40 sm:w-[4.5rem]">{posterUrl(result.answer.posterPath) && <Image src={posterUrl(result.answer.posterPath)!} alt={`${result.answer.title} poster`} fill sizes="72px" className="object-cover" />}</div>
                <p className="mt-2 line-clamp-2 text-center text-xs font-semibold leading-tight sm:text-sm">{result.answer.title}</p>
                {result.correct && <Check className="mx-auto mt-2 h-4 w-4 text-emerald-400" />}
              </> : <div className="games-grid-search"><Search aria-hidden="true" /><TmdbSearchInput label={`${clue.actor} and ${clue.genre} movie`} kind="title" value={guesses[index]} onChange={(value) => { setGuesses((previous) => previous.map((entry, slot) => slot === index ? value : entry)); setGuessIds((previous) => previous.map((entry, slot) => slot === index ? null : entry)); }} onSelect={(item) => { if (item.type === "movie") setGuessIds((previous) => previous.map((entry, slot) => slot === index ? item.id : entry)); }} placeholder="Search a movie" inputClassName="h-10 pl-8 pr-2 text-xs sm:text-sm" showSelectedPoster /></div>}
            </div>;
          })}
        </div> : <>
        <div className="games-grid-column-headings grid grid-cols-3 gap-3 pl-[6.5rem] sm:pl-[10.5rem]">{grid.columns.map((column) => <p key={column} className="flex min-h-9 items-end justify-center pb-1 text-center text-[11px] font-bold leading-tight text-[#ffad74] sm:text-sm">{column}</p>)}</div>
        {grid.rows.map((actor, rowIndex) => <div key={actor} className="mt-3 grid grid-cols-[6.5rem_minmax(0,1fr)] items-stretch gap-2 border-t border-white/10 pt-3 sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:gap-3">
          <div className="games-grid-row-title flex items-center break-words text-xs font-semibold leading-tight sm:text-sm"><ActorFace name={actor} path={grid.rowProfiles?.[rowIndex]} /><span>{actor}</span></div>
          <div className="grid grid-cols-3 gap-2">{grid.columns.map((column, columnIndex) => {
            const index = rowIndex * 3 + columnIndex;
            const result = results?.[index];
            return <div key={`${actor}:${column}`} className={`games-grid-cell min-w-0 ${result ? result.correct ? "is-correct" : "is-checked" : ""}`}>
              {result ? <>
                <div className="relative mx-auto aspect-[2/3] w-16 overflow-hidden rounded-sm bg-black/40 sm:w-[4.5rem]">{posterUrl(result.answer.posterPath) && <Image src={posterUrl(result.answer.posterPath)!} alt={`${result.answer.title} poster`} fill sizes="72px" className="object-cover" />}</div>
                <p className="mt-2 line-clamp-2 text-center text-xs font-semibold leading-tight sm:text-sm">{result.answer.title}</p>
                {result.correct && <Check className="mx-auto mt-1 h-3.5 w-3.5 text-emerald-400" />}
              </> : <div className="games-grid-search"><Search aria-hidden="true" /><TmdbSearchInput label={`${actor} and ${column} movie`} kind="title" value={guesses[index]} onChange={(value) => { setGuesses((previous) => previous.map((entry, slot) => slot === index ? value : entry)); setGuessIds((previous) => previous.map((entry, slot) => slot === index ? null : entry)); }} onSelect={(item) => { if (item.type === "movie") setGuessIds((previous) => previous.map((entry, slot) => slot === index ? item.id : entry)); }} placeholder="Search a movie" inputClassName="h-10 pl-8 pr-2 text-xs sm:text-sm" showSelectedPoster /></div>}
            </div>;
          })}</div>
        </div>)}
        </>}
        {results ? <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-white/65">{results.filter((result) => result.correct).length} / 9 correct</p><button type="button" onClick={() => void startGrid()} disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-[#ff7a1a] px-4 py-2.5 text-sm font-bold text-black hover:bg-[#ff8d35] disabled:opacity-50"><RotateCcw className="h-4 w-4" />New grid</button></div> : <button type="submit" disabled={busy || guessIds.some((id) => id === null)} className="games-grid-submit mt-5 w-full rounded-xl px-4 py-3 font-bold transition disabled:cursor-not-allowed">{busy ? "Checking…" : "Check answers"}</button>}
      </form>}
      {error && <p role="alert" className="mt-4 text-sm text-[#ffad74]">{error}</p>}
    </section>
  </div>;
}

export default function GamesPage({ routeKind, initialCategory }: { routeKind?: "reveal" | "connection" | "grid"; initialCategory?: GameCategoryId } = {}) {
  const { user } = useCurrentUser();
  const router = useRouter();
  const [daily, setDaily] = useState<DailyPayload | null>(null);
  const [category, setCategory] = useState<GameCategoryId>(initialCategory || "english");
  const [runs, setRuns] = useState<Record<string, SavedRun>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const categoryRequest = useRef(0);

  useEffect(() => {
    const requestId = ++categoryRequest.current;
    let chosenCategory = initialCategory || "english";
    if (!initialCategory) {
      try {
        const savedCategory = localStorage.getItem(CATEGORY_KEY) as GameCategoryId | null;
        if (savedCategory && GAME_CATEGORIES.some((item) => item.id === savedCategory)) chosenCategory = savedCategory;
      } catch { /* Keep the default category when storage is unavailable. */ }
    }
    setCategory(chosenCategory);
    setLoading(true);
    setLoadError("");
    let live = true;
    void (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const identity = auth.currentUser?.uid || getGuestId();
        const payload = await loadDailyGames(identity, chosenCategory, token);
        if (!live || requestId !== categoryRequest.current) return;
        setLoadError("");
        setDaily(payload);
        const restored: Record<string, SavedRun> = {};
        for (const [gameCategory, runsForCategory] of Object.entries(payload.sessions || {})) {
          for (const [kind, run] of Object.entries(runsForCategory)) restored[`${gameCategory}:${kind}`] = run;
        }
        setRuns(restored);
      } catch (error) {
        if (live && requestId === categoryRequest.current) setLoadError(error instanceof Error ? error.message : "Games are unavailable right now.");
      } finally {
        if (live && requestId === categoryRequest.current) setLoading(false);
      }
    })();
    return () => { live = false; };
  }, [initialCategory, routeKind]);

  const chooseCategory = useCallback((next: GameCategoryId) => {
    if (next === category) return;
    const requestId = ++categoryRequest.current;
    setCategory(next);
    setLoading(true);
    setLoadError("");
    try { localStorage.setItem(CATEGORY_KEY, next); } catch { /* Preference is optional. */ }
    if (routeKind) router.replace(`/games/${routeKind}?category=${encodeURIComponent(next)}`, { scroll: false });
    void (async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        const identity = auth.currentUser?.uid || getGuestId();
        const payload = await loadDailyGames(identity, next, token);
        if (requestId !== categoryRequest.current) return;
        setLoadError("");
        setDaily(payload);
        const restored: Record<string, SavedRun> = {};
        for (const [gameCategory, runsForCategory] of Object.entries(payload.sessions || {})) {
          for (const [kind, run] of Object.entries(runsForCategory)) restored[`${gameCategory}:${kind}`] = run;
        }
        setRuns((previous) => ({ ...previous, ...restored }));
      } catch (error) {
        if (requestId === categoryRequest.current) setLoadError(error instanceof Error ? error.message : "Games are unavailable right now.");
      } finally {
        if (requestId === categoryRequest.current) setLoading(false);
      }
    })();
  }, [category, routeKind, router]);

  async function handleSignOut() {
    try { await authSignOut(); } catch { /* Return to the login screen even if sign out needs a retry. */ }
    window.location.assign("/auth/login");
  }

  if (routeKind) {
    const puzzle = routeKind === "grid" ? null : daily?.games[category]?.[routeKind];
    const gameRun = routeKind === "grid" || !daily ? undefined : runs[`${category}:${routeKind}`];
    const gameClose = () => router.push("/games");
    return <PageLayout user={user} onSignOut={handleSignOut} theme="brutalist" fullWidth>
      <main className="min-h-[calc(100dvh-4rem)] bg-[#0a0a0a] pb-12 text-[#f5f0de]">
        <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-7 sm:pt-8"><Link href="/games" className="inline-flex items-center gap-2 text-sm font-semibold text-white/55 transition hover:text-[#f5f0de]"><ArrowRight className="h-4 w-4 rotate-180" />All games</Link></div>
        <div className="mx-auto flex max-w-5xl justify-end px-4 pt-4 sm:px-7">
          <label className="flex items-center gap-3 text-xs font-bold text-white/55 sm:text-sm">
            <span>Cinema</span>
            <span className="relative">
              <select value={category} onChange={(event) => chooseCategory(event.target.value as GameCategoryId)} className="min-w-40 appearance-none rounded-lg border border-white/15 bg-[#171512] py-2 pl-3 pr-9 font-semibold text-[#f5f0de] outline-none transition hover:border-[#d46b35]/70 focus:border-[#d46b35]">
                {GAME_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#d46b35]" />
            </span>
          </label>
        </div>
        {routeKind === "grid" ? loading ? <div className="mx-auto mt-8 max-w-5xl animate-pulse px-4"><div className="h-96 rounded-3xl border border-white/10 bg-[#12110f]" /></div> : loadError ? <p role="alert" className="mx-auto mt-8 max-w-5xl px-4 text-sm text-[#ffad74]">{loadError}</p> : <GridDialog category={category} onClose={gameClose} onStreakUpdate={(value) => setDaily((previous) => previous ? { ...previous, streaks: { ...previous.streaks, grid: value } } : previous)} standalone streak={daily?.streaks?.grid ?? 0} /> : loading ? <div className="mx-auto mt-8 max-w-3xl animate-pulse px-4"><div className="h-96 rounded-3xl border border-white/10 bg-[#12110f]" /></div> : loadError ? <p role="alert" className="mx-auto mt-8 max-w-3xl px-4 text-sm text-[#ffad74]">{loadError}</p> : puzzle && daily ? <GameDialog puzzle={puzzle} onClose={gameClose} onRunUpdate={(nextRun) => setRuns((previous) => ({ ...previous, [`${category}:${routeKind}`]: nextRun }))} onStreakUpdate={(value) => setDaily((previous) => previous ? { ...previous, streaks: { ...previous.streaks, [routeKind]: value } } : previous)} initialRun={gameRun} standalone streak={daily.streaks?.[routeKind] ?? 0} /> : <div className="mx-auto max-w-3xl px-4 py-12"><section className="rounded-3xl border border-white/10 bg-[#12110f] p-7"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#d46b35]">{GAME_CATEGORIES.find((item) => item.id === category)?.label}</p><h1 className="mt-2 text-3xl font-bold">Game unavailable</h1><p className="mt-2 text-sm text-white/55">Return to Games and choose another cinema.</p><button type="button" onClick={gameClose} className="mt-6 rounded-xl bg-[#d46b35] px-4 py-3 font-bold text-black">Back to games</button></section></div>}
      </main>
    </PageLayout>;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut} theme="brutalist" fullWidth>
    <main className="games-experience mx-auto min-h-[calc(100dvh-4rem)] w-full max-w-6xl px-4 pb-14 pt-6 text-[#f5f0de] sm:px-7 sm:pt-8">
      <div className="games-edition-line"><span>GAMES</span><span>{formatGamesDate(daily?.date)}</span></div>
      <section className="games-category-section" aria-label="Choose your cinema">
        <label className="games-cinema-picker">
          <span>Choose your cinema</span>
          <span className="relative block max-w-sm">
            <select value={category} onChange={(event) => chooseCategory(event.target.value as GameCategoryId)} className="w-full appearance-none rounded-xl border border-white/15 bg-[#1c1a17] px-4 py-3 pr-11 text-sm font-semibold text-[#f5f0de] outline-none focus:border-[#d46b35]">
              {GAME_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#d46b35]" />
          </span>
        </label>
      </section>

      {loadError && !loading && <p role="alert" className="mt-5 text-sm text-[#ffad74]">{loadError}</p>}
      <section className="games-feature-grid games-feature-grid--three" aria-label="Games">
        {loading ? Array.from({ length: 3 }, (_, index) => <div key={index} className="games-feature-skeleton" />) : <>
          <Link href={`/games/reveal?category=${encodeURIComponent(category)}`} className="games-feature-card games-feature-card--reveal">
            <div className="games-feature-top"><span>DAILY · 01</span><span>6 GUESSES</span></div>
            <span className="games-reveal-mark" aria-hidden="true">?</span>
            <div className="games-feature-bottom"><div><h3>Reveal</h3><span>Guess the movie from clues</span></div><span className="games-play-mark">PLAY</span></div>
          </Link>
          <Link href={`/games/connection?category=${encodeURIComponent(category)}`} className="games-feature-card games-feature-card--connection">
            <div className="games-feature-top"><span>DAILY · 02</span><span>3 GUESSES</span></div>
            <Link2 className="games-connection-mark" aria-hidden="true" />
            <div className="games-feature-bottom"><div><h3>Connection</h3><span>Name the actor in both movies</span></div><span className="games-play-mark">PLAY</span></div>
          </Link>
          <Link href={`/games/grid?category=${encodeURIComponent(category)}`} className="games-feature-card games-feature-card--grid">
            <div className="games-feature-top"><span>OPEN PLAY</span><span>9 MOVIES</span></div>
            <svg className="games-grid-logo" viewBox="0 0 160 160" role="img" aria-label="Cinema Grid, a three by three movie grid">
              {[12, 60, 108].flatMap((x) => [12, 60, 108].map((y) => {
                const isCenter = x === 60 && y === 60;
                return <rect key={`${x}-${y}`} x={x} y={y} width="40" height="40" fill={isCenter ? "#d46b35" : "#171512"} stroke="#d46b35" strokeWidth="5" />;
              }))}
            </svg>
            <div className="games-feature-bottom"><div><h3>Cinema Grid</h3><span>Fill the actor and genre table</span></div><span className="games-play-mark">PLAY</span></div>
          </Link>
        </>}
      </section>
      <p className="games-attribution">Film data by TMDB. This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
    </main>
    </PageLayout>
  );
}
