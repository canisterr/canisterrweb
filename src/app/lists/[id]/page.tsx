"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import {
  ArrowLeft,
  Lock,
  Globe,
  Plus,
  Trash2,
  UserPlus,
  Loader2,
  Edit2,
  Grid3x3,
  List as ListIcon,
  Eye,
  MoreVertical,
  GripVertical,
  MoveRight,
  Copy,
  Share2,
  ChevronUp,
  ChevronDown,
  UserX,
} from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { User, ListWithItems, ListCollaboratorWithUser } from "@/types";
import { auth, db } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import { normalizeListIdParam } from "@/lib/list-ids";
import {
  getListWithDetails,
  removeItemFromList,
  addCollaborator,
  removeCollaborator,
  updateList,
  deleteList,
  updateListViewPreferences,
  reorderListItems,
  createList,
  addItemToList,
  syncListCollaboratorIds,
} from "@/lib/lists";
import { getUserWatchedMovies, upsertWatchedMovie, type WatchedMovie } from "@/lib/watched-movies";
import { canInviteCollaborators, isUsernameBlocked, mergeSettings } from "@/lib/settings";
import { createCollaborationRequestNotification } from "@/lib/notifications";

function MenuButton({ onEdit, onAddItems, canEdit, isOwner, onDelete, onClone, onShare, cloneLoading, onToggleWatchedStatus, watchedStatusEnabled, viewType, onSetViewType, onToggleReorder, reorderMode }: {
  onEdit: () => void;
  onAddItems: () => void;
  canEdit: boolean;
  isOwner: boolean;
  onDelete?: () => void;
  onClone: () => void;
  onShare?: () => void;
  cloneLoading?: boolean;
  onToggleWatchedStatus?: () => void;
  watchedStatusEnabled?: boolean;
  viewType: "grid" | "list";
  onSetViewType: (viewType: "grid" | "list") => void;
  onToggleReorder?: () => void;
  reorderMode?: boolean;
  }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative z-50">
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-haspopup="true"
        className="relative z-50 flex items-center justify-center p-1 text-[#ff7a1a] transition hover:text-[#ffb36b]"
        onClick={() => setOpen((v) => !v)}
      >
        <MoreVertical className="h-6 w-6" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(17rem,calc(100vw-2rem))] rounded-xl border border-white/15 bg-[#101010] p-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
          <div className="grid grid-cols-2 gap-1 border-b border-white/10 pb-1.5">
            {(["grid", "list"] as const).map((mode) => {
              const Icon = mode === "grid" ? Grid3x3 : ListIcon;
              return (
                <button
                  key={mode}
                  type="button"
                  aria-pressed={viewType === mode}
                  onClick={() => { setOpen(false); onSetViewType(mode); }}
                  className={`flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition ${viewType === mode ? "bg-[#ff7a1a] text-black" : "text-white/55 hover:bg-white/[0.06] hover:text-[#f5f0de]"}`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.8} />
                  {mode === "grid" ? "Grid" : "List"}
                </button>
              );
            })}
          </div>
          <div className="py-1">
            <button type="button" onClick={() => { setOpen(false); onClone(); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-[#f5f0de] hover:bg-white/[0.06]">
              <Copy className="h-4 w-4 text-white/55" strokeWidth={1.8} />
              {cloneLoading ? "Cloning…" : "Clone list"}
            </button>
            {onShare && <button type="button" onClick={() => { setOpen(false); onShare(); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-[#f5f0de] hover:bg-white/[0.06]">
              <Share2 className="h-4 w-4 text-white/55" strokeWidth={1.8} />
              Share list
            </button>}
            <button type="button" aria-pressed={Boolean(watchedStatusEnabled)} onClick={() => { setOpen(false); onToggleWatchedStatus?.(); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-[#f5f0de] hover:bg-white/[0.06]">
              <Eye className="h-4 w-4 text-white/55" strokeWidth={1.8} />
              Watched status
              <span className={`ml-auto text-xs ${watchedStatusEnabled ? "text-[#ff9b52]" : "text-white/40"}`}>{watchedStatusEnabled ? "On" : "Off"}</span>
            </button>
            {canEdit && viewType === "list" && onToggleReorder && <button type="button" aria-pressed={Boolean(reorderMode)} onClick={() => { setOpen(false); onToggleReorder(); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-[#f5f0de] hover:bg-white/[0.06]">
              <GripVertical className="h-4 w-4 text-white/55" strokeWidth={1.8} />
              Reorder items
              {reorderMode && <span className="ml-auto text-xs text-[#ff9b52]">On</span>}
            </button>}
          </div>
          {canEdit && <div className="border-t border-white/10 py-1">
            {isOwner && <button type="button" onClick={() => { setOpen(false); onEdit(); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-[#f5f0de] hover:bg-white/[0.06]">
              <Edit2 className="h-4 w-4 text-white/55" strokeWidth={1.8} />
              Edit details
            </button>}
            <button type="button" onClick={() => { setOpen(false); onAddItems(); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-[#f5f0de] hover:bg-white/[0.06]">
              <Plus className="h-4 w-4 text-white/55" strokeWidth={1.8} />
              Add movies
            </button>
          </div>}
          {isOwner && onDelete && <div className="border-t border-white/10 pt-1">
            <button type="button" onClick={() => { setOpen(false); onDelete(); }} className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-red-300 transition hover:bg-red-500/10">
              <Trash2 className="h-4 w-4" strokeWidth={1.8} />
              Delete list
            </button>
          </div>}
        </div>
      )}
    </div>
  );
}

export default function ListDetailPage() {
  const [user, setUser] = useState<User | null>(null);
  const [currentUserSettings, setCurrentUserSettings] = useState(() => mergeSettings(null));
  const [list, setList] = useState<ListWithItems | null>(null);
  useEffect(() => {
    if (!user || !list) return;

    let cancelled = false;
    (async () => {
      try {
        const records = await getUserWatchedMovies(user.id);
        if (cancelled) return;

        const map: Record<string, WatchedMovie> = {};
        for (const record of records) {
          map[`${record.content_type}-${record.content_id}`] = record;
        }
        setWatchedMovies(map);
      } catch (error) {
        console.error("Error loading watched movies:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, list]);

  // Watched status state (must be after user/list)
  const [watchedStatusEnabled, setWatchedStatusEnabled] = useState(false);
  const [markingWatched, setMarkingWatched] = useState<string | null>(null);
  const [watchedMovies, setWatchedMovies] = useState<Record<string, WatchedMovie>>({});
  const router = useRouter();
  const params = useParams();
  const listId = normalizeListIdParam(params.id as string);

  // ...existing state declarations continue...
  const [loading, setLoading] = useState(true);
  const [isCollaborator, setIsCollaborator] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPrivacy, setEditPrivacy] = useState<"private" | "public">("private");
  const [showAddCollaborator, setShowAddCollaborator] = useState(false);
  const [collaboratorInput, setCollaboratorInput] = useState("");
  const [savingChanges, setSavingChanges] = useState(false);
  const [availableFriends, setAvailableFriends] = useState<User[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<User[]>([]);
  const [selectedFriends, setSelectedFriends] = useState<User[]>([]);
  const [addingCollaborators, setAddingCollaborators] = useState(false);
  // (moved above)
  const [viewType, setViewType] = useState<"grid" | "list">("grid");
  const [reorderMode, setReorderMode] = useState(false);
  const [showUnwatchedFirst, setShowUnwatchedFirst] = useState(false);
  const [savingPreferences, setSavingPreferences] = useState(false);
  const [cloningList, setCloningList] = useState(false);
  const [showDeleteItem, setShowDeleteItem] = useState<{ id: string; name: string } | null>(null);
  const [showCollaboratorsModal, setShowCollaboratorsModal] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadPublicList = async () => {
      try {
        const response = await fetch(`/api/lists/${encodeURIComponent(listId)}`);
        if (!response.ok) {
          if (!cancelled) {
            setList(null);
            setUser(null);
            setCurrentUserSettings(mergeSettings(null));
            setLoading(false);
          }
          return;
        }

        const payload = await response.json();
        if (cancelled) return;

        const publicList = payload.list as ListWithItems;
        setUser(null);
        setCurrentUserSettings(mergeSettings(null));
        setList(publicList);
        setEditName(publicList.name);
        setEditDescription(publicList.description || "");
        setEditPrivacy(publicList.privacy);
        setViewType(publicList.view_type || "grid");
        setShowUnwatchedFirst(publicList.show_unwatched_first || false);
        setIsCollaborator(false);
        setLoading(false);
      } catch (error) {
        console.error("Error loading public list:", error);
        if (!cancelled) {
          setList(null);
          setUser(null);
          setCurrentUserSettings(mergeSettings(null));
          setLoading(false);
        }
      }
    };

    if (!listId) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (cancelled) return;

      if (!firebaseUser) {
        await loadPublicList();
        return;
      }

      try {
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

        if (cancelled) return;

        setUser(currentUser);
        setCurrentUserSettings(mergeSettings(userData?.settings));

        const listData = await getListWithDetails(listId);
        if (cancelled) return;

        if (listData) {
          setList(listData);
          setEditName(listData.name);
          setEditDescription(listData.description || "");
          setEditPrivacy(listData.privacy);
          setViewType(listData.view_type || "grid");
          setShowUnwatchedFirst(listData.show_unwatched_first || false);

          setIsCollaborator(
            listData.owner_id === currentUser.id ||
            Boolean(listData.collaborator_ids?.[currentUser.id]) ||
            listData.collaborators.some((collaborator) => collaborator.user_id === currentUser.id)
          );

          if (listData.owner_id === currentUser.id) {
            const collaboratorIds = [
              listData.owner_id,
              ...listData.collaborators.map((collab) => collab.user_id),
            ];
            if (!listData.collaborator_ids || Object.keys(listData.collaborator_ids).length === 0) {
              await syncListCollaboratorIds(listId, collaboratorIds);
            }
          }
        } else {
          router.push("/lists");
        }

        setLoading(false);
      } catch (error) {
        console.error("Error loading list:", error);
        if (!cancelled) {
          setLoading(false);
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [listId, router]);

  const handleViewTypeChange = async (newViewType: "grid" | "list") => {
    if (!list || list.owner_id !== user?.id) {
      setViewType(newViewType);
      setReorderMode(false);
      return;
    }

    try {
      setSavingPreferences(true);
      setViewType(newViewType);
      if (newViewType !== "list") {
        setReorderMode(false);
      }
      await updateListViewPreferences(listId, newViewType, showUnwatchedFirst);
      if (list) {
        setList({ ...list, view_type: newViewType });
      }
    } catch (error) {
      console.error("Error changing view type:", error);
      setViewType(list?.view_type || "grid");
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleUnwatchedFilterChange = async () => {
    if (!list || list.owner_id !== user?.id) {
      setShowUnwatchedFirst((current) => !current);
      return;
    }

    try {
      setSavingPreferences(true);
      const newValue = !showUnwatchedFirst;
      setShowUnwatchedFirst(newValue);
      await updateListViewPreferences(listId, viewType, newValue);
      if (list) {
        setList({ ...list, show_unwatched_first: newValue });
      }
    } catch (error) {
      console.error("Error changing unwatched filter:", error);
      setShowUnwatchedFirst(list?.show_unwatched_first || false);
    } finally {
      setSavingPreferences(false);
    }
  };

  const handleReorderItems = async (fromIdx: number, toIdx: number) => {
    if (!list || fromIdx === toIdx) return;

    const previousItems = list.items;
    const nextItems = [...list.items];
    const [moved] = nextItems.splice(fromIdx, 1);
    nextItems.splice(toIdx, 0, moved);

    const normalizedItems = nextItems.map((item, position) => ({ ...item, position }));
    setList({ ...list, items: normalizedItems });

    try {
      await reorderListItems(
        listId,
        normalizedItems.map((item) => ({ id: item.id, position: item.position }))
      );
    } catch (error) {
      console.error("Error reordering items:", error);
      setList({ ...list, items: previousItems });
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

  const handleRemoveItem = async (itemId: string, itemTitle: string) => {
    setShowDeleteItem({ id: itemId, name: itemTitle });
  };

  const confirmDeleteItem = async () => {
    if (!showDeleteItem || !list) return;

    try {
      await removeItemFromList(listId, showDeleteItem.id);
      setList({
        ...list,
        items: list.items.filter((item) => item.id !== showDeleteItem.id),
        item_count: list.item_count - 1,
      });
      setShowDeleteItem(null);
    } catch (error) {
      console.error("Error removing item:", error);
      alert("Failed to remove item");
      setShowDeleteItem(null);
    }
  };

  const handleSaveChanges = async () => {
    if (!list || !user) return;
    const name = editName.trim();
    if (!name) return;

    try {
      setSavingChanges(true);
      await updateList(listId, {
        name,
        description: editDescription || null,
        privacy: list.owner_id === user.id ? editPrivacy : list.privacy,
      });

      setList({
        ...list,
        name,
        description: editDescription || null,
        privacy: list.owner_id === user.id ? editPrivacy : list.privacy,
      });

      setEditMode(false);
    } catch (error) {
      console.error("Error saving changes:", error);
      alert("Failed to save changes");
    } finally {
      setSavingChanges(false);
    }
  };

  const handleDeleteList = async () => {
    if (!user || !list) return;

    if (!confirm("Are you sure you want to delete this list? This action cannot be undone.")) {
      return;
    }

    try {
      await deleteList(listId, user.id);
      router.push("/lists");
    } catch (error) {
      console.error("Error deleting list:", error);
      alert("Failed to delete list");
    }
  };

  const handleCloneList = async () => {
    if (!user || !list) return;

    try {
      setCloningList(true);
      const clonedName = `Copy of ${list.name}`;
      const clonedList = await createList(
        user.id,
        clonedName,
        list.description || null,
        "private",
        list.is_ranked
      );

      await updateList(clonedList.id, {
        view_type: list.view_type,
        show_unwatched_first: list.show_unwatched_first || false,
        cover_type: list.cover_type,
        cover_image_url: list.cover_image_url,
        privacy: "private",
      });

      const itemsInOrder = [...list.items].sort((a, b) => a.position - b.position);
      for (const item of itemsInOrder) {
        await addItemToList(clonedList.id, item.content_id, item.content_type, user.id);
      }

      router.push(`/lists/${clonedList.id}`);
    } catch (error) {
      console.error("Error cloning list:", error);
      alert("Failed to clone list");
    } finally {
      setCloningList(false);
    }
  };

  const handleRemoveCollaborator = async (collaboratorId: string) => {
    if (!list) return;

    try {
      await removeCollaborator(collaboratorId, listId);
      setList({
        ...list,
        collaborators: list.collaborators.filter((c) => c.id !== collaboratorId),
        collaborator_count: list.collaborator_count - 1,
      });
    } catch (error) {
      console.error("Error removing collaborator:", error);
      alert("Failed to remove collaborator");
    }
  };

  const handleOpenAddCollaborator = async () => {
    if (!user) return;
    if (!canInviteCollaborators(currentUserSettings)) {
      alert("Your collaboration invites are turned off in settings.");
      return;
    }

    try {
      // Fetch accepted followers/friends
      const followsRef = ref(db, "follows");
      const followsSnapshot = await get(followsRef);
      const allFollows = followsSnapshot.exists() ? followsSnapshot.val() : {};

      // Get friends (both who follow user and user follows)
      const friendIds = new Set<string>();
      Object.values(allFollows).forEach((follow: any) => {
        if (follow.status === "accepted") {
          if (follow.follower_id === user.id) {
            friendIds.add(follow.following_id);
          }
          if (follow.following_id === user.id) {
            friendIds.add(follow.follower_id);
          }
        }
      });

      // Get friend users and exclude already added collaborators
      const existingCollabIds = new Set(list?.collaborators.map((c) => c.user_id) || []);

      const friends: User[] = [];
      await Promise.all(
        Array.from(friendIds).map(async (friendId) => {
          if (existingCollabIds.has(friendId)) return;

          const userSnapshot = await get(ref(db, `users/${friendId}`));
          const userData = userSnapshot.exists() ? userSnapshot.val() : null;
          if (userData) {
            const friendSettings = mergeSettings(userData?.settings);
            if (
              friendSettings.account.status !== "active" ||
              !friendSettings.social.allowCollaborations ||
              isUsernameBlocked(friendSettings, user.username) ||
              isUsernameBlocked(currentUserSettings, userData.username || "")
            ) {
              return;
            }

            friends.push({
              id: userData.id || friendId,
              username: userData.username || "",
              name: userData.name || "",
              avatar_url: userData.avatar_url || null,
              created_at: userData.created_at || userData.createdAt || new Date().toISOString(),
            });
          }
        })
      );

      setAvailableFriends(friends);
      setFilteredFriends(friends);
      setSelectedFriends([]);
      setCollaboratorInput("");
      setShowAddCollaborator(true);
    } catch (error) {
      console.error("Error loading friends:", error);
      alert("Failed to load friends");
    }
  };

  const handleFilterFriends = (query: string) => {
    setCollaboratorInput(query);
    if (!query.trim()) {
      setFilteredFriends(availableFriends);
    } else {
      const lowerQuery = query.toLowerCase();
      setFilteredFriends(
        availableFriends.filter(
          (friend) =>
            friend.name.toLowerCase().includes(lowerQuery) ||
            friend.username.toLowerCase().includes(lowerQuery)
        )
      );
    }
  };

  const handleSelectFriend = (friend: User) => {
    setSelectedFriends((prev) => {
      if (prev.find((f) => f.id === friend.id)) {
        return prev.filter((f) => f.id !== friend.id);
      } else {
        return [...prev, friend];
      }
    });
  };

  const handleAddCollaborators = async () => {
    if (!list || !user || selectedFriends.length === 0) return;

    try {
      setAddingCollaborators(true);

      for (const friend of selectedFriends) {
        await addCollaborator(listId, friend.id);
        await createCollaborationRequestNotification(
          friend.id,
          listId,
          list?.name || "this list",
          user,
          new Date().toISOString()
        );
      }

      // Reload list to see new collaborators
      const updatedList = await getListWithDetails(listId);
      if (updatedList) {
        setList(updatedList);
      }

      setShowAddCollaborator(false);
      setSelectedFriends([]);
    } catch (error) {
      console.error("Error adding collaborators:", error);
      alert("Failed to add collaborators");
    } finally {
      setAddingCollaborators(false);
    }
  };

  if (loading) {
    return null;
  }

  if (!list) {
    return (
      <PageLayout user={user} onSignOut={handleSignOut} theme="brutalist">
        <div className="mx-auto flex min-h-[60dvh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#ffb36b]">
            Shared Lists
          </p>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-[#f5f0de] sm:text-4xl">
            This list is not available
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-white/60 sm:text-base">
            Sign in to view private lists, or open a different shared link if this one was copied incorrectly.
          </p>
          <Link
            href="/auth/login"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-[#ff7a1a] px-5 py-3 text-sm font-semibold text-[#0a0a0a] transition hover:bg-[#ff8d3d]"
          >
            Sign in
          </Link>
        </div>
      </PageLayout>
    );
  }

  const viewerHasAuth = Boolean(user);
  const viewerId = user?.id ?? "";
  const isOwner = viewerId !== "" && list.owner_id === viewerId;
  const canEdit = viewerHasAuth && (isOwner || isCollaborator);
  const sortedItems = [...list.items].sort((a, b) => a.position - b.position);
  const visibleSortedItems = sortedItems.filter((item: any) => Boolean(item.content));
  const isRankedList = list.is_ranked;

  const handleShareList = async () => {
    if (typeof window === "undefined") return;

    const shareUrl = new URL(`/lists/${list.id}`, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({
          title: list.name,
          text: `Take a look at ${list.name} on Canisterr.`,
          url: shareUrl,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        return;
      }
    } catch (error) {
      console.error("Share list failed:", error);
    }

    window.prompt("Copy this link", shareUrl);
  };


  return (
    <PageLayout user={user} onSignOut={handleSignOut} theme="brutalist">
      <div className="px-2 py-4 sm:p-8">
        {!viewerHasAuth && (
          <div className="mb-5 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            You’re viewing a public list. Sign in to clone it, add collaborators, or manage your own lists.
          </div>
        )}
        {/* Header with Back and Title */}
        <div className="mb-5 sm:mb-8">
          <Link
            href="/lists"
            className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-[#ffb36b] hover:text-[#ff7a1a] sm:mb-4 sm:text-base"
          >
            <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            Back to Lists
          </Link>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="break-words text-3xl font-extrabold leading-tight tracking-tight text-[#f5f0de] sm:text-3xl sm:font-bold">
                {list.name}
              </h1>
              {list.description && !editMode && (
                <p className="mt-2 text-sm leading-relaxed text-white/55 sm:mt-2 sm:text-base">{list.description}</p>
              )}
              {!editMode && (isOwner ? (
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white/65 transition hover:border-[#ff7a1a]/50 hover:text-[#f5f0de]"
                  aria-label="Change list privacy"
                >
                  {list.privacy === "public" ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  {list.privacy === "public" ? "Public" : "Private"}
                </button>
              ) : (
                <span className="mt-3 inline-flex items-center gap-1.5 text-xs text-white/45">
                  {list.privacy === "public" ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  {list.privacy === "public" ? "Public" : "Private"}
                </span>
              ))}
            </div>

            {viewerHasAuth && (
              <div className="flex items-center gap-1.5">
                <MenuButton
                  onEdit={() => {
                    setEditMode(true);
                  }}
                  onAddItems={() => {
                    window.location.href = `/lists/${listId}/add-items`;
                  }}
                  canEdit={Boolean(isOwner || isCollaborator)}
                  isOwner={Boolean(isOwner)}
                  onDelete={isOwner ? handleDeleteList : undefined}
                  onClone={handleCloneList}
                  onShare={handleShareList}
                  cloneLoading={cloningList}
                  onToggleWatchedStatus={() => setWatchedStatusEnabled(v => !v)}
                  watchedStatusEnabled={watchedStatusEnabled}
                  viewType={viewType}
                  onSetViewType={(nextViewType) => void handleViewTypeChange(nextViewType)}
                  onToggleReorder={canEdit && viewType === "list" ? () => setReorderMode((v) => !v) : undefined}
                  reorderMode={reorderMode}
                />
              </div>
            )}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
              {isRankedList && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-[#f5f0de]">
                  Ranked List
                </span>
              )}
              {/* Collaborators: show profile pictures, open modal on click */}
              <button
                className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[#f5f0de]"
                onClick={() => setShowCollaboratorsModal(true)}
                aria-label="Show collaborators"
              >
                {list.collaborators && list.collaborators.length > 0 && list.collaborators.slice(0, 5).map((collab) => (
                <span key={collab.user_id} className="inline-block -ml-2 h-7 w-7 overflow-hidden rounded-full border-2 border-[#111111] bg-[#1a1a1a] first:ml-0 sm:h-8 sm:w-8">
                    {collab.user?.avatar_url ? (
                      <img src={collab.user.avatar_url} alt={collab.user.name || collab.user.username || "User"} className="w-full h-full object-cover rounded-full" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center rounded-full bg-[#2a2a2a] text-base font-bold text-[#f5f0de]">
                        {collab.user?.name?.[0]?.toUpperCase() || collab.user?.username?.[0]?.toUpperCase() || "U"}
                      </span>
                    )}
                  </span>
                ))}
                <span className="ml-1 inline-block text-xs font-bold text-[#ffb36b] sm:text-sm">
                  {list.collaborators.length > 1 ? `+${list.collaborators.length}` : "1"}
                </span>
              </button>
          </div>

          {/* List details */}
          {editMode && isOwner && (
            <div className="mt-5 max-w-2xl border-t border-white/15 pt-5 sm:mt-6">
              <h3 className="mb-5 text-lg font-semibold text-[#f5f0de]">Edit list</h3>
              <div className="space-y-5">
                <div>
                  <label htmlFor="edit-list-name" className="mb-2 block text-sm text-white/65">Title</label>
                  <input
                    id="edit-list-name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="List name"
                    className="w-full rounded-md border border-white/15 bg-[#111] px-3 py-2.5 text-sm text-[#f5f0de] outline-none transition focus:border-[#ff7a1a]"
                  />
                </div>

                <div>
                  <label htmlFor="edit-list-description" className="mb-2 block text-sm text-white/65">Description</label>
                  <textarea
                    id="edit-list-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Add a short description for this list"
                    className="w-full resize-y rounded-md border border-white/15 bg-[#111] px-3 py-2.5 text-sm text-[#f5f0de] outline-none transition focus:border-[#ff7a1a]"
                    rows={2}
                  />
                </div>

                {/* Only the owner decides whether collaborators' list is public. */}
                {isOwner && <fieldset className="border-t border-white/10 pt-4">
                  <legend className="text-sm text-white/65">Visibility</legend>
                  <div className="mt-2 flex flex-wrap gap-x-6 gap-y-3">
                    {(["private", "public"] as const).map((privacy) => (
                      <label key={privacy} className="inline-flex cursor-pointer items-center gap-2 text-sm text-[#f5f0de]">
                        <input
                          type="radio"
                          name="privacy"
                          value={privacy}
                          checked={editPrivacy === privacy}
                          onChange={() => setEditPrivacy(privacy)}
                          className="h-4 w-4 accent-[#ff7a1a]"
                        />
                        {privacy === "private" ? "Private" : "Public"}
                      </label>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-white/45">{editPrivacy === "private" ? "Only you and collaborators can see this list." : "Anyone can discover this list."}</p>
                </fieldset>}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleSaveChanges}
                    disabled={savingChanges || !editName.trim()}
                    className="rounded-md bg-[#ff7a1a] px-4 py-2.5 text-sm font-semibold text-[#0a0a0a] transition hover:bg-[#ff8d3b] disabled:bg-white/10 disabled:text-white/35"
                  >
                    {savingChanges ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditMode(false);
                      setEditName(list.name);
                      setEditDescription(list.description || "");
                      setEditPrivacy(list.privacy);
                    }}
                    className="px-2 py-2.5 text-sm text-white/55 transition hover:text-[#f5f0de]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Movie Items Section */}
        <div className="mt-4 sm:mt-6">
          {reorderMode && viewType === "list" && canEdit && (
            <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/40">
              <MoveRight className="h-3.5 w-3.5" />
              Use arrows or drag to reorder
            </div>
          )}
          {sortedItems.length > 0 ? (
            <div
              className={
                viewType === "list"
                  ? "space-y-2.5 sm:space-y-3"
                  : "grid grid-cols-3 gap-2.5 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-5"
              }
            >
              {visibleSortedItems.map((item, idx) => {
                const rank = item.position + 1;
                // Get logs for this movie, most recent first
                const posterSrc = item.content.poster_url || null;
                const watchedKey = `${item.content.type || "movie"}-${item.content.id}`;
                const watchedRecord = watchedMovies[watchedKey] || null;
                const userWatched = Boolean(watchedRecord);
                const canReorder = reorderMode && canEdit && viewType === "list";
                const canRemoveItem = editMode && canEdit;
                const isFirst = idx === 0;
                const isLast = idx === visibleSortedItems.length - 1;
                return (
                  <div
                    key={item.id}
                    className={
                      viewType === "list"
                        ? `group relative flex items-start gap-3 py-1 ${canRemoveItem ? "pr-20 sm:pr-28" : ""} ${canReorder ? "cursor-grab active:cursor-grabbing" : ""}`
                        : "relative flex flex-col"
                    }
                      draggable={canReorder}
                    onDragStart={canReorder ? e => {
                      e.dataTransfer.setData("text/plain", idx.toString());
                      e.currentTarget.classList.add("opacity-50");
                    } : undefined}
                    onDragEnd={canReorder ? e => {
                      e.currentTarget.classList.remove("opacity-50");
                    } : undefined}
                    onDragOver={canReorder ? e => {
                      e.preventDefault();
                    } : undefined}
                    onDrop={canReorder ? async e => {
                      e.preventDefault();
                      const fromIdx = Number(e.dataTransfer.getData("text/plain"));
                      if (fromIdx === idx) return;
                      await handleReorderItems(fromIdx, idx);
                    } : undefined}
                      >
                    {canReorder && (
                      <div className="mt-0.5 flex w-6 shrink-0 flex-col items-center gap-1 text-white/40">
                        <GripVertical className="h-3.5 w-3.5" />
                        <button
                          type="button"
                          aria-label={`Move ${item.content.title} up`}
                          disabled={isFirst}
                          onClick={() => void handleReorderItems(idx, idx - 1)}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-[#111111] text-white/55 transition hover:border-[#ff7a1a] hover:text-[#ffb36b] disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          aria-label={`Move ${item.content.title} down`}
                          disabled={isLast}
                          onClick={() => void handleReorderItems(idx, idx + 1)}
                          className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white/10 bg-[#111111] text-white/55 transition hover:border-[#ff7a1a] hover:text-[#ffb36b] disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <ChevronDown className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                    {/* Poster */}
                    <Link
                      href={item.content.type === "tv"
                        ? `/tv/${item.content.id}`
                        : `/movie/${item.content.id}`}
                      className={
                        viewType === "list"
                          ? `relative h-20 w-14 flex-shrink-0 overflow-hidden bg-[#1a1a1a] poster-stack-container sm:h-24 sm:w-16 ${
                              canReorder ? "pointer-events-none" : ""
                            }`
                          : "relative aspect-[3/4] w-full overflow-hidden bg-[#1a1a1a] poster-stack-container sm:aspect-[2/3]"
                      }
                      tabIndex={0}
                    >
                      {posterSrc ? (
                        <img
                          src={posterSrc}
                          alt={item.content.title}
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[#1a1a1a]">
                          <Plus className="h-8 w-8 text-white/35" />
                        </div>
                      )}
                      {isRankedList && (
                        <span className="absolute left-2 top-2 rounded-full bg-[#ff7a1a] px-2 py-1 text-[11px] font-bold text-[#0a0a0a] shadow">
                          {rank}
                        </span>
                      )}
                      </Link>
                      <div className={viewType === "list" ? "min-w-0 flex-1 pt-0.5" : "min-w-0 pt-1"}>
                        {canReorder && (
                          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                            <GripVertical className="h-3.5 w-3.5" />
                            Tap arrows or drag
                          </div>
                        )}
                        <p className="line-clamp-2 text-xs font-semibold leading-snug text-[#f5f0de] sm:text-sm">
                          {item.content.title}
                        </p>
                        {viewType === "list" && (
                          <p className="mt-0.5 truncate text-[10px] font-medium text-white/55 sm:text-xs">
                            Added by <span className="font-medium">{item.added_by_user.name}</span>
                          </p>
                        )}
                        {watchedStatusEnabled && (
                          <div className="mt-1">
                            {userWatched ? (
                              <span className="inline-flex rounded-full border border-green-500/20 bg-green-500/10 px-2 py-0.5 text-[10px] font-semibold text-green-200">
                                Watched
                              </span>
                            ) : (
                              <button
                                className="text-[10px] font-semibold text-[#ffb36b] hover:text-[#ff7a1a]"
                                disabled={markingWatched === String(item.content.id)}
                                onClick={async () => {
                                  if (!viewerId) return;
                                  setMarkingWatched(String(item.content.id));
                                  await upsertWatchedMovie(
                                    viewerId,
                                    Number(item.content.id),
                                    item.content.type === "tv" ? "tv" : "movie",
                                    "list"
                                  );
                                  const refreshed = await getUserWatchedMovies(viewerId);
                                  const refreshedMap: Record<string, WatchedMovie> = {};
                                  for (const record of refreshed) {
                                    refreshedMap[`${record.content_type}-${record.content_id}`] = record;
                                  }
                                  setWatchedMovies(refreshedMap);
                                  setMarkingWatched(null);
                                }}
                              >
                                {markingWatched === String(item.content.id) ? "Marking..." : "Mark watched"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    {canRemoveItem && (
                      <button
                        type="button"
                        aria-label="Delete movie"
                        className={
                          viewType === "list"
                            ? "absolute right-0 top-1 inline-flex items-center gap-1 rounded-full border border-red-400/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-200 transition hover:border-red-300/60 hover:bg-red-500/20"
                            : "absolute right-1 top-1 rounded-full bg-[#111111]/90 p-1.5 text-red-200 shadow-sm ring-1 ring-white/10 transition hover:bg-red-500/20 hover:text-red-100"
                        }
                        onClick={() => handleRemoveItem(item.id, item.content.title)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        {viewType === "list" && <span>Remove</span>}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
        ) : (
            <div className="py-12 text-center">
              <p className="mb-4 text-white/55">This list is empty</p>
              {(isOwner || isCollaborator) && (
                <button
                  className="mt-4 rounded-lg bg-[#ff7a1a] px-6 py-2 font-medium text-[#0a0a0a] shadow hover:bg-[#ff8d3b]"
                  onClick={() => window.location.href = `/lists/${listId}/add-items`}
                >
                  <Plus className="inline w-4 h-4 mr-2 -mt-1" /> Add Movies
                </button>
              )}
            </div>
          )}
        </div>

        {/* Collaborators Modal, Add Collaborator Modal, Delete List Button, Delete Item Modal, etc. remain unchanged below... */}



        {/* Collaborators Modal */}
        {showCollaboratorsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="flex max-h-96 w-full max-w-md flex-col border border-white/10 bg-[#111111] p-6 text-[#f5f0de] mx-4">
              <h3 className="mb-4 text-xl font-bold text-[#f5f0de]">Collaborators</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                {(Array.isArray(list.collaborators) ? list.collaborators : []).map((collaborator, idx) => (
                  <Link
                    key={`collab-${idx}`}
                    href={`/profile/${collaborator.user.username}`}
                    onClick={() => setShowCollaboratorsModal(false)}
                    className="flex items-center gap-2 border border-white/10 bg-white/[0.03] p-3 transition hover:bg-white/[0.06]"
                  >
                    {collaborator.user.avatar_url && (
                      <img
                        src={collaborator.user.avatar_url}
                        alt={collaborator.user.name}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-semibold text-[#f5f0de]">
                        {collaborator.user.name}
                      </p>
                      <p className="capitalize text-xs text-white/55">{collaborator.role}</p>
                    </div>
                  </Link>
                ))}
              </div>
              <button
                onClick={handleOpenAddCollaborator}
                className="mb-2 flex items-center gap-2 rounded-lg bg-[#ff7a1a] px-4 py-2 font-medium text-[#0a0a0a] transition-colors hover:bg-[#ff8d3b]"
              >
                <UserPlus className="w-4 h-4" />
                Add Collaborator
              </button>
              <button
                onClick={() => setShowCollaboratorsModal(false)}
                className="w-full rounded-lg border border-white/10 px-4 py-2 font-medium text-[#f5f0de] transition-colors hover:bg-white/5"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {/* Add Collaborator Modal (existing) */}
        {showAddCollaborator && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="mx-4 flex max-h-96 w-full max-w-md flex-col border border-white/10 bg-[#111111] p-6 text-[#f5f0de]">
              <h3 className="mb-4 text-xl font-bold text-[#f5f0de]">Add Friends as Collaborators</h3>

              {availableFriends.length > 0 ? (
                <>
                  {/* Search input */}
                  <input
                    type="text"
                    value={collaboratorInput}
                    onChange={(e) => handleFilterFriends(e.target.value)}
                    placeholder="Search friends..."
                    className="field mb-4 w-full px-4 py-2"
                  />

                  {/* Friends list */}
                  <div className="flex-1 overflow-y-auto space-y-2 mb-4">
                    {filteredFriends.length > 0 ? (
                      filteredFriends.map((friend) => (
                        <label
                          key={friend.id}
                          className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-white/5"
                        >
                          <input
                            type="checkbox"
                            checked={selectedFriends.some((f) => f.id === friend.id)}
                            onChange={() => handleSelectFriend(friend)}
                            className="h-4 w-4 rounded border-white/20 text-[#ff7a1a] focus:ring-[#ff7a1a]"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="truncate text-sm font-medium text-[#f5f0de]">
                              {friend.name}
                            </p>
                            <p className="text-xs text-white/55">@{friend.username}</p>
                          </div>
                        </label>
                      ))
                    ) : (
                      <p className="py-2 text-sm text-white/55">No matching friends found</p>
                    )}
                  </div>

                  {/* Selected count */}
                  {selectedFriends.length > 0 && (
                    <p className="mb-4 text-sm text-white/55">
                      {selectedFriends.length} friend{selectedFriends.length !== 1 ? "s" : ""} selected
                    </p>
                  )}
                </>
              ) : (
                <p className="mb-4 text-sm text-white/55">
                  You don't have any friends to add. Make some friends first!
                </p>
              )}

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddCollaborator(false)}
                  className="flex-1 rounded-lg border border-white/10 px-4 py-2 font-medium text-[#f5f0de] transition-colors hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCollaborators}
                  disabled={selectedFriends.length === 0 || addingCollaborators}
                  className="flex-1 rounded-lg bg-[#ff7a1a] px-4 py-2 font-medium text-[#0a0a0a] transition-colors hover:bg-[#ff8d3b] disabled:bg-white/10 disabled:text-white/35"
                >
                  {addingCollaborators ? "Adding..." : `Add (${selectedFriends.length})`}
                </button>
              </div>
            </div>
          </div>
        )}



        {/* Delete Item Confirmation Modal (existing) */}
        {showDeleteItem && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="mx-4 w-full max-w-sm border border-white/10 bg-[#111111] p-6 text-[#f5f0de]">
              <h3 className="mb-2 text-lg font-bold text-[#f5f0de]">Remove from list?</h3>
              <p className="mb-6 text-white/55">
                Are you sure you want to remove <span className="font-semibold">{showDeleteItem.name}</span> from this list?
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteItem(null)}
                  className="flex-1 rounded-lg border border-white/10 px-4 py-2 font-medium text-[#f5f0de] transition-colors hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteItem}
                  className="flex-1 rounded-lg bg-[#ff7a1a] px-4 py-2 font-medium text-[#0a0a0a] transition-colors hover:bg-[#ff8d3b]"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
