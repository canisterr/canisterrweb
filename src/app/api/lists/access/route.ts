import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp, getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { filterListDataForViewer } from "@/lib/list-access-filter";
import type { List, ListCollaborator, ListItem } from "@/types";
import type { FeaturedList } from "@/lib/featured-lists";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let viewerId: string;
  try {
    viewerId = (await getAuth(getFirebaseAdminApp()).verifyIdToken(token)).uid;
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const db = getFirebaseAdminDatabase();
    const [listsSnapshot, itemsSnapshot, collaboratorsSnapshot, featuredSnapshot] = await Promise.all([
      db.ref("lists").get(),
      db.ref("list_items").get(),
      db.ref("list_collaborators").get(),
      db.ref("home_featured_lists").get(),
    ]);
    const allLists = (listsSnapshot.val() || {}) as Record<string, List>;
    const allItems = (itemsSnapshot.val() || {}) as Record<string, ListItem>;
    const allCollaborators = (collaboratorsSnapshot.val() || {}) as Record<string, ListCollaborator>;
    const featuredLists = (featuredSnapshot.val() || {}) as Record<string, FeaturedList>;
    const today = new Date().toISOString().slice(0, 10);
    Object.entries(featuredLists).forEach(([featuredId, featured]) => {
      if (!featured.active || !Array.isArray(featured.items) || !featured.items.length || (featured.expires_at && featured.expires_at < today)) return;
      const id = `canisterr_${featuredId}`;
      allLists[id] = {
        id, name: featured.title, description: featured.description || null, owner_id: "canisterr",
        collaborator_ids: { canisterr: true }, privacy: "public", is_ranked: false, view_type: "grid",
        show_unwatched_first: false, cover_type: "grid", cover_image_url: null,
        created_at: featured.created_at, updated_at: featured.updated_at, editorial_source: "canisterr",
        ...(featured.expires_at ? { expires_at: featured.expires_at } : {}),
      };
      featured.items.forEach((title, position) => {
        const itemId = `${id}_${position}`;
        allItems[itemId] = {
          id: itemId, list_id: id, content_id: title.media_id, content_type: title.media_type,
          added_by_user_id: "canisterr", position, added_at: featured.updated_at, watched_by: [],
          poster_url_snapshot: title.poster_url || null,
          content_summary: { title: title.title, poster_url: title.poster_url || null, ...(title.release_year ? { release_year: title.release_year } : {}) },
        };
      });
      const collaboratorId = `${id}_owner`;
      allCollaborators[collaboratorId] = { id: collaboratorId, list_id: id, user_id: "canisterr", role: "owner", joined_at: featured.created_at };
    });
    const visible = filterListDataForViewer(viewerId, allLists, allItems, allCollaborators);
    const expiredEditorialIds = new Set(Object.entries(visible.lists)
      .filter(([, list]) => list.editorial_source === "canisterr" && Boolean(list.expires_at && list.expires_at < today))
      .map(([id]) => id));
    const lists = Object.fromEntries(Object.entries(visible.lists).filter(([id]) => !expiredEditorialIds.has(id)));
    return NextResponse.json(
      {
        lists,
        items: Object.fromEntries(Object.entries(visible.items).filter(([, item]) => !expiredEditorialIds.has(item.list_id))),
        collaborators: Object.fromEntries(Object.entries(visible.collaborators).filter(([, collab]) => !expiredEditorialIds.has(collab.list_id))),
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch {
    return NextResponse.json({ error: "unavailable" }, { status: 503 });
  }
}
