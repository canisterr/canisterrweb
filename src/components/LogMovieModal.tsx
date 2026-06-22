"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Content, MovieLog, MovieLogWithContent, User } from "@/types";
import { createLogCinePost } from "@/lib/cineposts";
import { createMovieLog, getUserMovieLogs, updateMovieLog } from "@/lib/logs";
import { getSeasonEpisodes, getShowEpisodes, getShowSeasons, type TVMazeEpisode, type TVMazeSeason } from "@/lib/tvmaze-seasons";
import { reportAppError } from "@/lib/report-error";

interface LogMovieModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: Content;
  user: User | null;
  onLogCreated?: (message: string) => void;
  mode?: "create" | "edit";
  existingLog?: MovieLogWithContent | null;
  onLogUpdated?: (log: MovieLogWithContent) => void;
  theme?: "default" | "brutalist";
  initialTvScope?: number | "all" | null;
  initialTvEpisodeChoice?: "all" | null;
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

function isSameContent(
  log: { content_id: number; content_type: "movie" | "tv" },
  currentContent: Content
): boolean {
  const currentType = currentContent.type === "tv" ? "tv" : "movie";
  return log.content_id === currentContent.id && log.content_type === currentType;
}

function getSeasonOptionLabel(season: TVMazeSeason): string {
  const defaultLabel = `Season ${season.number}`;
  if (!season.name || season.name.trim() === defaultLabel) {
    return defaultLabel;
  }

  return `${defaultLabel} - ${season.name}`;
}

function getEpisodeOptionLabel(episode: TVMazeEpisode): string {
  const base = `S${episode.season}E${episode.number}`;
  return episode.name ? `${base} - ${episode.name}` : base;
}

function formatRuntime(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}m`;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function getReleaseYear(releaseDate: string | null | undefined): string | null {
  if (!releaseDate) return null;
  const year = releaseDate.slice(0, 4);
  return /^\d{4}$/.test(year) ? year : null;
}

function getMetadataLine(content: Content): string {
  return [
    getReleaseYear(content.release_date),
    formatRuntime(content.runtime),
    content.director,
  ]
    .filter(Boolean)
    .join(" • ");
}

function getTitleClass(title: string): string {
  const words = title.trim().split(/\s+/).filter(Boolean).length;
  if (words <= 2) return "text-[34px] sm:text-[54px]";
  if (words <= 4) return "text-[28px] sm:text-[44px]";
  if (words <= 6) return "text-[22px] sm:text-[34px]";
  if (words <= 9) return "text-[18px] sm:text-[28px]";
  return "text-[15px] sm:text-[22px]";
}

export default function LogMovieModal({
  isOpen,
  onClose,
  content,
  user,
  onLogCreated,
  mode = "create",
  existingLog = null,
  onLogUpdated,
  initialTvScope = null,
  initialTvEpisodeChoice = null,
}: LogMovieModalProps) {
  const router = useRouter();
  const ALL_EPISODES_VALUE = "__all__";
  const isEditMode = mode === "edit";
  const contentLabel = content.type === "tv" ? "TV show" : "Movie";
  const [watchedDate, setWatchedDate] = useState(new Date().toISOString().split("T")[0]);
  const [reaction, setReaction] = useState<null | 0 | 1 | 1.5 | 2>(null); // 0=Bad, 1=Good, 1.5=Average, 2=Masterpiece
  const [notes, setNotes] = useState("");
  const [reviewDraft, setReviewDraft] = useState("");
  const [showReviewEditor, setShowReviewEditor] = useState(false);
  const [containsSpoiler, setContainsSpoiler] = useState(false);
  const [shareToFriends, setShareToFriends] = useState(false);
  const [shareAsPost, setShareAsPost] = useState(false);
  const [ticketImageUrl, setTicketImageUrl] = useState<string | null>(null);
  const [tvSeasons, setTvSeasons] = useState<TVMazeSeason[]>([]);
  const [tvEpisodes, setTvEpisodes] = useState<TVMazeEpisode[]>([]);
  const [selectedSeasonScope, setSelectedSeasonScope] = useState<string>("all");
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string>("");
  const [loadingSeasons, setLoadingSeasons] = useState(false);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // Context Log
  const [showContextLog, setShowContextLog] = useState(false);
  const [location, setLocation] = useState("");
  const [watchedWith, setWatchedWith] = useState("");
  const [mood, setMood] = useState("");
  const [contextTags, setContextTags] = useState("");
  const [contextNotes, setContextNotes] = useState("");
  const [isRewatch, setIsRewatch] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const submitLockRef = useRef(false);
  const watchedDateInputRef = useRef<HTMLInputElement | null>(null);
  const initialTvScopeRef = useRef(initialTvScope);
  const initialTvEpisodeChoiceRef = useRef(initialTvEpisodeChoice);
  const selectedSeasonScopeRef = useRef(selectedSeasonScope);
  const tvSeasonsRef = useRef(tvSeasons);

  initialTvScopeRef.current = initialTvScope;
  initialTvEpisodeChoiceRef.current = initialTvEpisodeChoice;
  selectedSeasonScopeRef.current = selectedSeasonScope;
  tvSeasonsRef.current = tvSeasons;

  useEffect(() => {
    if (!isOpen || !user) return;

    let cancelled = false;

    const loadPreviousWatches = async () => {
      try {
        const logs = await getUserMovieLogs(user.id, 200);
        const priorLogs = logs
          .filter((log) => isSameContent(log, content))
          .sort((a, b) => new Date(b.watched_date).getTime() - new Date(a.watched_date).getTime())
          .map((log) => log.watched_date);

        if (!cancelled) {
          if (!isEditMode) {
            setIsRewatch(priorLogs.length > 0);
          }
        }
      } catch (err) {
        reportAppError({
          title: "Could not load watch history",
          message: "We could not check your previous watches for this title.",
          details: err instanceof Error ? err.stack || err.message : String(err),
        });
      }
    };

    loadPreviousWatches();

    return () => {
      cancelled = true;
    };
  }, [content, isEditMode, isOpen, user]);

  useEffect(() => {
    if (!isOpen || content.type !== "tv") {
      setTvSeasons([]);
      setTvEpisodes([]);
      setSelectedSeasonScope("all");
      setSelectedEpisodeId("");
      setLoadingSeasons(false);
      setLoadingEpisodes(false);
      return;
    }

    let cancelled = false;

    const loadSeasons = async () => {
      try {
        setLoadingSeasons(true);
        const seasons = await getShowSeasons(content.id);
        if (cancelled) return;
        setTvSeasons(seasons);
        setSelectedSeasonScope((current) => {
          if (initialTvScopeRef.current === "all") return "all";
          if (
            typeof initialTvScopeRef.current === "number" &&
            seasons.some((season) => season.number === initialTvScopeRef.current)
          ) {
            return String(initialTvScopeRef.current);
          }
          if (current === "all") return current;
          if (seasons.some((season) => String(season.number) === current)) {
            return current;
          }
          return seasons[0] ? String(seasons[0].number) : "all";
        });
      } catch (err) {
        reportAppError({
          title: "Could not load seasons",
          message: "We could not load the seasons for this TV show.",
          details: err instanceof Error ? err.stack || err.message : String(err),
        });
        if (!cancelled) {
          setTvSeasons([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingSeasons(false);
        }
      }
    };

    loadSeasons();

    return () => {
      cancelled = true;
    };
  }, [content.id, content.type, initialTvScope, isOpen]);

  useEffect(() => {
    if (!isOpen || content.type !== "tv") return;

    let cancelled = false;

    const loadEpisodes = async () => {
      if (selectedSeasonScope === "all") {
        if (!cancelled) {
          setTvEpisodes([]);
          setSelectedEpisodeId("");
          setLoadingEpisodes(false);
        }
        return;
      }

      try {
        setLoadingEpisodes(true);
        const currentSelectedSeason = selectedSeasonScopeRef.current;
        const numericSeason = currentSelectedSeason === "all" ? null : Number(currentSelectedSeason);
        const seasons = tvSeasonsRef.current;
        const episodes = numericSeason
          ? await getSeasonEpisodes(
              seasons.find((season) => season.number === numericSeason) || {
                id: content.id,
                number: numericSeason,
                name: `Season ${numericSeason}`,
                source: "tvmaze",
                showId: content.id,
              }
            )
          : await getShowEpisodes(content.id);

        if (cancelled) return;
        setTvEpisodes(episodes);
        setSelectedEpisodeId((current) => {
          const preserveSeasonLogSelection = isEditMode && existingLog && typeof existingLog.episode !== "number";
          if (preserveSeasonLogSelection && !current) {
            return ALL_EPISODES_VALUE;
          }
          if (
            isEditMode &&
            existingLog &&
            typeof existingLog.episode === "number" &&
            episodes.some((episode) => episode.number === existingLog.episode)
          ) {
            const matchingEpisode = episodes.find((episode) => episode.number === existingLog.episode);
            return matchingEpisode ? String(matchingEpisode.id) : current;
          }
          if (current === ALL_EPISODES_VALUE || episodes.some((episode) => String(episode.id) === current)) {
            return current;
          }
          if (initialTvEpisodeChoiceRef.current === "all" || currentSelectedSeason !== "all") {
            return ALL_EPISODES_VALUE;
          }
          return episodes[0] ? String(episodes[0].id) : "";
        });
      } catch (err) {
        reportAppError({
          title: "Could not load episodes",
          message: "We could not load the episodes for this TV show.",
          details: err instanceof Error ? err.stack || err.message : String(err),
        });
        if (!cancelled) {
          setTvEpisodes([]);
          setSelectedEpisodeId("");
        }
      } finally {
        if (!cancelled) {
          setLoadingEpisodes(false);
        }
      }
    };

    loadEpisodes();

    return () => {
      cancelled = true;
    };
  }, [content.id, content.type, existingLog, isEditMode, isOpen, selectedSeasonScope]);

  useEffect(() => {
    if (!isOpen) return;
    if (isEditMode && existingLog) {
      setWatchedDate(existingLog.watched_date || new Date().toISOString().split("T")[0]);
      setReaction(typeof existingLog.reaction === "number" ? existingLog.reaction : null);
      setNotes(existingLog.notes || "");
      setReviewDraft(existingLog.notes || "");
      setContainsSpoiler(Boolean(existingLog.contains_spoiler));
      setTicketImageUrl(existingLog.ticket_image_url || null);

      const existingContext = existingLog.context_log || {};
      setShowContextLog(false);
      setLocation(existingContext.location || "");
      setWatchedWith(existingContext.watched_with || "");
      setMood(existingLog.mood || existingContext.mood || "");
      setContextTags(existingContext.tags || "");
      setContextNotes(existingContext.notes || "");
      const rewatchValue = (existingContext as Record<string, unknown>).rewatch;
      setIsRewatch(rewatchValue === "true" || rewatchValue === true);
      setShareToFriends(false);
      setShareAsPost(false);
      setError("");
      setSelectedSeasonScope(typeof existingLog.season === "number" ? String(existingLog.season) : "all");
      setSelectedEpisodeId(typeof existingLog.episode === "number" ? String(existingLog.episode) : "");
    } else {
      setTicketImageUrl(null);
      setWatchedDate(new Date().toISOString().split("T")[0]);
      setReaction(null);
      setNotes("");
      setReviewDraft("");
      setContainsSpoiler(false);
      setShowReviewEditor(false);
      setShareToFriends(false);
      setShareAsPost(false);
      setShowContextLog(false);
      setLocation("");
      setWatchedWith("");
      setMood("");
      setContextTags("");
      setContextNotes("");
      setIsRewatch(false);
      setError("");
      setSelectedSeasonScope("all");
      setSelectedEpisodeId("");
    }
  }, [existingLog, isEditMode, isOpen, content.id]);

  if (!user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitLockRef.current || loading) {
      return;
    }

    if (!watchedDate) {
      setError("Please select a date");
      return;
    }

    const allowEmptyEpisodeSelection = isEditMode && existingLog && typeof existingLog.episode !== "number";
    const isAllEpisodesSelection = selectedEpisodeId === ALL_EPISODES_VALUE;
    if (
      content.type === "tv" &&
      selectedSeasonScope !== "all" &&
      tvSeasons.length > 0 &&
      !selectedEpisodeId &&
      !allowEmptyEpisodeSelection &&
      !isAllEpisodesSelection
    ) {
      setError("Please select an episode");
      return;
    }

    try {
      submitLockRef.current = true;
      setLoading(true);
      setError("");

      const contentType = content.type === "tv" ? "tv" : "movie";

      // Build context log object, only including fields with values
      const contextLog = showContextLog
        ? Object.fromEntries(
            Object.entries({
              location,
              watched_with: watchedWith,
              mood,
              tags: contextTags,
              notes: contextNotes,
              rewatch: isRewatch ? "true" : undefined,
            }).filter(([, value]) => value)
          )
        : undefined;
      const selectedEpisode =
        selectedEpisodeId === ALL_EPISODES_VALUE
          ? null
          : tvEpisodes.find((episode) => String(episode.id) === selectedEpisodeId) || null;
      const selectedSeasonNumber =
        selectedEpisode?.season ?? (selectedSeasonScope === "all" ? undefined : Number(selectedSeasonScope));

      if (isEditMode) {
        if (!existingLog) {
          throw new Error("Missing log to edit");
        }

        const updates: Partial<MovieLog> = {
          watched_date: watchedDate,
          reaction,
          notes,
          contains_spoiler: containsSpoiler,
          mood: mood || undefined,
          ticket_image_url: ticketImageUrl || null,
          context_log: Object.keys(contextLog || {}).length > 0 ? (contextLog as MovieLog["context_log"]) : {},
          season: contentType === "tv" ? selectedSeasonNumber : undefined,
          episode:
            contentType === "tv"
              ? selectedSeasonScope === "all" || selectedEpisodeId === ALL_EPISODES_VALUE
                ? undefined
                : selectedEpisode?.number ?? undefined
              : undefined,
          episode_title:
            contentType === "tv"
              ? selectedSeasonScope === "all" || selectedEpisodeId === ALL_EPISODES_VALUE
                ? undefined
                : selectedEpisode?.name ?? undefined
              : undefined,
        };

        await updateMovieLog(existingLog.id, updates);

        onLogUpdated?.({
          ...existingLog,
          ...updates,
          id: existingLog.id,
          watched_date: watchedDate,
          reaction,
          notes,
          contains_spoiler: containsSpoiler,
          mood: mood || undefined,
          ticket_image_url: ticketImageUrl || null,
          context_log: updates.context_log || {},
        } as MovieLogWithContent);
      } else {
        const newLog = await createMovieLog(
          user.id,
          content.id,
          contentType,
          watchedDate,
          reaction,
          notes,
          mood || undefined,
          contextLog,
          ticketImageUrl,
          undefined,
          contentType === "tv" ? selectedSeasonNumber : undefined,
          contentType === "tv"
            ? selectedSeasonScope === "all" || selectedEpisodeId === ALL_EPISODES_VALUE
              ? undefined
              : selectedEpisode?.number ?? undefined
            : undefined,
          contentType === "tv"
            ? selectedSeasonScope === "all" || selectedEpisodeId === ALL_EPISODES_VALUE
              ? undefined
              : selectedEpisode?.name ?? undefined
            : undefined,
          containsSpoiler
        );

        if (shareAsPost) {
          await createLogCinePost(user, newLog, content, notes);
        }
      }

      // Reset form
      setWatchedDate(new Date().toISOString().split("T")[0]);
      setReaction(null);
      setNotes("");
      setReviewDraft("");
      setContainsSpoiler(false);
      setShowReviewEditor(false);
      setShareToFriends(false);
      setShareAsPost(false);
      setShowContextLog(false);
      setLocation("");
      setWatchedWith("");
      setMood("");
      setContextTags("");
      setContextNotes("");
      setIsRewatch(false);

      const contentLabel = contentType === "tv" ? "TV show" : "Movie";
      const successMessage = isEditMode
        ? `${contentLabel} updated`
        : shareAsPost
          ? `${contentLabel} logged and posted`
          : `${contentLabel} logged`;

      if (!isEditMode) {
        onLogCreated?.(successMessage);
      }
      onClose();
      if (!isEditMode && shareToFriends) {
        const shareUrl =
          contentType === "tv"
            ? `/share?content_id=${content.id}&type=tv`
            : `/share?movie_id=${content.id}`;
        router.push(shareUrl);
      }
    } catch (err) {
      reportAppError({
        title: "Log failed",
        message: "We could not save this log.",
        details: err instanceof Error ? err.stack || err.message : String(err),
      });
      setError(`Failed to log ${contentLabel.toLowerCase()}. Please try again.`);
    } finally {
      submitLockRef.current = false;
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const metadataLine = getMetadataLine(content) || (content.type === "tv" ? "TV Show" : "Movie");
  const titleClass = getTitleClass(content.title);
  const logTypeLabel = content.type === "tv" ? "TV LOG" : "MOVIE LOG";
  const ctaLabel = loading ? (isEditMode ? "SAVING" : "LOGGING") : isEditMode ? "SAVE CHANGES" : "LOG MOVIE";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#050505] text-[#F5F2EA]">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 pb-5 pt-4 sm:px-7 sm:pb-7 sm:pt-5 lg:px-9"
      >
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            aria-label="Back"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 text-2xl leading-none text-[#F5F2EA] transition hover:border-white/35 sm:h-10 sm:w-10"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 text-2xl leading-none text-[#F5F2EA] transition hover:border-white/35 sm:h-10 sm:w-10"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        {showReviewEditor && (
          <div
            className="fixed inset-0 z-[60] flex items-end bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:justify-center"
            onClick={() => setShowReviewEditor(false)}
          >
            <div
              className="flex max-h-[86dvh] w-full max-w-2xl flex-col border border-white/12 bg-[#050505] text-[#F5F2EA] shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-white/12 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF6A00]">Review</p>
                <button
                  type="button"
                  onClick={() => setShowReviewEditor(false)}
                  className="text-xl leading-none text-white/70 transition hover:text-white"
                  aria-label="Close review editor"
                >
                  ×
                </button>
              </div>

              <textarea
                value={reviewDraft}
                onChange={(event) => setReviewDraft(event.target.value)}
                placeholder="What stayed with you?"
                autoFocus
                className="min-h-[42dvh] flex-1 resize-none bg-transparent px-4 py-4 text-base leading-7 text-[#F5F2EA] outline-none placeholder:text-white/35 sm:min-h-[50dvh]"
              />

              <div className="border-t border-white/12 p-3">
                <button
                  type="button"
                  onClick={() => setContainsSpoiler((value) => !value)}
                  className={`flex h-12 w-full items-center justify-between border px-4 text-left text-xs font-black uppercase tracking-[0.16em] transition ${
                    containsSpoiler
                      ? "border-[#FF6A00] bg-[#FF6A00]/10 text-[#FF6A00]"
                      : "border-white/12 text-[#F5F2EA]"
                  }`}
                >
                  <span>Contains spoiler</span>
                  <span>{containsSpoiler ? "On" : "Off"}</span>
                </button>

                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setShowReviewEditor(false)}
                    className="h-11 border border-white/12 text-xs font-black uppercase tracking-[0.16em] text-white/70"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setNotes(reviewDraft);
                      setShowReviewEditor(false);
                    }}
                    className="h-11 bg-[#FF6A00] text-xs font-black uppercase tracking-[0.16em] text-black"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 space-y-5 pt-5 sm:space-y-6 sm:pt-6">
          {error && (
            <div className="rounded-2xl border border-[#FF6A00]/35 bg-[#FF6A00]/10 px-4 py-3 text-sm text-[#F5F2EA]">
              {error}
            </div>
          )}

          <section className="grid grid-cols-[38%_minmax(0,1fr)] items-start gap-4 sm:grid-cols-[34%_minmax(0,1fr)] sm:gap-7">
            <div className="relative aspect-[2/3] w-full overflow-hidden border border-white/12 bg-black shadow-[0_20px_60px_rgba(0,0,0,0.38)]">
              {content.poster_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={content.poster_url} alt={content.title} className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full w-full items-center justify-center px-8 text-center text-sm uppercase tracking-[0.22em] text-white/38">
                  No poster
                </div>
              )}
            </div>

            <div className="flex min-h-full flex-col py-0">
              <div>
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.26em] text-[#FF6A00] sm:gap-3 sm:text-xs sm:tracking-[0.34em]">
                  <span className="h-2 w-2 rounded-full bg-[#FF6A00] sm:h-3 sm:w-3" />
                  {logTypeLabel}
                </div>

                <div className="mt-3 sm:mt-4">
                  <h1
                    className={`max-w-[620px] break-words font-black uppercase leading-[0.9] tracking-normal text-[#F5F2EA] ${titleClass}`}
                    style={{ fontFamily: "Impact, 'Arial Narrow', 'Helvetica Neue Condensed', sans-serif" }}
                    title={content.title}
                  >
                    {content.title}
                  </h1>
                </div>

                <p className="mt-3 text-[11px] leading-5 text-white/58 sm:mt-4 sm:text-sm sm:leading-6">{metadataLine}</p>
              </div>

              <div className="mt-4 border-t border-white/14 pt-4 sm:mt-5 sm:pt-5">
                <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-white/58 sm:text-xs sm:tracking-[0.28em]">Watched on</p>
                    <label
                      onClick={() => {
                        watchedDateInputRef.current?.showPicker?.();
                        watchedDateInputRef.current?.focus();
                      }}
                      className="relative mt-2 block w-fit cursor-pointer text-left sm:mt-3"
                    >
                      <span className="block text-base font-black uppercase leading-tight text-[#F5F2EA] sm:text-3xl sm:leading-none">
                        {formatWatchedDate(watchedDate)}
                      </span>
                      <input
                        ref={watchedDateInputRef}
                        type="date"
                        value={watchedDate}
                        onChange={(event) => setWatchedDate(event.target.value)}
                        required
                        aria-label="Watched date"
                        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                      />
                    </label>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsRewatch((value) => !value)}
                    className={`flex h-8 items-center gap-2 uppercase tracking-[0.16em] transition sm:h-10 sm:gap-3 sm:tracking-[0.22em] ${
                      isRewatch ? "text-[#F5F2EA]" : "text-white/48"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full border text-sm leading-none sm:h-8 sm:w-8 sm:text-base ${
                        isRewatch ? "border-[#FF6A00] text-[#FF6A00]" : "border-white/25 text-transparent"
                      }`}
                    >
                      ✓
                    </span>
                    <span className="text-[11px] font-bold sm:text-xs">Rewatch</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="border-t border-white/14 pt-4 sm:pt-5">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F5F2EA]">Your Verdict</h2>
            <div className="mt-4 grid grid-cols-4 gap-1.5">
              {[
                { label: "Bad", value: 0, selectedClass: "border-red-500 bg-red-500 text-black" },
                { label: "Average", value: 1.5, selectedClass: "border-yellow-400 bg-yellow-400 text-black" },
                { label: "Good", value: 1, selectedClass: "border-green-500 bg-green-500 text-black" },
                {
                  label: "Masterpiece",
                  value: 2,
                  selectedClass: "border-[#FF6A00] bg-[#FF6A00] text-black",
                },
              ].map(({ label, value, selectedClass }) => {
                const isSelected = reaction === value;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setReaction((current) => (current === value ? null : (value as 0 | 1 | 1.5 | 2)))}
                    className={`h-10 border px-1 text-center text-[9px] font-bold uppercase tracking-[0.08em] transition sm:h-11 sm:text-[11px] sm:tracking-[0.12em] ${
                      isSelected
                        ? selectedClass
                        : "border-white/16 bg-transparent text-[#F5F2EA] hover:border-white/35"
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="border-t border-white/14 pt-4 sm:pt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#F5F2EA]">
              Review
            </p>
            <div
              onClick={() => {
                setReviewDraft(notes);
                setShowReviewEditor(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setReviewDraft(notes);
                  setShowReviewEditor(true);
                }
              }}
              role="button"
              tabIndex={0}
              className="mt-3 min-h-20 w-full border border-[#9A3F00] px-3 py-3 text-left transition hover:border-[#C65300] sm:min-h-28 sm:px-4 sm:py-4"
            >
              <span className={`block whitespace-pre-wrap text-sm font-bold leading-snug sm:text-lg ${
                notes.trim() ? "text-[#F5F2EA]" : "text-white/42"
              }`}>
                {notes.trim() || "What stayed with you?"}
              </span>
              <span className="mt-2 block text-[11px] text-white/48 sm:text-xs">Tap to write your review...</span>
            </div>
          </section>

          <section className="border-t border-white/14">
            <button
              type="button"
              onClick={() => setShowContextLog((value) => !value)}
              className="flex w-full items-center justify-between gap-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.16em] text-[#F5F2EA] sm:py-4 sm:text-xs sm:tracking-[0.18em]"
            >
              <span className="min-w-0 leading-5">
                Show Context <span className="text-white/42">(Mood, People, Tags, Notes)</span>
              </span>
              <span className="shrink-0 text-base font-normal leading-none text-white/75">{showContextLog ? "⌃" : "⌄"}</span>
            </button>

            {showContextLog && (
              <div className="grid gap-3 pb-5 sm:grid-cols-2">
                {content.type === "tv" && (
                  <>
                    <div>
                      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                        Season
                      </label>
                      {loadingSeasons ? (
                        <div className="border border-white/12 px-3 py-2 text-xs text-white/48">Loading seasons...</div>
                      ) : (
                        <select
                          value={selectedSeasonScope}
                          onChange={(event) => setSelectedSeasonScope(event.target.value)}
                          className="w-full border border-white/12 bg-[#050505] px-3 py-2 text-xs text-[#F5F2EA] outline-none focus:border-[#FF6A00]"
                        >
                          <option value="all">Entire show</option>
                          {tvSeasons.map((season) => (
                            <option key={season.id} value={season.number}>
                              {getSeasonOptionLabel(season)}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    {selectedSeasonScope !== "all" && (
                      <div>
                        <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">
                          Episode
                        </label>
                        {loadingEpisodes ? (
                          <div className="border border-white/12 px-3 py-2 text-xs text-white/48">Loading episodes...</div>
                        ) : (
                          <select
                            value={selectedEpisodeId}
                            onChange={(event) => setSelectedEpisodeId(event.target.value)}
                            className="w-full border border-white/12 bg-[#050505] px-3 py-2 text-xs text-[#F5F2EA] outline-none focus:border-[#FF6A00]"
                          >
                            <option value={ALL_EPISODES_VALUE}>All episodes</option>
                            <option value="" disabled>
                              Select an episode
                            </option>
                            {tvEpisodes.map((episode) => (
                              <option key={episode.id} value={String(episode.id)}>
                                {getEpisodeOptionLabel(episode)}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </>
                )}

                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Mood</label>
                  <input
                    value={mood}
                    onChange={(event) => setMood(event.target.value)}
                    className="w-full border border-white/12 bg-transparent px-3 py-2 text-xs text-[#F5F2EA] outline-none placeholder:text-white/28 focus:border-[#FF6A00]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">People</label>
                  <input
                    value={watchedWith}
                    onChange={(event) => setWatchedWith(event.target.value)}
                    className="w-full border border-white/12 bg-transparent px-3 py-2 text-xs text-[#F5F2EA] outline-none placeholder:text-white/28 focus:border-[#FF6A00]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Tags</label>
                  <input
                    value={contextTags}
                    onChange={(event) => setContextTags(event.target.value)}
                    className="w-full border border-white/12 bg-transparent px-3 py-2 text-xs text-[#F5F2EA] outline-none placeholder:text-white/28 focus:border-[#FF6A00]"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.2em] text-white/50">Notes</label>
                  <input
                    value={contextNotes}
                    onChange={(event) => setContextNotes(event.target.value)}
                    className="w-full border border-white/12 bg-transparent px-3 py-2 text-xs text-[#F5F2EA] outline-none placeholder:text-white/28 focus:border-[#FF6A00]"
                  />
                </div>
              </div>
            )}
          </section>

          <section className="border-t border-white/14">
            <label className="flex items-center justify-between gap-3 border-b border-white/10 py-3 sm:py-4">
              <span>
                <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#F5F2EA] sm:text-xs sm:tracking-[0.18em]">Share to Friends</span>
                <span className="mt-1 block text-[11px] text-white/58 sm:text-xs">Selected friends can see this log.</span>
              </span>
              <input
                type="checkbox"
                checked={shareToFriends}
                onChange={(event) => setShareToFriends(event.target.checked)}
                className="sr-only"
              />
              <span
                className={`relative h-7 w-12 shrink-0 rounded-full border transition ${
                  shareToFriends ? "border-[#FF6A00] bg-[#FF6A00]" : "border-white/35"
                }`}
              >
                <span
                  className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-[#F5F2EA] transition ${
                    shareToFriends ? "translate-x-5" : ""
                  }`}
                />
              </span>
            </label>

            {!isEditMode && (
              <label className="flex items-center justify-between gap-3 py-3 sm:py-4">
                <span>
                  <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#F5F2EA] sm:text-xs sm:tracking-[0.18em]">Share as Post</span>
                  <span className="mt-1 block text-[11px] text-white/58 sm:text-xs">Publish this log to your profile feed.</span>
                </span>
                <input
                  type="checkbox"
                  checked={shareAsPost}
                  onChange={(event) => setShareAsPost(event.target.checked)}
                  className="sr-only"
                />
                <span
                  className={`relative h-7 w-12 shrink-0 rounded-full border transition ${
                    shareAsPost ? "border-[#FF6A00] bg-[#FF6A00]" : "border-white/35"
                  }`}
                >
                  <span
                    className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-[#F5F2EA] transition ${
                      shareAsPost ? "translate-x-5" : ""
                    }`}
                  />
                </span>
              </label>
            )}
          </section>
        </main>

        <div className="sticky bottom-0 -mx-4 mt-5 bg-[#050505]/95 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:-mx-7 sm:mt-6 sm:px-7 lg:-mx-9 lg:px-9">
          <button
            type="submit"
            disabled={loading || loadingSeasons || loadingEpisodes}
            className="h-12 w-full rounded-2xl bg-[#FF6A00] px-6 text-center text-xs font-black uppercase tracking-[0.24em] text-black transition hover:bg-[#ff7c24] disabled:opacity-60 sm:h-[56px] sm:text-sm"
          >
            {ctaLabel}
          </button>
        </div>
      </form>
    </div>
  );
}

}