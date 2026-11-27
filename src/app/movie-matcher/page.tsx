"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Film } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import { signOut as authSignOut } from "@/lib/auth";
import { getFriendLeaderboard, getFullTasteProfile, type LeaderboardEntry } from "@/lib/friends-match";
import { generateMatchAnalysis, type MatchAnalysis } from "@/lib/match-score";
import type { UserTasteWithContent } from "@/types";

const SCORE_PARTS: Array<{ key: keyof Pick<MatchAnalysis, "genreSim" | "keywordSim" | "creatorSim" | "ratingSim" | "vibeSim" | "studioSim" | "eraSim" | "languageSim">; label: string }> = [
  { key: "genreSim", label: "Genres" },
  { key: "keywordSim", label: "Story themes" },
  { key: "creatorSim", label: "Creators" },
  { key: "ratingSim", label: "Ratings" },
  { key: "vibeSim", label: "Viewing vibe" },
  { key: "studioSim", label: "Studios" },
  { key: "eraSim", label: "Release eras" },
  { key: "languageSim", label: "Languages" },
];

export default function MovieMatcherPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useCurrentUser();
  const [matches, setMatches] = useState<LeaderboardEntry[]>([]);
  const [selected, setSelected] = useState<LeaderboardEntry | null>(null);
  const [analysis, setAnalysis] = useState<MatchAnalysis | null>(null);
  const [search, setSearch] = useState("");
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [comparing, setComparing] = useState(false);
  const [error, setError] = useState("");
  const tasteCache = useRef(new Map<string, Promise<UserTasteWithContent[]>>());
  const compareRequestId = useRef(0);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      router.replace("/auth/login?redirect=/movie-matcher");
      return;
    }

    let cancelled = false;
    setLoadingMatches(true);
    getFriendLeaderboard(user.id)
      .then((entries) => {
        if (!cancelled) setMatches(entries);
      })
      .catch(() => {
        if (!cancelled) setError("Couldn’t load match profiles. Try again in a moment.");
      })
      .finally(() => {
        if (!cancelled) setLoadingMatches(false);
      });
    return () => { cancelled = true; };
  }, [router, sessionLoading, user]);

  const visibleMatches = useMemo(() => {
    const query = search.trim().toLowerCase();
    return matches.filter((match) => !query || match.name.toLowerCase().includes(query) || match.username.toLowerCase().includes(query));
  }, [matches, search]);

  const selectMatch = async (match: LeaderboardEntry) => {
    if (!user) return;
    const requestId = ++compareRequestId.current;
    setSelected(match);
    setAnalysis(null);
    setError("");
    setComparing(true);

    const loadTaste = (userId: string) => {
      let request = tasteCache.current.get(userId);
      if (!request) {
        request = getFullTasteProfile(userId);
        tasteCache.current.set(userId, request);
        request.catch(() => tasteCache.current.delete(userId));
      }
      return request;
    };

    try {
      const [myTastes, theirTastes] = await Promise.all([
        loadTaste(user.id),
        loadTaste(match.userId),
      ]);
      if (compareRequestId.current !== requestId) return;
      if (myTastes.length === 0 || theirTastes.length === 0) {
        setError("Both profiles need taste picks before they can be compared.");
        return;
      }
      const report = await generateMatchAnalysis(myTastes, theirTastes, user.id, match.userId);
      if (compareRequestId.current === requestId) setAnalysis(report);
    } catch {
      if (compareRequestId.current === requestId) setError("Couldn’t build this match right now. Please try again.");
    } finally {
      if (compareRequestId.current === requestId) setComparing(false);
    }
  };

  const handleSignOut = async () => {
    await authSignOut();
    router.push("/auth/login");
  };

  if (sessionLoading || !user) return null;

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <main className="mx-auto w-full max-w-6xl px-4 pb-10 pt-4 text-[#f4ead4] sm:px-6 lg:pt-6">
        <header className="mb-6">
          <h1 className="font-serif text-4xl font-bold tracking-tight text-[#f4ead4] sm:text-5xl">Movie Matcher</h1>
        </header>

        {error && !selected && <p role="alert" className="mb-4 text-sm text-[#ff7a18]">{error}</p>}

        <div className="grid gap-8 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.8fr)] lg:gap-12">
          <section className="lg:border-r lg:border-[#493323] lg:pr-8" aria-labelledby="match-people-heading">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 id="match-people-heading" className="font-serif text-xl font-semibold text-[#f4ead4]">Compare with someone</h2>
              </div>
              <Link href="/taste" className="text-xs font-semibold text-[#ff7a18] underline-offset-4 hover:underline">Your taste</Link>
            </div>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search people"
              aria-label="Search match profiles"
              className="mb-4 w-full border-0 border-b border-[#68452e] bg-transparent px-0 py-2.5 text-base text-[#f4ead4] outline-none placeholder:text-[#b6aa96] focus:border-[#ff7a18]"
            />
            {loadingMatches ? (
              <p className="py-4 text-sm text-[#c2b9a9]">Loading…</p>
            ) : matches.length === 0 ? (
              <div className="py-4 text-sm leading-relaxed text-[#c2b9a9]">
                <p>No complete match profiles yet.</p>
                <p className="mt-1">Add at least 7 titles to <Link href="/taste" className="font-semibold text-[#ff7a18] hover:underline">Your Taste</Link> to get started.</p>
              </div>
            ) : visibleMatches.length === 0 ? (
              <p className="py-4 text-sm text-[#c2b9a9]">No profiles match that search.</p>
            ) : (
              <div className="max-h-[34rem] overflow-y-auto">
                {visibleMatches.map((match) => (
                  <button
                    key={match.userId}
                    type="button"
                    onClick={() => void selectMatch(match)}
                    className={`flex w-full items-center gap-3 border-b border-[#493323] px-1 py-3 text-left transition ${selected?.userId === match.userId ? "border-l-2 border-l-[#ff7a18] bg-[#20160f] pl-3" : "hover:bg-[#17110d]"}`}
                  >
                    {match.avatar_url ? <img src={match.avatar_url} alt="" className="h-10 w-10 rounded-full border border-[#795033] object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#795033] bg-[#c8b48b] text-sm font-bold text-[#211811]">{match.name.slice(0, 1).toUpperCase()}</span>}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{match.name}</span>
                      <span className="block truncate text-xs text-[#b3aa9b]">@{match.username} · {match.tasteCount} picks</span>
                    </span>
                    <span className="font-serif text-sm font-bold text-[#ff7a18]">{match.totalScore}%</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="min-h-[22rem]" aria-live="polite">
            {!selected ? (
              <div className="flex min-h-[20rem] flex-col items-center justify-center text-center">
                <Film size={25} strokeWidth={1.4} className="mb-4 text-[#ff7a18]" />
                <h2 className="font-serif text-2xl font-semibold text-[#f4ead4]">Choose a profile to begin</h2>
              </div>
            ) : comparing ? (
              <div className="flex min-h-[20rem] items-center justify-center text-sm text-[#c2b9a9]">Comparing with @{selected.username}…</div>
            ) : error ? (
              <div className="flex min-h-[20rem] flex-col items-center justify-center text-center">
                <p role="alert" className="text-sm text-[#ff7a18]">{error}</p>
              </div>
            ) : analysis ? (
              <div className="space-y-7">
                <div className="flex flex-wrap items-center gap-4 border-b border-[#68452e] pb-5">
                  <div className="flex -space-x-2">
                    {user.avatar_url ? <img src={user.avatar_url} alt="" className="h-12 w-12 rounded-full border-2 border-[#120e0b] object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#120e0b] bg-[#c8b48b] font-bold text-[#211811]">{user.name.slice(0, 1).toUpperCase()}</span>}
                    {selected.avatar_url ? <img src={selected.avatar_url} alt="" className="h-12 w-12 rounded-full border-2 border-[#120e0b] object-cover" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-[#120e0b] bg-[#a85e3b] font-bold text-[#f4ead4]">{selected.name.slice(0, 1).toUpperCase()}</span>}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-[#c2b9a9]">You and @{selected.username}</p>
                    <h2 className="mt-1 font-serif text-lg font-bold text-[#f4ead4]">{analysis.tasteInsight}</h2>
                    <p className="mt-1 text-xs text-[#b3aa9b]">{analysis.confidence} confidence</p>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-5xl font-bold leading-none text-[#ff7a18]">{analysis.totalScore}%</p>
                  </div>
                </div>

                <div>
                  <h3 className="mb-3 font-serif text-lg text-[#f4ead4]">Your overlap</h3>
                  <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
                    {SCORE_PARTS.map(({ key, label }) => (
                      <div key={key}>
                        <div className="mb-1 flex justify-between text-sm"><span className="text-[#c2b9a9]">{label}</span><span className="font-bold text-[#f0e8d7]">{analysis[key]}%</span></div>
                        <div className="h-1.5 rounded-full bg-[#f4ead4]/15"><div className="h-full rounded-full bg-[#ff7a18]" style={{ width: `${analysis[key]}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>

                {analysis.sharedGenres.length > 0 && <div>
                  <h3 className="mb-1 font-serif text-lg text-[#f4ead4]">Genres in common</h3>
                  <p className="text-sm text-[#c2b9a9]">{analysis.sharedGenres.slice(0, 8).join(" · ")}</p>
                </div>}

                {analysis.commonTasteMovies.length > 0 && <div>
                  <h3 className="mb-3 font-serif text-lg text-[#f4ead4]">You both like</h3>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">{analysis.commonTasteMovies.slice(0, 8).map((title) => <Link key={`${title.type}-${title.id}`} href={`/${title.type === "tv" ? "tv" : "movie"}/${title.id}`} className="group min-w-0"><div className="aspect-[2/3] overflow-hidden bg-[#20160f]">{title.poster_url && <img src={title.poster_url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />}</div><p className="mt-2 truncate text-xs text-[#f4ead4] group-hover:text-[#ff9a3d]">{title.title}</p></Link>)}</div>
                </div>}

                {analysis.recommendationsForA.length > 0 && <div>
                  <h3 className="mb-3 font-serif text-lg text-[#f4ead4]">Try these next</h3>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4">{analysis.recommendationsForA.slice(0, 8).map((title) => <Link key={`${title.type}-${title.id}`} href={`/${title.type === "tv" ? "tv" : "movie"}/${title.id}`} className="group min-w-0"><div className="aspect-[2/3] overflow-hidden bg-[#20160f]">{title.poster_url && <img src={title.poster_url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]" />}</div><p className="mt-2 truncate text-xs text-[#f4ead4] group-hover:text-[#ff9a3d]">{title.title}</p></Link>)}</div>
                </div>}
              </div>
            ) : null}
          </section>
        </div>
      </main>
    </PageLayout>
  );
}
