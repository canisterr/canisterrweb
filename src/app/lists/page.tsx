"use client";

import { useMemo, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import CinematicLoading from "@/components/CinematicLoading";
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
import { Film, Globe, ListFilter, Loader2, Lock, Plus, Search, Users } from "lucide-react";
import Link from "next/link";
import { AnimatedBackground } from "@/components/core/animated-background";

type ViewMode = "grid" | "list";

type DiscoverList = ListWithItems & {
  engagementScore: number;
};

const brutalText = "text-[#f5f0de]";
const brutalMuted = "text-white/55";
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
    firstCollaborator,
    extraCollaborators,
    collaboratorCountLabel: collaboratorNames.length,
  };
}

function getCollaboratorAvatarKey(listId: string, collaborator: ListWithItems["collaborators"][number], index: number) {
  return `${listId}:${collaborator.id || collaborator.user_id || "collaborator"}:${index}`;
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
  const coverClassName = compact
    ? "relative h-24 w-24 flex-shrink-0 overflow-hidden rounded-xl bg-[#1a1a1a] sm:h-32 sm:w-32"
    : "relative aspect-square w-full overflow-hidden rounded-xl bg-[#1a1a1a]";
  const visibleCollaborators = list.collaborators.slice(0, 4);

  const content = (
    <div
      className={
        compact
          ? "group flex min-h-32 items-center gap-3 rounded-2xl border border-white/10 bg-[#0b0d10] p-3 transition hover:border-[#ff7a1a]/45 hover:bg-[#0e1014] sm:gap-5"
          : "group cursor-pointer rounded-2xl border border-white/10 bg-[#0b0d10] p-3 transition hover:border-[#ff7a1a]/45"
      }
    >
      <div className={coverClassName}>
        {hasCustomCover && list.cover_image_url ? (
          <img
            src={list.cover_image_url}
            alt={list.name}
            className="h-full w-full object-cover"
          />
        ) : coverImages.length === 1 ? (
          <img
            src={coverImages[0]}
            alt={list.name}
            className="h-full w-full object-cover"
          />
        ) : coverImages.length > 1 ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-black">
            {coverImages.slice(0, 4).map((url, idx) => (
              <div key={idx} className="h-full w-full overflow-hidden">
                <img src={url} alt={`Cover ${idx + 1}`} className="h-full w-full object-cover" />
              </div>
            ))}
            {coverImages.length === 3 && <div className="h-full w-full bg-[#1a1a1a]" />}
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#1a1a1a]">
            <Plus className="w-12 h-12 text-white/35" />
          </div>
        )}

      </div>

      <div className={compact ? "flex min-w-0 flex-1 items-center self-stretch" : "mt-3"}>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <h3 className={`line-clamp-2 font-semibold ${brutalText} ${compact ? "text-sm sm:text-lg" : "text-base"} group-hover:text-[#ffb36b]`}>
              {list.name}
            </h3>
            <div className={`mt-1 flex items-center gap-2 text-xs sm:text-sm ${brutalMuted}`}>
              <span className="truncate">
                By {attribution.creatorName}
              </span>
              {attribution.collaboratorCountLabel > 0 && (
                <span className="flex-shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/70">
                  +{attribution.collaboratorCountLabel}
                </span>
              )}
            </div>

            <div className="mt-4 flex items-center gap-3">
              {visibleCollaborators.length > 0 && (
                <div className="flex -space-x-2">
                  {visibleCollaborators.map((collaborator, index) => (
                    <span
                      key={getCollaboratorAvatarKey(list.id, collaborator, index)}
                      className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full border-2 border-[#0b0d10] bg-[#26292e] text-[8px] font-bold text-[#f5f0de]"
                    >
                      {collaborator.user.avatar_url ? (
                        <img src={collaborator.user.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        getDisplayName(collaborator.user, "U").charAt(0).toUpperCase()
                      )}
                    </span>
                  ))}
                </div>
              )}
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#ff8d3b]">
                <Film className="h-3.5 w-3.5" />
                {list.item_count} {list.item_count === 1 ? "title" : "titles"}
              </span>
            </div>
          </div>

          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-[#f5f0de] sm:h-12 sm:w-12">
            {list.privacy === "private" ? <Lock className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
          </div>
        </div>
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
  const [sectionViews, setSectionViews] = useState<Record<"global" | "friends" | "your", ViewMode>>({
    global: "list",
    friends: "list",
    your: "list",
  });
  const [showViewMenu, setShowViewMenu] = useState(false);

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

  if (loading || !user) {
    return <CinematicLoading message="Your lists are loading" />;
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
              className="rounded-[11px] bg-[#f5f0de]"
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
                <Globe className="h-4 w-4 flex-shrink-0" />
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
                <Users className="h-4 w-4 flex-shrink-0" />
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
                <Lock className="h-4 w-4 flex-shrink-0" />
                Your Lists
              </button>
            </AnimatedBackground>
          </div>

            <div className="flex w-full items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/45" />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Search all list sections..."
                  className="w-full rounded-full border border-white/15 bg-[#0b0d10] py-3.5 pl-12 pr-4 text-sm text-[#f5f0de] outline-none placeholder:text-white/40 focus:border-[#ff7a1a]/70 focus:ring-2 focus:ring-[#ff7a1a]/10 sm:text-base"
                />
              </div>
              <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => setShowViewMenu((prev) => !prev)}
                  className="flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-[#0b0d10] text-[#f5f0de] transition hover:border-[#ff7a1a]/45 hover:bg-white/[0.06]"
                  aria-label="Open view menu"
                  title="Open view menu"
                >
                  <ListFilter className="h-5 w-5" />
                </button>
                {showViewMenu && (
                  <div className="menu-panel absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden border border-white/10 bg-[#111111] py-2 text-[#f5f0de] shadow-2xl">
                    <div className="px-4 pb-2 pt-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                      View mode
                    </div>
                    <div className="px-2 pb-1">
                      <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                        {activeSection === "global"
                          ? "Global"
                          : activeSection === "friends"
                          ? "Friends"
                          : "Your"}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSectionViews((prev) => ({ ...prev, [activeSection]: "list" }));
                            setShowViewMenu(false);
                          }}
                          className={`rounded-lg px-3 py-2 text-sm font-medium ${
                            sectionViews[activeSection] === "list"
                              ? "bg-[#ff7a1a] text-[#0a0a0a]"
                              : "bg-white/5 text-[#f5f0de] hover:bg-white/10"
                          }`}
                        >
                          List
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSectionViews((prev) => ({ ...prev, [activeSection]: "grid" }));
                            setShowViewMenu(false);
                          }}
                          className={`rounded-lg px-3 py-2 text-sm font-medium ${
                            sectionViews[activeSection] === "grid"
                              ? "bg-[#ff7a1a] text-[#0a0a0a]"
                              : "bg-white/5 text-[#f5f0de] hover:bg-white/10"
                          }`}
                        >
                          Grid
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
        </div>

        {activeSection === "global" && (
          <section className="scroll-mt-28">
            {filteredPublicLists.length > 0 ? (
              <div
                className={
                  sectionViews.global === "grid"
                    ? "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-5"
                    : "space-y-3"
                }
              >
                {filteredPublicLists.map((list) => (
                  <ListCard
                    key={list.id}
                    list={list}
                    coverImages={listCovers[list.id] || []}
                    compact={sectionViews.global === "list"}
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
                <p className="text-sm text-white/55">Collaborative and shared lists from your network.</p>
              </div>
            </div>

            {filteredFriendLists.length > 0 ? (
              <div
                className={
                  sectionViews.friends === "grid"
                    ? "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-5"
                    : "space-y-3"
                }
              >
                {filteredFriendLists.map((list) => (
                  <ListCard
                    key={list.id}
                    list={list}
                    coverImages={listCovers[list.id] || []}
                    compact={sectionViews.friends === "list"}
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
            <div className="mb-3 flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-bold text-[#f5f0de]">Your Lists</h2>
                <p className="text-sm text-white/55">Everything you own, ready to organize and share.</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
              <div
                className={
                  sectionViews.your === "grid"
                    ? "grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 xl:grid-cols-5"
                    : "space-y-3"
                }
              >
                {filteredOwnedLists.map((list) => (
                  <ListCard
                    key={list.id}
                    list={list}
                    coverImages={listCovers[list.id] || []}
                    compact={sectionViews.your === "list"}
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
