import type { List, ListCollaborator, ListItem } from "@/types";

export function filterListDataForViewer(
  viewerId: string,
  allLists: Record<string, List>,
  allItems: Record<string, ListItem>,
  allCollaborators: Record<string, ListCollaborator>
) {
  const memberListIds = new Set(Object.values(allCollaborators)
    .filter((collaborator) => collaborator.user_id === viewerId &&
      !Object.keys(allLists[collaborator.list_id]?.collaborator_ids || {}).length)
    .map((collaborator) => collaborator.list_id));
  const permittedListIds = new Set(Object.entries(allLists)
    .filter(([id, list]) => list.privacy === "public" || list.owner_id === viewerId ||
      Boolean(list.collaborator_ids?.[viewerId]) || memberListIds.has(id))
    .map(([id]) => id));

  return {
    lists: Object.fromEntries(Object.entries(allLists).filter(([id]) => permittedListIds.has(id))),
    items: Object.fromEntries(Object.entries(allItems).filter(([, item]) => permittedListIds.has(item.list_id))),
    collaborators: Object.fromEntries(Object.entries(allCollaborators).filter(([, collaborator]) => permittedListIds.has(collaborator.list_id))),
  };
}
