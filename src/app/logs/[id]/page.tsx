"use client";

import { useState, useEffect, useMemo, useRef, type ChangeEvent } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import LogMovieModal from "@/components/LogMovieModal";
import { MovieLog, MovieLogWithContent, User, Content, LogCommentWithUser } from "@/types";
import { deleteMovieLog, updateMovieLog, getVisibleLogNotes } from "@/lib/logs";
import { getTvEpisodeBadgeLabel } from "@/lib/tv-log-label";
import { likeLogAndNotify, unlikeLog, getLogLikes } from "@/lib/log-likes";
import { getMovieDetails } from "@/lib/tmdb";
import { getShowDetails } from "@/lib/tvmaze";
import {
  MoreVertical,
  ArrowLeft,
  Edit2,
  Trash2,
  ThumbsDown,
  Heart,
  Sparkles,
  CalendarDays,
  X,
  Send,
  Upload,
  Share2,
} from "lucide-react";
import Link from "next/link";
import { auth, db } from "@/lib/firebase";
import { ref, get, query, orderByChild, equalTo } from "firebase/database";
import { onAuthStateChanged } from "firebase/auth";
import {
  createLogComment,
  getLogComments,
  getLogCommentLikers,
  likeLogComment,
  unlikeLogComment,
} from "@/lib/log-comments";
import { buildLogUrl } from "@/lib/log-url";
import { setPendingLoadingTitle } from "@/lib/loading-title";
import { getUsersByIds } from "@/lib/users";
import { formatRelativeTime as relativeTime } from "@/lib/format";
import { buildCrewPath } from "@/lib/crew";
import LikersModal from "@/components/LikersModal";

type CrewCredit = {
  id: number;
  name: string;
  job?: string | null;
};

function linkify(text: string) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((part, index) => {
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={`${part}-${index}`}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-[#f5f0de] underline-offset-2 hover:underline"
        >
          {part}
        </a>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Could not read file"));
    };
    reader.onerror = () => reject(reader.error || new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

function getSeasonLabel(log: MovieLogWithContent): string {
  return getTvEpisodeBadgeLabel(log);
}

function TicketActionsModal({
  imageUrl,
  title,
  uploading,
  onClose,
  onDelete,
  onReplace,
}: {
  imageUrl: string | null;
  title: string;
  uploading: boolean;
  onClose: () => void;
  onDelete: () => void;
  onReplace: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm border border-white/10 bg-[#101010] p-4 shadow-2xl sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ffb36b]/80">Ticket image</p>
            <h3 className="mt-1 text-base font-semibold text-[#f5f0de]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-white/55 hover:bg-white/5"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {imageUrl && (
          <div className="mb-4 overflow-hidden bg-black">
            <img src={imageUrl} alt={`${title} ticket preview`} className="h-56 w-full object-cover" />
          </div>
        )}

        <div className="space-y-2">
          <button
            type="button"
            onClick={onReplace}
            disabled={uploading}
            className="flex w-full items-center gap-3 border border-white/10 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-[#f5f0de] transition hover:bg-white/10 disabled:opacity-60"
          >
            <Upload className="h-4 w-4 text-[#ff7a1a]" />
            {uploading ? "Uploading..." : "Replace image"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={uploading}
            className="flex w-full items-center gap-3 border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-left text-sm font-semibold text-rose-200 transition hover:bg-rose-500/15 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            Delete image
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full px-4 py-3 text-sm font-semibold text-[#f5f0de]/70 transition hover:text-[#f5f0de]"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function sortLogCommentTree(
  comments: LogCommentWithUser[],
  mode: "top" | "newest",
  ownerId?: string
): LogCommentWithUser[] {
  return comments
    .map((comment) => ({
      ...comment,
      replies: sortLogCommentTree(comment.replies, mode, ownerId),
    }))
    .sort((a, b) => {
      if (mode === "newest") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }

      const aOwner = ownerId && a.user_id === ownerId ? 1 : 0;
      const bOwner = ownerId && b.user_id === ownerId ? 1 : 0;
      if (aOwner !== bOwner) return bOwner - aOwner;

      if (b.insightScore !== a.insightScore) return b.insightScore - a.insightScore;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
}

function countLogCommentTree(comments: LogCommentWithUser[]): number {
  return comments.reduce(
    (total, comment) => total + 1 + countLogCommentTree(comment.replies),
    0
  );
}

function CommentThread({
  comment,
  currentUser,
  logOwnerId,
  replyingTo,
  replyText,
  setReplyingTo,
  setReplyText,
  submitting,
  highlightedCommentId,
  onReply,
  onToggleLike,
  onOpenLikers,
  onJumpToProfile,
}: {
  comment: LogCommentWithUser;
  currentUser: User | null;
  logOwnerId: string;
  replyingTo: string | null;
  replyText: string;
  setReplyingTo: (commentId: string | null) => void;
  setReplyText: (value: string) => void;
  submitting: boolean;
  highlightedCommentId: string | null;
  onReply: (parentId: string, ownerId: string) => Promise<void>;
  onToggleLike: (comment: LogCommentWithUser) => Promise<void>;
  onOpenLikers: (commentId: string) => Promise<void>;
  onJumpToProfile: (user: User) => string;
}) {
  const highlighted = highlightedCommentId === comment.id;
  return (
    <div
      id={`log-comment-${comment.id}`}
      className={`py-4 transition ${
        highlighted ? "rounded-none bg-blue-50/50 ring-1 ring-blue-200" : ""
      }`}
    >
      <div className="flex gap-3">
        <Link
          href={onJumpToProfile(comment.user)}
          className="h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border border-white/15 bg-[#f5f0de]"
        >
          {comment.user.avatar_url ? (
            <img
              src={comment.user.avatar_url}
              alt={comment.user.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-black text-black">
              {comment.user.name?.charAt(0)?.toUpperCase() || "U"}
            </div>
          )}
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Link href={onJumpToProfile(comment.user)} className="text-sm font-black text-[#f5f0de] transition hover:text-[#ffb36b]">
              {comment.user.name}
            </Link>
            <span className="text-xs text-slate-400">{relativeTime(comment.created_at)}</span>
            {comment.user_id === logOwnerId && (
              <span className="rounded-none bg-[#ff7a1a]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#ffb36b]">
                owner
              </span>
            )}
          </div>

          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-[#f5f0de]/75">{linkify(comment.content)}</p>

          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-black">
            <button
              type="button"
              onClick={() => onToggleLike(comment)}
              disabled={submitting}
              className={`inline-flex items-center gap-1.5 transition ${
                comment.liked_by_current_user ? "text-rose-400" : "text-white/40 hover:text-[#f5f0de]"
              }`}
            >
              <Heart className={`h-3.5 w-3.5 ${comment.liked_by_current_user ? "fill-rose-500" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => onOpenLikers(comment.id)}
              disabled={comment.likes_count === 0}
              className="text-white/40 hover:text-[#f5f0de] disabled:cursor-default disabled:text-white/20"
            >
              {comment.likes_count}
            </button>
            {currentUser && (
              <button
                type="button"
                onClick={() => {
                  setReplyingTo(replyingTo === comment.id ? null : comment.id);
                  setReplyText("");
                }}
                className="text-[#f5f0de] hover:text-[#f5f0de]"
              >
                Reply{comment.replies.length > 0 ? ` (${comment.replies.length})` : ""}
              </button>
            )}
          </div>
        </div>
      </div>

      {replyingTo === comment.id && (
        <div className="mt-3 flex gap-2 pl-12">
          <input
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder={`Reply to ${comment.user.name}`}
            className="min-w-0 flex-1 rounded-none border border-white/10 bg-black px-3 py-2 text-sm text-[#f5f0de] outline-none placeholder:text-white/35 focus:border-[#ff7a1a]"
          />
          <button
            type="button"
            disabled={submitting || replyText.trim().length < 2}
            onClick={() => onReply(comment.id, comment.user_id)}
            className="inline-flex items-center gap-1 rounded-none bg-[#ff7a1a] px-3 py-2 text-xs font-black text-black disabled:opacity-50"
            aria-label="Send reply"
          >
            <Send className="h-4 w-4" />
            Reply
          </button>
        </div>
      )}

      {comment.replies.length > 0 && (
        <div className="ml-5 mt-3 space-y-1 border-l border-white/10 pl-4 sm:ml-6 sm:pl-6">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              currentUser={currentUser}
              logOwnerId={logOwnerId}
              replyingTo={replyingTo}
              replyText={replyText}
              setReplyingTo={setReplyingTo}
              setReplyText={setReplyText}
              submitting={submitting}
              highlightedCommentId={highlightedCommentId}
              onReply={onReply}
              onToggleLike={onToggleLike}
              onOpenLikers={onOpenLikers}
              onJumpToProfile={onJumpToProfile}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function LogDetailPage() {
    const [userLogs, setUserLogs] = useState<MovieLogWithContent[]>([]);
    const [showUserLogs, setShowUserLogs] = useState(false);
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const logId = params.id as string;
  const targetCommentId = searchParams.get("comment") || "";
  const scrollTargetRef = useRef<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [log, setLog] = useState<MovieLogWithContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [showEditLogModal, setShowEditLogModal] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [likers, setLikers] = useState<User[]>([]);
  const [likersLoading, setLikersLoading] = useState(false);
  const [comments, setComments] = useState<LogCommentWithUser[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(true);
  const [commentSort, setCommentSort] = useState<"newest" | "top">("newest");
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [showCommentLikesModal, setShowCommentLikesModal] = useState(false);
  const [commentLikers, setCommentLikers] = useState<User[]>([]);
  const [commentLikersLoading, setCommentLikersLoading] = useState(false);
  const [commentLikesTitle, setCommentLikesTitle] = useState("");
  const [highlightedCommentId, setHighlightedCommentId] = useState<string | null>(null);
  const [commentLikeLoadingId, setCommentLikeLoadingId] = useState<string | null>(null);
  const [ticketImageUrl, setTicketImageUrl] = useState<string | null>(null);
  const [ticketUploading, setTicketUploading] = useState(false);
  const [showTicketActions, setShowTicketActions] = useState(false);
  const ticketInputRef = useRef<HTMLInputElement | null>(null);

  const getFallbackContent = (contentType: "movie" | "tv", contentId: number): Content => {
    if (contentType === "tv") {
      return {
        id: contentId,
        type: "tv",
        title: "Unknown Show",
        name: "Unknown Show",
        poster_url: null,
        genres: [],
        actors: [],
        language: null,
        status: null,
        release_date: null,
        overview: "Show details are unavailable right now.",
        runtime: null,
        rating: null,
        created_at: new Date().toISOString(),
      };
    }

    return {
      id: contentId,
      type: "movie",
      title: "Unknown Movie",
      poster_url: null,
      backdrop_url: null,
      genres: [],
      platforms: [],
      director: null,
      actors: [],
      language: null,
      release_date: null,
      overview: "Movie details are unavailable right now.",
      runtime: null,
      rating: null,
      created_at: new Date().toISOString(),
    };
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
        // Fetch user
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const [userSnapshot, logSnapshot] = await Promise.all([
          get(userRef),
          get(ref(db, `movie_logs/${logId}`)),
        ]);
        const userData = userSnapshot.val();

        const currentUser: User = {
          id: firebaseUser.uid,
          username: userData?.username || "user",
          name: userData?.name || firebaseUser.displayName || "User",
          avatar_url: userData?.avatar_url || null,
          created_at: userData?.createdAt || new Date().toISOString(),
        };

        setUser(currentUser);

        // Fetch log by ID so friend logs are viewable too
        if (!logSnapshot.exists()) {
          router.push("/logs");
          return;
        }

        const logData = logSnapshot.val() || {};
        const contentType: "movie" | "tv" = logData.content_type === "tv" ? "tv" : "movie";
        const logContentId = Number(logData.content_id || 0);

        const [content, ownerSnapshot, likes, logComments, historySnapshot] = await Promise.all([
          contentType === "tv"
            ? getShowDetails(logContentId).then((details) => details || getFallbackContent("tv", logContentId)).catch(() => getFallbackContent("tv", logContentId))
            : getMovieDetails(logContentId).then((details) => details || getFallbackContent("movie", logContentId)).catch(() => getFallbackContent("movie", logContentId)),
          logData.user_id === currentUser.id ? Promise.resolve(null) : get(ref(db, `users/${logData.user_id}`)).catch(() => null),
          getLogLikes(logId, currentUser.id).catch(() => ({ count: 0, liked: false })),
          getLogComments(logId, currentUser.id).catch(() => []),
          get(query(ref(db, "movie_logs"), orderByChild("content_id"), equalTo(logContentId))).catch(() => null),
        ]);

        const ownerData = ownerSnapshot?.val() || (logData.user_id === currentUser.id ? userData : null);

        const logOwner: User = {
          id: ownerData?.id || logData.user_id,
          username: ownerData?.username || "user",
          name: ownerData?.name || "User",
          avatar_url: ownerData?.avatar_url || null,
          created_at: ownerData?.createdAt || ownerData?.created_at || new Date().toISOString(),
        };

        const foundLog: MovieLogWithContent = {
          id: logId,
          ...logData,
          content_id: logContentId,
          content_type: contentType,
          watched_date: logData.watched_date || new Date().toISOString().slice(0, 10),
          reaction: typeof logData.reaction === "number" ? logData.reaction : null,
          notes: getVisibleLogNotes(logData),
          created_at: logData.created_at || new Date().toISOString(),
          updated_at: logData.updated_at || new Date().toISOString(),
          content,
          user: logOwner,
        };

        setLog(foundLog);
        setTicketImageUrl((foundLog as MovieLog).ticket_image_url || null);
        setLikeCount(likes.count);
        setLiked(likes.liked);
        setComments(logComments);
        setCommentsLoading(false);

        // Reuse the film and owner already loaded above for this log's history.
        if (historySnapshot?.exists()) {
          const logs = (Object.entries(historySnapshot.val() || {}) as Array<[string, MovieLog]>)
            .filter(([, item]) => item.user_id === foundLog.user_id && item.content_type === contentType && !item.watch_later && Boolean(item.watched_date))
            .map(([id, item]) => ({ ...item, id, notes: getVisibleLogNotes(item), content, user: logOwner } as MovieLogWithContent));
          logs.sort((a, b) => {
            const dateA = new Date(a.watched_date || a.created_at).getTime();
            const dateB = new Date(b.watched_date || b.created_at).getTime();
            return dateB - dateA;
          });
          setUserLogs(logs.slice(0, 100));
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading log:", error);
        setCommentsLoading(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [logId, router]);
  // Like/unlike handler (must be outside useEffect and only defined once)
  const handleLike = async () => {
    if (!user || !log) return;
    setLikeLoading(true);
    try {
      if (liked) {
        await unlikeLog(log.id, user.id);
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      } else {
        await likeLogAndNotify(log.id, log.user_id, user);
        setLiked(true);
        setLikeCount((c) => c + 1);
      }
    } catch (e) {
      alert("Failed to update like");
    }
    setLikeLoading(false);
  };

  const handleOpenLikes = async () => {
    if (!log) return;
    setShowLikesModal(true);
    setLikersLoading(true);
    try {
      const likesRef = ref(db, `log_likes/${log.id}`);
      const likesSnapshot = await get(likesRef);
      const userIds = likesSnapshot.exists() ? Object.keys(likesSnapshot.val() || {}) : [];
      if (userIds.length === 0) {
        setLikers([]);
        return;
      }

      const usersData = await getUsersByIds(userIds);
      const nextLikers = userIds
        .map((id) => {
          const raw = usersData[id];
          if (!raw) return null;
          return {
            id: raw.id || id,
            username: raw.username || "user",
            name: raw.name || "User",
            avatar_url: raw.avatar_url || null,
            created_at: raw.created_at || new Date().toISOString(),
          } as User;
        })
        .filter(Boolean) as User[];
      setLikers(nextLikers);
    } catch (error) {
      console.error("Error loading log likes:", error);
      setLikers([]);
    } finally {
      setLikersLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!log || !user || log.user_id !== user.id) return;
    if (!confirm("Are you sure you want to delete this log?")) return;

    try {
      await deleteMovieLog(logId);
      router.push("/logs");
    } catch (error) {
      console.error("Error deleting log:", error);
      alert("Failed to delete log");
    }
  };

  const handleTicketUploadClick = () => {
    setShowTicketActions(false);
    ticketInputRef.current?.click();
  };

  const handleDeleteTicketImage = async () => {
    if (!log || !user || log.user_id !== user.id) return;

    try {
      setTicketUploading(true);
      await updateMovieLog(log.id, {
        ticket_image_url: null,
      } as Partial<MovieLog>);
      setTicketImageUrl(null);
      setLog((prev) => (prev ? { ...prev, ticket_image_url: null } : prev));
      setShowTicketActions(false);
    } catch (error) {
      console.error("Error deleting ticket image:", error);
      alert("Failed to delete the image. Please try again.");
    } finally {
      setTicketUploading(false);
    }
  };

  const handleLogUpdated = (updatedLog: MovieLogWithContent) => {
    setLog((prev) =>
      prev
        ? {
            ...prev,
            ...updatedLog,
            content: prev.content,
            user: prev.user,
          }
        : prev
    );
    setTicketImageUrl(updatedLog.ticket_image_url || null);
    setShowEditLogModal(false);
  };

  const handleTicketFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !log || !user || log.user_id !== user.id) return;

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      alert("Image size must be 8MB or smaller.");
      return;
    }

    try {
      setTicketUploading(true);
      const downloadUrl = await fileToDataUrl(file);
      await updateMovieLog(log.id, {
        ticket_image_url: downloadUrl,
      } as Partial<MovieLog>);

      setTicketImageUrl(downloadUrl);
      setLog((prev) => (prev ? { ...prev, ticket_image_url: downloadUrl } : prev));
      setShowTicketActions(false);
    } catch (error) {
      console.error("Error uploading ticket image:", error);
      alert("Failed to upload the image. Please try again.");
    } finally {
      setTicketUploading(false);
      event.target.value = "";
    }
  };

  // Format date as '4th May 2026'
  const formatDate = (dateString?: string) => {
    if (!dateString || !dateString.includes("-")) return "Unknown date";
    const [year, month, day] = dateString.split("-");
    if (!year || !month || !day) return "Unknown date";
    const d = new Date(Number(year), Number(month) - 1, Number(day));
    const dayNum = d.getDate();
    const daySuffix =
      dayNum % 10 === 1 && dayNum !== 11 ? "st" :
      dayNum % 10 === 2 && dayNum !== 12 ? "nd" :
      dayNum % 10 === 3 && dayNum !== 13 ? "rd" : "th";
    const monthName = d.toLocaleString("default", { month: "long" });
    return `${dayNum}${daySuffix} ${monthName} ${d.getFullYear()}`;
  };

  const getReactionDisplay = (reaction: 0 | 1 | 1.5 | 2 | null | undefined) => {
    if (reaction == null) {
      return {
        label: "Unrated",
        textClass: "text-[#f5f0de]",
        icon: CalendarDays,
      };
    }
    switch (reaction) {
      case 2:
        return {
          label: "Masterpiece",
          textClass: "text-[#ff7a1a]",
          icon: Sparkles,
        };
      case 1.5:
        return {
          label: "Average",
          textClass: "text-[#ffb36b]/90",
          icon: Sparkles,
        };
      case 1:
        return {
          label: "Good",
          textClass: "text-[#ffb36b]",
          icon: Heart,
        };
      case 0:
      default:
        return {
          label: "Bad",
          textClass: "text-[#ffb36b]/85",
          icon: ThumbsDown,
        };
    }
  };

  const profileHref = (person: User) => `/profile/${person.username || person.id}`;

  const refreshComments = async () => {
    if (!user) return;
    setCommentsLoading(true);
    try {
      const logComments = await getLogComments(logId, user.id);
      setComments(logComments);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleComment = async () => {
    if (!user || !log || commentText.trim().length < 2) return;
    try {
      setSubmittingComment(true);
      await createLogComment(log.id, log.user_id, user, commentText);
      setCommentText("");
      await refreshComments();
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReply = async (parentId: string, ownerId: string) => {
    if (!user || !log || replyText.trim().length < 2) return;
    try {
      setSubmittingComment(true);
      await createLogComment(log.id, log.user_id, user, replyText, parentId, ownerId);
      setReplyText("");
      setReplyingTo(null);
      await refreshComments();
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleToggleCommentLike = async (comment: LogCommentWithUser) => {
    if (!user || !log) return;
    try {
      setCommentLikeLoadingId(comment.id);
      if (comment.liked_by_current_user) {
        await unlikeLogComment(log.id, comment.id, user.id);
      } else {
        await likeLogComment(log.id, comment.id, user.id);
      }
      await refreshComments();
    } finally {
      setCommentLikeLoadingId(null);
    }
  };

  const handleOpenCommentLikes = async (commentId: string) => {
    if (!log) return;
    setCommentLikesTitle("Likes");
    setCommentLikers([]);
    setCommentLikersLoading(true);
    setShowCommentLikesModal(true);
    try {
      const users = await getLogCommentLikers(log.id, commentId);
      setCommentLikers(users);
      setCommentLikesTitle(users.length === 1 ? "1 like" : `${users.length} likes`);
    } finally {
      setCommentLikersLoading(false);
    }
  };

  const releaseYear = log?.content.release_date ? new Date(log.content.release_date).getFullYear() : null;
  const directorCredit = log?.content_type === "movie"
    ? ((log.content as Content & { crew_details?: CrewCredit[] }).crew_details || []).find(
        (credit) => credit.job === "Director"
      ) || null
    : null;
  const directorName = directorCredit?.name || log?.content.director || null;
  const hasTicketImage = Boolean(ticketImageUrl);
  const sortedComments = useMemo(
    () => sortLogCommentTree(comments, commentSort, log?.user_id),
    [commentSort, comments, log?.user_id]
  );
  const commentCount = useMemo(() => countLogCommentTree(comments), [comments]);
  const contentHref = log
    ? log.content_type === "tv"
      ? `/tv/${log.content.id}`
      : `/movie/${log.content.id}`
    : "#";

  const handleShareLog = async () => {
    if (!log || typeof window === "undefined") return;

    const shareUrl = buildLogUrl(log, targetCommentId ? { comment: targetCommentId } : undefined);
    const absoluteUrl = new URL(shareUrl, window.location.origin).toString();

    try {
      if (navigator.share) {
        await navigator.share({
          title: log.content.title,
          text: `Take a look at ${log.content.title} on Canisterr.`,
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

  useEffect(() => {
    if (!log) return;

    const canonicalUrl = buildLogUrl(log, targetCommentId ? { comment: targetCommentId } : undefined);
    const currentUrl = `${window.location.pathname}${window.location.search}`;

    if (currentUrl !== canonicalUrl) {
      router.replace(canonicalUrl);
    }
  }, [log, router, targetCommentId]);

  useEffect(() => {
    if (!targetCommentId || commentsLoading) return;

    const targetElement = document.getElementById(`log-comment-${targetCommentId}`);
    if (!targetElement) return;
    if (scrollTargetRef.current === targetCommentId) return;

    scrollTargetRef.current = targetCommentId;
    setHighlightedCommentId(targetCommentId);
    targetElement.scrollIntoView({ behavior: "smooth", block: "center" });

    const timer = window.setTimeout(() => {
      setHighlightedCommentId((current) => (current === targetCommentId ? null : current));
    }, 3500);

    return () => window.clearTimeout(timer);
  }, [targetCommentId, commentsLoading, sortedComments.length]);

  if (loading || !user) {
    return null;
  }

  if (!log) {
    return (
      <PageLayout user={user} onSignOut={() => router.push("/auth/login")}>
        <div className="p-8 text-center">
          <p className="text-gray-600">Log not found</p>
          <Link href="/logs" className="text-[#f5f0de] hover:underline mt-4 inline-block">
            Back to logs
          </Link>
        </div>
      </PageLayout>
    );
  }

  const isOwnLog = log.user_id === user.id;

  return (
    <PageLayout user={user} onSignOut={() => router.push("/auth/login")} theme="brutalist">
      <div className="min-h-screen bg-[#0b0b0b] text-[#f5f0de]">
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
          <div className="flex items-center justify-between">
            <button
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#f5f0de]/60 transition hover:text-[#f5f0de]"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowMenu((prev) => !prev)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-[#f5f0de]/65 transition hover:bg-white/5 hover:text-[#f5f0de]"
                aria-label="Open log actions"
              >
                <MoreVertical className="h-5 w-5" />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-[calc(100%+0.75rem)] z-20 min-w-40 border border-white/10 bg-[#101010]">
                  <button
                    onClick={() => {
                      handleShareLog();
                      setShowMenu(false);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-[#f5f0de] transition-colors hover:bg-white/5"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                  {isOwnLog && (
                    <>
                      <button
                        onClick={() => {
                          setShowEditLogModal(true);
                          setShowMenu(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-[#f5f0de] transition-colors hover:bg-white/5"
                      >
                        <Edit2 className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          handleDelete();
                          setShowMenu(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-rose-300 transition-colors hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <section className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-4 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-7">
            <div className="min-w-0">
              <div className="relative aspect-[2/3] w-full overflow-hidden rounded-lg bg-black shadow-xl">
                {hasTicketImage ? (
                  <img src={ticketImageUrl || ""} alt={`${log.content.title} ticket`} className="h-full w-full object-cover" />
                ) : (
                  <Link href={contentHref} className="absolute inset-0 block" aria-label={`Open ${log.content.title}`}>
                    {log.content.poster_url ? (
                      <img src={log.content.poster_url} alt={log.content.title} className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-white/3 text-xs text-white/35">No poster</span>
                    )}
                  </Link>
                )}
                {isOwnLog && hasTicketImage && (
                  <button type="button" onClick={() => setShowTicketActions(true)} className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-[#f5f0de] hover:bg-black" aria-label="Open ticket actions">
                    <MoreVertical className="h-4 w-4" />
                  </button>
                )}
              </div>
              {isOwnLog && (
                <input
                  ref={ticketInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleTicketFileChange}
                />
              )}
            </div>

            <div className="flex min-w-0 flex-col justify-center py-1">
              <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff9b52]">{log.content_type === "tv" ? "TV show" : "Film"} diary</p>
              <Link
                href={contentHref}
                className="group inline-block max-w-full"
                aria-label={`Open ${log.content.title}`}
              >
                <h1 className="line-clamp-3 text-[clamp(1.65rem,5vw,3.25rem)] font-black leading-[1.05] tracking-tight text-[#f5f0de] transition group-hover:text-[#ffb36b]">
                  {log.content.title}
                </h1>
              </Link>

              <div className="mt-4 space-y-2 text-xs text-white/60 sm:text-sm">
                {releaseYear && (
                  <p>{releaseYear}</p>
                )}
                {getSeasonLabel(log) && (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#ffb36b]/80">
                    {getSeasonLabel(log)}
                  </p>
                )}
                {directorName && (
                  directorCredit ? (
                    <Link
                      href={buildCrewPath(directorCredit)}
                      className="block w-fit text-[#ff7a1a] transition hover:text-[#ffb36b]"
                    >
                      {directorName}
                    </Link>
                  ) : (
                    <p>{directorName}</p>
                  )
                )}
                {log.content.genres?.length ? (
                  <p className="leading-6 text-[#f5f0de]/76">
                    {log.content.genres.slice(0, 4).join(", ")}
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          {/* Review */}
          <section className="rounded-2xl border border-white/10 bg-[#151515] p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3 sm:gap-5">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <Link
                  href={profileHref(log.user)}
                  className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full border border-white/10 bg-[#f5f0de] sm:h-14 sm:w-14"
                  aria-label={`Open ${log.user.name}'s profile`}
                >
                  {log.user.avatar_url ? (
                    <img
                      src={log.user.avatar_url}
                      alt={log.user.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-base font-black text-black sm:text-lg">
                      {log.user.name?.charAt(0)?.toUpperCase() || "U"}
                    </span>
                  )}
                </Link>

                <div className="min-w-0">
                  <Link
                    href={profileHref(log.user)}
                    className="block truncate text-base font-black text-[#f5f0de] transition hover:text-[#ffb36b] sm:text-lg"
                  >
                    {log.user.name}
                  </Link>
                  <p className="mt-0.5 text-xs text-white/45 sm:text-sm">
                    {formatDate(log.watched_date)}
                  </p>
                </div>
              </div>

              {(() => {
                const reaction = getReactionDisplay(log.reaction);
                return (
                  <span className={`flex-shrink-0 rounded-full border border-[#ff7a1a]/20 bg-[#ff7a1a]/10 px-3 py-1.5 text-xs font-bold sm:text-sm ${reaction.textClass}`}>
                    {reaction.label}
                  </span>
                );
              })()}
            </div>

            {log.notes?.trim() ? (
              <div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-[#f5f0de]/85 sm:text-base">
                {log.notes}
              </div>
            ) : null}

            <div className="mt-5 flex items-center border-t border-white/10 pt-4">
              <button
                onClick={handleLike}
                disabled={likeLoading}
                className={`inline-flex items-center gap-2 text-sm font-semibold transition-colors disabled:opacity-50 ${
                  liked
                    ? "text-rose-300"
                    : "text-[#f5f0de]/75 hover:text-[#f5f0de]"
                }`}
                aria-label={liked ? "Unlike" : "Like"}
                title={liked ? "Unlike" : "Like"}
              >
                <Heart className={`h-5 w-5 ${liked ? "fill-rose-500" : ""}`} />
              </button>
              <button
                type="button"
                onClick={handleOpenLikes}
                className="ml-2 text-sm font-semibold text-[#f5f0de]/65 transition hover:text-[#f5f0de]"
              >
                {likeCount}
              </button>
            </div>
          </section>

        {/* Context Log */}
        {log.context_log && (
          <div className="mb-8 border-t border-white/10 pt-6">
            <h3 className="mb-4 text-lg font-semibold text-[#f5f0de]">Context log</h3>
            <div className="space-y-3 text-white/75">
              {log.context_log.location && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ffb36b]/80">Where</p>
                  <p>{log.context_log.location}</p>
                </div>
              )}

              {log.context_log.watched_with && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ffb36b]/80">With whom</p>
                  <p>{log.context_log.watched_with}</p>
                </div>
              )}

              {log.context_log.mood && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#ffb36b]/80">Mood</p>
                  <p>{log.context_log.mood}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Log History for this user and movie/show */}
        {userLogs.length > 1 && (
          <section className="mt-8 overflow-hidden rounded-2xl border border-white/10 bg-[#111]">
            <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ff9b52]">Watch history</p>
                <h3 className="mt-1 text-base font-bold text-[#f5f0de] sm:text-lg">Your logs <span className="ml-1 text-sm font-medium text-white/40">{userLogs.length}</span></h3>
              </div>
              <button
                className="shrink-0 rounded-full border border-white/15 px-3 py-2 text-xs font-semibold text-[#f5f0de]/75 transition hover:border-[#ff7a1a]/50 hover:text-[#ffb36b] sm:px-4 sm:text-sm"
                onClick={() => setShowUserLogs((v) => !v)}
                aria-expanded={showUserLogs}
              >
                {showUserLogs ? "Hide history" : `See all ${userLogs.length}`}
              </button>
            </div>
            {showUserLogs && (
              <div className="border-t border-white/10 p-3 sm:p-4">
                <div className="space-y-2">
                {userLogs.map((l, index) => {
                  const reaction = getReactionDisplay(l.reaction);
                  const isCurrentLog = l.id === log.id;
                  return (
                    <div key={l.id} className={`flex items-center gap-3 rounded-xl border px-3 py-3 sm:gap-4 sm:px-4 ${isCurrentLog ? "border-[#ff7a1a]/55 bg-[#ff7a1a]/[0.09] shadow-[inset_3px_0_0_#ff7a1a]" : "border-white/[0.08] bg-white/[0.02]"}`}>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="text-sm font-bold text-[#f5f0de] sm:text-base">{formatDate(l.watched_date)}</span>
                          {isCurrentLog ? <span className="rounded-full bg-[#ff7a1a] px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.12em] text-black">Current log</span> : <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">Log {userLogs.length - index}</span>}
                        </div>
                        {l.notes?.trim() && (
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/60 sm:text-sm">{l.notes}</p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[10px] font-bold sm:text-xs ${reaction.textClass}`}>
                        {reaction.label}
                      </span>
                      <button
                        type="button"
                        disabled={isCurrentLog}
                        className="shrink-0 text-xs font-semibold text-[#ff9b52] transition hover:text-[#ffb36b] disabled:cursor-default disabled:text-white/35 sm:text-sm"
                        onClick={() => {
                          setPendingLoadingTitle(l.content?.title || log?.content?.title);
                          router.push(buildLogUrl(l));
                        }}
                      >
                        {isCurrentLog ? "Viewing" : <>Open <span aria-hidden="true">→</span></>}
                      </button>
                    </div>
                  );
                })}
                </div>
              </div>
            )}
          </section>
        )}
        {/* Comments */}
        <div className="pt-10 sm:pt-14">
        <section className="border-t border-white/[0.08] pt-5 sm:pt-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h3 className="text-base font-bold tracking-tight text-[#f5f0de]/85 sm:text-lg">Comments</h3>
              <span className="text-xs tabular-nums text-white/40">
                {commentCount}
              </span>
            </div>

            <label className="sr-only" htmlFor="comment-sort">Sort comments</label>
            <select
              id="comment-sort"
              value={commentSort}
              onChange={(event) => setCommentSort(event.target.value as "newest" | "top")}
              className="bg-transparent px-1 py-1 text-xs text-white/45 outline-none hover:text-white/70 focus:text-[#f5f0de] sm:text-sm"
            >
              <option value="newest">Newest</option>
              <option value="top">Top</option>
            </select>
          </div>

          <div className="mt-3 divide-y divide-white/[0.06]">
            {commentsLoading ? (
              <p className="py-3 text-xs text-white/35">Loading comments…</p>
            ) : sortedComments.length === 0 ? (
              <div className="py-3">
                <p className="text-xs text-white/40">No comments yet.</p>
              </div>
            ) : (
              sortedComments.map((comment) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  currentUser={user}
                  logOwnerId={log.user_id}
                  replyingTo={replyingTo}
                  replyText={replyText}
                  setReplyingTo={setReplyingTo}
                  setReplyText={setReplyText}
                  submitting={submittingComment || commentLikeLoadingId === comment.id}
                  highlightedCommentId={highlightedCommentId}
                  onReply={handleReply}
                  onToggleLike={handleToggleCommentLike}
                  onOpenLikers={handleOpenCommentLikes}
                  onJumpToProfile={profileHref}
                />
              ))
            )}
          </div>

          <div className="mt-3 flex items-center gap-2.5">
            <Link
              href={profileHref(user)}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f5f0de] text-xs font-black text-black"
              aria-label="Open your profile"
            >
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
              ) : (
                user.name?.charAt(0)?.toUpperCase() || "U"
              )}
            </Link>
            <input
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !submittingComment && commentText.trim().length >= 2) {
                  void handleComment();
                }
              }}
              placeholder="Add a comment..."
              className="min-w-0 flex-1 border-b border-white/10 bg-transparent px-1 py-2 text-sm text-[#f5f0de] outline-none placeholder:text-white/35 focus:border-[#ff7a1a]/70"
            />
            <button
              type="button"
              disabled={submittingComment || commentText.trim().length < 2}
              onClick={handleComment}
              className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[#ff9b52] transition hover:bg-[#ff7a1a]/10 hover:text-[#ffb36b] disabled:opacity-35"
              aria-label="Send comment"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </section>
        </div>

        </div>
      </div>
      {showLikesModal && (
        <LikersModal
          title={likeCount === 1 ? "1 like" : `${likeCount} likes`}
          users={likers}
          loading={likersLoading}
          onClose={() => {
            setShowLikesModal(false);
            setLikers([]);
          }}
        />
      )}
      {showCommentLikesModal && (
        <LikersModal
          title={commentLikesTitle}
          users={commentLikers}
          loading={commentLikersLoading}
          onClose={() => {
            setShowCommentLikesModal(false);
            setCommentLikers([]);
          }}
        />
      )}
      {showEditLogModal && log && (
        <LogMovieModal
          isOpen={showEditLogModal}
          onClose={() => setShowEditLogModal(false)}
          content={log.content}
          user={user}
          mode="edit"
          existingLog={log}
          onLogUpdated={handleLogUpdated}
          theme="brutalist"
        />
      )}
      {showTicketActions && (
        <TicketActionsModal
          imageUrl={ticketImageUrl}
          title={log.content.title}
          uploading={ticketUploading}
          onClose={() => setShowTicketActions(false)}
          onDelete={handleDeleteTicketImage}
          onReplace={handleTicketUploadClick}
        />
      )}
    </PageLayout>
  );
}
