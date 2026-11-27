import "server-only";

import { getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { getMovieDetails } from "./tmdb";
import { getShowDetails } from "./tvmaze";
import { normalizeListIdParam } from "./list-ids";
import type {
  Content,
  List,
  ListCollaborator,
  ListCollaboratorWithUser,
  ListItem,
  ListItemWithContent,
  ListWithItems,
  User,
} from "@/types";

type AdminUserRecord = {
  username?: string;
  name?: string;
  avatar_url?: string | null;
  created_at?: string;
  createdAt?: string;
};

function normalizeLabel(value?: string | null): string {
  return value?.trim().replace(/^@/, "") || "";
}

function isPlaceholderLabel(value: string): boolean {
  const normalized = value.trim().toLowerCase();
  return (
    !normalized ||
    normalized === "unknown" ||
    normalized === "unknown user" ||
    normalized === "anonymous" ||
    normalized === "guest" ||
    normalized === "user" ||
    /^user\s+[a-z0-9]+$/.test(normalized)
  );
}

function createFallbackUser(userId: string): User {
  return {
    id: userId,
    username: userId,
    name: "User",
    avatar_url: null,
    created_at: new Date().toISOString(),
  };
}

function normalizeAdminUser(userId: string, raw: AdminUserRecord | null | undefined): User {
  if (!raw) {
    return createFallbackUser(userId);
  }

  const username = normalizeLabel(raw.username);
  const name = normalizeLabel(raw.name);
  const createdAt = raw.created_at || raw.createdAt || new Date().toISOString();
  const displayName =
    (name && !isPlaceholderLabel(name) && name !== userId.trim() ? name : null) ||
    (username && !isPlaceholderLabel(username) && username !== userId.trim() ? username : null) ||
    "User";

  return {
    id: userId,
    username: username || userId,
    name: displayName,
    avatar_url: raw.avatar_url || null,
    created_at: createdAt,
  };
}

async function getAdminUsersByIds(userIds: string[]): Promise<Record<string, User>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const db = getFirebaseAdminDatabase();
  const users = await Promise.all(
    uniqueIds.map(async (userId) => {
      const snapshot = await db.ref(`users/${userId}`).get();
      const raw = snapshot.exists() ? (snapshot.val() as AdminUserRecord) : null;
      return [userId, normalizeAdminUser(userId, raw)] as const;
    })
  );

  return Object.fromEntries(users);
}

function fallbackMovieContent(contentId: number): Content {
  return {
    id: contentId,
    title: "Unknown Movie",
    poster_url: null,
    genres: [],
    platforms: [],
    director: null,
    release_date: null,
    overview: "Movie details are unavailable right now.",
    runtime: null,
    rating: null,
    created_at: new Date().toISOString(),
    type: "movie",
  };
}

function fallbackShowContent(contentId: number): Content {
  return {
    id: contentId,
    title: "Unknown Show",
    name: "Unknown Show",
    poster_url: null,
    genres: [],
    status: null,
    release_date: null,
    overview: "Show details are unavailable right now.",
    runtime: null,
    rating: null,
    created_at: new Date().toISOString(),
    type: "tv",
  };
}

async function getContentDetails(item: ListItem): Promise<Content> {
  if (item.content_summary?.title) {
    const base = {
      id: item.content_id,
      title: item.content_summary.title,
      poster_url: item.content_summary.poster_url || item.poster_url_snapshot || null,
      genres: [],
      release_date: item.content_summary.release_year ? `${item.content_summary.release_year}-01-01` : null,
      overview: null,
      runtime: null,
      rating: null,
      created_at: item.added_at,
    };
    return (item.content_type === "tv"
      ? { ...base, name: base.title, status: null, type: "tv" }
      : { ...base, platforms: [], director: null, type: "movie" }) as Content;
  }
  if (item.content_type === "tv") {
    const show = await getShowDetails(item.content_id);
    return (show as unknown as Content) || fallbackShowContent(item.content_id);
  }

  const movie = await getMovieDetails(item.content_id);
  return (movie as unknown as Content) || fallbackMovieContent(item.content_id);
}

/**
 * Read-only list details for public/shared views.
 */
export async function getPublicListWithDetails(listId: string): Promise<ListWithItems | null> {
  try {
    const safeListId = normalizeListIdParam(listId);
    if (!safeListId) return null;

    const db = getFirebaseAdminDatabase();
    const listSnapshot = await db.ref(`lists/${safeListId}`).get();

    if (!listSnapshot.exists() && safeListId.startsWith("canisterr_")) {
      const featuredId = safeListId.slice("canisterr_".length);
      const featuredSnapshot = await db.ref(`home_featured_lists/${featuredId}`).get();
      if (!featuredSnapshot.exists()) return null;
      const featured = featuredSnapshot.val() as import("./featured-lists").FeaturedList;
      const today = new Date().toISOString().slice(0, 10);
      if (!featured.active || !Array.isArray(featured.items) || (featured.expires_at && featured.expires_at < today)) return null;
      const canisterrUser: User = {
        id: "canisterr", username: "canisterr", name: "Canisterr", avatar_url: "/logo.png",
        created_at: featured.created_at || new Date(0).toISOString(),
      };
      const list: List = {
        id: safeListId, name: featured.title, description: featured.description || null, owner_id: "canisterr",
        collaborator_ids: { canisterr: true }, privacy: "public", is_ranked: false, view_type: "grid",
        show_unwatched_first: false, cover_type: "grid", cover_image_url: null,
        created_at: featured.created_at, updated_at: featured.updated_at, editorial_source: "canisterr",
        ...(featured.expires_at ? { expires_at: featured.expires_at } : {}),
      };
      const items: ListItemWithContent[] = featured.items.map((title, position) => {
        const item: ListItem = {
          id: `${safeListId}_${position}`, list_id: safeListId, content_id: title.media_id,
          content_type: title.media_type, added_by_user_id: "canisterr", position,
          added_at: featured.updated_at, watched_by: [], poster_url_snapshot: title.poster_url || null,
          content_summary: { title: title.title, poster_url: title.poster_url || null, ...(title.release_year ? { release_year: title.release_year } : {}) },
        };
        return { ...item, content: awaitContentFromSummary(item), added_by_user: canisterrUser };
      });
      const collaborator: ListCollaboratorWithUser = {
        id: `${safeListId}_owner`, list_id: safeListId, user_id: "canisterr", role: "owner",
        joined_at: featured.created_at || "", user: canisterrUser,
      };
      return { ...list, items, collaborators: [collaborator], item_count: items.length, collaborator_count: 1 };
    }
    if (!listSnapshot.exists()) return null;

    const list = listSnapshot.val() as List;
    if (list.privacy !== "public") return null;
    if (list.editorial_source === "canisterr" && list.expires_at && list.expires_at < new Date().toISOString().slice(0, 10)) return null;

    const [itemsSnapshot, collaboratorsSnapshot] = await Promise.all([
      db.ref("list_items").get(),
      db.ref("list_collaborators").get(),
    ]);

    const allItems = itemsSnapshot.exists() ? (itemsSnapshot.val() as Record<string, ListItem>) : {};
    const listItems = Object.values(allItems)
      .filter((item: ListItem) => item.list_id === safeListId)
      .sort((a: ListItem, b: ListItem) => (a.position || 0) - (b.position || 0));

    const allCollaborators = collaboratorsSnapshot.exists()
      ? (collaboratorsSnapshot.val() as Record<string, ListCollaborator>)
      : {};
    const listCollaborators = Object.values(allCollaborators).filter(
      (collab: ListCollaborator) => collab.list_id === safeListId
    );

    const requiredUserIds = Array.from(
      new Set([
        ...listItems.map((item) => item.added_by_user_id),
        ...listCollaborators.map((collab) => collab.user_id),
      ])
    );
    const usersById = await getAdminUsersByIds(requiredUserIds);

    const enrichedItems: ListItemWithContent[] = await Promise.all(
      listItems.map(async (item) => ({
        ...item,
        watched_by: Array.isArray(item.watched_by) ? item.watched_by : [],
        content: await getContentDetails(item),
        added_by_user: usersById[item.added_by_user_id] || createFallbackUser(item.added_by_user_id),
      }))
    );

    const enrichedCollaborators: ListCollaboratorWithUser[] = listCollaborators.map((collab) => ({
      ...collab,
      user: usersById[collab.user_id] || createFallbackUser(collab.user_id),
    }));

    return {
      ...list,
      items: enrichedItems,
      collaborators: enrichedCollaborators,
      item_count: enrichedItems.length,
      collaborator_count: enrichedCollaborators.length,
    };
  } catch (error) {
    console.error("Error fetching public list details:", error);
    return null;
  }
}

function awaitContentFromSummary(item: ListItem): Content {
  const title = item.content_summary?.title || "Untitled";
  const base = {
    id: item.content_id, title, poster_url: item.content_summary?.poster_url || item.poster_url_snapshot || null,
    genres: [], release_date: item.content_summary?.release_year ? `${item.content_summary.release_year}-01-01` : null,
    overview: null, runtime: null, rating: null, created_at: item.added_at,
  };
  return (item.content_type === "tv"
    ? { ...base, name: title, status: null, type: "tv" }
    : { ...base, platforms: [], director: null, type: "movie" }) as Content;
}
