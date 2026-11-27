"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { RotateCcw, Trash2, Upload } from "lucide-react";
import { get, ref, remove } from "firebase/database";
import SettingsPageFrame from "@/components/SettingsPageFrame";
import LetterboxdMark from "@/components/LetterboxdMark";
import { useSettingsUser } from "../settings-shared";
import { SettingLine, SettingsGroup, SettingsMessage } from "../settings-ui";
import { auth, db } from "@/lib/firebase";
import { createImportedMovieLogs } from "@/lib/logs";
import { scheduleHonoursRecalculation } from "@/lib/honours-client";
import { searchMoviesForImport } from "@/lib/tmdb";
import { getTmdbPosterUrl } from "@/lib/performance";
import { getAuthorizedListData } from "@/lib/authorized-list-data";
import type { MovieLog, TMDBMovie } from "@/types";

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseRatingsCsv(csvText: string) {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((header) => header.replace(/^\ufeff/, "").toLowerCase());
  const watchedDateIdx = headers.findIndex((h) => h === "watched date");
  const dateIdx = watchedDateIdx >= 0 ? watchedDateIdx : headers.findIndex((h) => h === "date");
  const nameIdx = headers.findIndex((h) => h === "name" || h.includes("title"));
  const yearIdx = headers.findIndex((h) => h === "year");
  const ratingIdx = headers.findIndex((h) => h === "rating");

  if (nameIdx === -1 || ratingIdx === -1) throw new Error("CSV must include Name and Rating columns.");

  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return {
      date: dateIdx >= 0 ? cols[dateIdx] : "",
      name: cols[nameIdx] || "",
      year: yearIdx >= 0 ? cols[yearIdx] : "",
      rating: cols[ratingIdx] || "",
    };
  });
}

function parseRatingValue(ratingText: string): number | null {
  if (!ratingText) return null;
  const cleaned = ratingText.replace(",", ".").replace(/[^\d.]/g, "").trim();
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  if (Number.isNaN(parsed) || parsed < 0 || parsed > 5) return null;
  return parsed;
}

function isValidDateString(dateText: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateText) && !Number.isNaN(new Date(dateText).getTime());
}

type RatingBounds = {
  badMax: number;
  averageMax: number;
  goodMax: number;
  masterpieceMin: number;
};

const DEFAULT_RATING_BOUNDS: RatingBounds = {
  badMax: 2.5,
  averageMax: 3.4,
  goodMax: 4.4,
  masterpieceMin: 4.5,
};

function getReactionFromRating(rating: number, bounds: RatingBounds): 0 | 1 | 1.5 | 2 {
  if (rating <= bounds.badMax) return 0;
  if (rating <= bounds.averageMax) return 1.5;
  if (rating >= bounds.masterpieceMin) return 2;
  return 1;
}

function parseRatingBounds(
  badMaxText: string,
  averageMaxText: string,
  goodMaxText: string,
  masterpieceMinText: string
): RatingBounds {
  const badMax = Number.parseFloat(badMaxText);
  const averageMax = Number.parseFloat(averageMaxText);
  const goodMax = Number.parseFloat(goodMaxText);
  const masterpieceMin = Number.parseFloat(masterpieceMinText);

  const safeBadMax = Number.isFinite(badMax) ? Math.min(Math.max(badMax, 0), 5) : DEFAULT_RATING_BOUNDS.badMax;
  const safeAverageMax = Number.isFinite(averageMax)
    ? Math.min(Math.max(averageMax, 0), 5)
    : DEFAULT_RATING_BOUNDS.averageMax;
  const safeGoodMax = Number.isFinite(goodMax)
    ? Math.min(Math.max(goodMax, 0), 5)
    : DEFAULT_RATING_BOUNDS.goodMax;
  const safeMasterpieceMin = Number.isFinite(masterpieceMin)
    ? Math.min(Math.max(masterpieceMin, 0), 5)
    : DEFAULT_RATING_BOUNDS.masterpieceMin;

  if (!(safeBadMax < safeAverageMax && safeAverageMax < safeGoodMax && safeGoodMax < safeMasterpieceMin)) {
    return DEFAULT_RATING_BOUNDS;
  }

  return {
    badMax: safeBadMax,
    averageMax: safeAverageMax,
    goodMax: safeGoodMax,
    masterpieceMin: safeMasterpieceMin,
  };
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function downloadJsonFile(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type PendingImportMatch = {
  id: string;
  title: string;
  year: string;
  watchedDate: string;
  reaction: MovieLog["reaction"];
  options: TMDBMovie[];
  selectedId: number | null;
  searchText: string;
};

export default function SettingsImportPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { user, loading, handleSignOut } = useSettingsUser();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pendingMatches, setPendingMatches] = useState<PendingImportMatch[]>([]);
  const [badMaxInput, setBadMaxInput] = useState(String(DEFAULT_RATING_BOUNDS.badMax));
  const [averageMaxInput, setAverageMaxInput] = useState(String(DEFAULT_RATING_BOUNDS.averageMax));
  const [goodMaxInput, setGoodMaxInput] = useState(String(DEFAULT_RATING_BOUNDS.goodMax));
  const [masterpieceMinInput, setMasterpieceMinInput] = useState(String(DEFAULT_RATING_BOUNDS.masterpieceMin));
  const previewBounds = parseRatingBounds(badMaxInput, averageMaxInput, goodMaxInput, masterpieceMinInput);

  const handleImport = async (file: File) => {
    if (!auth.currentUser || !user) return;

    setBusy(true);
    setMessage(null);
    setError("");

    try {
      const ratingBounds = parseRatingBounds(
        badMaxInput,
        averageMaxInput,
        goodMaxInput,
        masterpieceMinInput
      );
      const rows = parseRatingsCsv(await file.text());
      let imported = 0;
      let skipped = 0;
      const skippedTitles: string[] = [];
      const reviewRows: PendingImportMatch[] = [];
      const resolvedEntries: Array<{
        contentId: number;
        watchedDate: string;
        reaction: MovieLog["reaction"];
        contentSummary: { title: string; poster_url: string | null };
      }> = [];
      const matchCache = new Map<string, TMDBMovie | null>();
      const candidateCache = new Map<string, TMDBMovie[]>();

      for (const [rowIndex, row] of rows.entries()) {
        const title = row.name?.trim();
        const ratingValue = parseRatingValue(row.rating);
        if (!title || ratingValue === null) {
          skipped += 1;
          if (title) skippedTitles.push(title);
          continue;
        }

        const targetTitle = normalizeTitle(title);
        const rawYear = row.year?.trim() || "";
        const targetYear = /^\d{4}$/.test(rawYear) ? rawYear : "";
        const matchKey = `${targetTitle}-${targetYear}`;
        let match = matchCache.get(matchKey);
        let candidateResults: TMDBMovie[] = candidateCache.get(matchKey) || [];

        if (!matchCache.has(matchKey)) {
          const searchQuery = title.replace(/\(\d{4}\)\s*$/, "").trim();
          const results = await searchMoviesForImport(searchQuery, targetYear ? Number(targetYear) : undefined);
          candidateResults = results;
          const exactYearMatch = results
            .map((movie) => {
              const movieTitle = normalizeTitle(movie.title || "");
              const movieYear = movie.release_date?.split("-")[0] || "";
              let score = 0;
              if (movieTitle === targetTitle) score += 100;
              else if (movieTitle.includes(targetTitle) || targetTitle.includes(movieTitle)) score += 50;
              if (targetYear) score = movieYear === targetYear ? score + 1000 : -1;
              return { movie, score };
            })
            .filter((entry) => entry.score >= 0)
            .sort((a, b) => b.score - a.score);
          match = exactYearMatch[0]?.movie || (!targetYear ? results[0] : null) || null;

          // TMDB sometimes omits the release year. Retry without the year, but
          // only accept an exact title with the requested year or no year at all.
          if (!match && targetYear) {
            const fallbackResults = await searchMoviesForImport(searchQuery);
            candidateResults = Array.from(new Map([...results, ...fallbackResults].map((movie) => [movie.id, movie])).values());
            match = fallbackResults.find((movie) => {
              const sameTitle = normalizeTitle(movie.title || "") === targetTitle;
              const movieYear = movie.release_date?.split("-")[0] || "";
              return sameTitle && (!movieYear || movieYear === targetYear);
            }) || null;
          }
          matchCache.set(matchKey, match);
          candidateCache.set(matchKey, candidateResults);
        }
        if (!match) {
          skipped += 1;
          skippedTitles.push(title);
          const watchedDate = isValidDateString(row.date) ? row.date : new Date().toISOString().split("T")[0];
          reviewRows.push({
            id: `${rowIndex}-${matchKey}`,
            title,
            year: targetYear,
            watchedDate,
            reaction: getReactionFromRating(ratingValue, ratingBounds),
            options: candidateResults.slice(0, 8),
            selectedId: null,
            searchText: title,
          });
          continue;
        }

        const watchedDate = isValidDateString(row.date) ? row.date : new Date().toISOString().split("T")[0];
        resolvedEntries.push({
          contentId: match.id,
          watchedDate,
          reaction: getReactionFromRating(ratingValue, ratingBounds),
          contentSummary: {
            title: match.title,
            poster_url: getTmdbPosterUrl(match.poster_path),
          },
        });
        imported += 1;
      }

      const createdCount = await createImportedMovieLogs(auth.currentUser.uid, resolvedEntries);
      setPendingMatches(reviewRows);
      const unreviewableSkipped = skippedTitles.length - reviewRows.length;
      const skippedSummary = reviewRows.length
        ? ` ${reviewRows.length} title${reviewRows.length === 1 ? "" : "s"} need your match check below.`
        : "";
      const duplicateCount = imported - createdCount;
      setMessage(`Imported ${createdCount} row${createdCount === 1 ? "" : "s"}.${duplicateCount > 0 ? ` Left ${duplicateCount} already imported row${duplicateCount === 1 ? "" : "s"} unchanged.` : ""}${unreviewableSkipped > 0 ? ` Skipped ${unreviewableSkipped} row${unreviewableSkipped === 1 ? "" : "s"} with missing title or rating.` : ""}${skippedSummary}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import CSV file.");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const importReviewedMatches = async () => {
    if (!auth.currentUser) return;
    const selectedRows = pendingMatches.filter((row) => row.selectedId !== null);
    if (!selectedRows.length) return;
    setBusy(true);
    setError("");
    try {
      const entries = selectedRows.flatMap((row) => {
        const movie = row.options.find((option) => option.id === row.selectedId);
        if (!movie) return [];
        return [{
          contentId: movie.id,
          watchedDate: row.watchedDate,
          reaction: row.reaction,
          contentSummary: { title: movie.title, poster_url: getTmdbPosterUrl(movie.poster_path) },
        }];
      });
      const createdCount = await createImportedMovieLogs(auth.currentUser.uid, entries);
      setPendingMatches((current) => current.filter((row) => row.selectedId === null));
      setMessage(`Imported ${createdCount} reviewed title${createdCount === 1 ? "" : "s"}.${createdCount < entries.length ? ` Left ${entries.length - createdCount} already imported title${entries.length - createdCount === 1 ? "" : "s"} unchanged.` : ""}`);
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Could not import the reviewed titles.");
    } finally {
      setBusy(false);
    }
  };

  const searchReviewCandidates = async (rowId: string) => {
    const row = pendingMatches.find((item) => item.id === rowId);
    if (!row || !row.searchText.trim()) return;
    setBusy(true);
    setError("");
    try {
      const results = await searchMoviesForImport(row.searchText.trim());
      setPendingMatches((current) => current.map((item) => item.id === rowId
        ? { ...item, options: results.slice(0, 8), selectedId: null }
        : item));
      if (!results.length) setError(`No movie results found for “${row.searchText.trim()}”.`);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Could not search for that movie.");
    } finally {
      setBusy(false);
    }
  };

  const handleExport = async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    setMessage(null);

    try {
      const [profileSnap, logsSnap, listData, followsSnap, notificationsSnap, sharesSnap] = await Promise.all([
        get(ref(db, `users/${user.id}`)),
        get(ref(db, "movie_logs")),
        getAuthorizedListData(),
        get(ref(db, "follows")),
        get(ref(db, `notifications/${user.id}`)),
        get(ref(db, "shares")),
      ]);

      const payload = {
        exportedAt: new Date().toISOString(),
        profile: profileSnap.exists() ? profileSnap.val() : null,
        settings: profileSnap.exists() ? profileSnap.val()?.settings || null : null,
        logs: logsSnap.exists() ? Object.entries(logsSnap.val() as Record<string, MovieLog>).filter(([, log]) => log.user_id === user.id).map(([id, log]) => ({ ...log, id })) : [],
        lists: Object.entries(listData.lists).filter(([, list]) => list.owner_id === user.id).map(([id, list]) => ({ ...list, id })),
        follows: followsSnap.exists() ? Object.entries(followsSnap.val() as Record<string, any>).filter(([, follow]) => follow.follower_id === user.id || follow.following_id === user.id).map(([id, follow]) => ({ ...follow, id })) : [],
        notifications: notificationsSnap.exists() ? notificationsSnap.val() : null,
        shares: sharesSnap.exists() ? Object.entries(sharesSnap.val() as Record<string, any>).filter(([, share]) => share.sender_id === user.id || share.receiver_id === user.id).map(([id, share]) => ({ ...share, id })) : [],
      };

      downloadJsonFile(`cineparte-${user.username}-export.json`, payload);
      setMessage("Your JSON export is ready.");
    } catch (err) {
      setError("We could not export your data right now.");
    } finally {
      setBusy(false);
    }
  };

  const handleClearImports = async () => {
    if (!user) return;
    const confirmed = window.confirm("Remove all logs imported from CSV?");
    if (!confirmed) return;

    setBusy(true);
    setMessage(null);
    setError("");

    try {
      const logsSnap = await get(ref(db, "movie_logs"));
      if (!logsSnap.exists()) {
        setMessage("No imported logs found.");
        return;
      }

      const removals: Promise<void>[] = [];
      let removed = 0;
      Object.entries(logsSnap.val() as Record<string, MovieLog>).forEach(([id, log]) => {
        if (log.user_id === user.id && (log.imported_from_csv || log.notes === "Imported from ratings CSV")) {
          removals.push(remove(ref(db, `movie_logs/${id}`)));
          removed += 1;
        }
      });
      await Promise.all(removals);
      if (removed > 0) scheduleHonoursRecalculation(user.id);
      setMessage(`Removed ${removed} imported log${removed === 1 ? "" : "s"}.`);
    } catch {
      setError("Could not clear imported ratings.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPageFrame
      user={user}
      loading={loading}
      onSignOut={handleSignOut}
      title="Import"
      description="Move your Letterboxd ratings or download your data."
    >
      <div className="space-y-5">
        <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#111111]">
          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-full bg-white/[0.04]">
                <LetterboxdMark className="h-5 w-11" />
              </span>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-[#ff9b52]">Bring your diary over</p>
                <h2 className="mt-1 text-lg font-bold leading-tight text-[#f5f0de] sm:text-xl">Import from Letterboxd</h2>
              </div>
            </div>

            <ol className="mt-5 grid gap-4 sm:grid-cols-3 sm:gap-5">
              <li className="flex gap-3 border-l border-[#ff7a1a]/70 pl-3">
                <span className="text-xs font-black tabular-nums text-[#ff9b52]">01</span>
                <p className="text-xs leading-relaxed text-white/65">Open Letterboxd&apos;s <a href="https://letterboxd.com/user/exportdata/" target="_blank" rel="noreferrer" className="font-semibold text-[#ffb36b] underline decoration-[#ffb36b]/40 underline-offset-2 hover:text-[#ff7a1a]">data export</a>.</p>
              </li>
              <li className="flex gap-3 border-l border-[#ff7a1a]/70 pl-3">
                <span className="text-xs font-black tabular-nums text-[#ff9b52]">02</span>
                <p className="text-xs leading-relaxed text-white/65">Choose <strong className="text-[#f5f0de]">Export Data</strong>, then unzip the download.</p>
              </li>
              <li className="flex gap-3 border-l border-[#ff7a1a]/70 pl-3">
                <span className="text-xs font-black tabular-nums text-[#ff9b52]">03</span>
                <p className="text-xs leading-relaxed text-white/65">Pick <strong className="text-[#f5f0de]">diary.csv</strong> below to keep your watch dates.</p>
              </li>
            </ol>
            <p className="mt-4 border-t border-white/[0.08] pt-3 text-[11px] leading-relaxed text-white/45"><strong className="text-white/65">diary.csv</strong> uses the date you watched a film. <strong className="text-white/65">ratings.csv</strong> uses the date you rated it. Rated movie rows are imported; unrated rows are skipped.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-white/10 px-4 py-4 sm:px-6">
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full bg-[#ff7a1a] px-5 text-sm font-bold text-[#101010] transition hover:bg-[#ff9142] disabled:opacity-50">
              <Upload className="h-4 w-4" /> Choose CSV
            </button>
            <button type="button" onClick={handleClearImports} disabled={busy} className="inline-flex h-10 items-center gap-2 rounded-full px-4 text-xs font-semibold text-white/50 transition hover:bg-white/[0.05] hover:text-[#f5f0de] disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" /> Clear imported logs
            </button>
            {busy && <span className="ml-auto text-xs text-white/45">Working…</span>}
          </div>

          <details className="border-t border-white/10 px-4 py-4 sm:px-6">
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 text-sm font-semibold text-[#f5f0de] marker:hidden">
              <span>Rating conversion</span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-white/40"><span>Bad ≤ {previewBounds.badMax.toFixed(1)} · Average ≤ {previewBounds.averageMax.toFixed(1)} · Good ≤ {previewBounds.goodMax.toFixed(1)} · Masterpiece ≥ {previewBounds.masterpieceMin.toFixed(1)}</span><span className="font-bold text-[#ff9b52]">Adjust ↓</span></span>
            </summary>
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-xs text-white/45">Adjust how your Letterboxd stars map to Canisterr verdicts.</p>
              <button type="button" onClick={() => {
                setBadMaxInput(String(DEFAULT_RATING_BOUNDS.badMax));
                setAverageMaxInput(String(DEFAULT_RATING_BOUNDS.averageMax));
                setGoodMaxInput(String(DEFAULT_RATING_BOUNDS.goodMax));
                setMasterpieceMinInput(String(DEFAULT_RATING_BOUNDS.masterpieceMin));
              }} disabled={busy} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-[#ffb36b] hover:bg-white/[0.05] disabled:opacity-50">
                <RotateCcw className="h-3 w-3" /> Reset
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">Bad up to</span>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={badMaxInput}
                    onChange={(event) => setBadMaxInput(event.target.value)}
                    disabled={busy}
                    className="w-full rounded-lg border border-white/10 bg-[#191919] px-3 py-2 text-sm text-[#f5f0de] outline-none transition placeholder:text-white/30 focus:border-[#ff7a1a] disabled:opacity-50"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">Average up to</span>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={averageMaxInput}
                    onChange={(event) => setAverageMaxInput(event.target.value)}
                    disabled={busy}
                    className="w-full rounded-lg border border-white/10 bg-[#191919] px-3 py-2 text-sm text-[#f5f0de] outline-none transition placeholder:text-white/30 focus:border-[#ff7a1a] disabled:opacity-50"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">Good up to</span>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={goodMaxInput}
                    onChange={(event) => setGoodMaxInput(event.target.value)}
                    disabled={busy}
                    className="w-full rounded-lg border border-white/10 bg-[#191919] px-3 py-2 text-sm text-[#f5f0de] outline-none transition placeholder:text-white/30 focus:border-[#ff7a1a] disabled:opacity-50"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/50">Masterpiece from</span>
                  <input
                    type="number"
                    min="0"
                    max="5"
                    step="0.1"
                    value={masterpieceMinInput}
                    onChange={(event) => setMasterpieceMinInput(event.target.value)}
                    disabled={busy}
                    className="w-full rounded-lg border border-white/10 bg-[#191919] px-3 py-2 text-sm text-[#f5f0de] outline-none transition placeholder:text-white/30 focus:border-[#ff7a1a] disabled:opacity-50"
                  />
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-white/40">
                <span>
                  0.0 - {previewBounds.badMax.toFixed(1)} = Bad
                </span>
                <span>
                  {(previewBounds.badMax + 0.1).toFixed(1)} - {previewBounds.averageMax.toFixed(1)} = Average
                </span>
                <span>
                  {(previewBounds.averageMax + 0.1).toFixed(1)} - {previewBounds.goodMax.toFixed(1)} = Good
                </span>
                <span>
                  {previewBounds.masterpieceMin.toFixed(1)}+ = Masterpiece
                </span>
              </div>
          </details>
        </section>

        {pendingMatches.length > 0 ? (
          <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#111111]">
            <div className="border-b border-white/10 px-4 py-4 sm:px-6">
              <h2 className="text-base font-semibold text-[#f5f0de]">Review titles we couldn&apos;t match</h2>
              <p className="mt-1 text-xs text-white/50">Choose a film by its poster, or search another title.</p>
            </div>
            <div className="divide-y divide-white/[0.08] px-4 sm:px-6">
              {pendingMatches.map((row) => (
                <div key={row.id} className="py-4 first:pt-4 last:pb-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-semibold text-[#f5f0de]">
                      {row.title}{row.year ? <span className="ml-2 text-xs font-medium text-white/45">{row.year}</span> : null}
                    </p>
                    <span className="text-[11px] text-white/40">Needs a match</span>
                  </div>
                  {row.options.length ? (
                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                      {row.options.map((movie) => {
                        const selected = row.selectedId === movie.id;
                        const posterUrl = getTmdbPosterUrl(movie.poster_path);
                        return (
                          <button
                            key={movie.id}
                            type="button"
                            aria-pressed={selected}
                            onClick={() => setPendingMatches((current) => current.map((item) => item.id === row.id ? { ...item, selectedId: selected ? null : movie.id } : item))}
                            className={`flex min-w-0 items-center gap-2 rounded-lg border p-2 text-left transition ${selected ? "border-[#ff7a1a] bg-[#ff7a1a]/[0.08]" : "border-white/10 hover:border-white/25"}`}
                          >
                            <div className="h-[72px] w-12 shrink-0 overflow-hidden rounded bg-white/[0.04]">
                              {posterUrl ? (
                                <img src={posterUrl} alt={`Poster for ${movie.title}`} loading="lazy" className="h-full w-full object-cover" />
                              ) : (
                                <div className="flex h-full items-center justify-center px-1 text-center text-[9px] text-white/35">No poster</div>
                              )}
                            </div>
                            <span className="min-w-0">
                              <span className="block line-clamp-2 text-xs font-semibold leading-snug text-[#f5f0de]">{movie.title}</span>
                              <span className="mt-1 block text-[11px] text-white/45">{movie.release_date?.slice(0, 4) || "Year unknown"}</span>
                              <span className={`mt-1 block text-[10px] font-medium ${selected ? "text-[#ff9b52]" : "text-white/35"}`}>{selected ? "Selected" : "Choose film"}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-white/45">No matches yet. Try a different title below.</p>
                  )}
                  <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void searchReviewCandidates(row.id); }}>
                    <input
                      value={row.searchText}
                      onChange={(event) => setPendingMatches((current) => current.map((item) => item.id === row.id ? { ...item, searchText: event.target.value } : item))}
                      aria-label={`Search for ${row.title}`}
                      placeholder="Try another movie title"
                      className="h-10 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-[#f5f0de] outline-none placeholder:text-white/35 focus:border-[#ff7a1a]"
                    />
                    <button type="submit" disabled={busy || !row.searchText.trim()} className="h-10 rounded-lg border border-white/15 px-4 text-xs font-semibold text-[#f5f0de] transition hover:border-[#ff7a1a]/60 hover:text-[#ffb36b] disabled:opacity-40">Search</button>
                  </form>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => void importReviewedMatches()}
                  disabled={busy || !pendingMatches.some((row) => row.selectedId !== null)}
                  className="inline-flex h-10 items-center rounded-full bg-[#ff7a1a] px-5 text-sm font-bold text-[#101010] transition hover:bg-[#ff9142] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {`Import selected (${pendingMatches.filter((row) => row.selectedId !== null).length})`}
                </button>
                <button type="button" onClick={() => setPendingMatches([])} disabled={busy} className="text-xs font-semibold text-white/45 transition hover:text-[#f5f0de] disabled:opacity-50">Leave unchecked titles out</button>
              </div>
            </div>
          </section>
        ) : null}

        <SettingsGroup title="Export">
          <SettingLine title="Export data" description="Download your data as JSON." stacked>
            <button
              onClick={handleExport}
              disabled={busy}
              className=" rounded-md bg-[#ff7a1a] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#ff8d3b] disabled:opacity-50"
            >
              Download export
            </button>
          </SettingLine>
        </SettingsGroup>

        {message ? <SettingsMessage tone="success">{message}</SettingsMessage> : null}
        {error ? <SettingsMessage tone="error">{error}</SettingsMessage> : null}

        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            if (file) {
              void handleImport(file);
            }
          }}
        />
      </div>
    </SettingsPageFrame>
  );
}
