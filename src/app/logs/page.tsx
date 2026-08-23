"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import TopActionBanner from "@/components/TopActionBanner";
import LogMovieModal from "@/components/LogMovieModal";
import { User, MovieLogWithContent, Content } from "@/types";
import { signOut as authSignOut } from "@/lib/auth";
import { deleteMovieLog, getUserMovieLogs } from "@/lib/logs";
import { searchMovies } from "@/lib/tmdb";
import { searchShows } from "@/lib/tvmaze";
import { buildLogUrl } from "@/lib/log-url";
import { setPendingLoadingTitle } from "@/lib/loading-title";
import { getBlurDataUrl, getTmdbPosterUrl } from "@/lib/performance";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Ticket,
  Trash2,
  X,
} from "lucide-react";

type ListMode = "month" | "all";
type LogsViewMode = "diary" | "ticket";
type LogContentFilter = "all" | "movie" | "tv";

const INITIAL_LOG_LIMIT = 24;
const FULL_LOG_LIMIT = 500;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getPosterStackClass(index: number): string {
  return `poster-stack-${index}`;
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
  if (log.reaction === 2) return "border border-orange-500/35 bg-orange-500/12 text-orange-200";
  if (log.reaction === 1.5) return "border border-amber-400/35 bg-amber-400/12 text-amber-200";
  if (log.reaction === 1) return "border border-white/10 bg-white/5 text-[#f5f0de]";
  return "border border-white/10 bg-white/5 text-white/65";
}

function isUnavailableContent(log: MovieLogWithContent): boolean {
  return log.content.title === "Unknown Movie" || log.content.title === "Unknown Show";
}

function dateKeyFromLog(log: MovieLogWithContent): string {
  return log.watched_date;
}

function getDayDD(dateStr: string): string {
  const day = dateStr.split("-")[2] || "01";
  return day.padStart(2, "0");
}

function formatMonthTitle(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMonthName(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
  }).format(date);
}

function formatShortLogDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;

  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "2-digit",
  }).formatToParts(date);

  const day = parts.find((part) => part.type === "day")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const year = parts.find((part) => part.type === "year")?.value ?? "";

  return `${day} ${month} '${year}`;
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

function formatTicketDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat("en-GB", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function getReleaseYearLabel(
  releaseDate: string | null | undefined,
  fallbackDate?: string | null | undefined
): string | null {
  const rawDate = releaseDate || fallbackDate;
  if (!rawDate) return null;
  const year = rawDate.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

function getLogTitleClass(title: string): string {
  const compactLength = title.trim().length;

  if (compactLength <= 18) return "text-[1rem] sm:text-[1.28rem] lg:text-[1.36rem]";
  if (compactLength <= 32) return "text-[0.94rem] sm:text-[1.16rem] lg:text-[1.22rem]";
  if (compactLength <= 48) return "text-[0.86rem] sm:text-[1.02rem] lg:text-[1.08rem]";
  return "text-[0.78rem] sm:text-[0.92rem] lg:text-[0.98rem]";
}

function colorFromSeed(seed: string): { background: string; foreground: string; border: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  const background = `hsl(${hue} 18% 34%)`;
  const foreground = hue > 35 && hue < 220 ? "#f8f4ea" : "#fffaf0";
  const border = `hsl(${hue} 16% 24%)`;
  return { background, foreground, border };
}

function usePosterAccent(posterUrl: string | null | undefined, seed: string) {
  void posterUrl;
  return useMemo(() => colorFromSeed(seed), [seed]);
}

function monthStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function isSameCalendarMonth(left: Date, right: Date): boolean {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = monthStart(date);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

function isSameMonth(dateStr: string, monthRef: Date): boolean {
  const [y, m] = dateStr.split("-").map((v) => parseInt(v, 10));
  return y === monthRef.getFullYear() && m === monthRef.getMonth() + 1;
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
    const monthDate = new Date(parseInt(year), parseInt(month) - 1);
    const monthLabel = formatMonthTitle(monthDate);
    
    if (!monthMap.has(monthLabel)) {
      monthMap.set(monthLabel, []);
    }
    monthMap.get(monthLabel)!.push(log);
  }
  
  const result: Array<{ month: string; logs: MovieLogWithContent[] }> = [];
  
  // Sort by date descending
  for (const [month, logs] of monthMap) {
    logs.sort(compareLogsDesc);
    result.push({ month, logs });
  }
  
  // Sort months by date descending
  result.sort((a, b) => {
    const aDate = new Date(a.logs[0].watched_date);
    const bDate = new Date(b.logs[0].watched_date);
    return bDate.getTime() - aDate.getTime();
  });
  
  return result;
}

function logKey(log: MovieLogWithContent): string {
  return `${log.content_type}-${log.content_id}`;
}

function getTvLogContextLabel(log: Pick<MovieLogWithContent, "content_type" | "season" | "episode">): string {
  if (log.content_type !== "tv") return "";

  const hasSeason = typeof log.season === "number" && Number.isFinite(log.season);
  const hasEpisode = typeof log.episode === "number" && Number.isFinite(log.episode);

  if (hasSeason && hasEpisode) {
    return `S${log.season} EP${log.episode}`;
  }

  if (hasEpisode) {
    return `EP${log.episode}`;
  }

  if (hasSeason) {
    return `Season ${log.season}`;
  }

  return "";
}

function normalizeLogs(logs: MovieLogWithContent[]): MovieLogWithContent[] {
  return logs
    .filter((log) => !log.watch_later && Boolean(log.watched_date))
    .sort(compareLogsDesc);
}

function LogCard({
  log,
  onOpen,
  isRewatch,
}: {
  log: MovieLogWithContent;
  onOpen: (log: MovieLogWithContent) => void;
  isRewatch: boolean;
}) {
  const hasReview = Boolean(log.notes && log.notes.trim().length > 0);
  const hasTicketImage = Boolean(log.ticket_image_url);
  const watchedDate = new Date(`${log.watched_date}T00:00:00`);
  const watchedMonth = watchedDate.toLocaleDateString("en-US", { month: "short" });
  const watchedYear = watchedDate.toLocaleDateString("en-US", { year: "numeric" });
  const tvContextLabel = getTvLogContextLabel(log);
  const hasMetaItems = log.reaction != null || hasReview || hasTicketImage || isRewatch;
  const titleClass = getLogTitleClass(log.content.title);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(log)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(log);
        }
      }}
      className="group w-full cursor-pointer text-left"
    >
      <div className="relative overflow-hidden bg-black shadow-[0_16px_35px_rgba(0,0,0,0.22)] transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_20px_45px_rgba(0,0,0,0.28)]">
        <div className="grid min-h-[7.1rem] grid-cols-[5.1rem_0.8rem_minmax(0,1fr)_3.6rem] items-stretch sm:min-h-[8.6rem] sm:grid-cols-[6.4rem_1rem_minmax(0,1fr)_4.75rem]">
          <div className="relative m-2 sm:m-3">
            <div className="relative h-full min-h-[5.9rem] w-full overflow-hidden bg-black sm:min-h-[6.9rem]">
            {log.content.poster_url ? (
              <Image
                src={log.content.poster_url}
                alt={log.content.title}
                fill
                sizes="120px"
                className="object-cover"
                placeholder="blur"
                blurDataURL={getBlurDataUrl()}
              />
            ) : (
                <div className="flex h-full w-full items-center justify-center px-2 text-center text-[9px] text-white/45 sm:text-[10px]">
                No image
              </div>
            )}
          </div>
          </div>

          <div className="relative flex items-stretch justify-center py-3">
            <div className="w-px border-l border-dotted border-white/20" />
            <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1f1f1f]" />
            <div className="absolute left-1/2 bottom-0 h-3 w-3 -translate-x-1/2 translate-y-1/2 rounded-full bg-[#1f1f1f]" />
          </div>

          <div className="flex min-w-0 flex-col justify-start py-3 pr-2 sm:py-4 sm:pr-4">
            <p className={`break-words text-balance font-black leading-[1.02] tracking-[-0.04em] text-[#f7f1e3] ${titleClass}`}>
              {log.content.title}
            </p>
            {tvContextLabel ? (
              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#ffb36b]/82 sm:text-[11px]">
                {tvContextLabel}
              </p>
            ) : null}

            <div className="mt-1 space-y-1 text-[11px] text-white/72 sm:text-[13px]">
              {hasMetaItems ? (
                <div className="flex flex-col items-start gap-1">
                  {log.reaction != null ? (
                    <span
                      className={`inline-flex rounded-[0.8rem] border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] sm:text-[11px] ${getReactionClasses(log)}`}
                    >
                      {getReactionLabel(log)}
                    </span>
                  ) : null}

                  {hasReview || hasTicketImage || isRewatch ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {hasReview ? (
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center text-white/68"
                          aria-label="Review"
                          title="Review"
                        >
                          <Pencil className="h-4 w-4 flex-shrink-0" />
                        </span>
                      ) : null}

                      {hasTicketImage ? (
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center text-white/68"
                          aria-label="Ticket image"
                          title="Ticket image"
                        >
                          <ImageIcon className="h-4 w-4 flex-shrink-0" />
                        </span>
                      ) : null}

                      {isRewatch ? (
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center text-white/68"
                          aria-label="Rewatch"
                          title="Rewatch"
                        >
                          <RotateCcw className="h-4 w-4 flex-shrink-0" />
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {isUnavailableContent(log) ? (
                <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-white/38 sm:text-[11px]">
                  Details unavailable
                </p>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col items-center justify-center border-l border-white/8 px-2 text-[#f5f0de] sm:px-3">
            <span className="text-[0.72rem] font-light italic leading-none text-white/72 sm:text-[0.88rem]">
              {watchedMonth}
            </span>
            <span className="mt-1 text-[2rem] font-light leading-none tracking-[-0.04em] sm:text-[2.6rem]">
              {getDayDD(log.watched_date)}
            </span>
            <span className="mt-1 text-[0.66rem] font-medium leading-none text-white/65 sm:text-[0.74rem]">
              {watchedYear}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function TicketLogCard({
  log,
  onOpen,
  isRewatch,
}: {
  log: MovieLogWithContent;
  onOpen: (log: MovieLogWithContent) => void;
  isRewatch: boolean;
}) {
  const hasReview = Boolean(log.notes && log.notes.trim().length > 0);
  const hasTicketImage = Boolean(log.ticket_image_url);
  const tvContextLabel = getTvLogContextLabel(log);
  const accent = usePosterAccent(log.content.poster_url, `${log.content.title}-${log.id}`);
  const titleClass = getLogTitleClass(log.content.title);
  const detailPanelStyle: CSSProperties = {
    backgroundColor: accent.background,
    color: accent.foreground,
    borderTopColor: accent.border,
  };
  const metaChipStyle: CSSProperties = {
    borderColor: accent.foreground === "#101010" ? "rgba(16,16,16,0.14)" : "rgba(248,244,234,0.16)",
    backgroundColor: accent.foreground === "#101010" ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.08)",
    color: accent.foreground,
  };
  const subTextStyle: CSSProperties = {
    color: accent.foreground === "#101010" ? "rgba(16,16,16,0.72)" : "rgba(248,244,234,0.78)",
  };

  return (
    <button
      type="button"
      onClick={() => onOpen(log)}
      className="group relative aspect-[0.44] w-full overflow-hidden bg-black text-left transition duration-200 hover:-translate-y-1 sm:aspect-[0.54] lg:aspect-[0.48]"
    >
      <div className="absolute left-0 top-1/2 z-20 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-[#020202] sm:h-7 sm:w-7" />
      <div className="absolute right-0 top-1/2 z-20 h-5 w-5 translate-x-1/2 -translate-y-1/2 rounded-full border border-white/12 bg-[#020202] sm:h-7 sm:w-7" />

      <div className="relative h-1/2 overflow-hidden border-b border-dashed border-white/12 bg-[#050505]">
        {log.content.poster_url ? (
          <Image
            src={log.content.poster_url}
            alt={log.content.title}
            fill
            sizes="(max-width: 768px) 33vw, 260px"
            className="object-cover transition duration-300 group-hover:scale-[1.02]"
            placeholder="blur"
            blurDataURL={getBlurDataUrl()}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-3 text-center text-[10px] font-medium uppercase tracking-[0.18em] text-white/35">
            No poster
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black via-black/60 to-transparent" />
      </div>

      <div className="flex h-1/2 flex-col border-t px-2.5 pb-2.5 pt-2 sm:px-3.5 sm:pb-3.5 sm:pt-3.5 lg:px-4 lg:pb-4" style={detailPanelStyle}>
        <div className="min-h-[2.5rem] sm:min-h-[3.1rem] lg:min-h-[3.5rem]">
          <p className={`break-words text-balance font-black leading-[1.02] tracking-[-0.04em] ${titleClass}`}>
            {log.content.title}
          </p>
          {tvContextLabel ? (
            <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] sm:text-[11px]" style={subTextStyle}>
              {tvContextLabel}
            </p>
          ) : null}
        </div>

        <div className="mt-3 flex flex-col items-start gap-1.5 overflow-hidden sm:mt-2.5 sm:gap-1.5 lg:mt-3 lg:gap-2">
          {log.reaction != null ? (
            <span
              className="inline-flex min-w-0 flex-shrink rounded-[0.8rem] border px-1.5 py-1 text-[7px] font-semibold uppercase tracking-[0.1em] whitespace-nowrap sm:px-2 sm:text-[9px] lg:px-2.5 lg:text-[11px]"
              style={metaChipStyle}
              title={getReactionLabel(log)}
            >
              {getReactionLabel(log)}
            </span>
          ) : null}
          {hasReview || hasTicketImage || isRewatch ? (
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-1.5 lg:gap-2">
              {hasReview ? (
                <span
                  className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center sm:h-7 sm:w-7 lg:h-8 lg:w-8"
                  style={{ color: metaChipStyle.color }}
                  title="Review written"
                >
                  <Pencil className="h-2.5 w-2.5 sm:h-3 sm:w-3 lg:h-3.5 lg:w-3.5" />
                </span>
              ) : null}
              {hasTicketImage ? (
                <span
                  className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center sm:h-7 sm:w-7 lg:h-8 lg:w-8"
                  style={{ color: metaChipStyle.color }}
                  title="Ticket image"
                >
                  <ImageIcon className="h-2.5 w-2.5 sm:h-3 sm:w-3 lg:h-3.5 lg:w-3.5" />
                </span>
              ) : null}
              {isRewatch ? (
                <span
                  className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center sm:h-7 sm:w-7 lg:h-8 lg:w-8"
                  style={{ color: metaChipStyle.color }}
                  title="Rewatch"
                >
                  <RotateCcw className="h-2.5 w-2.5 sm:h-3 sm:w-3 lg:h-3.5 lg:w-3.5" />
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-auto min-h-[1.25rem] pt-1.5 sm:min-h-[3.2rem] sm:pt-2.5 lg:min-h-[3.6rem] lg:pt-3">
          {hasReview ? (
            <p className="hidden sm:line-clamp-3 sm:block sm:text-[10px] sm:leading-4 lg:text-[12px] lg:leading-5" style={subTextStyle}>
              {log.notes}
            </p>
          ) : null}
        </div>

        <div className="mt-1.5 flex items-center justify-between border-t pt-1.5 text-[10px] font-medium tracking-[0.01em] sm:mt-2.5 sm:pt-2.5 sm:text-[9px] lg:mt-3 lg:pt-3 lg:text-[11px]" style={{ borderTopColor: accent.foreground === "#101010" ? "rgba(16,16,16,0.14)" : "rgba(248,244,234,0.16)" }}>
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 sm:h-3 sm:w-3 lg:h-3.5 lg:w-3.5" />
            {formatTicketDate(log.watched_date)}
          </span>
        </div>
      </div>
    </button>
  );
}

export default function LogsPage() {
  const router = useRouter();
  const { user: sessionUser, loading: sessionLoading } = useCurrentUser();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [logsLoading, setLogsLoading] = useState(true);
  const [logs, setLogs] = useState<MovieLogWithContent[]>([]);

  const [showLogModal, setShowLogModal] = useState(false);
  const [selectedContent, setSelectedContent] = useState<Content | null>(null);

  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Content[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFilter, setSearchFilter] = useState<"all" | "movie" | "tv">("all");
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logContentFilter, setLogContentFilter] = useState<LogContentFilter>("all");
  const [showLogFilterMenu, setShowLogFilterMenu] = useState(false);

  const [currentMonth, setCurrentMonth] = useState<Date>(monthStart(new Date()));
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [listMode, setListMode] = useState<ListMode>("month");
  const [viewMode, setViewMode] = useState<LogsViewMode>("diary");

  const [activeLog, setActiveLog] = useState<MovieLogWithContent | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const listSectionRef = useRef<HTMLDivElement | null>(null);
  const fullHistoryHydratedRef = useRef(false);
  const fullHistoryLoadingRef = useRef(false);
  const logFilterMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const targetUsername = new URLSearchParams(window.location.search).get("user")?.trim();
    if (!targetUsername) return;

    router.replace(`/user/${encodeURIComponent(targetUsername)}/logs`);
  }, [router]);

  useEffect(() => {
    if (!bannerMessage) return;

    const timer = window.setTimeout(() => {
      setBannerMessage(null);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [bannerMessage]);

  useEffect(() => {
    if (!showLogFilterMenu) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!logFilterMenuRef.current?.contains(event.target as Node)) {
        setShowLogFilterMenu(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showLogFilterMenu]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const storedMessage = window.sessionStorage.getItem("cine_action_banner");
    if (!storedMessage) return;

    window.sessionStorage.removeItem("cine_action_banner");
    setBannerMessage(storedMessage);
  }, []);

  useEffect(() => {
    if (sessionLoading) return;
    if (!sessionUser) {
      router.push("/auth/login");
      return;
    }

    let cancelled = false;

    const loadLogs = async () => {
      try {
        setUser(sessionUser);
        setLoading(false);
        setLogsLoading(true);
        fullHistoryHydratedRef.current = false;
        fullHistoryLoadingRef.current = false;

        const initialLogs = await getUserMovieLogs(sessionUser.id, INITIAL_LOG_LIMIT, sessionUser);
        if (cancelled) return;

        setLogs(normalizeLogs(initialLogs));
      } catch (error) {
        console.error("Error loading logs:", error);
      } finally {
        if (!cancelled) {
          setLogsLoading(false);
        }
      }
    };

    void loadLogs();

    return () => {
      cancelled = true;
    };
  }, [router, sessionLoading, sessionUser]);

  useEffect(() => {
    setSelectedDay(null);
    if (listMode !== "all") {
      setListMode("month");
    }
  }, [currentMonth, listMode]);

  useEffect(() => {
    if (!user) return;
    if (FULL_LOG_LIMIT <= INITIAL_LOG_LIMIT) return;
    if (fullHistoryHydratedRef.current || fullHistoryLoadingRef.current) return;

    const needsFullHistory =
      listMode === "all" || !isSameCalendarMonth(currentMonth, monthStart(new Date()));

    if (!needsFullHistory) return;

    let cancelled = false;
    fullHistoryLoadingRef.current = true;

    void (async () => {
      try {
        setLogsLoading(true);
        const fullLogs = await getUserMovieLogs(user.id, FULL_LOG_LIMIT, user);
        if (cancelled) return;

        fullHistoryHydratedRef.current = true;
        setLogs((current) => {
          const normalizedFullLogs = normalizeLogs(fullLogs);
          return normalizedFullLogs.length > current.length ? normalizedFullLogs : current;
        });
      } catch (error) {
        console.error("Error hydrating full log history:", error);
      } finally {
        fullHistoryLoadingRef.current = false;
        if (!cancelled) {
          setLogsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentMonth, listMode, user]);

  const filteredLogs = useMemo(() => {
    return logContentFilter === "all"
      ? logs
      : logs.filter((log) => log.content_type === logContentFilter);
  }, [logContentFilter, logs]);

  const logsByDate = useMemo(() => {
    const map = new Map<string, MovieLogWithContent[]>();
    for (const log of filteredLogs) {
      const key = dateKeyFromLog(log);
      const bucket = map.get(key) || [];
      bucket.push(log);
      map.set(key, bucket);
    }
    for (const [, bucket] of map) {
      bucket.sort(compareLogsDesc);
    }
    return map;
  }, [filteredLogs]);

  const monthLogs = useMemo(() => {
    return filteredLogs.filter((log) => isSameMonth(log.watched_date, currentMonth));
  }, [filteredLogs, currentMonth]);

  const rewatchKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const log of logs) {
      const key = logKey(log);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }, [logs]);

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
  }, [dayLogs, filteredLogs, listMode, monthLogs, selectedDay]);

  const visibleLogs = useMemo(() => {
    const normalized = logSearchQuery.trim().toLowerCase();
    if (!normalized) return displayLogs;

    return displayLogs.filter((log) => {
      const title = log.content.title.toLowerCase();
      const notes = (log.notes || "").toLowerCase();
      const type = log.content_type === "tv" ? "tv show" : "movie";
      return title.includes(normalized) || notes.includes(normalized) || type.includes(normalized);
    });
  }, [displayLogs, logSearchQuery]);

  const visibleTicketLogs = useMemo(() => {
    const normalized = logSearchQuery.trim().toLowerCase();
    const baseLogs = monthLogs.slice().sort(compareLogsDesc);

    if (!normalized) return baseLogs;

    return baseLogs.filter((log) => {
      const title = log.content.title.toLowerCase();
      const notes = (log.notes || "").toLowerCase();
      const type = log.content_type === "tv" ? "tv show" : "movie";
      return title.includes(normalized) || notes.includes(normalized) || type.includes(normalized);
    });
  }, [logSearchQuery, monthLogs]);

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
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleSearch = async (queryText: string) => {
    setSearchQuery(queryText);

    if (queryText.trim().length < 1) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const searchMode = searchFilter;

      const movies = searchMode === "tv" ? [] : await searchMovies(queryText);
      const shows = searchMode === "movie" ? [] : await searchShows(queryText);

      const movieResults = movies.map((movie) => ({
        id: movie.id,
        title: movie.title,
        poster_url: getTmdbPosterUrl(movie.poster_path, "w500"),
        genres: (movie.genres || []).map((genreId: number) => String(genreId)),
        release_date: movie.release_date || "",
        overview: movie.overview || "",
        runtime: movie.runtime || 0,
        rating: typeof movie.vote_average === "number" ? movie.vote_average : 0,
        type: "movie" as const,
        platforms: [],
        director: null,
        created_at: new Date().toISOString(),
      }));

      const showResults = shows.map((show) => ({
        id: show.id,
        title: show.name || show.title || "",
        name: show.name,
        poster_url: show.poster_url || null,
        genres: show.genres || [],
        release_date: show.release_date || show.premiered || "",
        premiered: show.premiered || show.release_date || "",
        overview: show.overview || "",
        runtime: show.runtime || 0,
        rating: typeof show.rating === "number" ? show.rating : 0,
        type: "tv" as const,
        status: show.status || null,
        network: undefined,
        source: show.source,
        tmdb_id: show.tmdb_id,
        tvmaze_id: show.tvmaze_id,
        created_at: new Date().toISOString(),
      }));

      setSearchResults([...movieResults, ...showResults].slice(0, 20));
      setShowSearchModal(true);
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (showSearchModal && searchQuery.trim().length >= 2) {
      void handleSearch(searchQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchFilter]);

  const handleSelectContent = (content: Content) => {
    setSelectedContent(content);
    setShowSearchModal(false);
    setShowLogModal(true);
  };

  const handleRefreshLogs = async () => {
    if (!user) return;
    try {
      setLogsLoading(true);
      const targetLimit = fullHistoryHydratedRef.current ? FULL_LOG_LIMIT : INITIAL_LOG_LIMIT;
      const userLogs = await getUserMovieLogs(user.id, targetLimit, user);
      setLogs(normalizeLogs(userLogs));
    } catch (error) {
      console.error("Error refreshing logs:", error);
    } finally {
      setLogsLoading(false);
    }
  };

  const filteredSearchResults = useMemo(() => {
    return searchResults.filter((result) => searchFilter === "all" || result.type === searchFilter);
  }, [searchFilter, searchResults]);

  const handleOpenLogDetails = (log: MovieLogWithContent) => {
    setPendingLoadingTitle(log.content?.title);
    router.push(buildLogUrl(log));
  };

  const scrollToListSection = () => {
    window.requestAnimationFrame(() => {
      listSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const handleDeleteLog = async () => {
    if (!activeLog) return;
    const ok = window.confirm("Delete this log permanently?");
    if (!ok) return;

    try {
      setDeleting(true);
      await deleteMovieLog(activeLog.id);
      await handleRefreshLogs();
      setShowDetailsModal(false);
      setActiveLog(null);
    } catch (error) {
      console.error("Delete log error:", error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading || !user) {
    return null;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut} theme="brutalist">
      <TopActionBanner message={bannerMessage} />
      <div className="brutalist mx-auto max-w-6xl space-y-5 px-1 pb-[calc(9rem+env(safe-area-inset-bottom))] sm:space-y-6 sm:p-8 sm:pb-[calc(10rem+env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              type="text"
              value={logSearchQuery}
              onChange={(e) => setLogSearchQuery(e.target.value)}
              placeholder="Search logged movies & TV shows"
              className="field w-full rounded-full py-3 pl-10 pr-4 text-sm"
            />
          </div>

          <button
            onClick={() => {
              setSearchQuery("");
              setSearchResults([]);
              setShowSearchModal(true);
            }}
            className="action-primary flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[1rem]"
            aria-label="Log title"
          >
            <Plus className="h-5 w-5" />
          </button>

          <div className="relative flex-shrink-0" ref={logFilterMenuRef}>
            <button
              onClick={() => setShowLogFilterMenu((current) => !current)}
              className="flex h-12 w-12 items-center justify-center rounded-[1rem] border border-white/10 bg-[#111111] text-[#f5f0de] transition hover:bg-white/5"
              aria-label="Filter logs"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>

            {showLogFilterMenu ? (
              <div className="absolute right-0 top-[calc(100%+0.6rem)] z-20 min-w-[12rem] overflow-hidden rounded-[1rem] border border-white/10 bg-[#111111] p-1.5 shadow-[0_20px_40px_rgba(0,0,0,0.35)]">
                {([
                  ["all", "All"],
                  ["movie", "Movies"],
                  ["tv", "TV Shows"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => {
                      setLogContentFilter(value);
                      setShowLogFilterMenu(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-[0.8rem] px-3 py-2 text-left text-xs font-medium transition ${
                      logContentFilter === value
                        ? "bg-[#ff7a1a] text-[#111111]"
                        : "text-[#f5f0de] hover:bg-white/5"
                    }`}
                  >
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(22rem,0.88fr)] lg:items-start lg:gap-5 lg:space-y-0">
          <div className="space-y-4 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.6rem] border border-white/10 bg-[#0d0d0d] px-3 py-3 sm:px-5">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  className="rounded-full border border-white/10 bg-white/5 p-1.5 text-[#f5f0de] shadow-sm transition hover:bg-white/10 sm:p-2"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
                <button
                  onClick={() => setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  className="rounded-full border border-white/10 bg-white/5 p-1.5 text-[#f5f0de] shadow-sm transition hover:bg-white/10 sm:p-2"
                  aria-label="Next month"
                >
                  <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
                </button>
              </div>

              <div className="min-w-0 flex-1 text-center">
                <h2 className="text-2xl font-black uppercase leading-none tracking-normal text-[#f5f0de] sm:text-4xl">
                  {formatMonthName(currentMonth)}
                </h2>
                <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.24em] text-[#ffb36b] sm:text-[10px]">
                  {currentMonth.getFullYear()}
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] p-1">
                <button
                  onClick={() => setViewMode("diary")}
                  className={`rounded-full px-3 py-1.5 text-xs font-black transition sm:text-sm ${
                    viewMode === "diary" ? "bg-[#ff7a1a] text-black shadow-sm" : "text-[#f5f0de] hover:bg-white/8"
                  }`}
                  aria-label="Diary view"
                >
                  {viewMode === "diary" ? <Calendar className="h-4 w-4" /> : "Diary"}
                </button>
                <button
                  onClick={() => {
                    setViewMode("ticket");
                    setSelectedDay(null);
                    setListMode("month");
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-black transition sm:text-sm ${
                    viewMode === "ticket" ? "bg-[#ff7a1a] text-black shadow-sm" : "text-[#f5f0de] hover:bg-white/8"
                  }`}
                  aria-label="Ticket view"
                >
                  {viewMode === "ticket" ? <Ticket className="h-4 w-4" /> : "Ticket"}
                </button>
              </div>
            </div>

            {viewMode === "diary" ? (
              <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(22rem,0.88fr)] lg:items-start lg:gap-5 lg:space-y-0">
                <div className="space-y-0">
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
                      const visibleStackCount = Math.min(dayLogsInCell.length, 3);
                      const stackOffsetPx = dayLogsInCell.length > 1 ? 6 : 0;
                      const stackHeightOffsetPx = (visibleStackCount - 1) * stackOffsetPx;

                      return (
                        <button
                          key={cell.key}
                          onClick={() => {
                            setListMode("month");
                            setSelectedDay((prev) => (prev === dayKey ? null : dayKey));
                            scrollToListSection();
                          }}
                          className={`group relative min-h-[6.25rem] overflow-hidden border-b border-r border-white/10 text-left transition sm:min-h-[9rem] ${
                            isSelected
                              ? "bg-orange-500/10 shadow-[inset_0_0_0_2px_rgba(255,122,26,0.55)]"
                              : dayLogsInCell.length > 0
                              ? "bg-[#101010] hover:bg-white/[0.03]"
                              : "bg-[#0f0f0f] hover:bg-white/[0.03]"
                          }`}
                        >
                          {dayLogsInCell.length > 0 ? (
                            <div className="absolute inset-0">
                              <div className="relative flex h-full w-full items-center justify-center">
                                {dayLogsInCell.slice(0, 3).map((log, idx) => (
                                  log.content.poster_url ? (
                                    <Image
                                      key={log.id}
                                      src={log.content.poster_url}
                                      alt={log.content.title}
                                      width={120}
                                      height={180}
                                      className={`absolute h-full w-full object-cover shadow-[0_8px_18px_rgba(15,23,42,0.22)] transition duration-200 group-hover:-translate-y-0.5 ${getPosterStackClass(idx)}`}
                                      style={{
                                        height: `calc(100% - ${stackHeightOffsetPx}px)`,
                                        left: 0,
                                        top: idx * stackOffsetPx,
                                        width: "100%",
                                        zIndex: 10 + idx,
                                      }}
                                      placeholder="blur"
                                      blurDataURL={getBlurDataUrl("#e2e8f0")}
                                    />
                                  ) : (
                                    <div
                                      key={log.id}
                                      className={`absolute flex h-full w-full items-center justify-center bg-slate-100 px-1 text-center text-[8px] font-bold text-slate-400 shadow-[0_8px_18px_rgba(15,23,42,0.16)] sm:text-[10px] ${getPosterStackClass(idx)}`}
                                      style={{
                                        height: `calc(100% - ${stackHeightOffsetPx}px)`,
                                        left: 0,
                                        top: idx * stackOffsetPx,
                                        width: "100%",
                                        zIndex: 10 + idx,
                                      }}
                                    >
                                      No poster
                                    </div>
                                  )
                                ))}
                              </div>
                            </div>
                          ) : (
                            <>
                              <span className={`absolute left-1.5 top-1.5 z-20 text-[11px] font-black sm:left-2.5 sm:top-2.5 sm:text-sm ${isSelected ? "text-[#ffb36b]" : "text-[#ff7a1a]"}`}>
                                {day}
                              </span>
                              <div className="pointer-events-none absolute inset-x-3 bottom-3 hidden h-px bg-white/10 sm:block" />
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div
                  ref={listSectionRef}
                  className="relative -mx-1 scroll-mt-24 overflow-hidden border border-white/10 bg-gradient-to-b from-[#2a2a2a]/95 via-[#1f1f1f]/95 to-[#141414]/95 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_20px_50px_rgba(0,0,0,0.24)] sm:-mx-2 sm:p-4 lg:mx-0 lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto"
                >
          <div className="pointer-events-none absolute -left-12 top-8 h-40 w-40 rounded-full bg-white/5 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 top-56 h-48 w-48 rounded-full bg-white/4 blur-3xl" />
          <div className="relative mb-3 flex flex-col items-center gap-2.5 text-center">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.24em] text-[#ffb36b]/75">
                Watch Diary
              </p>
              <h3 className="mt-0.5 text-xl font-black leading-tight text-[#f5f0de] sm:text-2xl">
                {listMode === "all"
                  ? "All Months"
                  : selectedDay
                ? `Logs for ${formatShortLogDate(selectedDay)}`
                  : `Logs for ${formatMonthTitle(currentMonth)}`}
              </h3>
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => setListMode("month")}
                className={`rounded-full px-2.5 py-1.5 text-xs font-black transition sm:text-sm ${
                  listMode === "month" ? "bg-[#ff7a1a] text-black shadow-sm" : "border border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/10"
                }`}
              >
                Month
              </button>
              <button
                onClick={() => {
                  setListMode("all");
                  setSelectedDay(null);
                }}
                className={`rounded-full px-2.5 py-1.5 text-xs font-black transition sm:text-sm ${
                  listMode === "all" ? "bg-[#ff7a1a] text-black shadow-sm" : "border border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/10"
                }`}
              >
                All
              </button>
            </div>

          </div>

          {visibleLogs.length > 0 ? (
            listMode === "all" ? (
              // Grouped by month for "All" mode
              <div className="relative space-y-7">
                {groupLogsByMonth(visibleLogs).map((group) => (
                  <div key={group.month}>
                    <h4 className="mb-3 text-center text-sm font-black uppercase tracking-[0.18em] text-[#ffb36b]/70">
                      {group.month}
                    </h4>
                    <div className="space-y-3">
                      {group.logs.map((log) => (
                        <LogCard
                          key={log.id}
                          log={log}
                          onOpen={handleOpenLogDetails}
                          isRewatch={rewatchKeys.has(logKey(log))}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Regular list for "Month" mode
              <div className="relative space-y-3">
                {visibleLogs.map((log) => (
                  <LogCard
                    key={log.id}
                    log={log}
                    onOpen={handleOpenLogDetails}
                    isRewatch={rewatchKeys.has(logKey(log))}
                  />
                ))}
              </div>
            )
          ) : logsLoading ? (
            <div className="relative py-10 text-center text-white/55">
              Loading your logs...
            </div>
          ) : (
            <div className="relative py-10 text-center text-white/55">
              {logSearchQuery.trim()
                ? "No logged movies or TV shows match your search."
                : "No logs for this selection."}
            </div>
          )}
                </div>
              </div>
            ) : (
              <div className="bg-[#050505] p-1 sm:p-2">
                {visibleTicketLogs.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 sm:gap-3.5 md:grid-cols-3 md:gap-4 xl:grid-cols-4">
                    {visibleTicketLogs.map((log) => (
                      <TicketLogCard
                        key={log.id}
                        log={log}
                        onOpen={handleOpenLogDetails}
                        isRewatch={rewatchKeys.has(logKey(log))}
                      />
                    ))}
                  </div>
                ) : logsLoading ? (
                  <div className="py-16 text-center text-white/45">
                    Loading your logs...
                  </div>
                ) : (
                  <div className="py-16 text-center text-white/45">
                    {logSearchQuery.trim()
                      ? "No ticket logs match your search this month."
                      : "No logs in this month for ticket view."}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showSearchModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-2 pt-2 sm:items-center sm:p-4">
          <div className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#111111] text-[#f5f0de] shadow-2xl sm:max-h-[90vh] sm:rounded-lg">
            <div className="flex items-center justify-between border-b border-white/10 p-4 sm:p-6">
              <h2 className="text-lg font-bold text-[#f5f0de] sm:text-xl">Search & Log Movie</h2>
              <button
                onClick={() => setShowSearchModal(false)}
                className="rounded-full border border-white/10 p-2 text-white/55 hover:bg-white/5 hover:text-[#f5f0de]"
                aria-label="Close search modal"
                title="Close search modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-white/10 p-4 sm:p-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
                <input
                  type="text"
                  placeholder="Search movies & shows..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  autoFocus
                  className="field py-3 pl-10 pr-4 text-base"
                />
              </div>
            </div>

            {searchResults.length > 0 && (
              <>
                <div className="sticky top-0 flex gap-2 overflow-x-auto border-b border-white/10 bg-[#111111] p-4">
                  <button
                    onClick={() => setSearchFilter("all")}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      searchFilter === "all"
                        ? "bg-[#ff7a1a] text-black"
                        : "bg-white/5 text-[#f5f0de] hover:bg-white/10"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSearchFilter("movie")}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      searchFilter === "movie"
                        ? "bg-[#ff7a1a] text-black"
                        : "bg-white/5 text-[#f5f0de] hover:bg-white/10"
                    }`}
                  >
                    Movies
                  </button>
                  <button
                    onClick={() => setSearchFilter("tv")}
                    className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                      searchFilter === "tv"
                        ? "bg-[#ff7a1a] text-black"
                        : "bg-white/5 text-[#f5f0de] hover:bg-white/10"
                    }`}
                  >
                    TV Shows
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto overscroll-contain">
                  {filteredSearchResults.map((result) => (
                      <div
                        key={`${result.type}-${result.id}`}
                        onClick={() => handleSelectContent(result)}
                        className="flex cursor-pointer items-center gap-3 border-b border-white/10 p-4 transition-colors last:border-b-0 hover:bg-white/5"
                      >
                        <div className="relative h-20 w-14 overflow-hidden rounded-xl bg-white/5 sm:h-16 sm:w-12 sm:rounded">
                          {result.poster_url ? (
                            <Image
                              src={result.poster_url}
                              alt={result.title}
                              fill
                              sizes="56px"
                              className="object-cover"
                              placeholder="blur"
                              blurDataURL={getBlurDataUrl()}
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center px-1 text-center text-[10px] font-medium leading-tight text-white/45">
                              No poster
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="line-clamp-2 font-semibold text-[#f5f0de]">{result.title}</h3>
                          <p className="text-sm text-white/60">
                            {[
                              result.type === "tv" ? "TV Show" : "Movie",
                              getReleaseYearLabel(
                                result.release_date,
                                result.type === "tv" && "premiered" in result ? result.premiered : undefined
                              ),
                            ]
                              .filter(Boolean)
                              .join(" • ")}
                          </p>
                        </div>
                      </div>
                    ))}

                  {filteredSearchResults.length === 0 && searchQuery.length >= 2 && !searching && (
                    <div className="p-10 text-center text-white/55">
                      No {searchFilter === "tv" ? "TV shows" : searchFilter === "movie" ? "movies" : "results"} found.
                    </div>
                  )}
                </div>
              </>
            )}

            {searchQuery.length >= 2 && searchResults.length === 0 && !searching && (
              <div className="p-12 text-center">
                <Calendar className="mx-auto mb-3 h-12 w-12 text-white/25" />
                <p className="text-white/60">No results found</p>
              </div>
            )}

            {searching && (
              <div className="p-12 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#ff7a1a]" />
              </div>
            )}
          </div>
        </div>
      )}

      {selectedContent && user && (
        <LogMovieModal
          isOpen={showLogModal}
          onClose={() => {
            setShowLogModal(false);
            setSelectedContent(null);
          }}
          content={selectedContent}
          user={user}
          theme="brutalist"
          onLogCreated={(message) => {
            setBannerMessage(message);
            setShowLogModal(false);
            setSelectedContent(null);
            handleRefreshLogs();
          }}
        />
      )}

      {showDetailsModal && activeLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-white/10 bg-[#111111] shadow-xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-[#111111] p-5">
              <h3 className="text-xl font-bold text-[#f5f0de]">Log Details</h3>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setActiveLog(null);
                }}
                className="text-white/55 hover:text-[#f5f0de]"
                aria-label="Close log details"
                title="Close log details"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="flex gap-4">
                <div className="relative h-36 w-24 overflow-hidden rounded bg-white/5">
                  {activeLog.content.poster_url ? (
                    <Image
                      src={activeLog.content.poster_url}
                      alt={activeLog.content.title}
                      fill
                      sizes="96px"
                      className="object-cover"
                      placeholder="blur"
                      blurDataURL={getBlurDataUrl()}
                    />
                  ) : null}
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#f5f0de]">{activeLog.content.title}</p>
                  {isUnavailableContent(activeLog) && (
                    <span className="mt-2 inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-200">
                      Details unavailable
                    </span>
                  )}
                  <p className="mt-1 text-sm text-white/65">Watched on {formatWatchedDate(activeLog.watched_date)}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${getReactionClasses(activeLog)}`}>
                      {getReactionLabel(activeLog)}
                    </span>
                    {rewatchKeys.has(logKey(activeLog)) && (
                      <span
                        className="inline-flex items-center justify-center text-[#f5f0de]/80"
                        aria-label="Rewatch"
                        title="Rewatch"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {activeLog.notes && (
                <div>
                  <p className="mb-1 text-sm font-semibold text-[#f5f0de]">Review</p>
                  <p className="whitespace-pre-wrap rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-[#f5f0de]">
                    {activeLog.notes}
                  </p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {activeLog.mood && (
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <p className="mb-1 text-xs text-white/50">Mood</p>
                    <p className="text-sm font-medium text-[#f5f0de]">{activeLog.mood}</p>
                  </div>
                )}

                {activeLog.context_log?.location && (
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <p className="mb-1 text-xs text-white/50">Location</p>
                    <p className="text-sm font-medium text-[#f5f0de]">{activeLog.context_log.location}</p>
                  </div>
                )}

                {activeLog.context_log?.watched_with && (
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <p className="mb-1 text-xs text-white/50">Watched With</p>
                    <p className="text-sm font-medium text-[#f5f0de]">{activeLog.context_log.watched_with}</p>
                  </div>
                )}

                {activeLog.context_log?.mood && (
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
                    <p className="mb-1 text-xs text-white/50">Context Mood</p>
                    <p className="text-sm font-medium text-[#f5f0de]">{activeLog.context_log.mood}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-white/10 bg-[#111111] p-5">
              <button
                onClick={() => {
                  setPendingLoadingTitle(activeLog.content?.title);
                  router.push(buildLogUrl(activeLog));
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-4 py-2 text-[#f5f0de] hover:bg-white/[0.04]"
              >
                <Pencil className="w-4 h-4" />
                Edit
              </button>
              <button
                onClick={handleDeleteLog}
                disabled={deleting}
                className="inline-flex items-center gap-2 rounded-lg bg-[#ff7a1a] px-4 py-2 text-black hover:bg-[#ff8d3b] disabled:opacity-60"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
