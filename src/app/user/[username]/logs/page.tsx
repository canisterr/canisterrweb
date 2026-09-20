"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Film,
} from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { auth, db } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import { getUserMovieLogs } from "@/lib/logs";
import { getTvEpisodeBadgeLabel } from "@/lib/tv-log-label";
import { getUserByUsername } from "@/lib/profile";
import type { MovieLogWithContent, User } from "@/types";

type ListMode = "month" | "all";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatMonthTitle(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatWatchedDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getDayDD(dateStr: string): string {
  const day = dateStr.split("-")[2] || "01";
  return day.padStart(2, "0");
}

function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = monthStart(date);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

function isSameMonth(dateStr: string, monthRef: Date): boolean {
  const [year, month] = dateStr.split("-").map((value) => parseInt(value, 10));
  return year === monthRef.getFullYear() && month === monthRef.getMonth() + 1;
}

function compareLogsDesc(a: MovieLogWithContent, b: MovieLogWithContent): number {
  const aTime = new Date(`${a.watched_date}T00:00:00`).getTime();
  const bTime = new Date(`${b.watched_date}T00:00:00`).getTime();
  if (aTime !== bTime) return bTime - aTime;
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

function groupLogsByMonth(logsToGroup: MovieLogWithContent[]): Array<{ month: string; logs: MovieLogWithContent[] }> {
  const monthMap = new Map<string, MovieLogWithContent[]>();

  for (const log of logsToGroup) {
    const [year, month] = log.watched_date.split("-");
    const monthDate = new Date(parseInt(year, 10), parseInt(month, 10) - 1);
    const monthLabel = formatMonthTitle(monthDate);

    if (!monthMap.has(monthLabel)) {
      monthMap.set(monthLabel, []);
    }
    monthMap.get(monthLabel)!.push(log);
  }

  const result: Array<{ month: string; logs: MovieLogWithContent[] }> = [];
  for (const [month, logs] of monthMap) {
    logs.sort(compareLogsDesc);
    result.push({ month, logs });
  }

  result.sort((a, b) => {
    const aDate = new Date(`${a.logs[0].watched_date}T00:00:00`);
    const bDate = new Date(`${b.logs[0].watched_date}T00:00:00`);
    return bDate.getTime() - aDate.getTime();
  });

  return result;
}

function getReactionLabel(log: MovieLogWithContent): string {
  if (log.reaction == null) return "Unrated";
  if (log.reaction === 2) return "Masterpiece";
  if (log.reaction === 1.5) return "Average";
  if (log.reaction === 1) return "Good";
  return "Bad";
}

function getReactionClasses(log: MovieLogWithContent): string {
  if (log.reaction == null) return "border border-white/10 bg-white/5 text-white/45";
  if (log.reaction === 2) return "border border-[#ff7a1a]/40 bg-[#ff7a1a]/12 text-[#ffb36b]";
  if (log.reaction === 1.5) return "border border-white/15 bg-white/[0.07] text-[#f5f0de]";
  if (log.reaction === 1) return "border border-white/10 bg-white/5 text-[#f5f0de]";
  return "border border-white/10 bg-black/30 text-white/55";
}

function isUnavailableContent(log: MovieLogWithContent): boolean {
  return log.content.title === "Unknown Movie" || log.content.title === "Unknown Show";
}

function getSeasonLabel(log: MovieLogWithContent): string {
  return getTvEpisodeBadgeLabel(log);
}

function normalizeTasteValue(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

function formatLanguageLabel(value: string | null | undefined): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "unknown";

  if (trimmed.length <= 3 && /^[a-z]{2,3}$/i.test(trimmed) && typeof Intl !== "undefined" && "DisplayNames" in Intl) {
    try {
      const displayNames = new Intl.DisplayNames(["en"], { type: "language" });
      return (displayNames.of(trimmed.toLowerCase()) || trimmed).toLowerCase();
    } catch {
      return trimmed.toLowerCase();
    }
  }

  return trimmed.toLowerCase();
}

function contentMatchesTasteFilter(
  log: MovieLogWithContent,
  tasteType: string | null,
  tasteValue: string | null
): boolean {
  const normalizedValue = normalizeTasteValue(tasteValue);
  if (!tasteType || !normalizedValue) return true;

  if (tasteType === "genre") {
    return (log.content.genres || []).some((genre) => normalizeTasteValue(genre) === normalizedValue);
  }

  if (tasteType === "actor") {
    const actors = [
      ...((log.content.actors || []) as string[]),
      ...((log.content.cast || []) as string[]),
    ];
    return actors.some((actor) => normalizeTasteValue(actor) === normalizedValue);
  }

  if (tasteType === "director") {
    return normalizeTasteValue(log.content.director || "") === normalizedValue;
  }

  if (tasteType === "language") {
    return (
      normalizeTasteValue(log.content.language || "") === normalizedValue ||
      formatLanguageLabel(log.content.language || "") === normalizedValue
    );
  }

  return true;
}

export default function PublicUserLogsPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const username = params.username as string;
  const reactionFilter = searchParams.get("reaction");
  const contentFilter = searchParams.get("content");
  const tasteFilter = searchParams.get("taste");
  const tasteValue = searchParams.get("value");
  const listSectionRef = useRef<HTMLDivElement | null>(null);

  const hardRedirect = (path: string) => {
    if (typeof window !== "undefined") {
      window.location.assign(path);
    }
  };

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<MovieLogWithContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<Date>(monthStart(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [listMode, setListMode] = useState<ListMode>("month");

  const normalizedContentFilter = contentFilter === "movie" || contentFilter === "tv" ? contentFilter : null;
  const normalizedTasteFilter =
    tasteFilter === "genre" || tasteFilter === "actor" || tasteFilter === "director" || tasteFilter === "language"
      ? tasteFilter
      : null;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        hardRedirect("/auth/login");
        return;
      }

      try {
        const currentUserRef = ref(db, `users/${firebaseUser.uid}`);
        const currentUserSnapshot = await get(currentUserRef);
        const currentUserData = currentUserSnapshot.val();

        const user: User = {
          id: currentUserData?.id || firebaseUser.uid,
          username: currentUserData?.username || firebaseUser.email?.split("@")[0] || "user",
          name: currentUserData?.name || firebaseUser.displayName || "User",
          email: currentUserData?.email || firebaseUser.email || undefined,
          avatar_url: currentUserData?.avatar_url || null,
          created_at: currentUserData?.createdAt || new Date().toISOString(),
          bio: currentUserData?.bio || "",
        };

        setCurrentUser(user);

        const profile = await getUserByUsername(username);
        if (!profile) {
          hardRedirect("/dashboard");
          return;
        }

        const userLogs = await getUserMovieLogs(profile.id, 500);
        const filtered = userLogs
          .filter((log) => !log.watch_later && Boolean(log.watched_date))
          .sort(compareLogsDesc);

        setProfileUser(profile);
        setLogs(filtered);
        setLoading(false);
      } catch (error) {
        console.error("Error loading public user logs:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [username]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (normalizedContentFilter && log.content_type !== normalizedContentFilter) {
        return false;
      }

      if (!reactionFilter || !["0", "1", "1.5", "2"].includes(reactionFilter)) {
        return contentMatchesTasteFilter(log, normalizedTasteFilter, tasteValue);
      }

      return String(log.reaction) === reactionFilter && contentMatchesTasteFilter(log, normalizedTasteFilter, tasteValue);
    });
  }, [logs, normalizedContentFilter, reactionFilter, normalizedTasteFilter, tasteValue]);

  const displayName = profileUser?.name || profileUser?.username || "User";
  const logTypeLabel =
    normalizedContentFilter === "movie"
      ? "Movie Logs"
      : normalizedContentFilter === "tv"
        ? "TV Logs"
        : "Logs";
  const tasteLabelPrefix =
    normalizedTasteFilter && tasteValue
      ? `${tasteValue} ${normalizedTasteFilter === "genre"
          ? "Genre"
          : normalizedTasteFilter === "actor"
            ? "Actor"
            : normalizedTasteFilter === "director"
              ? "Director"
              : "Language"}`
      : null;
  const pageTitle =
    reactionFilter === "2"
      ? `${displayName}'s Masterpiece ${logTypeLabel}`
      : reactionFilter === "1.5"
        ? `${displayName}'s Average ${logTypeLabel}`
        : reactionFilter === "1"
          ? `${displayName}'s Good ${logTypeLabel}`
          : reactionFilter === "0"
            ? `${displayName}'s Bad ${logTypeLabel}`
            : tasteLabelPrefix
              ? `${displayName}'s ${tasteLabelPrefix} ${logTypeLabel}`
              : `${displayName}'s ${logTypeLabel}`;

  const logsByDate = useMemo(() => {
    const map = new Map<string, MovieLogWithContent[]>();
    for (const log of filteredLogs) {
      const bucket = map.get(log.watched_date) || [];
      bucket.push(log);
      map.set(log.watched_date, bucket);
    }
    for (const [, bucket] of map) {
      bucket.sort(compareLogsDesc);
    }
    return map;
  }, [filteredLogs]);

  const monthLogs = useMemo(() => {
    return filteredLogs.filter((log) => isSameMonth(log.watched_date, currentMonth));
  }, [filteredLogs, currentMonth]);

  const dayLogs = useMemo(() => {
    if (!selectedDay) return [] as MovieLogWithContent[];
    return (logsByDate.get(selectedDay) || []).slice().sort(compareLogsDesc);
  }, [logsByDate, selectedDay]);

  const displayLogs = useMemo(() => {
    if (listMode === "all") {
      return filteredLogs.slice().sort(compareLogsDesc);
    }
    if (selectedDay) {
      return dayLogs;
    }
    return monthLogs.slice().sort(compareLogsDesc);
  }, [listMode, filteredLogs, monthLogs, selectedDay, dayLogs]);

  const calendarCells = useMemo(() => {
    const { start, end } = getMonthRange(currentMonth);
    const firstWeekdayIndex = (start.getDay() + 6) % 7;
    const totalDays = end.getDate();

    const cells: Array<{ date: Date | null; key: string; inMonth: boolean }> = [];

    for (let i = 0; i < firstWeekdayIndex; i += 1) {
      cells.push({ date: null, key: `blank-start-${i}`, inMonth: false });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      cells.push({ date, key, inMonth: true });
    }

    while (cells.length % 7 !== 0) {
      const idx = cells.length;
      cells.push({ date: null, key: `blank-end-${idx}`, inMonth: false });
    }

    return cells;
  }, [currentMonth]);

  const handleSignOut = async () => {
    try {
      await authSignOut();
      hardRedirect("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const scrollToListSection = () => {
    window.requestAnimationFrame(() => {
      listSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  if (loading || !currentUser || !profileUser) {
    return null;
  }

  return (
    <PageLayout user={currentUser} onSignOut={handleSignOut}>
      <div className="brutalist mx-auto w-full max-w-6xl space-y-5 px-1 pb-8 sm:space-y-6 sm:p-8">
        <div className="flex items-center justify-between px-1 pt-2 sm:px-0 sm:pt-0">
          <Link
            href={`/profile/${profileUser.username}`}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white/65 transition hover:border-[#ff7a1a]/35 hover:text-[#ffb36b]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Link>
        </div>

        <section className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111111] p-5 shadow-[0_20px_55px_rgba(0,0,0,0.25)] sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-[#ff7a1a]/10 blur-3xl" />
          <div className="flex items-start gap-4">
            {profileUser.avatar_url ? (
              <img
                src={profileUser.avatar_url}
                alt={profileUser.name}
                className="relative h-16 w-16 rounded-full border border-white/15 object-cover grayscale sm:h-20 sm:w-20"
              />
            ) : (
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/15 bg-black text-2xl font-black text-[#f5f0de] sm:h-20 sm:w-20 sm:text-3xl">
                {profileUser.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="relative min-w-0 flex-1">
              <p className="mb-1 text-[9px] font-black uppercase tracking-[0.24em] text-[#ffb36b]/75">Watch Diary</p>
              <div className="flex items-center gap-3">
                <Film className="hidden h-5 w-5 text-[#ff7a1a] sm:block" />
                <h1 className="text-xl font-black tracking-tight text-[#f5f0de] sm:text-3xl">{pageTitle}</h1>
              </div>
              <p className="mt-1 text-sm text-white/45 sm:text-base">@{profileUser.username}</p>
              <p className="mt-2 text-sm text-white/55">
                <span className="font-semibold text-[#ffb36b]">{filteredLogs.length}</span> logged titles
              </p>
            </div>
          </div>
        </section>

        <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(22rem,0.88fr)] lg:items-start lg:gap-5 lg:space-y-0">
        <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#111111] shadow-[0_20px_55px_rgba(0,0,0,0.2)] lg:sticky lg:top-24">
          <div className="flex items-center justify-between gap-3 px-3 py-3 sm:px-5">
            <button
              onClick={() => {
                setSelectedDay(null);
                setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
              }}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-[#f5f0de] transition hover:bg-white/10"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="text-center">
              <h2 className="text-2xl font-black uppercase leading-none text-[#f5f0de] sm:text-4xl">
                {currentMonth.toLocaleDateString("en-US", { month: "long" })}
              </h2>
              <p className="mt-1 text-[9px] font-black tracking-[0.28em] text-[#ffb36b]">{currentMonth.getFullYear()}</p>
            </div>

            <button
              onClick={() => {
                setSelectedDay(null);
                setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
              }}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-[#f5f0de] transition hover:bg-white/10"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 border-y border-white/10 bg-white/[0.02]">
            {WEEKDAYS.map((day) => (
              <div key={day} className="border-r border-white/10 py-2 text-center text-[9px] font-black uppercase tracking-[0.16em] text-[#ffb36b]/80 last:border-r-0 sm:text-xs">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 bg-[#111111]">
            {calendarCells.map((cell) => {
              if (!cell.inMonth || !cell.date) {
                return <div key={cell.key} className="min-h-[6.25rem] border-b border-r border-white/10 bg-white/[0.02] sm:min-h-[9rem]" />;
              }

              const day = cell.date.getDate();
              const dayKey = cell.key;
              const dayLogsInCell = (logsByDate.get(dayKey) || []).slice().sort(compareLogsDesc);
              const isSelected = selectedDay === dayKey;

              return (
                <button
                  key={cell.key}
                  onClick={() => {
                    setListMode("month");
                    setSelectedDay((prev) => (prev === dayKey ? null : dayKey));
                    scrollToListSection();
                  }}
                  className={`relative min-h-[6.25rem] overflow-hidden border-b border-r border-white/10 p-0 text-left transition sm:min-h-[9rem] ${
                    isSelected
                      ? "bg-[#ff7a1a]/10 shadow-[inset_0_0_0_2px_rgba(255,122,26,0.55)]"
                      : dayLogsInCell.length > 0
                        ? "bg-[#101010] hover:bg-white/[0.03]"
                        : "bg-[#0f0f0f] hover:bg-white/[0.03]"
                  }`}
                >
                  {dayLogsInCell.length > 0 ? (
                    <div className="relative flex h-full w-full items-center justify-center">
                      {dayLogsInCell.slice(0, 3).map((log, idx) => (
                        <img
                          key={log.id}
                          src={log.content.poster_url || undefined}
                          alt={log.content.title}
                          className={`absolute h-full w-full object-cover shadow ${idx === 0 ? "" : idx === 1 ? "translate-y-1.5" : "translate-y-3"}`}
                          style={{
                            zIndex: 10 + idx,
                          }}
                        />
                      ))}

                      {dayLogsInCell.length > 1 && (
                        <span className="absolute right-1.5 top-1.5 z-30 rounded-full bg-[#ff7a1a] px-2 py-0.5 text-[10px] font-black text-black shadow">
                          {dayLogsInCell.length}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex h-full w-full items-start justify-start p-2">
                      <span className={`text-[11px] font-black ${isSelected ? "text-[#ffb36b]" : "text-[#ff7a1a]"}`}>{day}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div ref={listSectionRef} className="relative scroll-mt-24 overflow-hidden rounded-t-[1.5rem] border border-white/10 bg-gradient-to-b from-[#292929] via-[#1d1d1d] to-[#111111] p-3 shadow-[0_20px_55px_rgba(0,0,0,0.24)] sm:p-4 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          <div className="pointer-events-none absolute -right-16 top-16 h-48 w-48 rounded-full bg-[#ff7a1a]/5 blur-3xl" />
          <div className="relative mb-5 flex flex-col items-center gap-3 text-center">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#ffb36b]/75">Watch Diary</p>
              <h3 className="mt-1 text-xl font-black text-[#f5f0de] sm:text-2xl">
                {listMode === "all"
                  ? "All Months"
                  : selectedDay
                    ? `Logs for ${formatWatchedDate(selectedDay)}`
                    : `Logs for ${formatMonthTitle(currentMonth)}`}
              </h3>
            </div>

            <div className="inline-flex rounded-full border border-white/10 bg-black/20 p-1">
              <button
                onClick={() => setListMode("month")}
                className={`rounded-full px-3 py-1.5 text-xs font-black transition sm:text-sm ${
                  listMode === "month" ? "bg-[#ff7a1a] text-black" : "text-white/60 hover:bg-white/10"
                }`}
              >
                Month
              </button>
              <button
                onClick={() => {
                  setListMode("all");
                  setSelectedDay(null);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-black transition sm:text-sm ${
                  listMode === "all" ? "bg-[#ff7a1a] text-black" : "text-white/60 hover:bg-white/10"
                }`}
              >
                All
              </button>
            </div>
          </div>

          {displayLogs.length > 0 ? (
            listMode === "all" ? (
              <div className="relative space-y-7">
                {groupLogsByMonth(displayLogs).map((group) => (
                  <div key={group.month}>
                    <h4 className="mb-3 text-center text-sm font-black uppercase tracking-[0.18em] text-[#ffb36b]/70">{group.month}</h4>
                    <div className="space-y-3">
                      {group.logs.map((log) => (
                        <Link
                          key={log.id}
                          href={log.content_type === "movie" ? `/movie/${log.content_id}` : `/tv/${log.content_id}`}
                          className="group block rounded-[1.35rem] border border-white/10 bg-[#111111] p-3 shadow-[0_14px_32px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:border-[#ff7a1a]/30 sm:p-4"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-12 flex-shrink-0 text-center">
                              <span className="text-2xl font-black text-[#ff7a1a]">{getDayDD(log.watched_date)}</span>
                            </div>

                            <img
                              src={log.content.poster_url || undefined}
                              alt={log.content.title}
                              className="h-20 w-14 flex-shrink-0 rounded-lg border border-white/10 object-cover grayscale-[0.15]"
                            />

                            <div className="min-w-0 flex-1">
                              <p className="truncate font-bold text-[#f5f0de]">{log.content.title}</p>
                              {getSeasonLabel(log) && (
                                <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ffb36b]">
                                  {getSeasonLabel(log)}
                                </p>
                              )}
                              {isUnavailableContent(log) && (
                                <span className="mt-1 inline-flex items-center rounded-full border border-[#ff7a1a]/30 bg-[#ff7a1a]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#ffb36b]">
                                  Details unavailable
                                </span>
                              )}
                            </div>

                            <span
                              className={`flex-shrink-0 rounded-full px-2 py-1 text-xs font-medium ${getReactionClasses(log)}`}
                            >
                              {getReactionLabel(log)}
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {displayLogs.map((log) => (
                  <Link
                    key={log.id}
                    href={log.content_type === "movie" ? `/movie/${log.content_id}` : `/tv/${log.content_id}`}
                    className="group block rounded-[1.35rem] border border-white/10 bg-[#111111] p-3 shadow-[0_14px_32px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:border-[#ff7a1a]/30 sm:p-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 flex-shrink-0 text-center">
                        <span className="text-2xl font-black text-[#ff7a1a]">{getDayDD(log.watched_date)}</span>
                      </div>

                      <img
                        src={log.content.poster_url || undefined}
                        alt={log.content.title}
                        className="h-20 w-14 flex-shrink-0 rounded-lg border border-white/10 object-cover grayscale-[0.15]"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold text-[#f5f0de]">{log.content.title}</p>
                        {getSeasonLabel(log) && (
                          <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-[#ffb36b]">
                            {getSeasonLabel(log)}
                          </p>
                        )}
                        {isUnavailableContent(log) && (
                          <span className="mt-1 inline-flex items-center rounded-full border border-[#ff7a1a]/30 bg-[#ff7a1a]/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#ffb36b]">
                            Details unavailable
                          </span>
                        )}
                      </div>

                      <span
                        className={`flex-shrink-0 rounded-full px-2 py-1 text-xs font-medium ${getReactionClasses(log)}`}
                      >
                        {getReactionLabel(log)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            )
          ) : (
            <div className="relative py-12 text-center text-sm text-white/45">
              No logs for this selection.
            </div>
          )}
        </div>
        </div>

        <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/[0.025] p-4 text-sm text-white/40">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#ff7a1a]" />
            <span>Calendar and list view for {profileUser.name}'s logged movies.</span>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
