"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { ArrowLeft, Bookmark, Heart, MessageCircle, MoreVertical, Pencil, Send, Share2, Trash2, X } from "lucide-react";
import ContentImageRow from "@/components/ContentImageRow";
import CinePostOwnerMenu from "@/components/CinePostOwnerMenu";
import PageLayout from "@/components/PageLayout";
import { getDisplayUserName } from "@/lib/users";
import { getMovieDetails } from "@/lib/tmdb";
import {
  CinePostCommentWithUser,
  CinePostEngagementType,
  CinePostWithDetails,
  User,
} from "@/types";
import { auth, db } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import {
  createCinePostComment,
  deleteCinePostComment,
  getCinePostContentHref,
  getCinePost,
  getCinePostEngagementUsers,
  getCinePostDisplayBody,
  setCinePostEngagement,
  updateCinePostComment,
} from "@/lib/cineposts";
import { formatRelativeTime } from "@/lib/format";
import { reportAppError } from "@/lib/report-error";
import { getShowDetails } from "@/lib/tvmaze";

function relativeTime(dateString: string): string {
  const date = new Date(dateString);
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days <= 14) {
    return `${days} ${days === 1 ? "day" : "days"}`;
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  }).format(date);
}

function profileHref(user: User): string {
  return `/profile/${user.username || user.id}`;
}

function contentHref(post: CinePostWithDetails): string | null {
  return getCinePostContentHref(post);
}

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
          className="font-semibold text-[#ff7a1a] underline-offset-2 hover:underline"
        >
          {part}
        </a>
      );
    }
    return <span key={`${part}-${index}`}>{part}</span>;
  });
}

function Avatar({ user, size = "h-10 w-10" }: { user: User; size?: string }) {
  if (user.avatar_url) {
    return (
      <div className={`${size} overflow-hidden rounded-full border border-white/15 bg-white/5 shadow-sm`}>
        <img src={user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div className={`flex ${size} items-center justify-center rounded-full bg-[#f5f0de] text-sm font-black text-[#050505]`}>
      {user.name.charAt(0).toUpperCase()}
    </div>
  );
}

const POST_BODY_PREVIEW_LIMIT = 320;

function ExpandablePostBody({
  body,
  spoiler,
  className = "",
  buttonClassName = "",
}: {
  body: string;
  spoiler?: boolean | null;
  className?: string;
  buttonClassName?: string;
}) {
  const [revealed, setRevealed] = useState(!spoiler);
  const [expanded, setExpanded] = useState(false);

  const isTrimmed = body.length > POST_BODY_PREVIEW_LIMIT;
  const visibleText =
    expanded || !isTrimmed
      ? body
      : `${body.slice(0, POST_BODY_PREVIEW_LIMIT).trimEnd()}...`;

  if (spoiler && !revealed) {
    return (
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setRevealed(true);
        }}
        className={`flex w-full flex-col items-start border border-white/12 bg-white/[0.03] px-4 py-3 text-left transition hover:border-[#ff7a1a]/55 ${buttonClassName}`}
      >
        <span className="text-xs font-black uppercase tracking-[0.18em] text-[#ff7a1a]">Contains spoiler</span>
        <span className="mt-1 text-xs text-white/55">Click to see</span>
      </button>
    );
  }

  return (
    <div>
      <div className={className}>{linkify(visibleText)}</div>
      {isTrimmed ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="mt-3 inline-flex rounded-full border border-[#ff7a1a]/20 bg-[#ff7a1a]/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-[#ffb36b] transition hover:border-[#ff9b4a]/40 hover:bg-[#ff7a1a]/14 hover:text-[#ffd8ae]"
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      ) : null}
    </div>
  );
}

function PeopleModal({
  title,
  users,
  loading,
  onClose,
}: {
  title: string;
  users: User[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-md border border-white/10 bg-[#111111] p-4 text-[#f5f0de] shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-black text-[#f5f0de]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-white/55 hover:bg-white/5 hover:text-[#f5f0de]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-12 animate-pulse bg-white/5" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="bg-white/5 p-4 text-sm text-white/55">No one here yet.</p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {users.map((user) => (
              <Link
                key={user.id}
                href={profileHref(user)}
                onClick={onClose}
                className="flex items-center gap-3 p-2 transition hover:bg-white/5"
              >
                <Avatar user={user} />
                <p className="truncate text-sm font-bold text-[#f5f0de]">{user.name}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CommentThread({
  comment,
  currentUser,
  postOwnerId,
  onReply,
  onEdit,
  onDelete,
  replyingTo,
  replyText,
  setReplyingTo,
  setReplyText,
  submitting,
  depth = 0,
}: {
  comment: CinePostCommentWithUser;
  currentUser: User | null;
  postOwnerId: string;
  onReply: (parentId: string, ownerId: string) => Promise<void>;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  replyingTo: string | null;
  replyText: string;
  setReplyingTo: (commentId: string | null) => void;
  setReplyText: (value: string) => void;
  submitting: boolean;
  depth?: number;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [commentSaving, setCommentSaving] = useState(false);
  const hasReplies = comment.replies.length > 0;
  const avatarSize = depth > 0 ? "h-7 w-7" : "h-9 w-9";

  useEffect(() => {
    if (!isEditing) {
      setEditText(comment.content);
    }
  }, [comment.content, isEditing]);

  const canManageComment = currentUser?.id === comment.user_id;

  const startEdit = () => {
    setMenuOpen(false);
    setEditText(comment.content);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditText(comment.content);
  };

  const saveEdit = async () => {
    if (editText.trim().length < 2) return;

    try {
      setCommentSaving(true);
      await onEdit(comment.id, editText);
      setIsEditing(false);
    } catch (error) {
      reportAppError({
        title: "Comment update failed",
        message: "We could not save your edit.",
        details: error instanceof Error ? error.stack || error.message : String(error),
      });
    } finally {
      setCommentSaving(false);
    }
  };

  const deleteComment = async () => {
    const confirmed = window.confirm(
      comment.replies.length > 0
        ? "Delete this comment and its replies?"
        : "Delete this comment?"
    );
    if (!confirmed) return;

    try {
      setMenuOpen(false);
      setCommentSaving(true);
      await onDelete(comment.id);
    } catch (error) {
      reportAppError({
        title: "Comment delete failed",
        message: "We could not delete this comment.",
        details: error instanceof Error ? error.stack || error.message : String(error),
      });
    } finally {
      setCommentSaving(false);
    }
  };

  return (
    <div className="py-3">
      <div className="flex gap-2.5">
        <Link href={profileHref(comment.user)} className="flex-shrink-0">
          <Avatar user={comment.user} size={avatarSize} />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link href={profileHref(comment.user)} className="text-[13px] font-black text-[#f5f0de] transition hover:text-[#ffb36b]">
                  {comment.user.name}
                </Link>
                <span className="text-[11px] text-white/35">{relativeTime(comment.created_at)}</span>
                {comment.user_id === postOwnerId && (
                  <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-[#ff9b4a]">
                    Owner
                  </span>
                )}
              </div>
            </div>

            {canManageComment && (
              <div className="relative flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="rounded-full p-1 text-white/45 transition hover:bg-white/5 hover:text-[#f5f0de]"
                  aria-label="Comment options"
                  aria-expanded={menuOpen}
                >
                  <MoreVertical className="h-4 w-4" />
                </button>

                {menuOpen && (
                  <div className="absolute right-0 top-9 z-20 w-40 overflow-hidden border border-white/10 bg-[#111111] p-1 shadow-xl">
                    <button
                      type="button"
                      onClick={startEdit}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-[#f5f0de] transition hover:bg-white/5"
                    >
                      <Pencil className="h-4 w-4" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={deleteComment}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-bold text-[#ff7a1a] transition hover:bg-white/5"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {isEditing ? (
            <div className="mt-3 space-y-2">
              <textarea
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
                rows={3}
                className="w-full resize-none border border-white/10 bg-[#0d0d0d] px-4 py-3 text-sm leading-6 text-[#f5f0de] outline-none focus:border-[#ff7a1a]"
              />
              <div className="flex gap-3 text-xs font-black">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-white/55 transition hover:text-[#f5f0de]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={commentSaving || editText.trim().length < 2}
                  className="text-[#ff9b4a] transition hover:text-[#ffb36b] disabled:opacity-50"
                >
                  {commentSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="mt-1 whitespace-pre-wrap text-[13px] leading-5 text-[#f5f0de]/84">{linkify(comment.content)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] font-black">
                {currentUser && (
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(replyingTo === comment.id ? null : comment.id);
                      setReplyText("");
                    }}
                    className="text-white/55 transition hover:text-[#f5f0de]"
                  >
                    Reply{hasReplies ? ` (${comment.replies.length})` : ""}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {replyingTo === comment.id && (
        <div className="mt-2 flex gap-2 pl-11">
          <input
            value={replyText}
            onChange={(event) => setReplyText(event.target.value)}
            placeholder={`Reply to ${comment.user.name}`}
            className="min-w-0 flex-1 border-b border-white/10 bg-transparent px-0 py-1.5 text-[13px] text-[#f5f0de] outline-none placeholder:text-white/35 focus:border-[#ff7a1a]"
          />
          <button
            type="button"
            disabled={submitting || replyText.trim().length < 2}
            onClick={() => onReply(comment.id, comment.user_id)}
            className="inline-flex items-center gap-1 rounded-none bg-[#ff7a1a] px-2.5 py-1.5 text-[11px] font-black text-black disabled:opacity-50"
            aria-label="Send reply"
          >
            <Send className="h-3.5 w-3.5" />
            Reply
          </button>
        </div>
      )}

      {hasReplies && (
        <div className="ml-4 mt-2 space-y-1 border-l border-white/10 pl-3 sm:ml-5 sm:pl-5">
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              currentUser={currentUser}
              postOwnerId={postOwnerId}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              replyingTo={replyingTo}
              replyText={replyText}
              setReplyingTo={setReplyingTo}
              setReplyText={setReplyText}
              submitting={submitting}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CinePostPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const postId = params.id;
  const [user, setUser] = useState<User | null>(null);
  const [post, setPost] = useState<CinePostWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [peopleModalTitle, setPeopleModalTitle] = useState("");
  const [peopleModalUsers, setPeopleModalUsers] = useState<User[]>([]);
  const [peopleModalLoading, setPeopleModalLoading] = useState(false);
  const [commentSort, setCommentSort] = useState<"top" | "newest">("top");
  const [stillUrls, setStillUrls] = useState<string[]>([]);
  const [engagementPending, setEngagementPending] = useState<Record<CinePostEngagementType, boolean>>({
    like: false,
    save: false,
  });

  const loadPost = async (currentUserId?: string) => {
    const foundPost = await getCinePost(postId, currentUserId);
    setPost(foundPost);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          router.push("/auth/login");
          return;
        }

        const userSnapshot = await get(ref(db, `users/${firebaseUser.uid}`));
        const userData = userSnapshot.val();
        const currentUser: User = {
          id: firebaseUser.uid,
          username: userData?.username || firebaseUser.email?.split("@")[0] || "user",
          name: userData?.name || firebaseUser.displayName || "User",
          avatar_url: userData?.avatar_url || null,
          created_at: userData?.created_at || userData?.createdAt || new Date().toISOString(),
        };

        setUser(currentUser);
        await loadPost(currentUser.id);
      } catch (error) {
        console.error("Error loading post:", error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [postId, router]);

  const handleSignOut = async () => {
    await authSignOut();
    router.push("/auth/login");
  };

  const refreshPost = async () => {
    await loadPost(user?.id);
  };

  const handleEngagement = async (
    type: CinePostEngagementType,
    enabled: boolean
  ) => {
    if (!user || !post || engagementPending[type]) return;

    const previousPost = post;
    const likeDelta = type === "like" ? (enabled ? 1 : -1) : 0;
    const saveDelta = type === "save" ? (enabled ? 1 : -1) : 0;

    setEngagementPending((current) => ({ ...current, [type]: true }));
    setPost({
      ...post,
      liked_by_current_user: type === "like" ? enabled : post.liked_by_current_user,
      saved_by_current_user: type === "save" ? enabled : post.saved_by_current_user,
      likes_count: Math.max(0, post.likes_count + likeDelta),
      saves_count: Math.max(0, post.saves_count + saveDelta),
      score: Math.max(0, post.score + likeDelta + saveDelta * 3),
    });

    try {
      await setCinePostEngagement(post, user, type, enabled);
      await refreshPost();
    } catch (error) {
      setPost(previousPost);
      reportAppError({
        title: "Could not update post",
        message: "We could not update that reaction.",
        details: error instanceof Error ? error.message : null,
      });
    } finally {
      setEngagementPending((current) => ({ ...current, [type]: false }));
    }
  };

  const openPeopleModal = async (type: CinePostEngagementType, title: string) => {
    if (!post) return;
    setPeopleModalTitle(title);
    setPeopleModalUsers([]);
    setPeopleModalLoading(true);
    try {
      const users = await getCinePostEngagementUsers(post.id, type);
      setPeopleModalUsers(users);
    } finally {
      setPeopleModalLoading(false);
    }
  };

  const handleComment = async () => {
    if (!user || !post || commentText.trim().length < 2) return;
    try {
      setSubmittingComment(true);
      await createCinePostComment(post, user, commentText);
      setCommentText("");
      await refreshPost();
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleReply = async (parentId: string, ownerId: string) => {
    if (!user || !post || replyText.trim().length < 2) return;
    try {
      setSubmittingComment(true);
      await createCinePostComment(post, user, replyText, parentId, ownerId);
      setReplyText("");
      setReplyingTo(null);
      await refreshPost();
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleEditComment = async (commentId: string, content: string) => {
    if (!user || !post) return;
    await updateCinePostComment(post.id, user.id, commentId, content);
    await refreshPost();
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!user || !post) return;
    await deleteCinePostComment(post.id, user.id, commentId);
    await refreshPost();
  };

  useEffect(() => {
    if (!post || post.backdrop_gallery_urls?.length) {
      setStillUrls([]);
      return;
    }

    let cancelled = false;

    (async () => {
      if (post.content_type === "movie" && post.content_id) {
        const details = await getMovieDetails(post.content_id);
        if (!cancelled && details) {
          const nextStillUrls = details.backdrop_gallery_urls?.length
            ? details.backdrop_gallery_urls
            : details.backdrop_url
              ? [details.backdrop_url]
              : [];
          setStillUrls(nextStillUrls);
        }
      } else if (post.content_type === "tv" && post.content_id) {
        const details = await getShowDetails(post.content_id);
        if (!cancelled && details) {
          const nextStillUrls = details.backdrop_gallery_urls?.length
            ? details.backdrop_gallery_urls
            : details.backdrop_url
              ? [details.backdrop_url]
              : [];
          setStillUrls(nextStillUrls);
        }
      } else if (!cancelled) {
        setStillUrls([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [post]);

  if (loading || !user) {
    return null;
  }

  if (!post) {
    return (
      <PageLayout user={user} onSignOut={handleSignOut}>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <button
            type="button"
            onClick={() => router.back()}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-[#111111] px-4 py-2 text-sm font-bold text-[#f5f0de] transition hover:border-[#ff7a1a]/30 hover:text-[#ffb36b]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <div className="rounded-[2rem] border border-white/10 bg-[#111111] p-8 text-center">
            <p className="font-black text-[#f5f0de]">This post was not found.</p>
          </div>
        </div>
      </PageLayout>
    );
  }

  const href = contentHref(post);
  const primaryImage = post.content_type === "list" ? post.list_cover_images?.[0] || null : post.poster_url || null;
  const secondaryImages = post.content_type === "list"
    ? (post.list_cover_images || []).slice(1, 3)
    : (post.backdrop_gallery_urls?.length ? post.backdrop_gallery_urls : stillUrls);
  const sortedComments = [...post.comments].sort((a, b) => {
    if (commentSort === "newest") {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }
    if (b.insightScore !== a.insightScore) return b.insightScore - a.insightScore;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <main className="mx-auto max-w-5xl px-3 py-4 sm:px-6 sm:py-8">
        <article className="bg-black">
          <div className="py-3 sm:py-4">
            <div className="px-4 sm:px-5">
              <div className="flex items-start justify-between gap-3">
                <Link href={profileHref(post.user)} className="flex min-w-0 items-center gap-3">
                  <Avatar user={post.user} size="h-8 w-8" />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-black text-[#f5f0de] sm:text-[15px]">
                      {getDisplayUserName(post.user, user)}
                    </p>
                    <p className="flex items-center gap-1 text-[11px] sm:text-xs">
                      <span className="font-bold uppercase tracking-wide text-[#ff8d3b]">{post.anchor_type}</span>
                      <span className="text-white/40"> · {formatRelativeTime(post.created_at)}</span>
                    </p>
                  </div>
                </Link>

                <CinePostOwnerMenu
                  post={post}
                  currentUser={user}
                  onDeleted={() => router.push("/dashboard")}
                  onUpdated={refreshPost}
                  theme="brutalist"
                />
              </div>

              {href && (
                <div className="pb-2 pt-2.5">
                  <Link
                    href={href}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold text-[#f5f0de] transition hover:border-[#ff7a1a]/40 hover:bg-white/10 sm:text-[11px]"
                  >
                    Open {post.anchor_type === "tv" ? "TV Show" : post.anchor_type === "list" ? "List" : post.anchor_type === "crew" ? "Crew" : "Movie"}
                    <span className="text-sm leading-none">›</span>
                  </Link>
                </div>
              )}
            </div>

            <ContentImageRow
              primaryUrl={primaryImage}
              primaryAlt={post.content_title || post.anchor_label}
              secondaryUrls={secondaryImages}
              layout={post.anchor_type === "list" ? "posters-only" : "poster-first"}
              density="compact"
            />

            <div className="px-4 pt-2.5 sm:px-5">
              <h1 className="text-[16px] font-black uppercase tracking-tight text-[#f5f0de] sm:text-[18px]">
                {post.content_title || post.anchor_label}
              </h1>

              <ExpandablePostBody
                body={getCinePostDisplayBody(post)}
                spoiler={post.contains_spoiler}
                className="mt-2 border-l-2 border-[#ff7a1a]/50 pl-3 whitespace-pre-wrap text-[13px] leading-5 text-[#f5f0de]/82"
                buttonClassName="mt-3 max-w-3xl"
              />
            </div>
          </div>

          <div className="border-t border-white/10 px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-5 text-white/75">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleEngagement("like", !post.liked_by_current_user)}
                    disabled={engagementPending.like}
                    className="transition hover:text-[#f5f0de] disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label={post.liked_by_current_user ? "Unlike post" : "Like post"}
                  >
                    <Heart
                      className={`h-5 w-5 ${
                        post.liked_by_current_user ? "fill-rose-500 text-rose-500" : "text-white/80"
                      }`}
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => openPeopleModal("like", "Liked by")}
                    disabled={post.likes_count === 0}
                    className="text-base font-semibold text-[#f5f0de] transition hover:text-white disabled:cursor-default disabled:opacity-50"
                    aria-label={post.likes_count === 1 ? "1 like" : `${post.likes_count} likes`}
                  >
                    {post.likes_count}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    document.getElementById("post-comments")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="flex items-center gap-2 transition hover:text-[#f5f0de]"
                  aria-label={post.comments_count === 1 ? "1 comment" : `${post.comments_count} comments`}
                >
                  <MessageCircle className="h-5 w-5 text-white/80" />
                  <span className="text-base font-semibold text-[#f5f0de]">{post.comments_count}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleEngagement("save", !post.saved_by_current_user)}
                  disabled={engagementPending.save}
                  className="transition hover:text-[#f5f0de] disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={post.saved_by_current_user ? "Unsave post" : "Save post"}
                >
                  <Bookmark
                    className={`h-5 w-5 ${
                      post.saved_by_current_user ? "fill-[#f5f0de] text-[#f5f0de]" : "text-white/80"
                    }`}
                  />
                </button>
              </div>

              <button
                type="button"
                onClick={async () => {
                  const absoluteUrl = new URL(`/posts/${post.id}`, window.location.origin).toString();
                  try {
                    if (navigator.share) {
                      await navigator.share({
                        title: post.content_title || post.anchor_label,
                        text: getCinePostDisplayBody(post).slice(0, 140),
                        url: absoluteUrl,
                      });
                      return;
                    }
                    if (navigator.clipboard?.writeText) {
                      await navigator.clipboard.writeText(absoluteUrl);
                      return;
                    }
                  } catch (error) {
                    console.error("Share post failed:", error);
                  }
                  window.prompt("Copy this link", absoluteUrl);
                }}
                className="flex items-center gap-2.5 text-white/75 transition hover:text-[#f5f0de]"
              >
                <Share2 className="h-4 w-4" />
                <span className="text-base font-medium">Share</span>
              </button>
            </div>
          </div>
        </article>

        <section id="post-comments" className="mt-6 px-1 py-1 sm:px-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-[#f5f0de] sm:text-base">
                <MessageCircle className="h-3.5 w-3.5" />
                Comments
              </h2>
              <p className="text-[11px] text-white/45 sm:text-xs">Replies stay with this post.</p>
            </div>
            <div className="rounded-full border border-white/10 bg-[#111111] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
              {(["top", "newest"] as const).map((sort) => (
                <button
                  key={sort}
                  type="button"
                  onClick={() => setCommentSort(sort)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-black capitalize transition ${
                    commentSort === sort ? "bg-[#ff7a1a] text-black" : "text-white/55 hover:bg-white/10 hover:text-[#f5f0de]"
                  }`}
                >
                  {sort}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-3 flex gap-2">
            <input
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              placeholder="Add a comment..."
              className="min-w-0 flex-1 border-b border-white/10 bg-transparent px-0 py-2 text-[13px] text-[#f5f0de] outline-none placeholder:text-white/35 focus:border-[#ff7a1a]"
            />
            <button
              type="button"
              disabled={submittingComment || commentText.trim().length < 2}
              onClick={handleComment}
              className="inline-flex items-center gap-1 rounded-none bg-[#ff7a1a] px-3 py-2 text-[12px] font-black text-black disabled:opacity-50"
              aria-label="Send comment"
            >
              <Send className="h-3.5 w-3.5" />
              Send
            </button>
          </div>

          <div className="divide-y divide-white/10">
            {post.comments.length === 0 ? (
              <p className="py-4 text-sm text-white/55">
                No comments yet. Start the thread.
              </p>
            ) : (
              sortedComments.map((comment) => (
                <CommentThread
                  key={comment.id}
                  comment={comment}
                  currentUser={user}
                  postOwnerId={post.user_id}
                  onReply={handleReply}
                  onEdit={handleEditComment}
                  onDelete={handleDeleteComment}
                  replyingTo={replyingTo}
                  replyText={replyText}
                  setReplyingTo={setReplyingTo}
                  setReplyText={setReplyText}
                  submitting={submittingComment}
                />
              ))
            )}
          </div>
        </section>
      </main>

      {peopleModalTitle && (
        <PeopleModal
          title={peopleModalTitle}
          users={peopleModalUsers}
          loading={peopleModalLoading}
          onClose={() => {
            setPeopleModalTitle("");
            setPeopleModalUsers([]);
          }}
        />
      )}
    </PageLayout>
  );
}
