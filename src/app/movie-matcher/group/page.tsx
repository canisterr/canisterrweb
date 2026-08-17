"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Users } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import CinematicLoading from "@/components/CinematicLoading";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import { signOut as authSignOut } from "@/lib/auth";
import { getAvailableFriends, type Friend } from "@/lib/friends-match";
import { generateGroupMatch, type GroupMatchResult } from "@/lib/group-match";

const PLACEHOLDER_POSTER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='342' height='513'%3E%3Crect fill='%23111111' width='342' height='513'/%3E%3C/svg%3E";

function MovieGrid({
  title,
  subtitle,
  movies,
  showVotes = false,
}: {
  title: string;
  subtitle: string;
  movies: Array<{ id: number; title: string; poster_url: string | null; type: "movie" | "tv"; votedBy?: number }>;
  showVotes?: boolean;
}) {
  return (
    <div>
      <p className="text-[0.65rem] uppercase tracking-[0.45em] text-[#ffb36b]">{title}</p>
      <p className="mt-1 text-sm text-white/55">{subtitle}</p>
      {movies.length === 0 ? (
        <p className="mt-4 text-sm text-white/45">Nothing here yet.</p>
      ) : (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
          {movies.map((movie) => (
            <div
              key={`${movie.type}-${movie.id}`}
              className="group relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-white/[0.03]"
            >
              <img
                src={movie.poster_url || PLACEHOLDER_POSTER}
                alt={movie.title}
                className="h-full w-full object-cover"
              />
              {showVotes && movie.votedBy ? (
                <span className="absolute bottom-1 right-1 rounded-full border border-[#ff7a1a]/40 bg-black/70 px-1.5 py-0.5 text-[9px] font-bold text-[#ffb36b]">
                  {movie.votedBy} votes
                </span>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function GroupMatchPage() {
  const router = useRouter();
  const { user, loading: sessionLoading } = useCurrentUser();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [result, setResult] = useState<GroupMatchResult | null>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionLoading) return;
    if (!user) {
      router.push("/auth/login");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const list = await getAvailableFriends(user.id);
        if (!cancelled) setFriends(list.filter((friend) => friend.isComplete));
      } catch {
        if (!cancelled) setError("Failed to load friends");
      } finally {
        if (!cancelled) setLoadingFriends(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sessionLoading, user, router]);

  const toggleFriend = (friendId: string) => {
    setSelectedIds((prev) =>
      prev.includes(friendId) ? prev.filter((id) => id !== friendId) : [...prev, friendId]
    );
  };

  const handleGenerate = async () => {
    if (!user || selectedIds.length < 2) return;
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const groupResult = await generateGroupMatch([user.id, ...selectedIds]);
      setResult(groupResult);
    } catch (err) {
      setError("Failed to generate group match");
    } finally {
      setGenerating(false);
    }
  };

  const handleSignOut = async () => {
    await authSignOut();
    router.push("/auth/login");
  };

  if (sessionLoading || !user) {
    return <CinematicLoading message="Loading group match" />;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="mx-auto max-w-5xl px-4 py-8 text-[#f5f0de] sm:px-6 sm:py-10">
        <Link
          href="/movie-matcher"
          className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-[#f5f0de]"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Movie Matcher
        </Link>

        <div className="mb-8 mt-6">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-[#ffb36b]">Group Match</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
            Find out what your whole group should watch.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/65">
            Pick at least 2 friends with a complete taste profile to see your group&apos;s compatibility,
            shared taste DNA, and what to watch together.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-[#ff7a1a]" />
            <h2 className="text-base font-bold">Select your group</h2>
            <span className="ml-auto rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-white/70">
              {selectedIds.length} selected
            </span>
          </div>

          {loadingFriends ? (
            <div className="py-8 text-center text-sm text-white/55">
              <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin" />
              Loading friends...
            </div>
          ) : friends.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-8 text-center text-sm text-white/55">
              No friends with complete taste profiles yet.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {friends.map((friend) => {
                const selected = selectedIds.includes(friend.userId);
                return (
                  <button
                    key={friend.userId}
                    type="button"
                    onClick={() => toggleFriend(friend.userId)}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                      selected
                        ? "border-[#ff7a1a]/60 bg-[#ff7a1a]/10"
                        : "border-white/10 bg-white/[0.02] hover:border-white/25"
                    }`}
                  >
                    {friend.avatar_url ? (
                      <img
                        src={friend.avatar_url}
                        alt={friend.username}
                        className="h-8 w-8 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 bg-[#111111] text-xs font-bold">
                        {friend.username[0]?.toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{friend.name}</p>
                      <p className="truncate text-xs text-white/45">@{friend.username}</p>
                    </div>
                    <span
                      className={`h-4 w-4 shrink-0 rounded-full border ${
                        selected ? "border-[#ff7a1a] bg-[#ff7a1a]" : "border-white/25"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          )}

          <button
            type="button"
            onClick={handleGenerate}
            disabled={selectedIds.length < 2 || generating}
            className={`mt-5 w-full rounded-full px-5 py-3 text-sm font-black transition ${
              selectedIds.length < 2 || generating
                ? "cursor-not-allowed bg-white/10 text-white/35"
                : "bg-[#ff7a1a] text-black hover:bg-[#ff8d3b]"
            }`}
          >
            {generating
              ? "Crunching your group's taste..."
              : selectedIds.length < 2
              ? "Select at least 2 friends"
              : `Generate Group Match (${selectedIds.length + 1} people)`}
          </button>

          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>

        {result && (
          <div className="mt-8 space-y-8">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center">
              <p className="text-[0.65rem] uppercase tracking-[0.45em] text-white/40">Group Score</p>
              <p className="mt-2 text-6xl font-black text-[#ff7a1a]">{result.groupScore}%</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {result.members.map((member) => (
                  <span
                    key={member.userId}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold"
                  >
                    {member.name}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[0.65rem] uppercase tracking-[0.45em] text-[#ffb36b]">Group Taste DNA</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.topGenres.length > 0 ? (
                    result.topGenres.map((genre) => (
                      <span
                        key={genre}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold capitalize"
                      >
                        {genre}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-white/45">No shared genres yet.</p>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
                <p className="text-[0.65rem] uppercase tracking-[0.45em] text-[#ffb36b]">Group Creators</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {result.topCreators.length > 0 ? (
                    result.topCreators.map((creator) => (
                      <span
                        key={creator}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold"
                      >
                        {creator}
                      </span>
                    ))
                  ) : (
                    <p className="text-sm text-white/45">No shared creators yet.</p>
                  )}
                </div>
              </div>
            </div>

            <MovieGrid
              title="Everyone's Watched"
              subtitle="In every member's taste profile."
              movies={result.commonMovies}
            />
            <MovieGrid
              title="What To Watch Next"
              subtitle="Loved by at least two of you, not by everyone yet."
              movies={result.groupRecommendations}
              showVotes
            />
          </div>
        )}
      </div>
    </PageLayout>
  );
}
