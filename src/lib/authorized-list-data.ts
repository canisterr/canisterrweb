import { auth } from "@/lib/firebase";
import type { List, ListCollaborator, ListItem } from "@/types";

export type AuthorizedListData = {
  lists: Record<string, List>;
  items: Record<string, ListItem & { poster_url_snapshot?: string | null }>;
  collaborators: Record<string, ListCollaborator>;
};

export async function getAuthorizedListData(): Promise<AuthorizedListData> {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to access lists");
  const token = await user.getIdToken();
  const response = await fetch("/api/lists/access", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Could not load lists");
  return response.json() as Promise<AuthorizedListData>;
}
