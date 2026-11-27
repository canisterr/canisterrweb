"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import SearchBar from "@/components/SearchBar";
import ShareModal from "@/components/ShareModal";
import TopActionBanner from "@/components/TopActionBanner";
import { AnimatedBackground } from "@/components/core/animated-background";
import { Content, ShareWithDetails, TMDBMovie, User } from "@/types";
import { auth, db } from "@/lib/firebase";
import { isPermissionDeniedError } from "@/lib/firebase-errors";
import { onAuthStateChanged } from "firebase/auth";
import { equalTo, get, onValue, orderByChild, query, ref, set, update } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { getMovieDetails, searchMovies } from "@/lib/tmdb";
import { getShowDetails, searchShows, ShowDetails } from "@/lib/tvmaze";
import { isUsernameBlocked, mergeSettings } from "@/lib/settings";
import { createShareReceivedNotification } from "@/lib/notifications";
import { getUsersByIds } from "@/lib/users";
import { ChevronLeft, ChevronRight, SendHorizontal, Trash2 } from "lucide-react";

type SearchResultItem = {
  id: string | number;
  title: string;
  subtitle?: string;
  image?: string;
  year?: string;
  type?: "movie" | "tv";
  originalId?: number;
};

type FollowRecord = {
  follower_id: string;
  following_id: string;
  status: "pending" | "accepted";
};

type ShareRecord = {
  sender_id: string;
  receiver_id: string;
  created_at: string;
  movie?: Content | null;
  content?: Content | null;
} & Record<string, unknown>;

const RECIPIENT_PRIORITY_STORAGE_PREFIX = "share-recipient-priority";

function recipientPriorityStorageKey(userId: string): string {
  return `${RECIPIENT_PRIORITY_STORAGE_PREFIX}:${userId}`;
}

function readRecipientPriority(userId: string): Record<string, number> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(recipientPriorityStorageKey(userId));
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};

    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => typeof value === "number" && Number.isFinite(value))
    ) as Record<string, number>;
  } catch {
    return {};
  }
}

function writeRecipientPriority(userId: string, priorityMap: Record<string, number>): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(recipientPriorityStorageKey(userId), JSON.stringify(priorityMap));
  } catch {
    // Ignore storage failures.
  }
}

function bumpRecipientPriority(
  currentMap: Record<string, number>,
  userId: string,
  recipientId: string
): Record<string, number> {
  const nextMap = {
    ...currentMap,
    [recipientId]: (currentMap[recipientId] || 0) + 1,
  };

  writeRecipientPriority(userId, nextMap);
  return nextMap;
}

function createMovieContent(
  movie: Awaited<ReturnType<typeof getMovieDetails>>,
  createdAt: string
): Content | null {
  if (!movie) return null;

  return {
    ...movie,
    type: "movie",
    created_at: createdAt,
  };
}

function createShowContent(show: ShowDetails, createdAt: string): Content {
  return {
    id: show.id,
    title: show.title || show.name,
    name: show.name,
    poster_url: show.poster_url ?? show.image?.original ?? show.image?.medium ?? null,
    genres: show.genres ?? [],
    language: show.language ?? null,
    status: show.status ?? null,
    release_date: show.release_date ?? show.premiered ?? null,
    overview: show.overview ?? show.summary ?? null,
    runtime: show.runtime ?? null,
    rating: show.rating?.average ?? null,
    created_at: createdAt,
    type: "tv",
    network: show.network,
    source: show.source,
    tmdb_id: show.tmdb_id,
    tvmaze_id: show.tvmaze_id,
  };
}

function contentFromSearchResult(item: SearchResultItem): Content | null {
  if (!item.originalId || !item.type) return null;
  const base = {
    id: item.originalId,
    title: item.title,
    poster_url: item.image?.replace("/w92/", "/w500/") || null,
    genres: [],
    release_date: item.year && item.year !== "N/A" ? `${item.year}-01-01` : null,
    overview: null,
    runtime: null,
    rating: null,
    created_at: new Date().toISOString(),
  };
  if (item.type === "tv") return { ...base, name: item.title, status: null, type: "tv" };
  return { ...base, platforms: [], director: null, type: "movie" };
}

function contentKey(content: Content): string {
  return `${content.type === "tv" ? "tv" : "movie"}:${content.id}`;
}

function SharePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const movieIdParam = searchParams.get("movie_id");
  const showIdParam = searchParams.get("show_id");
  const contentIdParam = searchParams.get("content_id");
  const typeParam = searchParams.get("type");
  const shareIdParam = searchParams.get("share_id");
  const panelParam = searchParams.get("panel");
  const noteParam = searchParams.get("note");

  const [sharedSearchQuery, setSharedSearchQuery] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePanel, setActivePanel] = useState<"share" | "history">(() =>
    panelParam === "history" ? "history" : "share"
  );

  const [currentStep, setCurrentStep] = useState(1);
  const [selectedContents, setSelectedContents] = useState<Content[]>([]);
  const [selectedRecipients, setSelectedRecipients] = useState<User[]>([]);
  const [followers, setFollowers] = useState<User[]>([]);
  const [followersSearchQuery, setFollowersSearchQuery] = useState("");
  const [shareNote, setShareNote] = useState(() => noteParam || "");
  const [contentTypeFilter, setContentTypeFilter] = useState<"all" | "movies" | "tv">("all");
  const [yearFilter, setYearFilter] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [sentShares, setSentShares] = useState<ShareWithDetails[]>([]);
  const [receivedShares, setReceivedShares] = useState<ShareWithDetails[]>([]);
  const [historyDirection, setHistoryDirection] = useState<"sent" | "received">("sent");
  const [selectedShare, setSelectedShare] = useState<ShareWithDetails | null>(null);
  const [showWatchConflictModal, setShowWatchConflictModal] = useState(false);
  const [pendingShareRecipients, setPendingShareRecipients] = useState<User[]>([]);
  const [watchConflicts, setWatchConflicts] = useState<{ recipient: User; content: Content }[]>([]);
  const [sending, setSending] = useState(false);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const hasInitializedFromParams = useRef(false);
  const recipientPriority = useMemo(
    () => (user ? readRecipientPriority(user.id) : {}),
    [user]
  );

  useEffect(() => {
    let unsubscribeFollowers = () => {};
    let unsubscribeShares = () => {};
    let unsubscribeReceivedShares = () => {};

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const userSnapshot = await get(userRef);
        const latestCurrentUserSettings = mergeSettings(userSnapshot.exists() ? userSnapshot.val()?.settings : null);

        let currentUser: User;

        if (userSnapshot.exists()) {
          const userData = userSnapshot.val();
          currentUser = {
            id: firebaseUser.uid,
            username: userData.username,
            name: userData.name,
            avatar_url: userData.avatar_url || null,
            created_at: userData.createdAt,
            email: userData.email,
            bio: userData.bio,
          };
        } else {
          currentUser = {
            id: firebaseUser.uid,
            username: firebaseUser.email?.split("@")[0] || "user",
            name: firebaseUser.displayName || "User",
            avatar_url: null,
            created_at: new Date().toISOString(),
            email: firebaseUser.email || undefined,
            bio: "",
          };
        }

        setUser(currentUser);

        if (!hasInitializedFromParams.current) {
          hasInitializedFromParams.current = true;
          if (movieIdParam) {
            const movieId = Number.parseInt(movieIdParam, 10);
            if (!Number.isNaN(movieId)) {
              try {
                const movie = await getMovieDetails(movieId);
                if (movie) {
                  setSelectedContents((prev) => [...prev, createMovieContent(movie, new Date().toISOString())!]);
                  setCurrentStep(2);
                }
              } catch (error) {
                console.error("Error fetching movie from URL param:", error);
              }
            }
          } else if (showIdParam) {
            const showId = Number.parseInt(showIdParam, 10);
            if (!Number.isNaN(showId)) {
              try {
                const show = await getShowDetails(showId);
                if (show) {
                  setSelectedContents((prev) => [...prev, createShowContent(show, new Date().toISOString())]);
                  setCurrentStep(2);
                }
              } catch (error) {
                console.error("Error fetching TV show from URL param:", error);
              }
            }
          } else if (contentIdParam && typeParam) {
            const contentId = Number.parseInt(contentIdParam, 10);
            if (!Number.isNaN(contentId)) {
              try {
                if (typeParam === "tv") {
                  const show = await getShowDetails(contentId);
                  if (show) {
                    setSelectedContents((prev) => [...prev, createShowContent(show, new Date().toISOString())]);
                    setCurrentStep(2);
                  }
                } else {
                  const movie = await getMovieDetails(contentId);
                  if (movie) {
                    setSelectedContents((prev) => [...prev, createMovieContent(movie, new Date().toISOString())!]);
                    setCurrentStep(2);
                  }
                }
              } catch (error) {
                console.error("Error fetching content from URL param:", error);
              }
            }
          }
        }

        setLoading(false);

        const followsRef = query(
          ref(db, "follows"),
          orderByChild("follower_id"),
          equalTo(currentUser.id)
        );
        unsubscribeFollowers = onValue(
          followsRef,
          (snapshot) => {
            try {
              if (!snapshot.exists()) {
                setFollowers([]);
                return;
              }

              const followsData = snapshot.val() as Record<string, FollowRecord>;
              const acceptedFollows = Object.values(followsData).filter(
                (follow) => follow.follower_id === currentUser.id && follow.status === "accepted"
              );

              const loadFollowers = async () => {
                const followerIds = acceptedFollows.map((follow) => follow.following_id);
                const followerUsers = await getUsersByIds(followerIds);
                if (!followerIds.length) {
                  setFollowers([]);
                  return;
                }

                const followersList = followerIds
                  .map((friendId) => followerUsers[friendId])
                  .filter((friend): friend is User => Boolean(friend))
                  .filter((friend) => {
                    const friendSettings = mergeSettings((friend as any)?.settings);
                    return (
                      friendSettings.account.status === "active" &&
                      !isUsernameBlocked(latestCurrentUserSettings, friend.username) &&
                      !isUsernameBlocked(friendSettings, currentUser.username)
                    );
                  });

                setFollowers(followersList);
              };

              void loadFollowers();
            } catch (error) {
              console.error("Error fetching followers:", error);
              setFollowers([]);
            }
          },
          (error) => {
            if (isPermissionDeniedError(error)) {
              console.warn("Followers listener is unavailable with the current Firebase permissions.");
              setFollowers([]);
              return;
            }

            console.error("Followers listener failed:", error);
            setFollowers([]);
          }
        );

        const sharesRef = query(
          ref(db, "shares"),
          orderByChild("sender_id"),
          equalTo(currentUser.id)
        );
        unsubscribeShares = onValue(
          sharesRef,
          (snapshot) => {
            if (!snapshot.exists()) {
              setSentShares([]);
              return;
            }

            try {
              const sharesData = snapshot.val() as Record<string, ShareRecord>;
              const sent = Object.entries(sharesData)
                .map(([id, data]) => ({ id, ...data }))
                .filter((share) => share.sender_id === currentUser.id)
                .sort(
                  (a, b) =>
                    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                );

              void (async () => {
                const userIds = Array.from(new Set(sent.map((share) => share.receiver_id)));
                const usersById = await getUsersByIds(userIds);
                const sentWithDetails = sent.map((share) => ({
                  ...share,
                  movie: share.movie || null,
                  content: share.content || share.movie || null,
                  receiver: usersById[share.receiver_id],
                }));
                setSentShares(sentWithDetails as ShareWithDetails[]);
              })();
            } catch (error) {
              console.error("Error fetching sent shares:", error);
              setSentShares([]);
            }
          },
          (error) => {
            if (isPermissionDeniedError(error)) {
              console.warn("Shares listener is unavailable with the current Firebase permissions.");
              setSentShares([]);
              return;
            }

            console.error("Shares listener failed:", error);
            setSentShares([]);
          }
        );

        const receivedSharesRef = query(
          ref(db, "shares"),
          orderByChild("receiver_id"),
          equalTo(currentUser.id)
        );
        unsubscribeReceivedShares = onValue(
          receivedSharesRef,
          (snapshot) => {
            if (!snapshot.exists()) {
              setReceivedShares([]);
              return;
            }

            try {
              const sharesData = snapshot.val() as Record<string, ShareRecord>;
              const received = Object.entries(sharesData)
                .map(([id, data]) => ({ id, ...data }))
                .filter((share) => share.receiver_id === currentUser.id)
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

              void (async () => {
                const userIds = Array.from(new Set(received.map((share) => share.sender_id)));
                const usersById = await getUsersByIds(userIds);
                const receivedWithDetails = received.map((share) => ({
                  ...share,
                  movie: share.movie || null,
                  content: share.content || share.movie || null,
                  sender: usersById[share.sender_id],
                }));
                setReceivedShares(receivedWithDetails as ShareWithDetails[]);
              })();
            } catch (error) {
              console.error("Error fetching received shares:", error);
              setReceivedShares([]);
            }
          },
          (error) => {
            if (isPermissionDeniedError(error)) {
              console.warn("Received shares listener is unavailable with the current Firebase permissions.");
              setReceivedShares([]);
              return;
            }

            console.error("Received shares listener failed:", error);
            setReceivedShares([]);
          }
        );
      } catch (error) {
        console.error("Error fetching user:", error);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeFollowers();
      unsubscribeShares();
      unsubscribeReceivedShares();
      unsubscribeAuth();
    };
  }, [
    router,
    movieIdParam,
    showIdParam,
    contentIdParam,
    typeParam,
  ]);

  useEffect(() => {
    if (!user || !shareIdParam) return;

    const loadShareFromId = async () => {
      const existing = sentShares.find((share) => share.id === shareIdParam);
      if (existing) {
        setSelectedShare(existing);
        setActivePanel("history");
        return;
      }

      try {
        const shareSnapshot = await get(ref(db, `shares/${shareIdParam}`));
        if (!shareSnapshot.exists()) return;

        const shareData = shareSnapshot.val() as ShareRecord;
        const usersData = await getUsersByIds([shareData.sender_id, shareData.receiver_id]);

        setSelectedShare({
          id: shareIdParam,
          ...shareData,
          movie: shareData.movie || null,
          content: shareData.content || shareData.movie || null,
          sender: usersData[shareData.sender_id],
          receiver: usersData[shareData.receiver_id],
        } as ShareWithDetails);
        setActivePanel("history");
      } catch (error) {
        console.error("Error loading share from URL:", error);
      }
    };

    void loadShareFromId();
  }, [sentShares, shareIdParam, user]);

  useEffect(() => {
    if (!bannerMessage) return;

    const timer = window.setTimeout(() => {
      setBannerMessage(null);
    }, 2800);

    return () => window.clearTimeout(timer);
  }, [bannerMessage]);

  const filteredFollowers = useMemo(() => {
    const query = followersSearchQuery.trim().toLowerCase();

    return [...followers]
      .filter((friend) => {
        if (!query) return true;

        const username = typeof friend.username === "string" ? friend.username.toLowerCase() : "";
        const name = typeof friend.name === "string" ? friend.name.toLowerCase() : "";
        return username.includes(query) || name.includes(query);
      })
      .sort((a, b) => {
        const aUsername = typeof a.username === "string" ? a.username.toLowerCase() : "";
        const aName = typeof a.name === "string" ? a.name.toLowerCase() : "";
        const bUsername = typeof b.username === "string" ? b.username.toLowerCase() : "";
        const bName = typeof b.name === "string" ? b.name.toLowerCase() : "";

        const scoreFriend = (username: string, name: string, id: string) => {
          let score = recipientPriority[id] || 0;
          if (query) {
            if (username === query || name === query) score += 1000;
            if (username.startsWith(query) || name.startsWith(query)) score += 500;
            if (username.includes(query) || name.includes(query)) score += 250;
          }
          return score;
        };

        const scoreDiff = scoreFriend(bUsername, bName, b.id) - scoreFriend(aUsername, aName, a.id);
        if (scoreDiff !== 0) return scoreDiff;

        const nameDiff = aName.localeCompare(bName);
        if (nameDiff !== 0) return nameDiff;

        return aUsername.localeCompare(bUsername);
      });
  }, [followers, followersSearchQuery, recipientPriority]);

  const historyShares = historyDirection === "sent" ? sentShares : receivedShares;
  const filteredHistoryShares = historyShares.filter((share) => {
    const query = sharedSearchQuery.trim().toLowerCase();
    if (!query) {
      return true;
    }

    const item = share.movie || share.content;
    const title = item?.title?.toLowerCase() || "";
    const otherUsername = (historyDirection === "sent" ? share.receiver?.username : share.sender?.username)?.toLowerCase() || "";
    const note = share.note?.toLowerCase() || "";

    return (
      title.includes(query) ||
      otherUsername.includes(query) ||
      note.includes(query)
    );
  });

  const filteredResults = yearFilter
    ? searchResults.filter((item) => item.year === yearFilter)
    : searchResults;

  const uniqueYears = [...new Set(searchResults.map((item) => item.year || "N/A"))]
    .filter(Boolean)
    .sort()
    .reverse();

  const handleMovieSearch = useCallback(async (query: string): Promise<SearchResultItem[]> => {
    try {
      const [movies, shows] = await Promise.all([
        contentTypeFilter === "all" || contentTypeFilter === "movies"
          ? searchMovies(query).catch(() => [])
          : [],
        contentTypeFilter === "all" || contentTypeFilter === "tv"
          ? searchShows(query).catch(() => [])
          : [],
      ]);

      const movieResults = (movies as TMDBMovie[]).map((movie) => ({
        id: `movie-${movie.id}`,
        title: movie.title,
        subtitle: `${movie.release_date?.split("-")[0] || "N/A"} • Movie`,
        year: movie.release_date?.split("-")[0] || "N/A",
        image: movie.poster_path
          ? `https://image.tmdb.org/t/p/w92${movie.poster_path}`
          : undefined,
        type: "movie" as const,
        originalId: movie.id,
      }));

      const showResults = (shows as ShowDetails[]).map((show) => ({
        id: `tv-${show.id}`,
        title: show.name || show.title || "Untitled",
        subtitle: `${show.premiered?.split("-")[0] || "N/A"} • TV Show`,
        year: show.premiered?.split("-")[0] || "N/A",
        image: show.poster_url || show.image?.medium,
        type: "tv" as const,
        originalId: show.id,
      }));

      const combinedResults = [...movieResults, ...showResults];
      setSearchResults(combinedResults);
      setYearFilter("");
      return combinedResults;
    } catch (error) {
      console.error("Search error:", error);
      setSearchResults([]);
      return [];
    }
  }, [contentTypeFilter]);

  const handleSelectContent = (item: SearchResultItem) => {
    const content = contentFromSearchResult(item);
    if (!content) return;
    setSelectedContents((prev) => prev.some((existing) => contentKey(existing) === contentKey(content))
      ? prev.filter((existing) => contentKey(existing) !== contentKey(content))
      : [...prev, content]);
  };

  const handleAddRecipient = (recipientId: string) => {
    const recipient = followers.find((friend) => friend.id === recipientId);
    if (!recipient) {
      return;
    }

    if (user?.id) {
      bumpRecipientPriority(readRecipientPriority(user.id), user.id, recipientId);
    }

    if (!selectedRecipients.find((existing) => existing.id === recipientId)) {
      setSelectedRecipients((prev) => [...prev, recipient]);
    }
  };

  const handleRemoveRecipient = (recipientId: string) => {
    setSelectedRecipients((prev) => prev.filter((recipient) => recipient.id !== recipientId));
  };

  const resetShareFlow = () => {
    setCurrentStep(1);
    setSelectedContents([]);
    setSelectedRecipients([]);
    setShareNote("");
    setFollowersSearchQuery("");
    setContentTypeFilter("all");
    setYearFilter("");
    setSearchResults([]);
    setWatchConflicts([]);
    setPendingShareRecipients([]);
    setShowWatchConflictModal(false);
  };

  const sendSharesToRecipients = async (recipients: User[], skipWatched = false) => {
    if (!selectedContents.length || !recipients.length || !user) return;
    const conflicts = new Set(watchConflicts.map(({ recipient, content }) => `${recipient.id}:${contentKey(content)}`));
    const pairs = recipients.flatMap((recipient) => selectedContents
      .filter((content) => !skipWatched || !conflicts.has(`${recipient.id}:${contentKey(content)}`))
      .map((content) => ({ recipient, content })));
    if (!pairs.length) {
      resetShareFlow();
      return;
    }

    setSending(true);
    try {
      const createdAt = new Date().toISOString();
      const shares = pairs.map(({ recipient, content }, index) => {
        const contentType: "movie" | "tv" = content.type === "tv" ? "tv" : "movie";
        const shareId = `share-${user.id}-${recipient.id}-${contentType}-${content.id}-${Date.now()}-${index}`;
        return {
          recipient, content, contentType, shareId,
          record: {
            id: shareId,
            sender_id: user.id,
            receiver_id: recipient.id,
            content_id: content.id,
            content_type: contentType,
            content,
            note: shareNote || null,
            created_at: createdAt,
          },
        };
      });
      await update(ref(db), Object.fromEntries(shares.map(({ shareId, record }) => [`shares/${shareId}`, record])));
      const firstShareByRecipient = new Map<string, typeof shares>();
      for (const share of shares) {
        const recipientShares = firstShareByRecipient.get(share.recipient.id) || [];
        recipientShares.push(share);
        firstShareByRecipient.set(share.recipient.id, recipientShares);
      }
      await Promise.all(Array.from(firstShareByRecipient.values()).map(async (recipientShares) => {
        const { recipient, content, contentType, shareId } = recipientShares[0];
        try {
          await createShareReceivedNotification(
            recipient.id, shareId,
            recipientShares.length === 1 ? content.title || "a title" : `${content.title} and ${recipientShares.length - 1} more`,
            contentType, user, createdAt, shareNote || null
          );
        } catch (notificationError) {
          console.warn("Share notification could not be created:", notificationError);
        }
      }));
      setBannerMessage(`${shares.length} title${shares.length === 1 ? "" : "s"} shared`);
      resetShareFlow();
    } finally {
      setSending(false);
    }
  };

  const handleShare = async () => {
    if (!selectedContents.length || !selectedRecipients.length || !user || sending) return;
    setSending(true);
    try {
      // One database read covers every selected title and recipient.
      const snapshot = await get(ref(db, "watched_movies"));
      const watched = (snapshot.val() || {}) as Record<string, { logged?: boolean; list_marked?: boolean }>;
      const conflicts = selectedRecipients.flatMap((recipient) => selectedContents
        .filter((content) => {
          const type = content.type === "tv" ? "tv" : "movie";
          const record = watched[`${recipient.id}__${type}__${content.id}`];
          return Boolean(record?.logged || record?.list_marked);
        })
        .map((content) => ({ recipient, content })));
      if (conflicts.length) {
        setPendingShareRecipients(selectedRecipients);
        setWatchConflicts(conflicts);
        setShowWatchConflictModal(true);
        return;
      }
      await sendSharesToRecipients(selectedRecipients);
    } catch (error) {
      console.error("Error sharing content:", error);
    } finally {
      setSending(false);
    }
  };

  const handleSendAnyway = async () => {
    try {
      await sendSharesToRecipients(pendingShareRecipients);
    } catch (error) {
      console.error("Error sharing content:", error);
    }
  };

  const handleSendOnlyUnwatched = async () => {
    try {
      await sendSharesToRecipients(pendingShareRecipients, true);
    } catch (error) {
      console.error("Error sharing content:", error);
    }
  };

  const handleRemoveShare = async (shareId: string) => {
    try {
      await set(ref(db, `shares/${shareId}`), null);
      setSentShares((prev) => prev.filter((share) => share.id !== shareId));
      setReceivedShares((prev) => prev.filter((share) => share.id !== shareId));
    } catch (error) {
      console.error("Error removing share:", error);
    }
  };

  const openShareDetails = (share: ShareWithDetails) => {
    setSelectedShare(share);
    setActivePanel("history");
  };

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  if (loading) {
    return null;
  }

  if (!user) {
    return null;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut} theme="brutalist">
      <TopActionBanner message={bannerMessage} />
      <div className="min-h-screen px-3 pb-6 pt-3 sm:px-6 sm:pt-5">
        <div className="mx-auto w-full max-w-5xl">
          <div className="mb-5 flex items-center justify-center gap-2.5 sm:mb-6 sm:gap-3">
            <button
              type="button"
              onClick={() => setActivePanel("share")}
              className={`inline-flex items-center justify-center rounded-[20px] border px-5 py-2.5 text-sm font-bold transition sm:px-7 sm:py-3.5 sm:text-xl ${
                activePanel === "share"
                  ? "border-[#ff7a1a] bg-[#ff7a1a] text-black"
                  : "border-[#292929] bg-[#171717] text-[#f5f0de] hover:border-white/20 hover:bg-[#1c1c1c]"
              }`}
            >
              Share
            </button>
            <button
              type="button"
              onClick={() => setActivePanel("history")}
              className={`inline-flex items-center justify-center rounded-[20px] border px-5 py-2.5 text-sm font-bold transition sm:px-7 sm:py-3.5 sm:text-xl ${
                activePanel === "history"
                  ? "border-[#ff7a1a] bg-[#ff7a1a] text-black"
                  : "border-[#292929] bg-[#171717] text-[#f5f0de] hover:border-white/20 hover:bg-[#1c1c1c]"
              }`}
            >
              History
            </button>
          </div>

          {activePanel === "share" ? (
            <section>
              <div className="py-5 sm:py-7">
                <div
                  className={`relative z-20 transition-all duration-500 ${
                    currentStep === 1 ? "opacity-100 translate-x-0" : "opacity-0 translate-x-6"
                  } ${currentStep !== 1 ? "hidden" : ""}`}
                >
                  <h3 className="text-xl font-semibold text-[#f5f0de] sm:text-2xl">Select Movies and Shows</h3>
                  <p className="mt-1 text-sm text-white/65">Choose as many titles as you want, then continue.</p>

                  <div className="mt-6 w-full rounded-[14px] border border-white/10 bg-[#111111] p-[3px]">
                    <AnimatedBackground
                      defaultValue={contentTypeFilter}
                      value={contentTypeFilter}
                      onValueChange={(value) => {
                        setContentTypeFilter(value as "all" | "movies" | "tv");
                        setSearchResults([]);
                        setYearFilter("");
                      }}
                      className="rounded-[11px] bg-[#ff7a1a]"
                      transition={{ ease: "easeInOut", duration: 0.2 }}
                    >
                    <button
                      data-id="all"
                      type="button"
                      className={`inline-flex min-w-0 flex-1 items-center justify-center rounded-[11px] px-2 py-3 text-sm font-semibold transition ${
                        contentTypeFilter === "all" ? "text-[#111111]" : "text-white/70 hover:text-[#f5f0de]"
                      }`}
                    >
                      All
                    </button>

                    <button
                      data-id="movies"
                      type="button"
                      className={`inline-flex min-w-0 flex-1 items-center justify-center rounded-[11px] px-2 py-3 text-sm font-semibold transition ${
                        contentTypeFilter === "movies" ? "text-[#111111]" : "text-white/70 hover:text-[#f5f0de]"
                      }`}
                    >
                      Movies
                    </button>

                    <button
                      data-id="tv"
                      type="button"
                      className={`inline-flex min-w-0 flex-1 items-center justify-center rounded-[11px] px-2 py-3 text-sm font-semibold transition ${
                        contentTypeFilter === "tv" ? "text-[#111111]" : "text-white/70 hover:text-[#f5f0de]"
                      }`}
                    >
                      TV Shows
                    </button>
                    </AnimatedBackground>
                  </div>

                  <div className="mt-4">
                    <SearchBar
                      placeholder="Search movies & TV shows..."
                      onSearch={handleMovieSearch}
                      onSelect={(item) => {
                        if (yearFilter && item.year !== yearFilter) {
                          return;
                        }
                        handleSelectContent(item as SearchResultItem);
                      }}
                      minChars={2}
                      debounceMs={450}
                      theme="brutalist"
                      selectedIds={selectedContents.map((content) => `${content.type}-${content.id}`)}
                    />
                  </div>

                  {searchResults.length > 0 && uniqueYears.length > 1 && (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <label className="text-sm font-medium text-white/55">Filter year</label>
                      <select
                        value={yearFilter}
                        onChange={(e) => setYearFilter(e.target.value)}
                        className="field w-auto min-w-[170px] py-2 text-sm"
                      >
                        <option value="">All years ({searchResults.length})</option>
                        {uniqueYears.map((year) => {
                          const count = searchResults.filter((item) => item.year === year).length;
                          return (
                            <option key={year} value={year}>
                              {year} ({count})
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  )}

                  {yearFilter && filteredResults.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-3 text-sm font-semibold text-[#f5f0de]">
                          Results for {yearFilter} ({filteredResults.length})
                        </p>

                      <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
                        {filteredResults.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => handleSelectContent(item)}
                            aria-pressed={selectedContents.some((content) => contentKey(content) === `${item.type}:${item.originalId}`)}
                            className="group flex w-full items-center gap-3 border-b border-white/10 px-0 py-2 text-left transition-colors hover:border-white/20"
                          >
                            {item.image && (
                              <img loading="lazy"
                                src={item.image}
                                alt={item.title}
                              className="h-16 w-12 flex-shrink-0 rounded object-cover"
                            />
                          )}
                          <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-[#f5f0de]">{item.title}</p>
                              <p className="truncate text-xs text-white/55">{item.subtitle}</p>
                          </div>
                          <span className="text-[#ff7a1a]">{selectedContents.some((content) => contentKey(content) === `${item.type}:${item.originalId}`) ? "✓" : "+"}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedContents.length > 0 && (
                    <div className="mt-5 border border-white/10 bg-white/[0.03] p-4 sm:mt-6">
                      <p className="mb-3 text-sm font-semibold text-[#f5f0de]">Selected: {selectedContents.length} title{selectedContents.length === 1 ? "" : "s"}</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedContents.map((content) => (
                          <button key={contentKey(content)} type="button"
                            onClick={() => setSelectedContents((prev) => prev.filter((item) => contentKey(item) !== contentKey(content)))}
                            className="rounded-full border border-[#ff7a1a]/50 px-3 py-1.5 text-sm text-[#f5f0de] hover:bg-white/5"
                            aria-label={`Remove ${content.title}`}>
                            {content.title} <span className="text-[#ff7a1a]">×</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className={`relative z-20 transition-all duration-500 ${
                    currentStep === 2 ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-6"
                  } ${currentStep !== 2 ? "hidden" : ""}`}
                >
                  <h3 className="text-xl font-semibold text-[#f5f0de] sm:text-2xl">Send to Friends</h3>
                  <p className="mt-1 text-sm text-white/65">Pick recipients and attach a short note.</p>

                  <div className="mt-5 border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-sm font-semibold text-[#f5f0de]">{selectedContents.length} selected title{selectedContents.length === 1 ? "" : "s"}</p>
                    <p className="mt-1 text-xs text-white/55">{selectedContents.map((content) => content.title).join(", ")}</p>
                  </div>

                  <div className="mt-4">
                    <input
                      type="text"
                      placeholder="Search friends..."
                      value={followersSearchQuery}
                      onChange={(e) => setFollowersSearchQuery(e.target.value)}
                      className="field py-2.5 text-sm"
                    />
                  </div>

                  <div className="mb-3 mt-3 max-h-48 divide-y divide-white/10 overflow-y-auto rounded-2xl border border-white/10 bg-[#141414] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                    {filteredFollowers.length > 0 ? (
                      filteredFollowers.map((friend) => (
                        <button
                          key={friend.id}
                          className="flex w-full items-center justify-between gap-3 bg-[#141414] px-3 py-2.5 text-left transition-colors hover:bg-[#1c1c1c]"
                          onClick={() => handleAddRecipient(friend.id)}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[#f5f0de]">@{friend.username}</p>
                            <p className="truncate text-xs text-white/40">{friend.name}</p>
                          </div>

                          <div
                            className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                              selectedRecipients.find((recipient) => recipient.id === friend.id)
                                ? "border-[#ff7a1a] bg-[#ff7a1a] text-[#0a0a0a]"
                                : "border-white/20 text-transparent"
                            }`}
                          >
                            ✓
                          </div>
                        </button>
                      ))
                    ) : (
                      <p className="py-4 text-center text-sm text-white/45">No friends found</p>
                    )}
                  </div>

                  {selectedRecipients.length > 0 && (
                    <div className="py-1.5">
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-white/45">
                        Selected: {selectedRecipients.length} friend{selectedRecipients.length !== 1 ? "s" : ""}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-white/65">
                        {selectedRecipients.map((recipient, index) => (
                          <span key={recipient.id} className="inline-flex items-center gap-2">
                            <span className="text-[#f5f0de]">@{recipient.username}</span>
                            <button
                              onClick={() => handleRemoveRecipient(recipient.id)}
                              className="text-white/45 hover:text-[#ff7a1a]"
                            >
                              ×
                            </button>
                            {index < selectedRecipients.length - 1 && <span className="text-white/25">•</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 border-t border-white/10 pt-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label className="text-sm font-medium text-[#f5f0de]">Note <span className="text-white/40">(optional)</span></label>
                      <span className="text-xs text-white/35">{shareNote.length}/300</span>
                    </div>
                    <textarea
                      value={shareNote}
                      onChange={(e) => setShareNote(e.target.value.slice(0, 300))}
                      placeholder="Add a message..."
                      className="field min-h-20 resize-none py-2.5 text-sm"
                      rows={2}
                      maxLength={300}
                    />
                  </div>
                </div>
              </div>

              <div className="relative z-0 flex items-center justify-between gap-3 border-t border-white/10 px-0 pt-5">
                <button
                  onClick={() => {
                    if (currentStep > 1) {
                      setCurrentStep(currentStep - 1);
                    }
                  }}
                  disabled={currentStep === 1}
                  className={`action ${currentStep === 1 ? "cursor-not-allowed opacity-40" : ""}`}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>

                <div className="flex gap-3">
                  {currentStep === 1 && (
                    <button
                      onClick={() => setCurrentStep(2)}
                      disabled={selectedContents.length === 0}
                      className={`action-primary gap-2 ${selectedContents.length === 0 ? "cursor-not-allowed opacity-40" : ""}`}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  )}

                  {currentStep === 2 && (
                    <button
                      onClick={handleShare}
                      disabled={selectedRecipients.length === 0 || sending}
                      className={`action-primary gap-2 ${
                        selectedRecipients.length === 0 || sending ? "cursor-not-allowed opacity-40" : ""
                      }`}
                    >
                      <SendHorizontal className="h-4 w-4" />
                      Share
                    </button>
                  )}
                </div>
              </div>
            </section>
          ) : (
            <section>
              <div className="pb-5">
                <h2 className="mt-1 text-lg font-black tracking-tight text-[#f5f0de] sm:text-2xl">
                  {historyDirection === "sent" ? "Sent to Others" : "Received from Others"}
                </h2>
              </div>

              <div className="pt-5">
                <div className="mb-4 flex w-fit gap-1 rounded-[20px] border border-[#292929] bg-[#111111] p-1">
                  <button
                    type="button"
                    onClick={() => setHistoryDirection("sent")}
                    className={`rounded-[16px] px-5 py-2.5 text-xs font-bold transition sm:px-7 sm:py-3 sm:text-base ${
                      historyDirection === "sent" ? "bg-[#ff7a1a] text-black" : "text-white/50 hover:text-[#f5f0de]"
                    }`}
                  >
                    Sent
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryDirection("received")}
                    className={`rounded-[16px] px-5 py-2.5 text-xs font-bold transition sm:px-7 sm:py-3 sm:text-base ${
                      historyDirection === "received" ? "bg-[#ff7a1a] text-black" : "text-white/50 hover:text-[#f5f0de]"
                    }`}
                  >
                    Received
                  </button>
                </div>
                <input
                  type="text"
                  placeholder={`Search ${historyDirection === "sent" ? "sent" : "received"} titles...`}
                  value={sharedSearchQuery}
                  onChange={(e) => setSharedSearchQuery(e.target.value)}
                  className="mb-4 w-full rounded-lg border border-white/10 bg-[#111111] px-3.5 py-2.5 text-sm text-[#f5f0de] outline-none placeholder:text-white/35 focus:border-[#ff7a1a]/60"
                />

                {filteredHistoryShares.length > 0 ? (
                  <div className="grid max-h-[50rem] grid-cols-2 gap-2.5 overflow-y-auto pr-1 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
                    {filteredHistoryShares.map((share) => {
                      const item = share.movie || share.content;
                      const otherUser = historyDirection === "sent" ? share.receiver : share.sender;

                      return (
                        <div
                          key={share.id}
                          className="group relative overflow-hidden rounded-xl border border-white/10 bg-[#0b0d10] transition hover:border-[#ff7a1a]/50 hover:bg-[#111111]"
                        >
                          <button type="button" onClick={() => openShareDetails(share)} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ff7a1a]">
                            <div className="relative aspect-[2/3] overflow-hidden rounded-t-xl bg-[#1a1a1a]">
                              {item?.poster_url ? (
                                <img loading="lazy" src={item.poster_url} alt={item.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                              ) : (
                                <div className="flex h-full items-center justify-center text-xs text-white/35">No poster</div>
                              )}
                              {share.content_type && (
                                <span className="absolute left-2 top-2 rounded-md border border-white/15 bg-black/80 px-2 py-1 text-[8px] font-black uppercase tracking-[0.14em] text-[#ffb36b] sm:text-[10px]">
                                  {share.content_type === "tv" ? "TV Show" : "Movie"}
                                </span>
                              )}
                            </div>
                            <div className="min-h-24 rounded-b-xl border-t border-white/10 p-2.5 sm:p-3">
                              <p className="truncate text-[10px] font-bold text-[#f5f0de] sm:text-sm">{item?.title || "Unknown"}</p>
                              <p className="mt-1 truncate text-xs font-medium text-white/65 sm:text-sm">
                                {historyDirection === "sent" ? "To" : "From"} @{otherUser?.username || "unknown"}
                              </p>
                              {share.note && <p className="mt-2 line-clamp-2 text-[9px] italic text-white/55 sm:text-xs">&quot;{share.note}&quot;</p>}
                              <p className="mt-2 text-xs font-medium text-white/65 sm:text-sm">{new Date(share.created_at).toLocaleDateString()}</p>
                            </div>
                          </button>
                          <div className="absolute right-2 top-2">
                            <button
                              type="button"
                              aria-label={`Delete ${historyDirection === "sent" ? "sent" : "received"} share of ${item?.title || "title"}`}
                              title="Delete share"
                              onClick={() => handleRemoveShare(share.id)}
                              className="rounded-lg border border-white/15 bg-black/75 p-1.5 text-white/70 transition hover:border-[#ff7a1a]/60 hover:text-[#ff9b52]"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-[#111111] px-5 py-12 text-center">
                    <p className="font-bold text-[#f5f0de]">
                      {historyDirection === "sent" ? "No titles sent yet" : "No titles received yet"}
                    </p>
                    <p className="mt-1 text-sm text-white/45">
                      {historyDirection === "sent" ? "Share a title with a friend to see it here." : "Titles your friends share with you will appear here."}
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {selectedShare && user && (
        <ShareModal
          key={selectedShare.id}
          share={selectedShare}
          currentUserId={user.id}
          onClose={() => setSelectedShare(null)}
          user={user}
          theme="brutalist"
        />
      )}

      {showWatchConflictModal && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-sm sm:items-center">
          <div className="w-full max-w-lg rounded-t-[2rem] border border-white/10 bg-[#111111] p-4 text-[#f5f0de] shadow-2xl sm:rounded-[2rem] sm:p-6">
            <h3 className="text-lg font-semibold text-[#f5f0de] sm:text-xl">Some titles were already watched</h3>
            <p className="mt-2 text-sm text-white/65">These friends have already watched these titles. You can send everything or skip those pairs.</p>
            <div className="mt-4 max-h-48 overflow-y-auto rounded-2xl bg-white/5 p-3">
              {watchConflicts.map(({ recipient, content }) => (
                <p key={`${recipient.id}:${contentKey(content)}`} className="py-1 text-sm text-[#f5f0de]">@{recipient.username} — {content.title}</p>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowWatchConflictModal(false);
                  setPendingShareRecipients([]);
                  setWatchConflicts([]);
                }}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-[#f5f0de] hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendOnlyUnwatched}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-[#f5f0de] hover:bg-white/5"
              >
                Skip watched titles
              </button>
              <button
                type="button"
                onClick={handleSendAnyway}
                className="rounded-xl bg-[#ff7a1a] px-4 py-2.5 text-sm font-semibold text-[#0a0a0a] hover:bg-[#ff8d3b]"
              >
                Send anyway
              </button>
            </div>
          </div>
        </div>
      )}

      </PageLayout>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={null}>
      <SharePageContent />
    </Suspense>
  );
}
