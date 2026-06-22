import { get, limitToFirst, orderByChild, query, ref, startAt, endAt } from "firebase/database";
import { db } from "@/lib/firebase";
import type { User } from "@/types";
import { createTimedCache } from "@/lib/cache";

type UserRecord = Record<string, unknown> & {
  id?: string;
  username?: string;
  username_lower?: string;
  name?: string;
  name_lower?: string;
  avatar_url?: string | null;
  created_at?: string;
  createdAt?: string;
};

type NormalizableUserRecord = UserRecord | User;

const PROFILE_TTL_MS = 5 * 60 * 1000;
const ALL_USERS_TTL_MS = 2 * 60 * 1000;

function normalizeLabel(value?: string | null): string {
  return value?.trim().replace(/^@/, "") || "";
}

function normalizeUserSearchTerm(value?: string | null): string {
  return normalizeLabel(value).toLowerCase();
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
    /^user\s+[a-z0-9_-]+$/.test(normalized)
  );
}

function isOpaqueUserIdentifier(value: string): boolean {
  const normalized = normalizeLabel(value);
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)[A-Za-z0-9_-]{16,}$/.test(normalized);
}

function isPublicIdentityLabel(value?: string | null, canonicalId?: string): boolean {
  const normalized = normalizeLabel(value);
  if (!normalized) return false;
  if (isPlaceholderLabel(normalized) || isOpaqueUserIdentifier(normalized)) return false;
  if (canonicalId && normalized === normalizeLabel(canonicalId)) return false;
  return true;
}

export function formatFallbackUserName(_userId?: string) {
  return "User";
}

export function getDisplayUserName(user: Pick<User, "id" | "username" | "name">, currentUser?: User | null): string {
  if (currentUser && currentUser.id === user.id) {
    const currentName = currentUser.name?.trim();
    if (isPublicIdentityLabel(currentName, user.id)) {
      return currentName;
    }

    const currentUsername = currentUser.username?.trim();
    if (isPublicIdentityLabel(currentUsername, user.id)) {
      return currentUsername.startsWith("@") ? currentUsername : `@${currentUsername}`;
    }
  }

  const name = user.name?.trim();
  if (isPublicIdentityLabel(name, user.id)) {
    return name;
  }

  const username = user.username?.trim();
  if (isPublicIdentityLabel(username, user.id)) {
    return username.startsWith("@") ? username : `@${username}`;
  }

  return formatFallbackUserName();
}

export function getDisplayUserHandle(user: Pick<User, "id" | "username">, currentUser?: User | null): string | null {
  if (currentUser && currentUser.id === user.id) {
    const currentUsername = currentUser.username?.trim();
    if (isPublicIdentityLabel(currentUsername, user.id)) {
      return currentUsername.startsWith("@") ? currentUsername : `@${currentUsername}`;
    }
  }

  const username = user.username?.trim();
  if (isPublicIdentityLabel(username, user.id)) {
    return username.startsWith("@") ? username : `@${username}`;
  }

  return null;
}

export function normalizeUserRecord(id: string, raw: NormalizableUserRecord): User {
  const username = normalizeLabel(raw.username);
  const name = normalizeLabel(raw.name);
  const createdAt = "created_at" in raw ? raw.created_at : "createdAt" in raw ? raw.createdAt : undefined;
  const displayName =
    (isPublicIdentityLabel(name, id) ? name : null) ||
    (isPublicIdentityLabel(username, id) ? username : null) ||
    formatFallbackUserName(id);

  return {
    // The RTDB key is the canonical user id; never trust a stored `raw.id` to override it.
    id,
    username: username || id,
    name: displayName,
    avatar_url: raw.avatar_url || null,
    created_at: createdAt || new Date().toISOString(),
  };
}

export function createFallbackUser(userId: string): User {
  return {
    id: userId,
    username: userId,
    name: formatFallbackUserName(userId),
    avatar_url: null,
    created_at: new Date().toISOString(),
  };
}

const cachedGetUserProfile = createTimedCache<[string], User | null>({
  ttlMs: PROFILE_TTL_MS,
  key: (userId) => userId,
  loader: async (userId) => {
    const snapshot = await get(ref(db, `users/${userId}`));
    if (!snapshot.exists()) return null;

    const raw = snapshot.val() as UserRecord;
    return normalizeUserRecord(userId, raw);
  },
});

const cachedGetAllUsers = createTimedCache<[], Record<string, User>>({
  ttlMs: ALL_USERS_TTL_MS,
  key: () => "all-users",
  loader: async () => {
    try {
      const snapshot = await get(ref(db, "users"));
      if (!snapshot.exists()) return {};

      const raw = snapshot.val() as Record<string, UserRecord>;
      return Object.fromEntries(Object.entries(raw).map(([id, user]) => [id, normalizeUserRecord(id, user)]));
    } catch (error) {
      console.warn("All-users cache failed, returning an empty set:", error);
      return {};
    }
  },
});

const cachedSearchUsers = createTimedCache<[string], Record<string, User>>({
  ttlMs: ALL_USERS_TTL_MS,
  key: (term) => normalizeUserSearchTerm(term),
  loader: async (term) => {
    const normalized = normalizeUserSearchTerm(term);
    if (!normalized) return {};

    const matches = new Map<string, User>();

    try {
      const searchBounds = `${normalized}\uf8ff`;
      const [usernameSnapshot, nameSnapshot] = await Promise.all([
        get(query(ref(db, "users"), orderByChild("username_lower"), startAt(normalized), endAt(searchBounds), limitToFirst(20))),
        get(query(ref(db, "users"), orderByChild("name_lower"), startAt(normalized), endAt(searchBounds), limitToFirst(20))),
      ]);

      for (const snapshot of [usernameSnapshot, nameSnapshot]) {
        if (!snapshot.exists()) continue;

        const value = snapshot.val() as Record<string, UserRecord>;
        for (const [id, user] of Object.entries(value)) {
          matches.set(id, normalizeUserRecord(id, user));
        }
      }
    } catch (error) {
      console.warn("Indexed user search unavailable, falling back to cached user scan:", error);
    }

    if (matches.size < 20) {
      const allUsers = await cachedGetAllUsers();
      for (const [id, user] of Object.entries(allUsers)) {
        const username = normalizeUserSearchTerm(user.username);
        const name = normalizeUserSearchTerm(user.name);
        if ((username.includes(normalized) || name.includes(normalized)) && !matches.has(id)) {
          matches.set(id, user);
        }
        if (matches.size >= 20) break;
      }
    }

    return Object.fromEntries(matches.entries());
  },
});

export async function getUserProfile(userId: string): Promise<User> {
  return (await cachedGetUserProfile(userId)) || createFallbackUser(userId);
}

export async function getUsersByIds(userIds: string[]): Promise<Record<string, User>> {
  const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
  const users = await Promise.all(uniqueIds.map(async (userId) => [userId, await getUserProfile(userId)] as const));
  return Object.fromEntries(users);
}

export async function getAllUsersCached(): Promise<Record<string, User>> {
  return (await cachedGetAllUsers()) || {};
}

export async function searchUsersCached(term: string): Promise<Record<string, User>> {
  return (await cachedSearchUsers(term)) || {};
}
