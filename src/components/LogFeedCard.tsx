"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  MoreVertical,
  Share2,
  Edit2,
  Trash2,
  Heart,
  MessageCircle,
  Bookmark,
  ChevronRight,
  Star,
  EyeOff,
} from "lucide-react";
import type { Movie, MovieLogWithContent, TVShow, User } from "@/types";
import { deleteMovieLog, getReactionStars, getTvEpisodeLabel, getVisibleLogNotes } from "@/lib/logs";
import { getTvEpisodeBadgeLabel } from "@/lib/tv-log-label";
import { likeLogAndNotify, unlikeLog, getLogLikes, getLogLikers } from "@/lib/log-likes";
import { saveLog, unsaveLog, getLogSaves } from "@/lib/log-saves";
import { getLogCommentCount } from "@/lib/log-comments";
import { buildLogUrl } from "@/lib/log-url";
import { formatRelativeTime, getLogHashtag } from "@/lib/format";
import { getEmptyLogEngagement, type LogEngagementSnapshot } from "@/lib/log-engagement";
import LikersModal, { Avatar } from "@/components/LikersModal";
import ContentImageRow from "@/components/ContentImageRow";

const LogMovieModal = dynamic(() => import("@/components/LogMovieModal"), { ssr: false });

interface LogFeedCardProps {
  log: MovieLogWithContent;
  currentUser: User | null;
  engagement?: LogEngagementSnapshot;
  onEngagementChange?: (logId: string, next: Partial<LogEngagementSnapshot>) => void;
  onDeleted?: (logId: string) => void;
  onUpdated?: (log: MovieLogWithContent) => void;
}

export default function LogFeedCard({
  log,
  currentUser,
  engagement: engagementProp,
  onEngagementChange,
  onDeleted,
  onUpdated,
}: LogFeedCardProps) {
  const [localLog, setLocalLog] = useState(log);
  const [syncedLog, setSyncedLog] = useState(log);
  if (log !== syncedLog) {
    setSyncedLog(log);
    setLocalLog(log);
  }

  const [engagement, setEngagement] = useState<LogEngagementSnapshot>(engagementProp ?? getEmptyLogEngagement());
  const [showMenu, setShowMenu] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [showLikers, setShowLikers] = useState(false);
  const [likers, setLikers] = useState<User[]>([]);
  const [likersLoading, setLikersLoading] = useState(false);
  const engagementUserId = currentUser?.id;

  useEffect(() => {
    if (engagementProp) {
      setEngagement(engagementProp);
      return;
    }
    if (!engagementUserId) {
      setEngagement(getEmptyLogEngagement());
      return;
    }

    let cancelled = false;
    (async () => {
      const [likesResult, commentsResult, savesResult] = await Promise.allSettled([
        getLogLikes(localLog.id, engagementUserId),
        getLogCommentCount(localLog.id),
        getLogSaves(localLog.id, engagementUserId),
      ]);
      if (cancelled) return;
      setEngagement({
        likesCount: likesResult.status === "fulfilled" ? likesResult.value.count : 0,
        liked: likesResult.status === "fulfilled" ? likesResult.value.liked : false,
        likerPreview: [],
        commentsCount: commentsResult.status === "fulfilled" ? commentsResult.value : 0,
        savesCount: savesResult.status === "fulfilled" ? savesResult.value.count : 0,
        saved: savesResult.status === "fulfilled" ? savesResult.value.saved : false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [engagementProp, localLog.id, engagementUserId]);

  const notes = getVisibleLogNotes(localLog);
  if (!notes.trim()) return null;

  const isOwnLog = currentUser?.id === localLog.user_id;
  const isTv = localLog.content_type === "tv";
  const movieContent = !isTv ? (localLog.content as Movie) : null;
  const tvContent = isTv ? (localLog.content as TVShow) : null;
  const year = localLog.content?.release_date ? new Date(localLog.content.release_date).getFullYear() : null;
  const contentHref = isTv ? `/tv/${localLog.content.id}` : `/movie/${localLog.content.id}`;
  const episodeLabel = getTvEpisodeLabel(localLog);
  const episodeBadge = getTvEpisodeBadgeLabel(localLog);
  const stars = getReactionStars(localLog.reaction);
  const hashtag = getLogHashtag(localLog.content?.title || "");
  const logUrl = buildLogUrl(localLog);

  const patchEngagement = (patch: Partial<LogEngagementSnapshot>) => {
    setEngagement((current) => ({ ...current, ...patch }));
    onEngagementChange?.(localLog.id, patch);
  };

  const handleToggleLike = async () => {
    if (!currentUser) return;
    const wasLiked = engagement.liked;
    const prevCount = engagement.likesCount;
    patchEngagement({ liked: !wasLiked, likesCount: Math.max(0, prevCount + (wasLiked ? -1 : 1)) });
    try {
      if (wasLiked) {
        await unlikeLog(localLog.id, currentUser.id);
      } else {
        await likeLogAndNotify(localLog.id, localLog.user_id, currentUser);
      }
    } catch (error) {
      console.error("Failed to toggle log like:", error);
      patchEngagement({ liked: wasLiked, likesCount: prevCount });
    }
  };

  const handleToggleSave = async () => {
    if (!currentUser) return;
    const wasSaved = engagement.saved;
    const prevCount = engagement.savesCount;
    patchEngagement({ saved: !wasSaved, savesCount: Math.max(0, prevCount + (wasSaved ? -1 : 1)) });
    try {
      if (wasSaved) {
        await unsaveLog(localLog.id, currentUser.id);
      } else {
        await saveLog(localLog.id, currentUser.id);
      }
    } catch (error) {
      console.error("Failed to toggle log save:", error);
      patchEngagement({ saved: wasSaved, savesCount: prevCount });
    }
  };

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const absoluteUrl = new URL(logUrl, window.location.origin).toString();

    try {
      if (navigator.share) {
        await navigator.share({
          title: localLog.content.title,
          text: `Take a look at ${localLog.content.title} on Canisterr.`,
          url: absoluteUrl,
        });
        return;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(absoluteUrl);
        return;
      }
    } catch (error) {
      console.error("Share log failed:", error);
    }
    window.prompt("Copy this link", absoluteUrl);
  };

  const handleDelete = async () => {
    if (!isOwnLog) return;
    if (!confirm("Are you sure you want to delete this log?")) return;
    try {
      await deleteMovieLog(localLog.id);
      onDeleted?.(localLog.id);
    } catch (error) {
      console.error("Error deleting log:", error);
      alert("Failed to delete log");
    }
  };

  const handleOpenLikers = async () => {
    setShowLikers(true);
    setLikersLoading(true);
    try {
      const users = await getLogLikers(localLog.id);
      setLikers(users);
    } catch (error) {
      console.error("Failed to load likers:", error);
      setLikers([]);
    } finally {
      setLikersLoading(false);
    }
  };

  const subtitle = movieContent?.director
    ? `dir. ${movieContent.director}`
    : tvContent?.network?.name
      ? tvContent.network.name
      : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
      <div className="flex items-center justify-between p-4 pb-3">
        <Link href={`/profile/${localLog.user.username || localLog.user_id}`} className="flex min-w-0 items-center gap-3">
          <Avatar user={localLog.user} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#f5f0de]">{localLog.user.username || localLog.user.name}</p>
            <p className="text-xs">
              <span className="font-bold uppercase tracking-wide text-emerald-400">Watched</span>
              <span className="text-white/40"> · {formatRelativeTime(localLog.created_at)}</span>
            </p>
          </div>
        </Link>

        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={() => setShowMenu((prev) => !prev)}
            className="rounded-full p-1.5 text-white/50 transition hover:bg-white/5 hover:text-white/80"
            aria-label="Log actions"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {showMenu && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setShowMenu(false)}
                aria-label="Close menu"
              />
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 min-w-36 rounded-xl border border-white/10 bg-[#101010] py-1 shadow-2xl">
                <button
                  type="button"
                  onClick={() => {
                    handleShare();
                    setShowMenu(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#f5f0de] transition hover:bg-white/5"
                >
                  <Share2 className="h-3.5 w-3.5" />
                  Share
                </button>
                {isOwnLog && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditModal(true);
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[#f5f0de] transition hover:bg-white/5"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        handleDelete();
                        setShowMenu(false);
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-rose-300 transition hover:bg-rose-500/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="px-4 pb-3">
        <Link
          href={contentHref}
          className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#f5f0de] transition hover:border-[#ff7a1a]/40 hover:bg-white/10"
        >
          Open {isTv ? "Show" : "Movie"}
          <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="relative">
        <ContentImageRow
          primaryUrl={localLog.content?.poster_url || null}
          primaryAlt={localLog.content?.title || ""}
          secondaryUrls={localLog.content?.backdrop_gallery_urls || []}
        />
        {episodeBadge && (
          <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-[#ffb36b]/40 bg-[#140c04]/90 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-[#ffd6a3] shadow-[0_10px_25px_rgba(0,0,0,0.35)]">
            {episodeBadge}
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-black uppercase tracking-tight text-[#f5f0de]">{localLog.content?.title}</h3>
          {year && (
            <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-semibold text-white/60">
              {year}
            </span>
          )}
        </div>

        {(subtitle || episodeLabel) && (
          <p className="mt-1 text-sm text-white/55">
            {subtitle}
            {subtitle && episodeLabel ? " · " : ""}
            {episodeLabel}
          </p>
        )}

        <div className="mt-2 flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((position) => (
            <Star
              key={position}
              className={`h-4 w-4 ${position <= stars ? "fill-[#ff8a1e] text-[#ff8a1e]" : "text-white/15"}`}
            />
          ))}
          <span className="ml-1 text-sm font-semibold text-white/60">{stars}</span>
        </div>

        <div className="relative mt-3 border-l-2 border-[#ff7a1a]/50 pl-3">
          {localLog.contains_spoiler && !spoilerRevealed ? (
            <button
              type="button"
              onClick={() => setSpoilerRevealed(true)}
              className="flex items-center gap-2 text-sm italic text-white/40 blur-[6px] transition hover:blur-none"
            >
              <EyeOff className="h-3.5 w-3.5 shrink-0" />
              {notes}
            </button>
          ) : (
            <p className="text-sm italic leading-relaxed text-white/80">&ldquo;{notes}&rdquo;</p>
          )}
          {localLog.contains_spoiler && !spoilerRevealed && (
            <button
              type="button"
              onClick={() => setSpoilerRevealed(true)}
              className="mt-1 text-xs font-semibold text-[#ffb36b] hover:text-[#ff7a1a]"
            >
              Show spoiler
            </button>
          )}
        </div>

        {hashtag && <p className="mt-3 text-sm font-semibold text-[#ff8d3b]">{hashtag}</p>}

        <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={handleToggleLike}
              disabled={!currentUser}
              className="flex items-center gap-1.5 text-white/70 transition hover:text-[#f5f0de] disabled:opacity-50"
            >
              <Heart className={`h-5 w-5 ${engagement.liked ? "fill-rose-500 text-rose-500" : ""}`} />
              <span className="text-sm font-semibold">{engagement.likesCount}</span>
            </button>
            <Link href={logUrl} className="flex items-center gap-1.5 text-white/70 transition hover:text-[#f5f0de]">
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm font-semibold">{engagement.commentsCount}</span>
            </Link>
            <button
              type="button"
              onClick={handleToggleSave}
              disabled={!currentUser}
              className="text-white/70 transition hover:text-[#f5f0de] disabled:opacity-50"
              aria-label={engagement.saved ? "Unsave" : "Save"}
            >
              <Bookmark className={`h-5 w-5 ${engagement.saved ? "fill-[#f5f0de] text-[#f5f0de]" : ""}`} />
            </button>
          </div>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 text-sm font-semibold text-white/70 transition hover:text-[#f5f0de]"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>

        {engagement.likesCount > 0 && (
          <button
            type="button"
            onClick={handleOpenLikers}
            className="mt-3 flex items-center gap-2 text-left"
          >
            <div className="flex -space-x-2">
              {engagement.likerPreview.slice(0, 3).map((user) => (
                <div key={user.id} className="rounded-full ring-2 ring-black">
                  <Avatar user={user} size={6} />
                </div>
              ))}
            </div>
            <p className="text-xs text-white/55">
              Liked by{" "}
              {engagement.likerPreview[0] && (
                <span className="font-semibold text-[#f5f0de]">{engagement.likerPreview[0].username || engagement.likerPreview[0].name}</span>
              )}
              {engagement.likesCount > 1 && (
                <> and <span className="font-semibold text-[#f5f0de]">{engagement.likesCount - 1} other{engagement.likesCount - 1 === 1 ? "" : "s"}</span></>
              )}
            </p>
          </button>
        )}
      </div>

      {showLikers && (
        <LikersModal
          title={engagement.likesCount === 1 ? "1 like" : `${engagement.likesCount} likes`}
          users={likers}
          loading={likersLoading}
          onClose={() => {
            setShowLikers(false);
            setLikers([]);
          }}
        />
      )}

      {showEditModal && currentUser && (
        <LogMovieModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          content={localLog.content}
          user={currentUser}
          mode="edit"
          existingLog={localLog}
          onLogUpdated={(updated) => {
            setLocalLog(updated);
            onUpdated?.(updated);
          }}
          theme="brutalist"
        />
      )}
    </div>
  );
}
