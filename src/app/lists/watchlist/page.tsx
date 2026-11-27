"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { ArrowLeft, Bookmark, Film, Trash2 } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import RouteLoadingSkeleton from "@/components/RouteLoadingSkeleton";
import { auth, db } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import { getUserWatchlist, removeFromWatchlist } from "@/lib/logs";
import { getBlurDataUrl, getTmdbPosterUrl } from "@/lib/performance";
import type { MovieLogWithContent, User } from "@/types";

function releaseLabel(log: MovieLogWithContent): string | null {
  const date = log.release_date_snapshot || log.content?.release_date;
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date <= new Date().toISOString().slice(0, 10)) return null;
  return new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${date}T12:00:00Z`));
}

export default function WatchlistPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<MovieLogWithContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.replace("/auth/login?redirect=/lists/watchlist");
        return;
      }

      try {
        const [snapshot, watchlist] = await Promise.all([
          get(ref(db, `users/${firebaseUser.uid}`)),
          getUserWatchlist(firebaseUser.uid),
        ]);
        if (cancelled) return;
        const data = snapshot.val();
        setUser({
          id: firebaseUser.uid,
          username: data?.username || "user",
          name: data?.name || firebaseUser.displayName || "User",
          avatar_url: data?.avatar_url || null,
          created_at: data?.created_at || data?.createdAt || new Date().toISOString(),
        });
        setItems(watchlist);
      } catch (error) {
        console.error("Could not load watchlist:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [router]);

  const handleRemove = async (log: MovieLogWithContent) => {
    setRemovingId(log.id);
    try {
      await removeFromWatchlist(log);
      setItems((current) => current.filter((item) => item.id !== log.id));
    } catch (error) {
      console.error("Could not remove watchlist title:", error);
    } finally {
      setRemovingId(null);
    }
  };

  if (loading || !user) return <RouteLoadingSkeleton title="Watchlist" description="Loading your saved titles" />;

  return <PageLayout user={user} onSignOut={async () => {
    await authSignOut();
    router.push("/auth/login");
  }} theme="brutalist">
    <main className="mx-auto w-full max-w-5xl px-4 py-7 text-[#f5f0de] sm:px-6">
      <Link href="/lists" className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> Your Lists</Link>
      <div className="mt-7 flex items-end justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#ff9b52]">Saved to watch</p>
          <h1 className="mt-2 text-4xl font-black tracking-tight sm:text-5xl">Watchlist</h1>
          <p className="mt-2 text-sm text-white/50">{items.length} {items.length === 1 ? "title" : "titles"}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <div className="mt-12 border border-white/10 bg-[#141414] px-5 py-14 text-center">
          <Bookmark className="mx-auto h-7 w-7 text-[#ff9b52]" />
          <h2 className="mt-4 text-xl font-black">Your watchlist is empty</h2>
          <p className="mt-2 text-sm text-white/50">Save a movie from its page, or track an upcoming release.</p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((log) => {
            const title = log.title_snapshot || log.content?.title || "Untitled";
            const poster = getTmdbPosterUrl(log.poster_url_snapshot || log.content?.poster_url, "w342");
            const releaseDate = releaseLabel(log);
            return <article key={log.id} className="group relative min-w-0 border border-white/10 bg-[#141414]">
              <Link href={log.content_type === "tv" ? `/tv/${log.content_id}` : `/movie/${log.content_id}`} className="block">
                <div className="relative aspect-[2/3] bg-[#202020]">
                  {poster ? <Image src={poster} alt="" fill sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw" className="object-cover" placeholder="blur" blurDataURL={getBlurDataUrl()} /> : <Film className="absolute inset-0 m-auto h-8 w-8 text-white/25" />}
                </div>
                <div className="p-3">
                  <h2 className="line-clamp-2 min-h-10 text-sm font-black leading-5">{title}</h2>
                  {releaseDate ? <p className="mt-1 text-xs text-[#ff9b52]">Release {releaseDate}</p> : <p className="mt-1 text-xs text-white/40">Saved to watch</p>}
                </div>
              </Link>
              <button type="button" onClick={() => void handleRemove(log)} disabled={removingId === log.id} aria-label={`Remove ${title} from watchlist`} className="absolute right-2 top-2 border border-white/20 bg-black/80 p-2 text-white/80 transition hover:text-white disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>
            </article>;
          })}
        </div>
      )}
    </main>
  </PageLayout>;
}
