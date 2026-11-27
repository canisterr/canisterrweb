"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import { User, MovieLogWithContent } from "@/types";
import { signOut as authSignOut } from "@/lib/auth";
import { getFriendLogs } from "@/lib/friend-logs";
import { buildLogUrl } from "@/lib/log-url";
import { setPendingLoadingTitle } from "@/lib/loading-title";
import { getTvEpisodeBadgeLabel } from "@/lib/tv-log-label";

export default function FriendLogsPage() {
  const router = useRouter();
  const { user: sessionUser, loading: sessionLoading } = useCurrentUser();
  const [user, setUser] = useState<User | null>(null);
  const [logs, setLogs] = useState<(MovieLogWithContent & { friend: User })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!sessionUser) {
      router.push("/auth/login");
      return;
    }

    let cancelled = false;

    const loadFriendLogs = async () => {
      try {
        setUser(sessionUser);
        const friendLogs = await getFriendLogs(sessionUser.id, {
          daysBack: null,
          limit: 100,
          dedupeByContent: false,
          summaryOnly: true,
        });
        if (cancelled) return;
        setLogs(friendLogs);
      } catch (error) {
        console.error("Error loading friend logs:", error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadFriendLogs();

    return () => {
      cancelled = true;
    };
  }, [router, sessionLoading, sessionUser]);

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const formatDate = (dateString: string) => {
    const [year, month, day] = dateString.split("-");
    return `${day}/${month}/${year.slice(-2)}`;
  };

  const getReactionLabel = (reaction: 0 | 1 | 1.5 | 2 | null | undefined) => {
    if (reaction == null) {
      return { label: "Unrated", color: "text-white/40" };
    }
    switch (reaction) {
      case 2:
        return { label: "Masterpiece", color: "text-[#ff7a1a]" };
      case 1.5:
        return { label: "Average", color: "text-[#f0bd42]" };
      case 1:
        return { label: "Good", color: "text-[#ff7a1a]" };
      case 0:
      default:
        return { label: "Bad", color: "text-[#f06a7c]" };
    }
  };

  const getSeasonLabel = (log: MovieLogWithContent) => getTvEpisodeBadgeLabel(log);

  if (loading || !user) {
    return null;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      <div className="mx-auto max-w-6xl px-3 py-5 text-[#f5f0de] sm:px-6 sm:py-8">
        {/* Header */}
        <div className="mb-5 flex items-center gap-3 sm:mb-7 sm:gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black tracking-tight text-[#f5f0de] sm:text-3xl">Friends Activity</h1>
          </div>
        </div>

        {/* Logs Grid */}
        {logs.length > 0 ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {logs.map((log) => (
              <div
                key={log.id}
                    onClick={() => {
                      setPendingLoadingTitle(log.content?.title);
                      router.push(buildLogUrl(log));
                    }}
                className="group cursor-pointer overflow-hidden border border-white/10 bg-[#0b0d10] text-left transition hover:border-[#ff7a1a]/50 hover:bg-[#111111]"
              >
                {/* Poster */}
                {log.content.poster_url && (
                  <div className="relative aspect-[2/3] overflow-hidden bg-[#1a1a1a]">
                    <img
                      src={log.content.poster_url}
                      alt={log.content.title}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                    />
                    {getSeasonLabel(log) && (
                      <div className="absolute left-1.5 top-1.5 border border-white/15 bg-black/80 px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-[#ffb36b] sm:left-2 sm:top-2 sm:text-[10px]">
                        {getSeasonLabel(log)}
                      </div>
                    )}
                  </div>
                )}

                {/* Content */}
                  <div className="border-t border-white/10 p-2 sm:p-3">
                    {/* Movie Title */}
                    <h3 className="mb-1 line-clamp-2 text-[10px] font-bold leading-tight text-[#f5f0de] sm:text-sm">
                      {log.content.title}
                    </h3>

                  {/* Friend Info */}
                  <div className="mb-1 sm:mb-2">
                    <p className="truncate text-[9px] leading-tight text-white/50 sm:text-xs">
                      by {log.friend.name}
                    </p>
                  </div>

                  {/* Date */}
                  <div className="mb-1 text-[9px] text-white/40 sm:mb-2 sm:text-xs">
                    {formatDate(log.watched_date)}
                  </div>

                  {/* Reaction */}
                  <div className="sm:mb-3">
                    {(() => {
                      const reaction = getReactionLabel(log.reaction as 0 | 1 | 1.5 | 2 | null | undefined);
                      return <span className={`text-[9px] font-bold uppercase tracking-wide sm:text-[10px] ${reaction.color}`}>{reaction.label}</span>;
                    })()}
                  </div>

                  {/* Mood */}
                  {log.mood && (
                    <div className="mb-3 hidden sm:block">
                      <span className="border border-white/10 bg-white/[0.04] px-2 py-1 text-xs font-medium text-white/55">
                        {log.mood}
                      </span>
                    </div>
                  )}

                  {/* Notes Preview */}
                  {log.notes && (
                    <p className="mt-2 hidden text-xs leading-relaxed text-white/55 line-clamp-2 sm:block">
                      {log.notes}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-white/10 bg-[#111111] px-5 py-12 text-center sm:py-16">
            <p className="mb-2 font-bold text-[#f5f0de]">No friend activity yet</p>
            <p className="text-sm text-white/50">Follow people to see the movies and TV shows they log.</p>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
