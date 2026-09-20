"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import { User, List, ListWithItems } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import {
  getUserLists,
  getPublicLists,
  createList,
  getListCoverImages,
  getListWithDetails,
  syncListCollaboratorIds,
} from "@/lib/lists";
import { Film, Globe, Loader2, Lock, Plus } from "lucide-react";
import Link from "next/link";
import { AnimatedBackground } from "@/components/core/animated-background";

type DiscoverList = ListWithItems & {
  engagementScore: number;
};

const brutalText = "text-[#f5f0de]";
const brutalMuted = "text-white/55";

const shelfAccentPairs = [
  { base: "#f6a43a", glow: "rgba(246, 164, 58, 0.34)" },
  { base: "#47a9ff", glow: "rgba(71, 169, 255, 0.3)" },
  { base: "#64d2a3", glow: "rgba(100, 210, 163, 0.28)" },
  { base: "#ff7f6e", glow: "rgba(255, 127, 110, 0.28)" },
  { base: "#a88bff", glow: "rgba(168, 139, 255, 0.24)" },
];

function matchesQuery(list: List, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return (
    list.name.toLowerCase().includes(normalized) ||
    (list.description || "").toLowerCase().includes(normalized) ||
    list.owner_id.toLowerCase().includes(normalized)
  );
}

function getDisplayName(user?: User | null, fallback = "Unknown") {
  const name = user?.name?.trim();
  if (name) return name;

  const username = user?.username?.trim();
  if (username) return username;

  return fallback;
}

function buildListAttribution(list: DiscoverList, currentUserId: string) {
  const ownerEntry = list.collaborators.find((collab) => collab.role === "owner" || collab.user_id === list.owner_id);
  const creatorName = list.owner_id === currentUserId
    ? "You"
    : getDisplayName(ownerEntry?.user, list.owner_id);

  const collaboratorNames = list.collaborators
    .filter((collab) => collab.user_id !== list.owner_id)
    .map((collab) => getDisplayName(collab.user))
    .filter((name) => name && name !== "Unknown");

  const firstCollaborator = collaboratorNames[0] ?? null;
  const extraCollaborators = Math.max(0, collaboratorNames.length - 1);

  return {
    creatorName,
    creatorUser: ownerEntry?.user ?? null,
    firstCollaborator,
    extraCollaborators,
    collaboratorCountLabel: collaboratorNames.length,
  };
}

function getShelfAccent(listId: string) {
  const hash = Array.from(listId).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return shelfAccentPairs[hash % shelfAccentPairs.length];
}

function ListCard({
  list,
  coverImages,
  compact,
  currentUserId,
}: {
  list: DiscoverList;
  coverImages: string[];
  compact: boolean;
  currentUserId: string;
}) {
  const attribution = buildListAttribution(list, currentUserId);
  const hasCustomCover = list.cover_type === "custom" && Boolean(list.cover_image_url);
  const shelfAccent = getShelfAccent(list.id);
  const visibleShelves = (hasCustomCover && list.cover_image_url
    ? [list.cover_image_url, ...coverImages]
    : coverImages
  ).slice(0, 4);
  const shelfHeightClass = compact ? "h-[150px] sm:h-[224px] lg:h-[258px]" : "h-[296px]";
  const description = list.description?.trim();

  const content = (
    <div
      className={
        compact
          ? "group mx-auto w-full max-w-[920px] py-2 transition sm:py-3"
          : "group cursor-pointer overflow-hidden rounded-[28px] border border-white/10 bg-[#111111] p-4 transition hover:border-[#ff7a1a]/45 hover:bg-[#151515]"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {compact ? (
            <div className="mb-2 flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5">
                {attribution.creatorUser?.avatar_url ? (
                  <img
                    src={attribution.creatorUser.avatar_url}
                    alt={attribution.creatorName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-[#f5f0de] text-[10px] font-bold text-[#0a0a0a]">
                    {attribution.creatorName.charAt(0).toUpperCase()}
                  </span>
                )}
              </span>
              <p className="text-xs font-medium text-[#f5f0de] sm:text-sm">
                {attribution.creatorName}
              </p>
            </div>
          ) : null}
          <h3 className={`line-clamp-2 font-semibold ${compact ? "text-[#f5f0de]" : brutalText} ${compact ? "text-base sm:text-lg" : "text-base"} group-hover:text-[#ffb36b]`}>
            {list.name}
          </h3>
          {compact ? (
            null
          ) : (
            <>
              <div className={`mt-1 flex items-center gap-2 text-xs sm:text-sm ${brutalMuted}`}>
                <span className="truncate">By {attribution.creatorName}</span>
                {attribution.collaboratorCountLabel > 0 && (
                  <span className="flex-shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                    +{attribution.collaboratorCountLabel}
                  </span>
                )}
              </div>
              {description && (
                <p className="mt-2 line-clamp-2 text-xs text-white/45 sm:text-sm">
                  {description}
                </p>
              )}
            </>
          )}
        </div>

        {compact ? null : (
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-[#f5f0de] sm:h-12 sm:w-12">
            {list.privacy === "private" ? <Lock className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
          </div>
        )}
      </div>

      <div className={`relative isolate mt-0 overflow-hidden rounded-none ${compact ? "" : "bg-[#f4efe7]"} px-3 pt-3 ${shelfHeightClass}`}>

        {visibleShelves.length > 0 ? (
          <div className={`absolute inset-x-5 ${compact ? "bottom-[0.8rem] top-2 lg:bottom-[1.1rem] lg:top-0" : "bottom-[1.1rem] top-4"} z-10 flex items-end justify-center`}>
            <div className="flex w-full max-w-[760px] items-end justify-center gap-3 lg:max-w-[860px] lg:gap-8">
            {visibleShelves.map((url, idx) => (
              <div
                key={`${list.id}:shelf:${idx}`}
                className="group/poster relative w-[22%] flex-none transition-transform duration-200 lg:w-[18.5%]"
                style={{
                  zIndex: 10 + idx,
                  transform: idx === 1
                    ? "translateY(0px) rotate(0deg)"
                    : idx === 0
                      ? "translateX(10%) translateY(2px) rotate(0deg)"
                      : "translateX(-10%) translateY(2px) rotate(0deg)",
                }}
              >
                <div className={`overflow-hidden rounded-none border ${compact ? "border-white/10 bg-[#050505]" : "border-black/10 bg-[#ddd6c8]"} shadow-[0_10px_18px_rgba(0,0,0,0.18)]`}>
                  <img
                    src={url}
                    alt={`${list.name} cover ${idx + 1}`}
                    className={`w-full ${compact ? "aspect-[2/3] object-contain bg-[#050505] lg:aspect-[2/3]" : "h-full object-cover aspect-[0.68]"}`}
                  />
                </div>
              </div>
            ))}
            </div>
          </div>
        ) : (
          <div className={`absolute inset-x-5 ${compact ? "bottom-[0.8rem] top-2 lg:bottom-[1.1rem] lg:top-0" : "bottom-[1.1rem] top-5"} z-10 flex items-end justify-center`}>
            <div className="flex w-full max-w-[760px] items-end justify-center gap-3 lg:max-w-[860px] lg:gap-8">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={`${list.id}:placeholder:${idx}`}
                className="relative w-[22%] flex-none lg:w-[18.5%]"
                style={{
                  transform: idx === 1
                    ? "translateY(0px) rotate(0deg)"
                    : idx === 0
                      ? "translateX(10%) translateY(2px) rotate(0deg)"
                      : "translateX(-10%) translateY(2px) rotate(0deg)",
                }}
              >
                <div className={`flex items-center justify-center rounded-none border ${compact ? "border-white/10 bg-[#111111]" : "border-black/10 bg-[linear-gradient(180deg,#d7d0c2,#bfb6a6)]"} shadow-[0_10px_18px_rgba(0,0,0,0.16)] ${compact ? "aspect-[0.66]" : "aspect-[0.68]"}`}>
                  <Plus className="h-7 w-7 text-black/35" />
                </div>
              </div>
            ))}
            </div>
          </div>
        )}

        <div
          className={`absolute inset-x-4 ${compact ? "bottom-3 h-[2.1rem] lg:h-[2.7rem]" : "bottom-3 h-[3.7rem]"} z-30 rounded-none border border-white/28`}
          style={{
            background: compact
              ? `linear-gradient(180deg, color-mix(in srgb, ${shelfAccent.base} 52%, white 28%), color-mix(in srgb, ${shelfAccent.base} 62%, transparent 18%))`
              : `linear-gradient(180deg, color-mix(in srgb, ${shelfAccent.base} 68%, white 14%), color-mix(in srgb, ${shelfAccent.base} 88%, black 4%))`,
            boxShadow: `0 12px 20px rgba(0,0,0,0.14)`,
            opacity: compact ? 0.54 : 0.72,
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        />
        <div className={`absolute inset-x-5 ${compact ? "bottom-[2.6rem] lg:bottom-[3.15rem]" : "bottom-[3.9rem]"} z-40 h-px bg-white/55`} />
        <div className={`absolute inset-x-8 ${compact ? "bottom-[2.1rem] lg:bottom-[2.75rem]" : "bottom-[3.45rem]"} z-40 h-3 bg-white/20 blur-md`} />
        <div className={`absolute inset-x-7 bottom-2 z-20 h-4 ${compact ? "bg-black/28" : "bg-black/12"} blur-md`} />
        <div className={`absolute left-7 ${compact ? "top-[calc(100%-2.1rem)] lg:top-[calc(100%-2.45rem)]" : "top-[calc(100%-2.9rem)]"} z-50 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35 bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,0.98),rgba(205,212,220,0.8)_32%,rgba(94,101,113,0.92)_100%)] shadow-[0_2px_5px_rgba(0,0,0,0.24)]`} />
        <div className={`absolute right-7 ${compact ? "top-[calc(100%-2.1rem)] lg:top-[calc(100%-2.45rem)]" : "top-[calc(100%-2.9rem)]"} z-50 h-4 w-4 translate-x-1/2 -translate-y-1/2 rounded-full border border-white/35 bg-[radial-gradient(circle_at_35%_35%,rgba(255,255,255,0.98),rgba(205,212,220,0.8)_32%,rgba(94,101,113,0.92)_100%)] shadow-[0_2px_5px_rgba(0,0,0,0.24)]`} />

        {!compact ? (
          <div className="absolute inset-x-4 bottom-0 flex items-center justify-between px-2 py-3">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-black/65">
              <Film className="h-3.5 w-3.5" />
              {list.item_count} {list.item_count === 1 ? "title" : "titles"}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );

  return <Link href={`/lists/${list.id}`}>{content}</Link>;
}
export default function ListsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userLists, setUserLists] = useState<DiscoverList[]>([]);
  const [publicLists, setPublicLists] = useState<DiscoverList[]>([]);
  const [listCovers, setListCovers] = useState<Record<string, string[]>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [newListDescription, setNewListDescription] = useState("");
  const [newListPrivacy, setNewListPrivacy] = useState<"private" | "public">("private");
  const [newListIsRanked, setNewListIsRanked] = useState<boolean | null>(null);
  const [creatingList, setCreatingList] = useState(false);
  const [activeSection, setActiveSection] = useState<"global" | "friends" | "your">("global");
  const [globalSearch, setGlobalSearch] = useState("");
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
        // Fetch user
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();

        const currentUser: User = {
          id: userData?.id || firebaseUser.uid,
          username: userData?.username || "user",
          name: userData?.name || firebaseUser.displayName || "User",
          avatar_url: userData?.avatar_url || null,
          created_at: userData?.createdAt || new Date().toISOString(),
        };

        setUser(currentUser);

        // Fetch user's lists
        const lists = await getUserLists(currentUser.id);
        const userListsWithDetails = await Promise.all(
          lists.map(async (list) => {
            const details = await getListWithDetails(list.id);
            if (!details) return null;

            const collaboratorCount = details.collaborators.filter((collab) => collab.user_id !== details.owner_id).length;
            const watchSignal = details.items.reduce((sum, item) => sum + (item.watched_by?.length || 0), 0);

            return {
              ...details,
              engagementScore: details.item_count * 2 + collaboratorCount * 3 + watchSignal,
            };
          })
        );
        const resolvedUserLists = userListsWithDetails.filter((list): list is DiscoverList => Boolean(list));
        setUserLists(resolvedUserLists);

        if (currentUser.id) {
          await Promise.all(
            resolvedUserLists
              .filter((list) => list.owner_id === currentUser.id)
              .filter((list) => !list.collaborator_ids || Object.keys(list.collaborator_ids).length === 0)
              .map((list) =>
                syncListCollaboratorIds(
                  list.id,
                  [list.owner_id, ...list.collaborators.map((collab) => collab.user_id)]
                )
              )
          );
        }

        // Fetch cover images for each list
        const covers: Record<string, string[]> = {};
        for (const list of lists) {
          covers[list.id] = await getListCoverImages(list.id);
        }
        setListCovers(covers);

        // Fetch public lists and sort by engagement
        const publicListsBase = await getPublicLists(30);
        const publicListsWithDetails = await Promise.all(
          publicListsBase.map(async (list) => {
            const details = await getListWithDetails(list.id);
            if (!details) return null;

            const collaboratorCount = details.collaborators.filter((collab) => collab.user_id !== details.owner_id).length;
            const watchSignal = details.items.reduce((sum, item) => sum + (item.watched_by?.length || 0), 0);

            return {
              ...details,
              engagementScore: details.item_count * 2 + collaboratorCount * 3 + watchSignal,
            };
          })
        );
        setPublicLists(
          publicListsWithDetails
            .filter((list): list is DiscoverList => Boolean(list))
        );

        const publicCovers: Record<string, string[]> = {};
        for (const list of publicListsBase) {
          publicCovers[list.id] = await getListCoverImages(list.id);
        }
        setListCovers((prev) => ({ ...prev, ...publicCovers }));

        setLoading(false);
      } catch (error) {
        console.error("Error fetching lists:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleCreateList = async () => {
    if (!user || !newListName.trim() || newListIsRanked === null) return;

    try {
      setCreatingList(true);
      const createdList = await createList(
        user.id,
        newListName,
        newListDescription || null,
        newListPrivacy,
        newListIsRanked
      );

      // Reset form
      setNewListName("");
      setNewListDescription("");
      setNewListPrivacy("private");
      setNewListIsRanked(null);
      setShowCreateModal(false);

      // Navigate to the new list
      router.push(`/lists/${createdList.id}`);
    } catch (error) {
      console.error("Error creating list:", error);
      alert("Failed to create list");
    } finally {
      setCreatingList(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const currentUserId = user?.id ?? "";

  const ownedLists = useMemo(
    () => userLists.filter((list) => list.owner_id === currentUserId),
    [userLists, currentUserId]
  );

  const friendLists = useMemo(
    () => userLists.filter((list) => list.owner_id !== currentUserId),
    [userLists, currentUserId]
  );

  const filteredPublicLists = useMemo(
    () => publicLists.filter((list) => matchesQuery(list, globalSearch)),
    [publicLists, globalSearch]
  );

  const filteredFriendLists = useMemo(
    () => friendLists.filter((list) => matchesQuery(list, globalSearch)),
    [friendLists, globalSearch]
  );

  const filteredOwnedLists = useMemo(
    () => ownedLists.filter((list) => matchesQuery(list, globalSearch)),
    [ownedLists, globalSearch]
  );

  if (!user) {
    return null;
  }

  return (
    <PageLayout user={user} onSignOut={handleSignOut} theme="brutalist">
      <div className="mx-auto min-h-screen w-full max-w-[860px] space-y-8 bg-black px-1 py-4 sm:px-4 sm:py-6">
        <div className="sticky top-16 z-20 -mx-1 space-y-4 border-b border-white/5 bg-black/95 px-1 pb-4 pt-1 backdrop-blur-xl sm:-mx-4 sm:px-4">
          <div className="rounded-[14px] border border-white/10 bg-[#111111] p-[3px]">
            <AnimatedBackground
              defaultValue={activeSection}
              value={activeSection}
              onValueChange={(value) => setActiveSection(value as "global" | "friends" | "your")}
              className="rounded-[11px] bg-[#ff7a1a]"
              transition={{
                ease: "easeInOut",
                duration: 0.2,
              }}
            >
              <button
                data-id="global"
                type="button"
                aria-label="Global lists view"
                className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[11px] px-2 py-3 text-xs font-semibold transition-transform active:scale-[0.98] sm:gap-2 sm:text-sm ${
                  activeSection === "global" ? "text-[#111111]" : "text-white/75"
                }`}
              >
                Global
              </button>
              <button
                data-id="friends"
                type="button"
                aria-label="Friends lists view"
                className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[11px] px-2 py-3 text-xs font-semibold transition-transform active:scale-[0.98] sm:gap-2 sm:text-sm ${
                  activeSection === "friends" ? "text-[#111111]" : "text-white/75"
                }`}
              >
                Friends
              </button>
              <button
                data-id="your"
                type="button"
                aria-label="Your lists view"
                className={`inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-[11px] px-2 py-3 text-xs font-semibold transition-transform active:scale-[0.98] sm:gap-2 sm:text-sm ${
                  activeSection === "your" ? "text-[#111111]" : "text-white/75"
                }`}
              >
                Your Lists
              </button>
            </AnimatedBackground>
          </div>

            <div className="flex w-full items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Search all list sections..."
                  className="w-full rounded-full border border-white/15 bg-[#0b0d10] px-4 py-3.5 text-sm text-[#f5f0de] outline-none placeholder:text-white/40 focus:border-[#ff7a1a]/70 focus:ring-2 focus:ring-[#ff7a1a]/10 sm:text-base"
                />
              </div>
            </div>
        </div>

        {activeSection === "global" && (
          <section className="scroll-mt-28">
            {filteredPublicLists.length > 0 ? (
              <div className="space-y-4">
                {filteredPublicLists.map((list) => (
                  <ListCard
                    key={list.id}
                    list={list}
                    coverImages={listCovers[list.id] || []}
                    compact
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-white/10 bg-[#111111] py-12 text-center text-white/55">
                No public lists match your search.
              </div>
            )}
          </section>
        )}

        {activeSection === "friends" && (
          <section className="scroll-mt-28">
            <div className="mb-3 flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#f5f0de]">Friends&apos; Lists</h2>
              </div>
            </div>

            {filteredFriendLists.length > 0 ? (
              <div className="space-y-4">
                {filteredFriendLists.map((list) => (
                  <ListCard
                    key={list.id}
                    list={list}
                    coverImages={listCovers[list.id] || []}
                    compact
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-white/10 bg-[#111111] py-12 text-center text-white/55">
                No friends&apos; lists match your search.
              </div>
            )}
          </section>
        )}

        {activeSection === "your" && (
          <section className="scroll-mt-28">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-bold text-[#f5f0de]">Your Lists</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#ff7a1a] px-4 py-3 text-sm font-medium text-[#0a0a0a] transition-colors hover:bg-[#ff8d3b]"
                >
                  <Plus className="h-4 w-4" />
                  Create List
                </button>
              </div>
            </div>

            {filteredOwnedLists.length > 0 ? (
              <div className="space-y-4">
                {filteredOwnedLists.map((list) => (
                  <ListCard
                    key={list.id}
                    list={list}
                    coverImages={listCovers[list.id] || []}
                    compact
                    currentUserId={currentUserId}
                  />
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-white/10 bg-[#111111] py-12 text-center text-white/55">
                No lists match your search.
              </div>
            )}
          </section>
        )}

      {/* Create List Modal */}
      {/* Create List Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md border border-white/10 bg-[#111111] p-8 text-[#f5f0de]">
            <h3 className="mb-4 text-2xl font-bold text-[#f5f0de]">Create a New List</h3>

            <div className="space-y-4">
              {/* Name Input */}
              <div>
                <label className="mb-2 block text-sm font-medium text-white/65">
                  List Name *
                </label>
                <input
                  type="text"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g., Sci-Fi Classics"
                  className="field px-4 py-2"
                />
              </div>

              {/* Description Input */}
              <div>
                <label className="mb-2 block text-sm font-medium text-white/65">
                  Description
                </label>
                <textarea
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  placeholder="Add a description (optional)"
                  rows={3}
                  className="field resize-none px-4 py-2"
                />
              </div>

              {/* Privacy Toggle */}
              <div>
                <label className="mb-2 block text-sm font-medium text-white/65">
                  Privacy
                </label>
                <div className="flex gap-3">
                  <button
                    onClick={() => setNewListPrivacy("private")}
                    className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      newListPrivacy === "private"
                        ? "bg-[#ff7a1a] text-[#0a0a0a]"
                        : "bg-white/5 text-[#f5f0de] hover:bg-white/10"
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    Private
                  </button>
                  <button
                    onClick={() => setNewListPrivacy("public")}
                    className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      newListPrivacy === "public"
                        ? "bg-[#ff7a1a] text-[#0a0a0a]"
                        : "bg-white/5 text-[#f5f0de] hover:bg-white/10"
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    Public
                  </button>
                </div>
              </div>

              {/* List Type Selection */}
              <div>
                <label className="mb-2 block text-sm font-medium text-white/65">
                  List Type *
                </label>
                <div className="space-y-2">
                  <button
                    onClick={() => setNewListIsRanked(false)}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors text-left border-2 ${
                      newListIsRanked === false
                        ? "border-[#ff7a1a] bg-white/5"
                        : "border-white/10 bg-[#0d0d0d] hover:border-white/20"
                    }`}
                  >
                    <div className="font-semibold text-[#f5f0de]">Regular List</div>
                    <div className="mt-1 text-xs text-white/55">
                      Add movies in any order. Drag to reorder.
                    </div>
                  </button>
                  <button
                    onClick={() => setNewListIsRanked(true)}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors text-left border-2 ${
                      newListIsRanked === true
                        ? "border-[#ff7a1a] bg-white/5"
                        : "border-white/10 bg-[#0d0d0d] hover:border-white/20"
                    }`}
                  >
                    <div className="font-semibold text-[#f5f0de]">Ranked List</div>
                    <div className="mt-1 text-xs text-white/55">
                      Rank movies from best to worst with numbers displayed.
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 rounded-lg border border-white/10 px-4 py-2 font-medium text-[#f5f0de] transition-colors hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateList}
                disabled={!newListName.trim() || newListIsRanked === null || creatingList}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#ff7a1a] px-4 py-2 font-medium text-[#0a0a0a] transition-colors hover:bg-[#ff8d3b] disabled:bg-white/10 disabled:text-white/35"
              >
                {creatingList ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    Create
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </PageLayout>
  );
}
