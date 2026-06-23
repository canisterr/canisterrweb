"use client";

import Link from "next/link";
import { Bookmark, Heart, MessageCircle } from "lucide-react";
import CinePostOwnerMenu from "@/components/CinePostOwnerMenu";
import CinePostArtwork from "@/components/CinePostArtwork";
import CinePostListStrip from "@/components/CinePostListStrip";
import SpoilerText from "@/components/SpoilerText";
import { getCinePostContentHref, getCinePostDisplayBody } from "@/lib/cineposts";
import { CinePostWithDetails, User } from "@/types";
import { getDisplayUserHandle, getDisplayUserName } from "@/lib/users";

const PREVIEW_LIMIT = 130;

function relativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.max(1, Math.floor(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function profileHref(user: User): string {
  return `/profile/${user.username || user.id}`;
}

function formatPostType(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function preview(body: string): string {
  if (body.length <= PREVIEW_LIMIT) return body;
  return `${body.slice(0, PREVIEW_LIMIT).trimEnd()}...`;
}

function Avatar({
  user,
  size = "h-10 w-10",
}: {
  user: User;
  size?: string;
}) {
  if (user.avatar_url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.avatar_url}
        alt={getDisplayUserName(user)}
        className={`${size} rounded-full border border-white/10 object-cover`}
      />
    );
  }

  return (
    <div
      className={`${size} flex items-center justify-center rounded-full border border-white/10 bg-white/5 text-sm font-black text-[#f5f0de]`}
    >
      {getDisplayUserName(user).charAt(0).toUpperCase()}
    </div>
  );
}

export default function CinePostPreviewList({
  posts,
  emptyText = "No posts yet.",
  className = "",
  currentUser = null,
  onPostMutated,
  theme = "default",
}: {
  posts: CinePostWithDetails[];
  emptyText?: string;
  className?: string;
  currentUser?: User | null;
  onPostMutated?: () => void;
  theme?: "default" | "brutalist";
}) {
  const isBrutalist = theme === "brutalist";

  if (posts.length === 0) {
    return (
      <div
        className={`border border-dashed p-6 text-center text-sm ${
          isBrutalist ? "border-white/10 bg-[#111111] text-white/50" : "border-slate-200 bg-white text-slate-500"
        } ${className}`}
      >
        {emptyText}
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {posts.map((post) => {
        const contentHref = getCinePostContentHref(post);
        const hasArtwork = Boolean(post.poster_url || (post.list_cover_images && post.list_cover_images.length > 0));
        const isListPost = post.content_type === "list" && (post.list_items?.length || 0) > 0;
        const postAuthorUser = currentUser && currentUser.id === post.user_id ? currentUser : post.user;
        const authorName = getDisplayUserName(postAuthorUser, currentUser);
        const authorHandle = getDisplayUserHandle(postAuthorUser, currentUser);

        if (isListPost) {
          return (
            <article key={post.id} className="border-b border-white/10 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex flex-wrap items-center gap-2">
                  <Link href={profileHref(post.user)} className="font-black text-[#f5f0de] hover:text-[#ffb36b]">
                    {authorName}
                  </Link>
                  <span className="text-xs text-white/45">{relativeTime(post.created_at)}</span>
                  <span className="rounded-full bg-[#ff7a1a] px-2 py-0.5 text-[10px] font-black text-black">
                    {formatPostType(post.type)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {currentUser && currentUser.id === post.user_id && onPostMutated && (
                    <CinePostOwnerMenu
                      post={post}
                      currentUser={currentUser}
                      onDeleted={onPostMutated}
                      onUpdated={onPostMutated}
                      theme={theme}
                    />
                  )}
                </div>
              </div>

              <div className="mt-2 block">
                <SpoilerText spoiler={post.contains_spoiler} className="whitespace-pre-wrap text-sm leading-6 text-[#f5f0de]/80">
                  <Link href={`/posts/${post.id}`}>{preview(getCinePostDisplayBody(post))}</Link>
                </SpoilerText>
              </div>

              <div className="mt-3">
                <CinePostListStrip items={post.list_items || []} theme={theme} />
              </div>
            </article>
          );
        }

        if (isBrutalist) {
          return (
            <article
              key={post.id}
              className="overflow-hidden border border-white/10 bg-[#080a0d] text-[#f5f0de]"
            >
              <div className="grid min-h-[8.8rem] grid-cols-[5.8rem_minmax(0,1fr)] sm:min-h-[11.75rem] sm:grid-cols-[8.4rem_minmax(0,1fr)]">
                {hasArtwork && contentHref ? (
                  <Link
                    href={contentHref}
                    className="group relative block h-full overflow-hidden border-r border-white/10 bg-black"
                    title={`Open ${post.content_title || post.anchor_label}`}
                  >
                    <CinePostArtwork
                      src={post.poster_url}
                      collageImages={post.list_cover_images}
                      alt={post.content_title || post.anchor_label}
                      className="h-full w-full"
                      mediaClassName="transition duration-300 group-hover:scale-[1.02]"
                      fit="cover"
                      theme={theme}
                    />
                  </Link>
                ) : hasArtwork ? (
                  <div className="relative h-full overflow-hidden border-r border-white/10 bg-black">
                    <CinePostArtwork
                      src={post.poster_url}
                      collageImages={post.list_cover_images}
                      alt={post.content_title || post.anchor_label}
                      className="h-full w-full"
                      mediaClassName="transition duration-300"
                      fit="cover"
                      theme={theme}
                    />
                  </div>
                ) : (
                  <div className="border-r border-white/10 bg-[#111111]" />
                )}

                <div className="flex min-w-0 flex-col px-3 py-3 sm:px-4 sm:py-3.5">
                  <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
                    <Link href={profileHref(postAuthorUser)} className="shrink-0">
                      <Avatar user={postAuthorUser} size="h-9 w-9 sm:h-10 sm:w-10" />
                    </Link>

                    <div className="min-w-0 flex-1">
                      <Link
                        href={profileHref(postAuthorUser)}
                        className="block truncate text-[0.98rem] font-black leading-tight text-[#f5f0de] hover:text-[#ffb36b] sm:text-[1.08rem]"
                      >
                        {authorName}
                      </Link>
                      {authorHandle ? (
                        <p className="mt-0.5 truncate text-[0.76rem] leading-none text-white/55 sm:text-[0.85rem]">
                          {authorHandle}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-1.5 text-[0.72rem] text-white/45 sm:text-[0.84rem]">
                      <span>{relativeTime(post.created_at)}</span>
                      {currentUser && currentUser.id === post.user_id && onPostMutated ? (
                        <CinePostOwnerMenu
                          post={post}
                          currentUser={currentUser}
                          onDeleted={onPostMutated}
                          onUpdated={onPostMutated}
                          theme={theme}
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-2.5 flex-1 sm:mt-3">
                    <SpoilerText
                      spoiler={post.contains_spoiler}
                      className="line-clamp-4 text-[0.92rem] leading-6 text-[#f5f0de]/88 sm:text-[0.98rem] sm:leading-7"
                    >
                      <Link href={`/posts/${post.id}`}>{preview(getCinePostDisplayBody(post))}</Link>
                    </SpoilerText>
                  </div>

                  <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5 sm:mt-3.5 sm:pt-3">
                    <div className="flex items-center gap-4 text-[#f5f0de]/82 sm:gap-5">
                      <Link href={`/posts/${post.id}`} className="inline-flex items-center gap-1.5 transition hover:text-[#ffb36b]">
                        <Heart className={`h-4 w-4 sm:h-[18px] sm:w-[18px] ${post.liked_by_current_user ? "fill-[#ff7a1a] text-[#ff7a1a]" : ""}`} />
                        <span className="text-xs font-black sm:text-sm">{post.likes_count}</span>
                      </Link>
                      <Link href={`/posts/${post.id}`} className="inline-flex items-center gap-1.5 transition hover:text-[#ffb36b]">
                        <MessageCircle className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
                        <span className="text-xs font-black sm:text-sm">{post.comments_count}</span>
                      </Link>
                    </div>

                    <Link href={`/posts/${post.id}`} className="text-[#f5f0de]/72 transition hover:text-[#ffb36b]" aria-label="Open post">
                      <Bookmark className={`h-4 w-4 sm:h-[18px] sm:w-[18px] ${post.saved_by_current_user ? "fill-[#ff7a1a] text-[#ff7a1a]" : ""}`} />
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          );
        }

        return (
          <article
            key={post.id}
            className="grid grid-cols-[4.75rem_minmax(0,1fr)] gap-3 border-b border-white/10 py-3 sm:grid-cols-[5.25rem_minmax(0,1fr)] sm:gap-4 sm:py-4"
          >
            {hasArtwork && contentHref ? (
              <Link href={contentHref} className="relative aspect-[2/3] overflow-hidden bg-transparent">
                <CinePostArtwork
                  src={post.poster_url}
                  collageImages={post.list_cover_images}
                  alt={post.content_title || post.anchor_label}
                  className="h-full w-full"
                  mediaClassName=""
                  theme={theme}
                />
              </Link>
            ) : hasArtwork ? (
              <div className="relative aspect-[2/3] overflow-hidden bg-transparent">
                <CinePostArtwork
                  src={post.poster_url}
                  collageImages={post.list_cover_images}
                  alt={post.content_title || post.anchor_label}
                  className="h-full w-full"
                  mediaClassName=""
                  theme={theme}
                />
              </div>
            ) : (
              <div className="aspect-[2/3] bg-transparent" />
            )}
            <div className="min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex flex-wrap items-center gap-2">
                  <Link href={profileHref(post.user)} className="font-black text-[#f5f0de] hover:text-[#ffb36b]">
                    {authorName}
                  </Link>
                  <span className="text-xs text-white/45">{relativeTime(post.created_at)}</span>
                  <span className="rounded-full bg-[#ff7a1a] px-2 py-0.5 text-[10px] font-black text-black">
                    {formatPostType(post.type)}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {currentUser && currentUser.id === post.user_id && onPostMutated && (
                    <CinePostOwnerMenu
                      post={post}
                      currentUser={currentUser}
                      onDeleted={onPostMutated}
                      onUpdated={onPostMutated}
                      theme={theme}
                    />
                  )}
                </div>
              </div>
              <div className="mt-2 block">
                <SpoilerText spoiler={post.contains_spoiler} className="whitespace-pre-wrap text-sm leading-6 text-[#f5f0de]/80">
                  <Link href={`/posts/${post.id}`}>{preview(getCinePostDisplayBody(post))}</Link>
                </SpoilerText>
              </div>
              <div className="mt-2 flex gap-3 text-xs font-bold text-white/55">
                <span>{post.likes_count} likes</span>
                <span>{post.comments_count} comments</span>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
