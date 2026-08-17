"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MoreVertical,
  Share2,
  Trash2,
  Heart,
  MessageCircle,
  Bookmark,
  ChevronRight,
  EyeOff,
} from "lucide-react";
import type { CinePostAnchorType, CinePostWithDetails, User } from "@/types";
import {
  deleteCinePost,
  getCinePostContentHref,
  getCinePostDisplayBody,
  setCinePostEngagement,
} from "@/lib/cineposts";
import { getMovieDetails } from "@/lib/tmdb";
import { getShowDetails } from "@/lib/tvmaze";
import { buildCrewPath } from "@/lib/crew";
import { formatRelativeTime } from "@/lib/format";
import { Avatar } from "@/components/LikersModal";
import ContentImageRow from "@/components/ContentImageRow";

const ANCHOR_LABEL: Record<CinePostAnchorType, string> = {
  movie: "Movie",
  tv: "TV Show",
  list: "List",
  crew: "Crew",
};

interface PostFeedCardProps {
  post: CinePostWithDetails;
  currentUser: User | null;
  onDeleted?: (postId: string) => void;
}

const POST_PREVIEW_LIMIT = 200;

export default function PostFeedCard({ post, currentUser, onDeleted }: PostFeedCardProps) {
  const router = useRouter();
  const [localPost, setLocalPost] = useState(post);
  const [liked, setLiked] = useState(post.liked_by_current_user);
  const [likesCount, setLikesCount] = useState(post.likes_count);
  const [saved, setSaved] = useState(post.saved_by_current_user);

  const [syncedPost, setSyncedPost] = useState(post);
  if (post !== syncedPost) {
    setSyncedPost(post);
    setLocalPost(post);
    setLiked(post.liked_by_current_user);
    setLikesCount(post.likes_count);
    setSaved(post.saved_by_current_user);
  }

  const [showMenu, setShowMenu] = useState(false);
  const [spoilerRevealed, setSpoilerRevealed] = useState(false);
  const [stillUrls, setStillUrls] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (localPost.content_type === "movie" && localPost.content_id) {
        const details = await getMovieDetails(localPost.content_id);
        if (!cancelled && details) {
          const nextStillUrls = details.backdrop_gallery_urls?.length
            ? details.backdrop_gallery_urls
            : details.backdrop_url
              ? [details.backdrop_url]
              : [];
          setStillUrls(nextStillUrls);
        }
      } else if (localPost.content_type === "tv" && localPost.content_id) {
        const details = await getShowDetails(localPost.content_id);
        if (!cancelled && details) {
          const nextStillUrls = details.backdrop_gallery_urls?.length
            ? details.backdrop_gallery_urls
            : details.backdrop_url
              ? [details.backdrop_url]
              : [];
          setStillUrls(nextStillUrls);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [localPost.content_type, localPost.content_id]);

  const isOwnPost = currentUser?.id === localPost.user_id;
  const contentHref =
    localPost.anchor_type === "crew" && localPost.person_id
      ? buildCrewPath({ id: localPost.person_id, name: localPost.person_name || localPost.anchor_label })
      : getCinePostContentHref(localPost);
  const displayBody = getCinePostDisplayBody(localPost);
  const postUrl = `/posts/${localPost.id}`;
  const isBodyTrimmed = displayBody.length > POST_PREVIEW_LIMIT;
  const previewBody = isBodyTrimmed
    ? `${displayBody.slice(0, POST_PREVIEW_LIMIT).trimEnd()}...`
    : displayBody;

  const primaryImage = localPost.anchor_type === "list" ? localPost.list_cover_images?.[0] || null : localPost.poster_url || null;
  const secondaryImages = localPost.anchor_type === "list"
    ? (localPost.list_cover_images || []).slice(1, 3)
    : (localPost.backdrop_gallery_urls?.length ? localPost.backdrop_gallery_urls : stillUrls);

  const handleToggleLike = async () => {
    if (!currentUser) return;
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikesCount((c) => Math.max(0, c + (wasLiked ? -1 : 1)));
    try {
      await setCinePostEngagement(localPost, currentUser, "like", !wasLiked);
    } catch (error) {
      console.error("Failed to toggle post like:", error);
      setLiked(wasLiked);
      setLikesCount((c) => Math.max(0, c + (wasLiked ? 1 : -1)));
    }
  };

  const handleToggleSave = async () => {
    if (!currentUser) return;
    const wasSaved = saved;
    setSaved(!wasSaved);
    try {
      await setCinePostEngagement(localPost, currentUser, "save", !wasSaved);
    } catch (error) {
      console.error("Failed to toggle post save:", error);
      setSaved(wasSaved);
    }
  };

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    const absoluteUrl = new URL(postUrl, window.location.origin).toString();

    try {
      if (navigator.share) {
        await navigator.share({
          title: localPost.content_title || localPost.anchor_label,
          text: displayBody.slice(0, 140),
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
  };

  const handleDelete = async () => {
    if (!currentUser || !isOwnPost) return;
    if (!confirm("Are you sure you want to delete this post?")) return;
    try {
      await deleteCinePost(localPost.id, currentUser.id);
      onDeleted?.(localPost.id);
    } catch (error) {
      console.error("Error deleting post:", error);
      alert("Failed to delete post");
    }
  };

  const handleOpenPost = () => {
    router.push(postUrl);
  };

  const handlePostKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleOpenPost();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleOpenPost}
      onKeyDown={handlePostKeyDown}
      className="cursor-pointer"
      aria-label={`Open post about ${localPost.content_title || localPost.anchor_label}`}
    >
      <div className="flex items-center justify-between p-3.5 pb-3">
        <Link
          href={`/profile/${localPost.user.username || localPost.user_id}`}
          onClick={(event) => event.stopPropagation()}
          className="flex min-w-0 items-center gap-3"
        >
          <Avatar user={localPost.user} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-[#f5f0de]">{localPost.user.username || localPost.user.name}</p>
            <p className="flex items-center gap-1 text-xs">
              <span className="font-bold uppercase tracking-wide text-[#ff8d3b]">{ANCHOR_LABEL[localPost.anchor_type]}</span>
              <span className="text-white/40"> · {formatRelativeTime(localPost.created_at)}</span>
            </p>
          </div>
        </Link>

        <div className="relative flex-shrink-0">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setShowMenu((prev) => !prev);
            }}
            className="rounded-full p-1.5 text-white/50 transition hover:bg-white/5 hover:text-white/80"
            aria-label="Post actions"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
          {showMenu && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-10 cursor-default"
                onClick={(event) => {
                  event.stopPropagation();
                  setShowMenu(false);
                }}
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
                {isOwnPost && (
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
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {contentHref && (
        <div className="px-3.5 pb-3">
          <Link
            href={contentHref}
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-[#f5f0de] transition hover:border-[#ff7a1a]/40 hover:bg-white/10"
          >
            Open {ANCHOR_LABEL[localPost.anchor_type]}
            <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      <div onClick={(event) => event.stopPropagation()}>
        <ContentImageRow
          primaryUrl={primaryImage}
          primaryAlt={localPost.content_title || localPost.anchor_label}
          secondaryUrls={secondaryImages}
          layout={localPost.anchor_type === "list" ? "posters-only" : "poster-first"}
        />
      </div>

      <div className="p-3.5">
        <h3 className="text-base font-black uppercase tracking-tight text-[#f5f0de] sm:text-[17px]">
          {localPost.content_title || localPost.anchor_label}
        </h3>

        <div className="relative mt-3 border-l-2 border-[#ff7a1a]/50 pl-3">
          {localPost.contains_spoiler && !spoilerRevealed ? (
            <button
              type="button"
              onClick={() => setSpoilerRevealed(true)}
              className="flex items-center gap-2 text-sm italic text-white/40 blur-[6px] transition hover:blur-none"
            >
              <EyeOff className="h-3.5 w-3.5 shrink-0" />
              {previewBody}
            </button>
          ) : (
            <div>
              <p className="text-sm leading-relaxed text-white/80">{previewBody}</p>
              {isBodyTrimmed && (
                <Link
                  href={postUrl}
                  onClick={(event) => event.stopPropagation()}
                  className="mt-2 inline-flex text-xs font-semibold text-[#ffb36b] transition hover:text-[#ff7a1a]"
                >
                  Show more
                </Link>
              )}
            </div>
          )}
          {localPost.contains_spoiler && !spoilerRevealed && (
            <button
              type="button"
              onClick={() => setSpoilerRevealed(true)}
              className="mt-1 text-xs font-semibold text-[#ffb36b] hover:text-[#ff7a1a]"
            >
              Show spoiler
            </button>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-3.5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleToggleLike();
              }}
              disabled={!currentUser}
              className="flex items-center gap-1.5 text-white/70 transition hover:text-[#f5f0de] disabled:opacity-50"
            >
              <Heart className={`h-5 w-5 ${liked ? "fill-rose-500 text-rose-500" : ""}`} />
              <span className="text-sm font-semibold">{likesCount}</span>
            </button>
            <Link
              href={postUrl}
              onClick={(event) => event.stopPropagation()}
              className="flex items-center gap-1.5 text-white/70 transition hover:text-[#f5f0de]"
            >
              <MessageCircle className="h-5 w-5" />
              <span className="text-sm font-semibold">{localPost.comments_count}</span>
            </Link>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                handleToggleSave();
              }}
              disabled={!currentUser}
              className="text-white/70 transition hover:text-[#f5f0de] disabled:opacity-50"
              aria-label={saved ? "Unsave" : "Save"}
            >
              <Bookmark className={`h-5 w-5 ${saved ? "fill-[#f5f0de] text-[#f5f0de]" : ""}`} />
            </button>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              handleShare();
            }}
            className="flex items-center gap-1.5 text-sm font-semibold text-white/70 transition hover:text-[#f5f0de]"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>
        </div>

      </div>
    </div>
  );
}
