"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, ChevronLeft, ChevronRight, Heart, MessageCircle, Sparkles, X } from "lucide-react";
import CinePostOwnerMenu from "@/components/CinePostOwnerMenu";
import CinePostArtwork from "@/components/CinePostArtwork";
import SpoilerText from "@/components/SpoilerText";
import { CinePostEngagementType, CinePostWithDetails, Content, TMDBMovie, User } from "@/types";
import {
  getCinePostContentHref,
  getCinePostEngagementUsers,
  getCinePosts,
  getCinePostDisplayBody,
  setCinePostEngagement,
} from "@/lib/cineposts";
import { getPublicLists, getListWithDetails } from "@/lib/lists";
import { getPopularMovies } from "@/lib/tmdb";
import { getBlurDataUrl, getTmdbPosterUrl } from "@/lib/performance";
import { lsGet, lsSet } from "@/lib/local-cache";
import { getDisplayUserHandle, getDisplayUserName } from "@/lib/users";
import { reportAppError } from "@/lib/report-error";
import CinePostListStrip from "@/components/CinePostListStrip";
import { buildMoviePath, buildTvPath } from "@/lib/content-slugs";

interface CinePostsFeedProps {
  currentUser: User | null;
  refreshKey?: number;
  theme?: "default" | "brutalist";
  variant?: "default" | "home";
}

const PREVIEW_LIMIT = 150;

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

function getAuthorDisplayName(post: CinePostWithDetails, currentUser: User | null): string {
  return getDisplayUserName(post.user, currentUser);
}

function getAuthorUsername(user: User): string | null {
  return user.username ? `@${user.username}` : null;
}

function Avatar({
  user,
  size = "h-9 w-9",
  dark = false,
}: {
  user: User;
  size?: string;
  dark?: boolean;
}) {
  if (user.avatar_url) {
    return (
      <div className={`${size} overflow-hidden rounded-full border border-white/15 bg-white/5 shadow-sm`}>
        <img src={user.avatar_url} alt={user.name} className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={`flex ${size} items-center justify-center rounded-full text-sm font-bold ${
        dark ? "bg-[#f5f0de] text-[#0a0a0a]" : "bg-slate-950 text-white"
      }`}
    >
      {user.name.charAt(0).toUpperCase()}
    </div>
  );
}

function AuthorLabel({
  user,
  currentUser,
  theme,
}: {
  user: User;
  currentUser: User | null;
  theme: "default" | "brutalist";
}) {
  const isBrutalist = theme === "brutalist";
  const displayName = getDisplayUserName(user, currentUser);
  const handle = getDisplayUserHandle(user, currentUser);
  const showHandle = handle !== displayName;

  return (
    <div className="min-w-0 flex-1">
      <p
        className={`truncate text-[13px] font-black leading-none sm:text-sm ${
          isBrutalist ? "text-[#f5f0de]" : "text-slate-950"
        }`}
      >
        {displayName}
      </p>
      {showHandle && (
        <p className={`mt-0.5 truncate text-[10px] leading-none sm:text-xs ${isBrutalist ? "text-white/45" : "text-slate-400"}`}>
          {handle}
        </p>
      )}
    </div>
  );
}

function getContentHref(post: CinePostWithDetails): string | null {
  return getCinePostContentHref(post);
}

function getPreview(body: string): { text: string; isTrimmed: boolean } {
  if (body.length <= PREVIEW_LIMIT) return { text: body, isTrimmed: false };
  return {
    text: `${body.slice(0, PREVIEW_LIMIT).trimEnd()}...`,
    isTrimmed: true,
  };
}

function getFeedSplitActionClass(theme: "default" | "brutalist", active = false): string {
  const base =
    "group/action inline-flex h-10 items-center overflow-hidden rounded-full border transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]";

  if (theme === "brutalist") {
    return `${base} ${
      active
        ? "border-[#ff7a1a]/35 bg-[#ff7a1a]/12 text-[#ffb36b] shadow-[0_12px_28px_rgba(255,122,26,0.12)]"
        : "border-white/10 bg-white/[0.03] text-white/70 hover:border-[#ff8a1e]/30 hover:bg-[#ff8a1e]/10 hover:text-[#f5f0de]"
    }`;
  }

  return `${base} ${
    active
      ? "border-rose-200 bg-rose-50 text-rose-600 shadow-[0_12px_24px_rgba(244,63,94,0.12)]"
      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
  }`;
}

function getFeedActionChipClass(theme: "default" | "brutalist", active = false): string {
  const base =
    "group/chip inline-flex h-10 items-center gap-2 rounded-full border px-3 transition-all duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]";

  if (theme === "brutalist") {
    return `${base} ${
      active
        ? "border-[#ff7a1a]/35 bg-[#ff7a1a]/12 text-[#ffb36b] shadow-[0_12px_28px_rgba(255,122,26,0.12)]"
        : "border-white/10 bg-white/[0.03] text-white/70 hover:border-[#ff8a1e]/30 hover:bg-[#ff8a1e]/10 hover:text-[#f5f0de]"
    }`;
  }

  return `${base} ${
    active
      ? "border-sky-200 bg-sky-50 text-sky-600 shadow-[0_12px_24px_rgba(14,165,233,0.12)]"
      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
  }`;
}

function getFeedCountButtonClass(theme: "default" | "brutalist", active = false): string {
  if (theme === "brutalist") {
    return `inline-flex h-full min-w-[2.5rem] items-center justify-center px-3 text-xs font-black tabular-nums transition-colors disabled:cursor-default ${
      active ? "text-[#ffd8ae]" : "text-[#ffb36b] disabled:opacity-45"
    }`;
  }

  return `inline-flex h-full min-w-[2.5rem] items-center justify-center px-3 text-xs font-black tabular-nums transition-colors disabled:cursor-default ${
    active ? "text-rose-600" : "text-slate-500 disabled:opacity-45"
  }`;
}

function sortPostsNewestFirst(posts: CinePostWithDetails[]): CinePostWithDetails[] {
  return [...posts].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

type RailItem = {
  id: string;
  label: string;
  href: string;
  posterUrl: string | null;
  meta: string;
};

type DiscoverListItem = {
  id: string;
  name: string;
  href: string;
  coverImage: string | null;
  description: string | null;
};

function tmdbPosterUrl(path: string | null): string | null {
  return getTmdbPosterUrl(path, "w342");
}

function buildPopularRailItems(items: TMDBMovie[]): RailItem[] {
  return items.map((item) => ({
    id: String(item.id),
    label: item.title,
    href: buildMoviePath({
      id: item.id,
      title: item.title,
      director: item.director || null,
      release_date: item.release_date || null,
      language: item.original_language || undefined,
    }),
    posterUrl: tmdbPosterUrl(item.poster_path),
    meta: "Popular",
  }));
}

function buildSuggestedRailItems(items: Content[]): RailItem[] {
  return items.map((item) => ({
    id: String(item.id),
    label: item.title || (item as any).name || "Untitled",
    href: item.type === "tv" ? `/tv/${item.id}` : `/movie/${item.id}`,
    posterUrl: item.poster_url || null,
    meta: item.type === "tv" ? "Suggested show" : "Suggested movie",
  }));
}

function buildDiscoverListScore(list: {
  item_count: number;
  collaborator_count: number;
  items: Array<{ watched_by?: string[] }>;
}): number {
  const watchSignal = list.items.reduce((sum, item) => sum + (item.watched_by?.length || 0), 0);
  return list.item_count * 2 + list.collaborator_count * 3 + watchSignal;
}

function buildDiscoverListItems(allLists: DiscoverListItem[]): DiscoverListItem[] {
  return allLists;
}

function scrollRail(ref: { current: HTMLDivElement | null }, direction: -1 | 1) {
  const node = ref.current;
  if (!node) return;
  const amount = Math.max(node.clientWidth * 0.88, 320);
  node.scrollBy({ left: amount * direction, behavior: "smooth" });
}

function DiscoveryRail({
  title,
  items,
  loading,
  emptyLabel,
  railRef,
  theme = "default",
  onLeft,
  onRight,
  showButtons = true,
}: {
  title: string;
  items: RailItem[];
  loading: boolean;
  emptyLabel: string;
  railRef: { current: HTMLDivElement | null };
  theme?: "default" | "brutalist";
  onLeft?: () => void;
  onRight?: () => void;
  showButtons?: boolean;
}) {
  const isBrutalist = theme === "brutalist";

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className={`text-[11px] uppercase tracking-[0.3em] ${isBrutalist ? "text-white/45" : "text-slate-400"}`}>
            {title}
          </h3>
        </div>
        {showButtons && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onLeft}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                isBrutalist
                  ? "border-white/10 bg-[#0a0a0a] text-[#f5f0de] hover:border-white/20"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
              aria-label={`Scroll ${title.toLowerCase()} left`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onRight}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                isBrutalist
                  ? "border-white/10 bg-[#0a0a0a] text-[#f5f0de] hover:border-white/20"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
              aria-label={`Scroll ${title.toLowerCase()} right`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div
        ref={railRef}
        className="grid grid-flow-col gap-3 overflow-x-auto scroll-smooth pb-1 pr-1 scrollbar-hide snap-x snap-mandatory auto-cols-[7.5rem] sm:auto-cols-[8rem] lg:auto-cols-[calc((100%-3rem)/5)]"
      >
        {loading ? (
          Array.from({ length: 10 }).map((_, index) => (
            <div key={`${title}-skeleton-${index}`} className="snap-start">
              <div className="aspect-[2/3] overflow-hidden bg-white/5">
                <div className="h-full w-full animate-pulse bg-white/10" />
              </div>
              <div className="mt-2 h-3 w-4/5 animate-pulse bg-white/10" />
              <div className="mt-2 h-2 w-2/5 animate-pulse bg-white/5" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className={`py-3 text-sm ${isBrutalist ? "text-white/45" : "text-slate-500"}`}>{emptyLabel}</div>
        ) : (
          items.map((item) => (
            <Link key={item.id} href={item.href} className="snap-start">
              <div className="group">
                <div className="relative aspect-[2/3] overflow-hidden bg-[#1a1a1a]">
                  {item.posterUrl ? (
                    <Image
                      src={item.posterUrl}
                      alt={item.label}
                      fill
                      sizes="(max-width: 640px) 120px, (max-width: 1024px) 140px, 180px"
                      className="object-cover transition duration-300 group-hover:scale-[1.03]"
                      placeholder="blur"
                      blurDataURL={getBlurDataUrl()}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-white/35">No poster</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 pt-8">
                    <p className="line-clamp-2 text-[11px] font-semibold leading-4 text-[#f5f0de]">{item.label}</p>
                  </div>
                </div>
                <p className={`mt-2 text-[10px] uppercase tracking-[0.18em] ${isBrutalist ? "text-white/35" : "text-slate-400"}`}>
                  {item.meta}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function DiscoverListRail({
  items,
  loading,
  emptyLabel,
  railRef,
  theme = "default",
  onLeft,
  onRight,
}: {
  items: DiscoverListItem[];
  loading: boolean;
  emptyLabel: string;
  railRef: { current: HTMLDivElement | null };
  theme?: "default" | "brutalist";
  onLeft?: () => void;
  onRight?: () => void;
}) {
  const isBrutalist = theme === "brutalist";

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h3 className={`text-[11px] uppercase tracking-[0.3em] ${isBrutalist ? "text-white/45" : "text-slate-400"}`}>
            Discover Lists
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLeft}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
              isBrutalist
                ? "border-white/10 bg-[#0a0a0a] text-[#f5f0de] hover:border-white/20"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
            aria-label="Scroll discover lists left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onRight}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border ${
              isBrutalist
                ? "border-white/10 bg-[#0a0a0a] text-[#f5f0de] hover:border-white/20"
                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
            }`}
            aria-label="Scroll discover lists right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div
        ref={railRef}
        className="grid grid-flow-col gap-3 overflow-x-auto scroll-smooth pb-1 pr-1 scrollbar-hide snap-x snap-mandatory auto-cols-[7.5rem] sm:auto-cols-[8rem] lg:auto-cols-[calc((100%-3rem)/5)]"
      >
        {loading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <div key={`discover-skeleton-${index}`} className="snap-start">
              <div className="aspect-[2/3] overflow-hidden bg-white/5">
                <div className="h-full w-full animate-pulse bg-white/10" />
              </div>
              <div className="mt-2 h-3 w-4/5 animate-pulse bg-white/10" />
              <div className="mt-2 h-2 w-2/5 animate-pulse bg-white/5" />
            </div>
          ))
        ) : items.length === 0 ? (
          <div className={`py-3 text-sm ${isBrutalist ? "text-white/45" : "text-slate-500"}`}>{emptyLabel}</div>
        ) : (
          items.map((item) => (
            <Link key={item.id} href={item.href} className="snap-start">
              <div className="group">
                <div className="relative aspect-[2/3] overflow-hidden bg-[#1a1a1a]">
                  {item.coverImage ? (
                    <Image
                      src={item.coverImage}
                      alt={item.name}
                      fill
                      sizes="(max-width: 640px) 120px, (max-width: 1024px) 140px, 180px"
                      className="object-cover transition duration-300 group-hover:scale-[1.03]"
                      placeholder="blur"
                      blurDataURL={getBlurDataUrl()}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs text-white/35">No poster</div>
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 pt-8">
                    <p className="line-clamp-2 text-[11px] font-semibold leading-4 text-[#f5f0de]">{item.name}</p>
                  </div>
                </div>
                <p className={`mt-2 text-[10px] uppercase tracking-[0.18em] ${isBrutalist ? "text-white/35" : "text-slate-400"}`}>
                  Public list
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </section>
  );
}

function PeopleModal({
  title,
  users,
  loading,
  onClose,
  theme = "default",
}: {
  title: string;
  users: User[];
  loading: boolean;
  onClose: () => void;
  theme?: "default" | "brutalist";
}) {
  const isBrutalist = theme === "brutalist";

  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-center p-3 pb-[calc(8rem+env(safe-area-inset-bottom))] backdrop-blur-sm sm:items-center sm:pb-3 ${
      isBrutalist ? "bg-black/70" : "bg-slate-950/45"
    }`}>
      <div
        className={`w-full max-w-md border p-4 shadow-2xl ${
          isBrutalist
            ? "border-white/10 bg-black text-[#f5f0de]"
            : "rounded-[1.75rem] border-slate-200 bg-white"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className={`text-lg font-black ${isBrutalist ? "text-[#f5f0de]" : "text-slate-950"}`}>{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-full border p-2 ${
              isBrutalist
                ? "border-white/10 text-white/55 hover:bg-white/5 hover:text-[#f5f0de]"
                : "border-slate-200 text-slate-500 hover:bg-slate-50"
            }`}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((item) => (
              <div key={item} className={`h-12 animate-pulse ${isBrutalist ? "bg-white/5" : "rounded-2xl bg-slate-100"}`} />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className={`p-4 text-sm ${isBrutalist ? "bg-white/5 text-white/55" : "rounded-2xl bg-slate-50 text-slate-500"}`}>
            No one here yet.
          </p>
        ) : (
          <div className="max-h-[70dvh] space-y-2 overflow-y-auto sm:max-h-80">
            {users.map((user) => (
              <Link
                key={user.id}
                href={profileHref(user)}
                onClick={onClose}
                className={`flex items-center gap-3 p-2 transition ${
                  isBrutalist ? "hover:bg-white/5" : "rounded-2xl hover:bg-slate-50"
                }`}
              >
                <Avatar user={user} dark={isBrutalist} />
                <div className="min-w-0">
                  <p className={`truncate text-sm font-bold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-950"}`}>{user.name}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function CinePostsFeed({
  currentUser,
  refreshKey = 0,
  theme = "default",
  variant = "default",
}: CinePostsFeedProps) {
  const isBrutalist = theme === "brutalist";
  const isHome = variant === "home";
  const router = useRouter();
  const popularRailRef = useRef<HTMLDivElement | null>(null);
  const discoverRailRef = useRef<HTMLDivElement | null>(null);
  const seenPostsRef = useRef<Set<string>>(new Set());
  const [posts, setPosts] = useState<CinePostWithDetails[]>([]);
  const [lockedFeedPostIds, setLockedFeedPostIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [popularMovies, setPopularMovies] = useState<RailItem[]>([]);
  const [popularLoading, setPopularLoading] = useState(true);
  const [discoverLists, setDiscoverLists] = useState<DiscoverListItem[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(true);
  const [peopleModalTitle, setPeopleModalTitle] = useState("");
  const [peopleModalUsers, setPeopleModalUsers] = useState<User[]>([]);
  const [peopleModalLoading, setPeopleModalLoading] = useState(false);
  const [seenHistoryReady, setSeenHistoryReady] = useState(false);
  const [engagementPendingKeys, setEngagementPendingKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window === "undefined") {
      setSeenHistoryReady(true);
      return;
    }

    if (!currentUser?.id) {
      seenPostsRef.current = new Set();
      setSeenHistoryReady(true);
      return;
    }

    try {
      const stored = window.localStorage.getItem(`cinepost-feed-seen:${currentUser.id}`);
      const parsed = stored ? (JSON.parse(stored) as string[]) : [];
      seenPostsRef.current = new Set(parsed);
    } catch {
      seenPostsRef.current = new Set();
    } finally {
      setSeenHistoryReady(true);
    }
  }, [currentUser?.id]);

  const feedCacheKey = `feed_${currentUser?.id ?? "guest"}`;
  const FEED_TTL = 3 * 60 * 1000; // 3 minutes

  const fetchPublicFeed = async () => {
    const response = await fetch("/api/cineposts/public?limit=30", {
      cache: "no-store",
      credentials: "same-origin",
    });

    if (!response.ok) {
      throw new Error("Failed to load public feed");
    }

    const data = (await response.json()) as { posts?: CinePostWithDetails[] };
    return Array.isArray(data.posts) ? data.posts : [];
  };

  const refreshPosts = async () => {
    try {
      setLockedFeedPostIds(new Set());
      if (!currentUser?.id) {
        const publicFeed = await fetchPublicFeed();
        setPosts(publicFeed);
        lsSet(feedCacheKey, publicFeed, FEED_TTL);
        setLoading(false);
        return;
      }
      const feed = await getCinePosts(currentUser?.id, 30, {
        sort: "smart",
        feedContext: { seenPostIds: Array.from(seenPostsRef.current) },
      });
      setPosts(feed);
      lsSet(feedCacheKey, feed, FEED_TTL);
    } catch (error) {
      console.error("Error loading posts:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!seenHistoryReady) return;

    let cancelled = false;

    // Show cached feed instantly, then fetch fresh in background
    const cached = lsGet<CinePostWithDetails[]>(feedCacheKey, FEED_TTL);
    if (cached && cached.length > 0) {
      setPosts(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const loadPosts = async () => {
      try {
        setLockedFeedPostIds(new Set());
        if (!currentUser?.id) {
          const publicFeed = await fetchPublicFeed();
          if (!cancelled) {
            setPosts(publicFeed);
            lsSet(feedCacheKey, publicFeed, FEED_TTL);
          }
          return;
        }
        const feed = await getCinePosts(currentUser?.id, 30, {
          sort: "smart",
          feedContext: { seenPostIds: Array.from(seenPostsRef.current) },
        });
        if (!cancelled) {
          setPosts(feed);
          lsSet(feedCacheKey, feed, FEED_TTL);
        }
      } catch (error) {
        console.error("Error loading posts:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPosts();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, refreshKey, seenHistoryReady]);

  useEffect(() => {
    if (isHome) return;

    let cancelled = false;

    const loadDiscoveryRails = async () => {
      setPopularLoading(true);
      setDiscoverLoading(true);

      try {
        const [popular, publicListsBase] = await Promise.all([
          getPopularMovies(1, 20),
          getPublicLists(8),
        ]);

        if (cancelled) return;

        setPopularMovies(buildPopularRailItems(popular));

        const detailedLists = await Promise.all(
          publicListsBase.slice(0, 5).map(async (list) => {
            const details = await getListWithDetails(list.id);
            if (!details) return null;
            return {
              id: details.id,
              name: details.name,
              href: `/lists/${details.id}`,
              coverImage: details.cover_image_url || details.items[0]?.content?.poster_url || null,
              description: details.description,
              item_count: details.item_count,
              collaborator_count: details.collaborator_count,
              items: details.items,
            };
          })
        );

        const sortedLists = detailedLists
          .filter(Boolean)
          .sort((a, b) => buildDiscoverListScore(b as any) - buildDiscoverListScore(a as any))
          .map((list) => ({
            id: (list as any).id,
            name: (list as any).name,
            href: (list as any).href,
            coverImage: (list as any).coverImage,
            description: (list as any).description,
          }));

        setDiscoverLists(sortedLists);
      } catch (error) {
        console.error("Error loading discovery rails:", error);
      } finally {
        if (!cancelled) {
          setPopularLoading(false);
          setDiscoverLoading(false);
        }
      }
    };

    loadDiscoveryRails();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, isHome]);

  useEffect(() => {
    if (!currentUser?.id || typeof window === "undefined" || posts.length === 0) return;

    const storageKey = `cinepost-feed-seen:${currentUser.id}`;
    const persistSeenPosts = () => {
      window.localStorage.setItem(storageKey, JSON.stringify(Array.from(seenPostsRef.current)));
    };

    const observer = new IntersectionObserver(
      (entries) => {
        let changed = false;

        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < 0.6) return;

          const target = entry.target as HTMLElement;
          const postId = target.dataset.feedPostId;
          if (!postId || seenPostsRef.current.has(postId)) return;

          seenPostsRef.current.add(postId);
          changed = true;
        });

        if (changed) {
          persistSeenPosts();
        }
      },
      {
        threshold: [0.6],
        rootMargin: "0px 0px -12% 0px",
      }
    );

    const nodes = document.querySelectorAll<HTMLElement>("[data-feed-post-id]");
    nodes.forEach((node) => observer.observe(node));

    return () => observer.disconnect();
  }, [currentUser?.id, posts]);

  const handleEngagement = async (
    post: CinePostWithDetails,
    type: CinePostEngagementType,
    enabled: boolean
  ) => {
    if (!currentUser) return;
    const pendingKey = `${post.id}:${type}`;
    if (engagementPendingKeys.has(pendingKey)) return;

    const previousPosts = posts;
    const likeDelta = type === "like" ? (enabled ? 1 : -1) : 0;
    const saveDelta = type === "save" ? (enabled ? 1 : -1) : 0;

    setEngagementPendingKeys((current) => new Set(current).add(pendingKey));
    setLockedFeedPostIds((current) => new Set(current).add(post.id));
    setPosts((currentPosts) =>
      currentPosts.map((currentPost) => {
        if (currentPost.id !== post.id) return currentPost;

        return {
          ...currentPost,
          liked_by_current_user: type === "like" ? enabled : currentPost.liked_by_current_user,
          saved_by_current_user: type === "save" ? enabled : currentPost.saved_by_current_user,
          likes_count: Math.max(0, currentPost.likes_count + likeDelta),
          saves_count: Math.max(0, currentPost.saves_count + saveDelta),
          score: Math.max(0, currentPost.score + likeDelta + saveDelta * 3),
        };
      })
    );

    try {
      await setCinePostEngagement(post, currentUser, type, enabled);
    } catch (error) {
      setPosts(previousPosts);
      reportAppError({
        title: "Could not update post",
        message: "We could not update that reaction.",
        details: error instanceof Error ? error.message : null,
      });
    } finally {
      setEngagementPendingKeys((current) => {
        const next = new Set(current);
        next.delete(pendingKey);
        return next;
      });
    }
  };

  const openPeopleModal = async (
    post: CinePostWithDetails,
    type: CinePostEngagementType,
    title: string
  ) => {
    if (!currentUser?.id) return;

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

  const renderPopularSection = () => (
    <div key="popular-movies-rail" className="pt-6">
      <DiscoveryRail
        title="Popular Movies"
        items={popularMovies}
        loading={popularLoading}
        emptyLabel="Popular movies will appear here soon."
        railRef={popularRailRef}
        theme={theme}
        onLeft={() => scrollRail(popularRailRef, -1)}
        onRight={() => scrollRail(popularRailRef, 1)}
      />
    </div>
  );

  const renderDiscoverSection = () => (
    <div key="discover-lists-rail" className="pt-6">
      <DiscoverListRail
        items={discoverLists}
        loading={discoverLoading}
        emptyLabel="Public lists will appear here soon."
        railRef={discoverRailRef}
        theme={theme}
        onLeft={() => scrollRail(discoverRailRef, -1)}
        onRight={() => scrollRail(discoverRailRef, 1)}
      />
    </div>
  );

  const renderMainFeedStream = () => {
    const stream: ReactNode[] = [];
    let insertedPopular = false;
    let insertedDiscover = false;

    mainFeedPosts.forEach((post, index) => {
      stream.push(renderPostCard(post, index, false));

      if (!insertedPopular && index === 1) {
        stream.push(renderPopularSection());
        insertedPopular = true;
      }

      if (!insertedDiscover && index === 4) {
        stream.push(renderDiscoverSection());
        insertedDiscover = true;
      }
    });

    if (!insertedPopular) {
      stream.push(renderPopularSection());
    }

    if (!insertedDiscover) {
      stream.push(renderDiscoverSection());
    }

    return stream;
  };

  const priorityFriendPosts = posts.filter((post) => post.feedTier === 0);
  const mainFeedPosts = posts.filter(
    (post) =>
      post.feedTier !== 0 &&
      (post.user_id === currentUser?.id || lockedFeedPostIds.has(post.id) || !post.liked_by_current_user)
  );
  const likedPosts = posts.filter(
    (post) =>
      post.user_id !== currentUser?.id &&
      post.liked_by_current_user &&
      !lockedFeedPostIds.has(post.id) &&
      post.feedTier !== 0
  );
  const ownMainFeedPosts = mainFeedPosts.filter((post) => post.user_id === currentUser?.id);
  const allVisibleNonPriorityPostsLiked =
    posts.some((post) => post.feedTier !== 0) &&
    posts.filter((post) => post.feedTier !== 0).every((post) => post.liked_by_current_user || post.user_id === currentUser?.id);
  const chronologicalFallbackPosts = allVisibleNonPriorityPostsLiked ? sortPostsNewestFirst(likedPosts) : likedPosts;
  const chronologicalOwnPosts = allVisibleNonPriorityPostsLiked ? sortPostsNewestFirst(ownMainFeedPosts) : ownMainFeedPosts;

  const renderHomePostCard = (post: CinePostWithDetails) => {
    const contentHref = getContentHref(post);
    const postHref = `/posts/${post.id}`;
    const preview = getPreview(getCinePostDisplayBody(post));
    const postAuthorUser = currentUser && currentUser.id === post.user_id ? currentUser : post.user;
    const likePending = engagementPendingKeys.has(`${post.id}:like`);
    const savePending = engagementPendingKeys.has(`${post.id}:save`);
    const posterUrl =
      post.poster_url ||
      post.person_profile_url ||
      post.list_cover_images?.[0] ||
      post.list_items?.find((item) => Boolean(item.content.poster_url))?.content.poster_url ||
      null;
    const artwork = (
      <CinePostArtwork
        src={posterUrl}
        collageImages={post.list_cover_images}
        alt={post.content_title || post.anchor_label}
        className="h-full w-full"
        mediaClassName="transition duration-300 group-hover:scale-105"
        theme="brutalist"
      />
    );

    return (
      <article
        key={post.id}
        data-feed-post-id={post.id}
        className="grid min-h-[12.5rem] grid-cols-[8.35rem_minmax(0,1fr)] overflow-hidden border border-white/10 bg-[#080a0d] text-[#f5f0de] shadow-[0_12px_32px_rgba(0,0,0,0.18)] sm:min-h-[13.5rem] sm:grid-cols-[9rem_minmax(0,1fr)]"
      >
        {contentHref ? (
          <Link
            href={contentHref}
            className="group relative block h-full min-h-[12.5rem] overflow-hidden bg-black sm:min-h-[13.5rem]"
            title={`Open ${post.content_title || post.anchor_label}`}
          >
            {artwork}
          </Link>
        ) : (
          <div className="group relative h-full min-h-[12.5rem] overflow-hidden bg-black sm:min-h-[13.5rem]">
            {artwork}
          </div>
        )}

        <div className="flex min-w-0 flex-col px-3 pt-3 sm:px-4 sm:pt-4">
          <div className="flex min-w-0 items-start gap-2.5">
            <Link href={profileHref(postAuthorUser)} className="flex-shrink-0">
              <Avatar user={postAuthorUser} size="h-8 w-8 sm:h-9 sm:w-9" dark />
            </Link>
            <Link href={profileHref(postAuthorUser)} className="min-w-0 flex-1 pt-0.5">
              <p className="truncate text-sm font-black leading-tight text-[#f5f0de]">
                {getDisplayUserName(postAuthorUser, currentUser)}
              </p>
              <p className="mt-0.5 truncate text-[10px] leading-tight text-white/55 sm:text-xs">
                {getDisplayUserHandle(postAuthorUser, currentUser)}
              </p>
            </Link>
            <div className="flex flex-shrink-0 items-center gap-2 text-[10px] text-white/50 sm:gap-3 sm:text-xs">
              <span>{relativeTime(post.created_at)}</span>
              <CinePostOwnerMenu
                post={post}
                currentUser={currentUser}
                onDeleted={refreshPosts}
                onUpdated={refreshPosts}
                theme="brutalist"
              />
            </div>
          </div>

          <div className="mt-3 flex-1 sm:mt-4">
            <SpoilerText
              spoiler={post.contains_spoiler}
              className="whitespace-pre-wrap text-xs leading-5 text-[#f5f0de]/92 sm:text-sm sm:leading-6"
            >
              <Link href={postHref}>{preview.text}</Link>
              {preview.isTrimmed && <span className="mt-1 block text-xs font-bold text-[#ff9b4a]">Show more</span>}
            </SpoilerText>
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-white/10 py-3 pl-1 sm:mt-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={getFeedSplitActionClass(theme, post.liked_by_current_user)}>
                <button
                  type="button"
                  onClick={() => handleEngagement(post, "like", !post.liked_by_current_user)}
                  disabled={likePending}
                  className="inline-flex h-full items-center justify-center px-3 disabled:cursor-not-allowed disabled:opacity-70"
                  aria-label={post.liked_by_current_user ? "Unlike post" : "Like post"}
                >
                  <Heart
                    className={`h-[18px] w-[18px] transition-transform duration-200 group-hover/action:scale-110 ${
                      post.liked_by_current_user ? "fill-[#ff7a1a]" : ""
                    }`}
                  />
                </button>
                <div className="h-4 w-px bg-current/15" />
                <button
                  type="button"
                  onClick={() => openPeopleModal(post, "like", "Liked by")}
                  disabled={post.likes_count === 0}
                  className={getFeedCountButtonClass(theme, post.liked_by_current_user)}
                >
                  {post.likes_count}
                </button>
              </div>
              <Link
                href={postHref}
                className={getFeedActionChipClass(theme)}
              >
                <MessageCircle className="h-[18px] w-[18px] transition-transform duration-200 group-hover/chip:scale-110" />
                <span className="text-xs font-black tabular-nums text-current/80">{post.comments_count}</span>
              </Link>
            </div>
            <button
              type="button"
              onClick={() => handleEngagement(post, "save", !post.saved_by_current_user)}
              disabled={savePending}
              className={`${getFeedActionChipClass(theme, post.saved_by_current_user)} disabled:cursor-not-allowed disabled:opacity-70`}
              aria-label={post.saved_by_current_user ? "Unsave post" : "Save post"}
            >
              <Bookmark
                className={`h-[18px] w-[18px] transition-transform duration-200 group-hover/chip:scale-110 ${
                  post.saved_by_current_user ? "fill-[#ff7a1a]" : ""
                }`}
              />
            </button>
          </div>
        </div>
      </article>
    );
  };

  const renderPostCard = (post: CinePostWithDetails, index: number, withDiscoveryRails = true) => {
    const contentHref = getContentHref(post);
    const postHref = `/posts/${post.id}`;
    const preview = getPreview(getCinePostDisplayBody(post));
    const postAuthorUser = currentUser && currentUser.id === post.user_id ? currentUser : post.user;
    const isListPost = post.content_type === "list" && (post.list_items?.length || 0) > 0;
    const likePending = engagementPendingKeys.has(`${post.id}:like`);
    const savePending = engagementPendingKeys.has(`${post.id}:save`);
    const shouldIgnorePostClick = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return false;
      return Boolean(target.closest("a,button,[role='button'],input,textarea,select,label"));
    };

    return (
      <div key={post.id} className={isBrutalist ? "py-3 sm:py-4" : "space-y-4"}>
        <article
          className={`cursor-pointer ${isBrutalist ? "border border-white/10 bg-black text-[#f5f0de]" : "overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.06)]"}`}
          role="button"
          tabIndex={0}
          data-feed-post-id={post.id}
          onClick={(event) => {
            if (shouldIgnorePostClick(event.target)) return;
            router.push(postHref);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              router.push(postHref);
            }
          }}
        >
          {isListPost ? (
            <div className={isBrutalist ? "px-4 py-4 sm:px-5 sm:py-5" : "p-3 sm:p-5"}>
              <div className="min-w-0 py-1">
                <div className="flex items-start gap-3">
                  <Link href={profileHref(postAuthorUser)} className="flex-shrink-0" onClick={(event) => event.stopPropagation()}>
                    <Avatar user={postAuthorUser} size="h-11 w-11 sm:h-12 sm:w-12" dark={isBrutalist} />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                      <Link
                        href={profileHref(postAuthorUser)}
                        onClick={(event) => event.stopPropagation()}
                        className={`text-[13px] font-black leading-none sm:text-sm ${isBrutalist ? "text-[#f5f0de] hover:text-[#ffb36b]" : "text-slate-950 hover:text-[#f5f0de]"}`}
                      >
                        {getAuthorDisplayName(post, currentUser)}
                      </Link>
                      <span className={`text-[10px] sm:text-xs ${isBrutalist ? "text-white/45" : "text-slate-400"}`}>{relativeTime(post.created_at)}</span>
                    </div>
                    {getAuthorUsername(postAuthorUser) ? (
                      <p className="mt-1 text-sm text-[#ffb36b] sm:text-[1.05rem]">{getAuthorUsername(postAuthorUser)}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm sm:text-base ${isBrutalist ? "text-white/45" : "text-slate-400"}`}>{relativeTime(post.created_at)}</span>
                    <div onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                      <CinePostOwnerMenu
                        post={post}
                        currentUser={currentUser}
                        onDeleted={refreshPosts}
                        onUpdated={refreshPosts}
                        theme={theme}
                      />
                    </div>
                  </div>
                </div>

                <Link href={postHref} className="mt-2 block sm:mt-3" onClick={(event) => event.stopPropagation()}>
                  <p className={`whitespace-pre-wrap text-[13px] leading-5 sm:text-[14px] sm:leading-6 ${
                    isBrutalist ? "text-[#f5f0de]/92" : "text-slate-700"
                  }`}>
                    {preview.text}
                  </p>
                </Link>

                {preview.isTrimmed && (
                  <Link
                    href={postHref}
                    className={`mt-2 inline-flex text-base font-black sm:mt-3 ${
                      isBrutalist ? "text-[#ffb36b]" : "text-[#f5f0de]"
                    }`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    Show more
                  </Link>
                )}

                <div className="mt-4">
                  <CinePostListStrip items={post.list_items || []} theme={theme} />
                </div>
              </div>
            </div>
          ) : isBrutalist ? (
            <div className="grid grid-cols-[7.8rem_minmax(0,1fr)] sm:grid-cols-[10rem_minmax(0,1fr)]">
              {contentHref ? (
                <Link
                  href={contentHref}
                  className="group relative h-[11.7rem] overflow-hidden border-r border-white/10 bg-transparent sm:h-auto sm:min-h-[15rem]"
                  title={`Open ${post.content_title || post.anchor_label}`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <CinePostArtwork
                    src={post.poster_url}
                    collageImages={post.list_cover_images}
                    alt={post.content_title || post.anchor_label}
                    className="h-full w-full"
                    mediaClassName="transition duration-300 group-hover:scale-[1.02]"
                    fit="contain"
                    theme={theme}
                  />
                </Link>
              ) : (
                <div className="h-[11.7rem] overflow-hidden border-r border-white/10 bg-transparent sm:h-auto sm:min-h-[15rem]">
                  <CinePostArtwork
                    src={post.poster_url}
                    collageImages={post.list_cover_images}
                    alt={post.content_title || post.anchor_label}
                    className="h-full w-full"
                    mediaClassName="transition duration-300 group-hover:scale-[1.02]"
                    fit="contain"
                    theme={theme}
                  />
                </div>
              )}

              <div className="flex h-[11.7rem] flex-col px-2.5 py-2 sm:h-auto sm:min-h-[15rem] sm:px-4 sm:py-3.5">
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <Link href={profileHref(postAuthorUser)} className="flex-shrink-0" onClick={(event) => event.stopPropagation()}>
                    <Avatar user={postAuthorUser} size="h-8 w-8 sm:h-9 sm:w-9" dark />
                  </Link>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <Link
                      href={profileHref(postAuthorUser)}
                      onClick={(event) => event.stopPropagation()}
                      className="block truncate text-[0.96rem] font-black leading-[1.02] text-[#f5f0de] hover:text-[#ffb36b] sm:text-[1.12rem]"
                    >
                      {getAuthorDisplayName(post, currentUser)}
                    </Link>
                    {getAuthorUsername(postAuthorUser) ? (
                        <p className="mt-0.5 truncate text-[0.76rem] font-medium leading-none text-[#ffb36b] sm:text-[0.9rem]">{getAuthorUsername(postAuthorUser)}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className="text-[0.72rem] text-white/45 sm:text-[0.92rem]">{relativeTime(post.created_at)}</span>
                    <div onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                      <CinePostOwnerMenu
                        post={post}
                        currentUser={currentUser}
                        onDeleted={refreshPosts}
                        onUpdated={refreshPosts}
                        theme={theme}
                      />
                    </div>
                  </div>
                </div>

                <Link href={postHref} className="mt-1.5 block sm:mt-4" onClick={(event) => event.stopPropagation()}>
                  <p className="line-clamp-3 text-[0.78rem] leading-[1.25rem] text-[#f5f0de]/90 sm:line-clamp-none sm:whitespace-pre-wrap sm:text-[1rem] sm:leading-8">
                    {preview.text}
                  </p>
                </Link>

                {preview.isTrimmed && (
                  <Link
                    href={postHref}
                    className="mt-0.5 inline-flex text-[0.76rem] font-black text-[#ffb36b] sm:text-[0.95rem]"
                    onClick={(event) => event.stopPropagation()}
                  >
                    Show more
                  </Link>
                )}

                <div className="mt-auto border-t border-white/10 pt-1.5 sm:pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => handleEngagement(post, "like", !post.liked_by_current_user)}
                        onMouseDown={(event) => event.stopPropagation()}
                        className={`inline-flex items-center text-[0.72rem] font-black transition sm:text-[0.88rem] ${
                          post.liked_by_current_user ? "text-[#ff7a1a]" : "text-white/60 hover:text-[#ffb36b]"
                        }`}
                        aria-label={post.liked_by_current_user ? "Unlike post" : "Like post"}
                      >
                        <Heart className={`h-3.25 w-3.25 sm:h-4 sm:w-4 ${post.liked_by_current_user ? "fill-[#ff7a1a]" : ""}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => openPeopleModal(post, "like", "Liked by")}
                        onMouseDown={(event) => event.stopPropagation()}
                        disabled={post.likes_count === 0}
                        className="px-1.5 py-1 text-[0.72rem] font-black text-[#ffb36b] transition hover:text-[#ffd2a7] disabled:text-white/30 disabled:opacity-50 sm:text-[0.88rem]"
                        aria-label="View likes"
                      >
                        {post.likes_count}
                      </button>
                      <Link
                        href={postHref}
                        onClick={(event) => event.stopPropagation()}
                        className="inline-flex items-center gap-1 text-[0.72rem] font-black text-white/60 transition hover:text-[#ffb36b] sm:text-[0.88rem]"
                      >
                        <MessageCircle className="h-3.25 w-3.25 sm:h-4 sm:w-4" />
                        <span>{post.comments_count}</span>
                      </Link>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEngagement(post, "save", !post.saved_by_current_user)}
                      onMouseDown={(event) => event.stopPropagation()}
                      className={`inline-flex items-center justify-center text-white/60 transition ${
                        post.saved_by_current_user ? "text-[#ff7a1a]" : "hover:text-[#ffb36b]"
                      }`}
                      aria-label={post.saved_by_current_user ? "Unsave post" : "Save post"}
                    >
                      <Bookmark className={`h-3.5 w-3.5 sm:h-4.5 sm:w-4.5 ${post.saved_by_current_user ? "fill-[#ff7a1a]" : ""}`} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div className="grid grid-cols-[5.75rem_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[8rem_minmax(0,1fr)] sm:gap-5 sm:p-5">
                {contentHref ? (
                  <Link
                    href={contentHref}
                    className="group relative aspect-[2/3] overflow-hidden rounded-[1.4rem] bg-slate-950 shadow-sm"
                    title={`Open ${post.content_title || post.anchor_label}`}
                    onClick={(event) => event.stopPropagation()}
                  >
                    <CinePostArtwork
                      src={post.poster_url}
                      collageImages={post.list_cover_images}
                      alt={post.content_title || post.anchor_label}
                      className="h-full w-full"
                      mediaClassName="transition duration-300 group-hover:scale-105"
                      theme={theme}
                    />
                  </Link>
                ) : (
                  <div className="aspect-[2/3] overflow-hidden rounded-[1.4rem] bg-slate-950 shadow-sm">
                    <CinePostArtwork
                      src={post.poster_url}
                      collageImages={post.list_cover_images}
                      alt={post.content_title || post.anchor_label}
                      className="h-full w-full"
                      mediaClassName="transition duration-300 group-hover:scale-105"
                      theme={theme}
                    />
                  </div>
                )}

                <div className="min-w-0 py-1">
                  <div className="flex items-start gap-3">
                    <Link href={profileHref(postAuthorUser)} className="flex-shrink-0" onClick={(event) => event.stopPropagation()}>
                      <Avatar user={postAuthorUser} size="h-7 w-7 sm:h-8 sm:w-8" dark={isBrutalist} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        <Link
                          href={profileHref(postAuthorUser)}
                          onClick={(event) => event.stopPropagation()}
                          className={`text-[13px] font-black leading-none sm:text-sm ${isBrutalist ? "text-[#f5f0de] hover:text-[#ffb36b]" : "text-slate-950 hover:text-[#f5f0de]"}`}
                        >
                          {getAuthorDisplayName(post, currentUser)}
                        </Link>
                        <span className={`text-[10px] sm:text-xs ${isBrutalist ? "text-white/45" : "text-slate-400"}`}>{relativeTime(post.created_at)}</span>
                      </div>
                      {getAuthorUsername(postAuthorUser) ? (
                        <p className="mt-1 text-xs text-slate-400">{getAuthorUsername(postAuthorUser)}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-[10px] text-slate-400 sm:text-xs">{relativeTime(post.created_at)}</span>
                      <div onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()}>
                        <CinePostOwnerMenu
                          post={post}
                          currentUser={currentUser}
                          onDeleted={refreshPosts}
                          onUpdated={refreshPosts}
                          theme={theme}
                        />
                      </div>
                    </div>
                  </div>

                  <Link href={postHref} className="mt-2 block sm:mt-3" onClick={(event) => event.stopPropagation()}>
                    <p className={`whitespace-pre-wrap text-[13px] leading-5 sm:text-[14px] sm:leading-6 ${
                      isBrutalist ? "text-[#f5f0de]/92" : "text-slate-700"
                    }`}>
                      {preview.text}
                    </p>
                  </Link>

                  {preview.isTrimmed && (
                    <Link
                      href={postHref}
                      className="mt-3 inline-flex text-[11px] font-black text-[#f5f0de] sm:mt-2 sm:text-sm"
                      onClick={(event) => event.stopPropagation()}
                    >
                      Show more
                    </Link>
                  )}
                </div>
              </div>

          <div className={`py-3 sm:py-4 ${isBrutalist ? "border-t border-white/10" : "border-t border-slate-100 px-3 sm:px-5"}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleEngagement(post, "like", !post.liked_by_current_user)}
                  onMouseDown={(event) => event.stopPropagation()}
                  className={`inline-flex items-center justify-center transition ${
                    post.liked_by_current_user
                      ? isBrutalist
                        ? "text-[#ff7a1a]"
                        : "bg-rose-50 text-rose-600"
                      : isBrutalist
                      ? "text-white/65 hover:text-[#ffb36b]"
                      : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                  aria-label={post.liked_by_current_user ? "Unlike post" : "Like post"}
                >
                  <Heart className={`h-5 w-5 ${post.liked_by_current_user ? (isBrutalist ? "fill-[#ff7a1a]" : "fill-rose-500") : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={() => openPeopleModal(post, "like", "Liked by")}
                  onMouseDown={(event) => event.stopPropagation()}
                  disabled={post.likes_count === 0}
                  className={`px-1 py-2 text-sm font-black disabled:opacity-40 ${
                    isBrutalist ? "text-[#ffb36b]" : "text-rose-600 disabled:text-slate-400"
                  }`}
                >
                  {post.likes_count}
                </button>
                <Link
                  href={postHref}
                  onClick={(event) => event.stopPropagation()}
                  className={`inline-flex items-center justify-center gap-1.5 transition ${
                    isBrutalist ? "text-white/65 hover:text-[#ffb36b]" : "rounded-2xl bg-slate-50 px-2.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 sm:px-3 sm:text-sm"
                  }`}
                >
                  <MessageCircle className="h-5 w-5" />
                  {post.comments_count}
                </Link>
              </div>
              <button
                type="button"
                onClick={() => handleEngagement(post, "save", !post.saved_by_current_user)}
                onMouseDown={(event) => event.stopPropagation()}
                className={`inline-flex items-center justify-center transition ${
                  post.saved_by_current_user
                    ? isBrutalist
                      ? "text-[#ff7a1a]"
                      : "bg-blue-50 text-[#f5f0de]"
                    : isBrutalist
                    ? "text-white/65 hover:text-[#ffb36b]"
                    : "bg-slate-50 text-slate-600 hover:bg-slate-100"
                  }`}
                aria-label={post.saved_by_current_user ? "Unsave post" : "Save post"}
              >
                <Bookmark className={`h-5 w-5 ${post.saved_by_current_user ? (isBrutalist ? "fill-[#ff7a1a]" : "fill-blue-500") : ""}`} />
              </button>
            </div>
          </div>
            </div>
          )}
        </article>

        {withDiscoveryRails && index === 1 && renderPopularSection()}
        {withDiscoveryRails && index === 4 && renderDiscoverSection()}
      </div>
    );
  };

  if (isHome) {
    return (
      <>
        {loading ? (
          <div className="space-y-5">
            {[0, 1, 2].map((item) => (
              <div key={item} className="h-64 animate-pulse rounded-[1.2rem] border border-white/10 bg-white/[0.04]" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-[1.2rem] border border-dashed border-white/15 bg-white/[0.03] p-8 text-center">
            <Sparkles className="mx-auto mb-3 h-8 w-8 text-[#ff7a1a]" />
            <p className="font-bold text-[#f5f0de]">No CinePosts yet</p>
            <p className="mt-1 text-sm text-white/50">Create the first post and it will appear here.</p>
          </div>
        ) : (
          <div className="space-y-5">{posts.map(renderHomePostCard)}</div>
        )}

        {peopleModalTitle && (
          <PeopleModal
            title={peopleModalTitle}
            users={peopleModalUsers}
            loading={peopleModalLoading}
            theme={theme}
            onClose={() => {
              setPeopleModalTitle("");
              setPeopleModalUsers([]);
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {priorityFriendPosts.length > 0 && !loading && (
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className={`text-[11px] uppercase tracking-[0.3em] ${isBrutalist ? "text-white/45" : "text-slate-400"}`}>
                  Friends First
                </h2>
                <p className={`mt-1 text-sm ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>
                  Unseen friend posts from the last 48 hours stay pinned up top.
                </p>
              </div>
            </div>
            <div className={isBrutalist ? "divide-y divide-white/10" : "space-y-4"}>
              {priorityFriendPosts.slice(0, 3).map((post) => renderPostCard(post, 0, false))}
            </div>
          </section>
        )}

        {(loading || mainFeedPosts.length === 0) && (
          <div className="space-y-6">
            <div className="space-y-6">
              <DiscoveryRail
                title="Popular Movies"
                items={popularMovies}
                loading={popularLoading}
                emptyLabel="Popular movies will appear here soon."
                railRef={popularRailRef}
                theme={theme}
                onLeft={() => scrollRail(popularRailRef, -1)}
                onRight={() => scrollRail(popularRailRef, 1)}
              />
              <DiscoverListRail
                items={discoverLists}
                loading={discoverLoading}
                emptyLabel="Public lists will appear here soon."
                railRef={discoverRailRef}
                theme={theme}
                onLeft={() => scrollRail(discoverRailRef, -1)}
                onRight={() => scrollRail(discoverRailRef, 1)}
              />
            </div>
          </div>
        )}

        {loading ? (
          <div className={isBrutalist ? "divide-y divide-white/10" : "grid gap-3"}>
            {[0, 1].map((item) => (
              <div key={item} className={`h-48 animate-pulse ${isBrutalist ? "bg-white/5" : "rounded-[1.75rem] bg-slate-100"}`} />
            ))}
          </div>
        ) : allVisibleNonPriorityPostsLiked && chronologicalFallbackPosts.length > 0 ? (
          <div className={isBrutalist ? "divide-y divide-white/10" : "space-y-4"}>
            {chronologicalFallbackPosts.map((post, index) => renderPostCard(post, index, false))}
          </div>
        ) : mainFeedPosts.length === 0 ? (
          <div className={`p-6 text-center ${isBrutalist ? "bg-black" : "rounded-[1.75rem] border border-dashed border-slate-300 bg-white"}`}>
            <Sparkles className={`mx-auto mb-3 h-8 w-8 ${isBrutalist ? "text-[#ff7a1a]" : "text-slate-300"}`} />
            <p className={`font-bold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>No posts here yet</p>
            <p className={`mt-1 text-sm ${isBrutalist ? "text-white/55" : "text-slate-500"}`}>Try another filter or create the first one.</p>
          </div>
        ) : (
          <div className={isBrutalist ? "divide-y divide-white/10" : "space-y-4"}>
            {renderMainFeedStream()}
          </div>
        )}

        {allVisibleNonPriorityPostsLiked && chronologicalOwnPosts.length > 0 ? (
          <section className="space-y-3 pt-2">
            <div>
              <h2 className={`text-[11px] uppercase tracking-[0.3em] ${isBrutalist ? "text-white/45" : "text-slate-400"}`}>
                Your Posts
              </h2>
            </div>
            <div className={isBrutalist ? "divide-y divide-white/10" : "space-y-4"}>
              {chronologicalOwnPosts.map((post, index) => renderPostCard(post, index, false))}
            </div>
          </section>
        ) : null}

        {!allVisibleNonPriorityPostsLiked && likedPosts.length > 0 && (
          <section className="space-y-3 pt-2">
            <div>
              <h2 className={`text-[11px] uppercase tracking-[0.3em] ${isBrutalist ? "text-white/45" : "text-slate-400"}`}>
                Liked Posts
              </h2>
            </div>
            <div className={isBrutalist ? "divide-y divide-white/10" : "space-y-4"}>
              {likedPosts.map((post) => renderPostCard(post, 0, false))}
            </div>
          </section>
        )}
      </div>

      {peopleModalTitle && (
        <PeopleModal
          title={peopleModalTitle}
          users={peopleModalUsers}
          loading={peopleModalLoading}
          theme={theme}
          onClose={() => {
            setPeopleModalTitle("");
            setPeopleModalUsers([]);
          }}
        />
      )}
    </>
  );
}
