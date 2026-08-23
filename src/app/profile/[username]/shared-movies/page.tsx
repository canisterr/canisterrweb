"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, onValue, ref, remove } from "firebase/database";
import { ArrowLeft, Search } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { isPermissionDeniedError } from "@/lib/firebase-errors";
import { getUserByUsername } from "@/lib/profile";
import { getUsersByIds } from "@/lib/users";
import type { Content, ShareWithDetails, User } from "@/types";
import { canShowSharedMovies, isUsernameBlocked, mergeSettings } from "@/lib/settings";

type Filter = "all" | "movie" | "tv";
type Item = { key: string; shareId: string; content: Content; title: string; type: "movie" | "tv"; sharedBy: string; note?: string | null; watched?: boolean };

export default function SharedMoviesPage() {
  const router = useRouter();
  const params = useParams();
  const username = params.username as string;

  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [shares, setShares] = useState<ShareWithDetails[]>([]);
  const [canAccessPage, setCanAccessPage] = useState(true);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [removingShareId, setRemovingShareId] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribeShares: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) return window.location.assign("/auth/login");
      try {
        const currentUserSnapshot = await get(ref(db, `users/${firebaseUser.uid}`));
        if (!currentUserSnapshot.exists()) return window.location.assign("/profile/edit");

        const currentUserData = currentUserSnapshot.val();
        const currentSettings = mergeSettings(currentUserData?.settings);
        const me: User = {
          id: currentUserData?.id || firebaseUser.uid,
          username: currentUserData?.username || "user",
          name: currentUserData?.name || firebaseUser.displayName || "User",
          email: currentUserData?.email || firebaseUser.email || undefined,
          avatar_url: currentUserData?.avatar_url || null,
          created_at: currentUserData?.createdAt || new Date().toISOString(),
          bio: currentUserData?.bio || "",
        };

        const viewed = await getUserByUsername(username);
        if (!viewed) return window.location.assign("/dashboard");

        const viewedUserSnapshot = await get(ref(db, `users/${viewed.id}`));
        const viewedRaw = viewedUserSnapshot.val() || viewed;
        const viewedSettings = mergeSettings((viewedRaw as any)?.settings);

        const followsSnapshot = await get(ref(db, "follows"));
        const followsData = followsSnapshot.val() || {};
        const isFollowingViewed = Object.values(followsData).some(
          (follow: any) =>
            follow?.follower_id === me.id &&
            follow?.following_id === viewed.id &&
            follow?.status === "accepted"
        );

        const blockedByProfile = isUsernameBlocked(viewedSettings, me.username);
        const blockingProfile = isUsernameBlocked(currentSettings, viewed.username);
        const canViewShared = canShowSharedMovies(viewedSettings, false, isFollowingViewed);

        setCurrentUser(me);
        setProfileUser(viewed);

        if (blockedByProfile || blockingProfile || !canViewShared) {
          setCanAccessPage(false);
          setShares([]);
          setLoading(false);
          return;
        }

        setCanAccessPage(true);

        unsubscribeShares = onValue(
          ref(db, "shares"),
          async (snapshot) => {
            if (!snapshot.exists()) {
              setShares([]);
              return;
            }

            const allShares = snapshot.val();
            const relevant = Object.entries(allShares)
              .map(([id, data]: any) => ({ id, ...data }))
              .filter((share: any) =>
                (share.sender_id === me.id && share.receiver_id === viewed.id) ||
                (share.sender_id === viewed.id && share.receiver_id === me.id)
              );

            const usersById = await getUsersByIds(Array.from(new Set(relevant.flatMap((share: any) => [share.sender_id, share.receiver_id]))));
            const mapped = relevant
              .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
              .map((share: any) => ({
                ...share,
                movie: share.movie || null,
                content: share.content || share.movie || null,
                sender: usersById[share.sender_id],
                receiver: usersById[share.receiver_id],
              })) as ShareWithDetails[];

            setShares(mapped);
          },
          (error) => {
            if (isPermissionDeniedError(error)) {
              console.warn("Shared movies listener is unavailable with the current Firebase permissions.");
              setShares([]);
              setLoading(false);
              return;
            }

            console.error("Shared movies listener failed:", error);
            setShares([]);
            setLoading(false);
          }
        );

        setLoading(false);
      } catch (error) {
        console.error("Error loading shared movies page:", error);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeShares?.();
      unsubscribe();
    };
  }, [username]);

  const makeItem = useCallback((share: ShareWithDetails, direction: "byYou" | "byThem"): Item | null => {
    const content = (share.content || share.movie) as Content | null;
    if (!content) return null;
    return {
      key: `${direction}-${share.id}`,
      shareId: share.id,
      content,
      title: (content as any).title || (content as any).name || "Untitled",
      type: (share.content_type || (content as any).type || "movie") as "movie" | "tv",
      sharedBy: direction === "byYou" ? currentUser?.name || "You" : profileUser?.name || "Them",
      note: share.note || null,
      watched: share.watched,
    };
  }, [currentUser?.name, profileUser?.name]);

  const sections = useMemo(() => {
    const byYou = shares.map((s) => (s.sender_id === currentUser?.id && s.receiver_id === profileUser?.id ? makeItem(s, "byYou") : null)).filter(Boolean) as Item[];
    const byThem = shares.map((s) => (s.sender_id === profileUser?.id && s.receiver_id === currentUser?.id ? makeItem(s, "byThem") : null)).filter(Boolean) as Item[];

    const q = query.trim().toLowerCase();
    const matches = (item: Item) => {
      if (filter !== "all" && item.type !== filter) return false;
      if (!q) return true;
      return item.title.toLowerCase().includes(q) || item.sharedBy.toLowerCase().includes(q);
    };

    return {
      byYou: byYou.filter(matches),
      byThem: byThem.filter(matches),
    };
  }, [shares, currentUser?.id, profileUser?.id, query, filter, makeItem]);

  const handleRemoveShared = async (shareId: string) => {
    try {
      setRemovingShareId(shareId);
      await remove(ref(db, `shares/${shareId}`));
    } catch (error) {
      console.error("Error removing shared item:", error);
    } finally {
      setRemovingShareId(null);
    }
  };

  const SharedRail = ({
    title,
    items,
    allowRemove,
  }: {
    title: string;
    items: Item[];
    allowRemove?: boolean;
  }) => (
    <section className="space-y-5 border-t border-white/8 pt-8 first:border-t-0 first:pt-0">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-[#f5f0de] sm:text-[2rem]">{title}</h2>
        </div>
        <p className="text-sm font-bold text-[#ffb36b]">{items.length}</p>
      </div>

      {items.length === 0 ? (
        <p className="py-6 text-sm text-[#f5f0de]/45">No shared titles here yet.</p>
      ) : (
        <div className="scrollbar-hide -mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-2">
          {items.filter((item) => Boolean(item.content)).map((item) => (
            <article
              key={item.key}
              className="group shrink-0 snap-start basis-[44%] sm:basis-[30%] md:basis-[24%] lg:basis-[19%] xl:basis-[18%]"
            >
              <Link href={item.type === "movie" ? `/movie/${item.content.id}` : `/tv/${item.content.id}`} className="block">
                <div className="relative overflow-hidden rounded-[1.4rem] bg-[#111111] transition duration-300 group-hover:-translate-y-1">
                  <div className="relative aspect-[2/3] w-full">
                    {item.content.poster_url ? (
                      <img src={item.content.poster_url} alt={item.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-[#111111] text-sm text-[#f5f0de]/45">No poster</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/88 via-black/18 to-transparent" />
                    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                      <span className="text-[10px] font-black uppercase tracking-[0.18em] text-white/88">
                        {item.type === "movie" ? "Movie" : "TV"}
                      </span>
                      {item.watched && (
                        <span className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ffb36b]">
                          Watched
                        </span>
                      )}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="line-clamp-2 text-sm font-black leading-5 text-[#f5f0de]">{item.title}</p>
                    </div>
                  </div>
                </div>
              </Link>

              <div className="mt-3 space-y-1 px-1">
                <p className="text-[11px] uppercase tracking-[0.16em] text-[#ffb36b]">Shared by {item.sharedBy}</p>
                {item.note && <p className="line-clamp-2 text-xs leading-5 text-[#f5f0de]/65">{item.note}</p>}
                {allowRemove && (
                  <button
                    onClick={() => handleRemoveShared(item.shareId)}
                    disabled={removingShareId === item.shareId}
                    className="inline-flex text-xs font-bold text-[#ffb36b] transition hover:text-[#ff7a1a] disabled:opacity-50"
                  >
                    {removingShareId === item.shareId ? "Removing..." : "Remove"}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );

  if (loading || !currentUser || !profileUser) {
    return null;
  }

  if (!canAccessPage) {
    return (
      <div className="brutalist min-h-screen bg-[#0a0a0a] text-[#f5f0de]">
        <div className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-10 sm:px-6 lg:px-8">
          <section className="w-full text-center sm:p-8">
            <h1 className="mt-3 text-3xl font-black text-[#f5f0de] sm:text-4xl">
              This shared-movies view is not available.
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#f5f0de]/60 sm:text-base">
              The profile owner has hidden shared movies, or one of you has blocked the other.
            </p>
            <button
              onClick={() => router.push(`/profile/${profileUser.username}`)}
              className="mt-6 text-sm font-black text-[#ffb36b] transition hover:text-[#ff7a1a]"
            >
              Back to profile
            </button>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="brutalist min-h-screen bg-[#0a0a0a] text-[#f5f0de]">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-10 space-y-6">
          <div className="space-y-5">
            <button
              onClick={() => router.push(`/profile/${profileUser.username}`)}
              className="inline-flex items-center gap-2 text-sm font-bold text-[#f5f0de]/82 transition hover:text-[#ffb36b]"
            >
              <ArrowLeft className="h-4 w-4" /> Back to Profile
            </button>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-3xl font-black tracking-tight text-[#f5f0de] sm:text-5xl">
                Shared titles between {currentUser.name} and {profileUser.name}
              </h1>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
              <p className="text-[#f5f0de]/58">
                Shared by you: <span className="font-black text-[#f5f0de]">{sections.byYou.length}</span>
              </p>
              <p className="text-[#f5f0de]/58">
                Shared by them: <span className="font-black text-[#f5f0de]">{sections.byThem.length}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="mb-10 flex flex-col gap-5 border-t border-white/8 pt-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search shared titles or names..."
              className="w-full border-b border-white/12 bg-transparent py-3 pl-10 pr-4 text-sm text-[#f5f0de] outline-none placeholder:text-white/35 focus:border-[#ff7a1a]/45"
            />
          </div>

          <div className="flex flex-wrap gap-5">
            {(["all", "movie", "tv"] as Filter[]).map((item) => (
              <button
                key={item}
                onClick={() => setFilter(item)}
                className={`border-b pb-1 text-sm font-bold transition ${
                  filter === item
                    ? "border-[#ff7a1a] text-[#ffb36b]"
                    : "border-transparent text-[#f5f0de]/52 hover:text-[#f5f0de]"
                }`}
              >
                {item === "all" ? "All" : item === "movie" ? "Movies" : "TV Shows"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-12">
          <SharedRail title="Shared by you" items={sections.byYou} allowRemove />
          <SharedRail title="Shared by them" items={sections.byThem} />
        </div>
      </div>
    </div>
  );
}
