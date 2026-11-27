"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Pencil,
  RotateCcw,
  Ticket,
} from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import { signOut as authSignOut } from "@/lib/auth";
import { getUserMovieLogs } from "@/lib/logs";
import { buildLogUrl } from "@/lib/log-url";
import { getBlurDataUrl } from "@/lib/performance";
import { usePosterAccent } from "@/hooks/usePosterAccent";
import { getTvEpisodeBadgeLabel } from "@/lib/tv-log-label";
import { getUserByUsername } from "@/lib/profile";
import type { MovieLogWithContent, User } from "@/types";

type ListMode = "month" | "all";
type ViewMode = "diary" | "ticket";

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

function DiaryLogCard({ log, isRewatch }: { log: MovieLogWithContent; isRewatch: boolean }) {
  const accent = usePosterAccent(log.content.poster_url, `${log.content.title}-${log.id}`);
  const watchedDate = new Date(`${log.watched_date}T00:00:00`);
  const hasReview = Boolean(log.notes?.trim());
  return <Link href={buildLogUrl(log)} prefetch={false} className="group block w-full text-left">
    <span className="relative block overflow-hidden shadow-[0_16px_35px_rgba(0,0,0,0.22)] transition duration-200 group-hover:-translate-y-0.5" style={{ backgroundColor: accent.background }}>
      <span className="grid min-h-[7.1rem] grid-cols-[5.1rem_0.8rem_minmax(0,1fr)_3.6rem] items-stretch sm:min-h-[8.6rem] sm:grid-cols-[6.4rem_1rem_minmax(0,1fr)_4.75rem]">
        <span className="relative m-2 min-h-[5.9rem] overflow-hidden bg-black sm:m-3 sm:min-h-[6.9rem]">
          {log.content.poster_url ? <Image src={log.content.poster_url} alt="" fill sizes="120px" className="object-cover" placeholder="blur" blurDataURL={getBlurDataUrl()} /> : <span className="flex h-full items-center justify-center text-[9px] text-white/45">No image</span>}
        </span>
        <span className="relative flex items-stretch justify-center py-3"><span className="w-px border-l border-dotted border-white/20" /><span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1f1f1f]" /><span className="absolute bottom-0 left-1/2 h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-[#1f1f1f]" /></span>
        <span className="flex min-w-0 flex-col py-3 pr-2 sm:py-4 sm:pr-4">
          <span className="break-words text-balance text-lg font-black leading-[1.02] tracking-[-0.04em] text-[#f7f1e3] sm:text-xl">{log.content.title}</span>
          {getSeasonLabel(log) ? <span className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#ffb36b]/82">{getSeasonLabel(log)}</span> : null}
          {log.reaction != null ? <span className="mt-1.5 self-start rounded-[0.8rem] border border-white/15 bg-white/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#f5f0de]">{getReactionLabel(log)}</span> : null}
          {(hasReview || log.ticket_image_url || isRewatch) ? <span className="mt-1 flex items-center gap-2 text-white/68">{hasReview ? <Pencil className="h-4 w-4" aria-label="Review" /> : null}{log.ticket_image_url ? <ImageIcon className="h-4 w-4" aria-label="Ticket image" /> : null}{isRewatch ? <RotateCcw className="h-4 w-4" aria-label="Rewatch" /> : null}</span> : null}
        </span>
        <span className="flex flex-col items-center justify-center border-l border-white/8 px-1 text-[#f5f0de] sm:px-3">
          <span className="text-[0.72rem] font-light italic leading-none text-white/72">{watchedDate.toLocaleDateString("en-US", { month: "short" })}</span>
          <span className="mt-1 text-[2rem] font-light leading-none tracking-[-0.04em] sm:text-[2.6rem]">{String(watchedDate.getDate()).padStart(2, "0")}</span>
          <span className="mt-1 text-[0.66rem] font-medium leading-none text-white/65">{watchedDate.getFullYear()}</span>
        </span>
      </span>
    </span>
  </Link>;
}

function TicketLogCard({ log, isRewatch }: { log: MovieLogWithContent; isRewatch: boolean }) {
  const accent = usePosterAccent(log.content.poster_url, `${log.content.title}-${log.id}`);
  const hasReview = Boolean(log.notes?.trim());
  return <Link href={buildLogUrl(log)} prefetch={false} className="group relative flex h-full w-full min-w-0 flex-col overflow-hidden rounded-[8px] bg-black text-left shadow-[0_12px_28px_rgba(0,0,0,0.3)] transition duration-200 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-[#ff7a1a]">
    <span className="relative aspect-[2/3] w-full shrink-0 overflow-hidden bg-[#050505]">
      {log.content.poster_url ? <Image src={log.content.poster_url} alt="" fill sizes="(max-width: 1023px) 33vw, 25vw" className="object-contain transition duration-300 group-hover:scale-[1.02]" placeholder="blur" blurDataURL={getBlurDataUrl()} /> : <span className="flex h-full items-center justify-center px-3 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">No poster</span>}
    </span>
    <span className="relative flex min-h-28 flex-1 flex-col border-t-2 border-dashed px-2.5 pb-2.5 pt-2 sm:min-h-32 sm:px-3.5 sm:pb-3 sm:pt-3" style={{ backgroundColor: accent.background, color: accent.foreground, borderTopColor: accent.border }}>
      <span className="absolute left-0 top-0 z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#050505] sm:h-6 sm:w-6" aria-hidden="true" />
      <span className="absolute right-0 top-0 z-20 h-5 w-5 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#050505] sm:h-6 sm:w-6" aria-hidden="true" />
      <span className="flex items-start gap-1 text-[10px] font-bold leading-tight sm:text-xs"><Calendar className="mt-px h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" aria-hidden="true" />{formatWatchedDate(log.watched_date)}</span>
      {getSeasonLabel(log) ? <span className="mt-0.5 line-clamp-1 text-[9px] font-bold uppercase tracking-[0.12em] opacity-75 sm:text-[10px]">{getSeasonLabel(log)}</span> : null}
      <span className="mt-1.5 flex flex-wrap items-center gap-1 sm:mt-2 sm:gap-1.5">
        {log.reaction != null ? <span className="border-l-2 border-current pl-1.5 text-[9px] font-black uppercase tracking-[0.12em] sm:text-[10px]">{getReactionLabel(log)}</span> : null}
        {hasReview ? <Pencil className="h-3 w-3" aria-label="Review written" /> : null}
        {log.ticket_image_url ? <ImageIcon className="h-3 w-3" aria-label="Ticket image" /> : null}
        {isRewatch ? <RotateCcw className="h-3 w-3" aria-label="Rewatch" /> : null}
      </span>
      <span className="mt-auto border-t pt-1.5 text-[9px] leading-snug opacity-75 sm:pt-2 sm:text-[10px]" style={{ borderTopColor: accent.foreground === "#101010" ? "rgba(16,16,16,0.14)" : "rgba(248,244,234,0.16)" }}><span className="line-clamp-2">{hasReview ? log.notes : "No review"}</span></span>
    </span>
  </Link>;
}

export default function PublicUserLogsPage() {
  const { user: currentUser, loading: sessionLoading } = useCurrentUser();
  const params = useParams();
  const searchParams = useSearchParams();
  const username = params.username as string;
  const reactionFilter = searchParams.get("reaction");
  const contentFilter = searchParams.get("content");
  const tasteFilter = searchParams.get("taste");
  const tasteValue = searchParams.get("value");
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const startDate = fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : undefined;
  const endDate = toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam) ? toParam : undefined;
  const listSectionRef = useRef<HTMLDivElement | null>(null);

  const hardRedirect = (path: string) => {
    if (typeof window !== "undefined") {
      window.location.assign(path);
    }
  };

  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<MovieLogWithContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<Date>(monthStart(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [listMode, setListMode] = useState<ListMode>("month");
  const [viewMode, setViewMode] = useState<ViewMode>("diary");

  const normalizedContentFilter = contentFilter === "movie" || contentFilter === "tv" ? contentFilter : null;
  const normalizedTasteFilter =
    tasteFilter === "genre" || tasteFilter === "actor" || tasteFilter === "director" || tasteFilter === "language"
      ? tasteFilter
      : null;
  const viewerId = currentUser?.id;

  useEffect(() => {
    if (sessionLoading) return;
    if (!viewerId) {
      hardRedirect("/auth/login");
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const profile = await getUserByUsername(username);
        if (!profile) {
          hardRedirect("/dashboard");
          return;
        }

        const userLogs = await getUserMovieLogs(profile.id, 500, profile, { summaryOnly: !normalizedTasteFilter, startDate, endDate });
        if (cancelled) return;
        const filtered = userLogs
          .filter((log) => !log.watch_later && Boolean(log.watched_date))
          .sort(compareLogsDesc);
        const matchingLogs = filtered.filter((log) => {
          if (normalizedContentFilter && log.content_type !== normalizedContentFilter) return false;
          if (reactionFilter && ["0", "1", "1.5", "2"].includes(reactionFilter) && String(log.reaction) !== reactionFilter) return false;
          return contentMatchesTasteFilter(log, normalizedTasteFilter, tasteValue);
        });
        if (matchingLogs.length) {
          const latestDate = new Date(`${matchingLogs[0].watched_date}T00:00:00`);
          if (!Number.isNaN(latestDate.getTime())) setCurrentMonth(monthStart(latestDate));
        }

        setProfileUser(profile);
        setLogs(filtered);
        setLoading(false);
      } catch (error) {
        console.error("Error loading public user logs:", error);
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [viewerId, normalizedContentFilter, normalizedTasteFilter, reactionFilter, sessionLoading, startDate, endDate, tasteValue, username]);

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
  const ticketLogs = useMemo(() =>
    (listMode === "all" ? filteredLogs : monthLogs).slice().sort(compareLogsDesc),
    [filteredLogs, listMode, monthLogs]
  );
  const rewatchKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs) {
      const key = `${log.content_type}-${log.content_id}`;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return new Set([...counts].filter(([, count]) => count > 1).map(([key]) => key));
  }, [logs]);

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
      <div className="brutalist mx-auto w-full max-w-6xl space-y-5 px-3 pb-8 pt-4 sm:space-y-6 sm:p-8">
        <div className="flex items-center justify-between">
          <Link
            href={`/profile/${profileUser.username}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-white/60 transition hover:text-[#f5f0de]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Link>
        </div>

        <section className="border-b border-white/10 pb-5">
          <div className="flex items-start gap-4">
            {profileUser.avatar_url ? (
              <Image
                src={profileUser.avatar_url}
                alt={profileUser.name}
                width={64}
                height={64}
                unoptimized
                className="h-14 w-14 rounded-full border border-white/15 object-cover sm:h-16 sm:w-16"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-[#f5f0de] text-xl font-black text-black sm:h-16 sm:w-16">
                {profileUser.name.charAt(0).toUpperCase()}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-black tracking-tight text-[#f5f0de] sm:text-3xl">{pageTitle}</h1>
              <p className="mt-1 text-sm text-white/45 sm:text-base">@{profileUser.username}</p>
              <p className="mt-2 text-sm text-white/55">
                <span className="font-semibold text-[#ffb36b]">{filteredLogs.length}</span> watched logs
              </p>
            </div>
          </div>
        </section>

        <div className="space-y-5">
          <div className="grid grid-cols-2 items-center gap-x-3 gap-y-3 px-1 py-2 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:gap-x-4 sm:px-2">
            <div className="col-start-1 row-start-2 flex items-center gap-2 sm:row-start-1">
            <button
              onClick={() => {
                setSelectedDay(null);
                setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#f5f0de] shadow-sm transition hover:bg-white/10 sm:h-12 sm:w-12"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => {
                setSelectedDay(null);
                setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
              }}
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-[#f5f0de] shadow-sm transition hover:bg-white/10 sm:h-12 sm:w-12"
              aria-label="Next month"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            </div>

            <div className="col-span-2 col-start-1 row-start-1 min-w-0 text-center sm:col-span-1 sm:col-start-2">
              <h2 className="text-[clamp(2rem,11vw,3rem)] font-black uppercase leading-none tracking-[-0.025em] text-[#f5f0de] sm:text-4xl sm:tracking-normal lg:text-5xl">
                {currentMonth.toLocaleDateString("en-US", { month: "long" })}
              </h2>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-[#ffb36b] sm:text-xs">{currentMonth.getFullYear()}</p>
            </div>

            <div className="col-start-2 row-start-2 flex items-center justify-self-end rounded-full border border-white/10 bg-white/[0.03] p-1 sm:col-start-3 sm:row-start-1">
              <button type="button" onClick={() => setViewMode("diary")} aria-label="Diary view" className={`flex h-10 w-10 items-center justify-center rounded-full transition sm:h-11 sm:w-11 ${viewMode === "diary" ? "bg-[#ff7a1a] text-black shadow-sm" : "text-[#f5f0de] hover:bg-white/8"}`}><Calendar className="h-4 w-4" /></button>
              <button type="button" onClick={() => { setViewMode("ticket"); setSelectedDay(null); }} aria-label="Ticket view" className={`flex h-10 w-10 items-center justify-center rounded-full transition sm:h-11 sm:w-11 ${viewMode === "ticket" ? "bg-[#ff7a1a] text-black shadow-sm" : "text-[#f5f0de] hover:bg-white/8"}`}><Ticket className="h-4 w-4 rotate-90" /></button>
            </div>
          </div>

          {viewMode === "diary" ? <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(22rem,0.88fr)] lg:items-start lg:gap-5 lg:space-y-0">
          <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#111111]">
          <div className="grid grid-cols-7 border-b border-white/10 bg-white/[0.02]">
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
                  className={`relative min-h-[6.25rem] min-w-0 overflow-hidden border-b border-r border-white/10 p-0 text-left transition sm:min-h-[9rem] ${
                    isSelected
                      ? "bg-[#ff7a1a]/10 shadow-[inset_0_0_0_2px_rgba(255,122,26,0.55)]"
                      : dayLogsInCell.length > 0
                        ? "bg-[#101010] hover:bg-white/[0.03]"
                        : "bg-[#0f0f0f] hover:bg-white/[0.03]"
                  }`}
                >
                  {dayLogsInCell[0]?.content.poster_url ? <Image src={dayLogsInCell[0].content.poster_url} alt="" fill sizes="(max-width: 639px) 14vw, 12vw" className="object-contain" placeholder="blur" blurDataURL={getBlurDataUrl()} /> : null}
                  {dayLogsInCell.length > 0 ? <span className="absolute inset-0 bg-gradient-to-b from-black/65 via-transparent to-black/20" /> : null}
                  <span className={`absolute left-1.5 top-1 z-10 text-[11px] font-black sm:left-2.5 sm:top-2.5 sm:text-sm ${isSelected ? "text-[#ffb36b]" : dayLogsInCell.length ? "text-[#f5f0de]" : "text-[#ff7a1a]"}`}>{day}</span>
                  {dayLogsInCell.length > 1 ? <span className="absolute bottom-1 right-1 z-10 rounded-full bg-[#ff7a1a] px-1.5 py-0.5 text-[10px] font-black text-black">{dayLogsInCell.length}</span> : null}
                </button>
              );
            })}
          </div>
          </div>

        <div ref={listSectionRef} className="relative -mx-1 scroll-mt-24 overflow-hidden rounded-t-[1.5rem] border border-white/10 bg-gradient-to-b from-[#2a2a2a]/95 via-[#1f1f1f]/95 to-[#141414]/95 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_20px_50px_rgba(0,0,0,0.24)] sm:-mx-2 sm:p-4 lg:mx-0 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto">
          <div className="relative mb-3 flex flex-col items-center gap-2.5 text-center">
              <div><p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#ffb36b]/75">Watch Diary</p>
              <h3 className="mt-0.5 text-xl font-black leading-tight text-[#f5f0de] sm:text-2xl">
                {listMode === "all"
                  ? "All Months"
                  : selectedDay
                    ? `Logs for ${formatWatchedDate(selectedDay)}`
                    : `Logs for ${formatMonthTitle(currentMonth)}`}
              </h3></div>
              <div className="flex items-center justify-center gap-2">
                <button type="button" onClick={() => { setListMode("month"); setSelectedDay(null); }} className={`rounded-full px-2.5 py-1.5 text-xs font-black transition sm:text-sm ${listMode === "month" ? "bg-[#ff7a1a] text-black shadow-sm" : "border border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/10"}`}>Month</button>
                <button type="button" onClick={() => { setListMode("all"); setSelectedDay(null); }} className={`rounded-full px-2.5 py-1.5 text-xs font-black transition sm:text-sm ${listMode === "all" ? "bg-[#ff7a1a] text-black shadow-sm" : "border border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/10"}`}>All</button>
              </div>
          </div>

          {displayLogs.length > 0 ? (
            listMode === "all" ? (
              <div className="relative space-y-7">
                {groupLogsByMonth(displayLogs).map((group) => (
                  <div key={group.month}>
                    <h4 className="mb-3 text-center text-sm font-black uppercase tracking-[0.18em] text-[#ffb36b]/70">{group.month}</h4>
                    <div className="space-y-3">{group.logs.map((log) => <DiaryLogCard key={log.id} log={log} isRewatch={rewatchKeys.has(`${log.content_type}-${log.content_id}`)} />)}</div>
                  </div>
                ))}
              </div>
            ) : <div className="relative space-y-3">{displayLogs.map((log) => <DiaryLogCard key={log.id} log={log} isRewatch={rewatchKeys.has(`${log.content_type}-${log.content_id}`)} />)}</div>
          ) : (
            <div className="relative py-10 text-center text-sm text-white/55">
              No logs for this selection.
            </div>
          )}
        </div>
        </div> : <div className="space-y-3">
          <div className="flex items-center justify-end gap-2 px-1">
            <button type="button" onClick={() => setListMode("month")} className={`rounded-full px-2.5 py-1.5 text-xs font-black ${listMode === "month" ? "bg-[#ff7a1a] text-black" : "border border-white/10 bg-white/5 text-[#f5f0de]"}`}>Month</button>
            <button type="button" onClick={() => setListMode("all")} className={`rounded-full px-2.5 py-1.5 text-xs font-black ${listMode === "all" ? "bg-[#ff7a1a] text-black" : "border border-white/10 bg-white/5 text-[#f5f0de]"}`}>All</button>
          </div>
          <div className="bg-[#050505] p-1 sm:p-2">
            {ticketLogs.length ? <div className="grid grid-cols-3 gap-1.5 sm:gap-3.5 lg:grid-cols-4 lg:gap-4">{ticketLogs.map((log) => <TicketLogCard key={log.id} log={log} isRewatch={rewatchKeys.has(`${log.content_type}-${log.content_id}`)} />)}</div> : <p className="py-12 text-center text-sm text-white/45">No logs for this selection.</p>}
          </div>
        </div>}
        </div>

      </div>
    </PageLayout>
  );
}
