import "server-only";

import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp, getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { getUsernameValidationError, normalizeUsernameKey } from "@/lib/username-utils";
import type { User } from "@/types";

type StoredUserRecord = {
  username?: string;
  name?: string;
  avatar_url?: string | null;
  created_at?: string;
  createdAt?: string;
};

type EnsureUserProfileOptions = {
  uid: string;
  preferredName?: string | null;
  preferredUsername?: string | null;
  strictPreferredUsername?: boolean;
};

function sanitizeUsernameSeed(value?: string | null): string {
  return normalizeUsernameKey(value || "")
    .replace(/[^a-z0-9._]/g, "")
    .replace(/\.{2,}/g, ".")
    .replace(/^[_\.]+|[_\.]+$/g, "");
}

function normalizeName(value?: string | null): string {
  return value?.trim().replace(/\s+/g, " ") || "";
}

function isPlaceholderName(value?: string | null): boolean {
  const normalized = normalizeName(value).toLowerCase();
  return !normalized || normalized === "user" || normalized === "unknown user";
}

function buildDisplayName(
  preferredName: string,
  storedName: string,
  authName: string,
  emailLocalPart: string,
  username: string
): string {
  if (!isPlaceholderName(preferredName)) return preferredName;
  if (!isPlaceholderName(storedName)) return storedName;
  if (!isPlaceholderName(authName)) return authName;
  if (!isPlaceholderName(emailLocalPart)) return emailLocalPart;
  return username;
}

function withUsernameSuffix(base: string, suffix: string): string {
  const safeSuffix = suffix.replace(/[^a-z0-9]/g, "");
  const safeBase = sanitizeUsernameSeed(base) || "user";
  const maxBaseLength = Math.max(1, 20 - safeSuffix.length);
  const trimmedBase = safeBase.slice(0, maxBaseLength).replace(/^[_\.]+|[_\.]+$/g, "") || "user";
  return `${trimmedBase}${safeSuffix}`.slice(0, 20);
}

async function claimUsername(userId: string, candidate: string): Promise<boolean> {
  const normalizedCandidate = normalizeUsernameKey(candidate);
  if (getUsernameValidationError(normalizedCandidate)) {
    return false;
  }

  const adminDb = getFirebaseAdminDatabase();
  const usernameRef = adminDb.ref(`usernames/${normalizedCandidate}`);
  const result = await usernameRef.transaction((current) => {
    if (current === null || current === userId) {
      return userId;
    }
    return;
  });

  return Boolean(result.committed && result.snapshot.val() === userId);
}

async function reserveUsername(options: {
  userId: string;
  preferredUsername?: string | null;
  strictPreferredUsername?: boolean;
  existingUsername?: string | null;
  email?: string | null;
}): Promise<string> {
  const preferred = sanitizeUsernameSeed(options.preferredUsername);
  const existing = sanitizeUsernameSeed(options.existingUsername);
  const emailLocalPart = sanitizeUsernameSeed(options.email?.split("@")[0] || "");
  const baseSeed = preferred || existing || emailLocalPart || "user";
  const uidTail = options.userId.toLowerCase().replace(/[^a-z0-9]/g, "").slice(-6) || "cine";

  if (options.strictPreferredUsername) {
    if (getUsernameValidationError(preferred)) {
      throw new Error(getUsernameValidationError(preferred) || "Username is required.");
    }

    if (await claimUsername(options.userId, preferred)) {
      return preferred;
    }

    throw new Error("Username already taken.");
  }

  const candidates = Array.from(
    new Set(
      [
        existing,
        preferred,
        emailLocalPart,
        withUsernameSuffix(baseSeed, uidTail),
        withUsernameSuffix(baseSeed, uidTail.slice(-4)),
        withUsernameSuffix("user", uidTail),
        ...Array.from({ length: 8 }, (_, index) => withUsernameSuffix(baseSeed, String(index + 2))),
      ].filter(Boolean)
    )
  );

  for (const candidate of candidates) {
    if (await claimUsername(options.userId, candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to reserve a username for this account.");
}

export async function ensureUserProfileRecord(options: EnsureUserProfileOptions): Promise<User> {
  const adminAuth = getAuth(getFirebaseAdminApp());
  const adminDb = getFirebaseAdminDatabase();

  const [authUser, snapshot] = await Promise.all([
    adminAuth.getUser(options.uid),
    adminDb.ref(`users/${options.uid}`).get(),
  ]);

  const stored = snapshot.exists() ? (snapshot.val() as StoredUserRecord) : null;
  const username = await reserveUsername({
    userId: options.uid,
    preferredUsername: options.preferredUsername,
    strictPreferredUsername: options.strictPreferredUsername,
    existingUsername: stored?.username,
    email: authUser.email,
  });

  const preferredName = normalizeName(options.preferredName);
  const storedName = normalizeName(stored?.name);
  const authName = normalizeName(authUser.displayName);
  const emailLocalPart = normalizeName(authUser.email?.split("@")[0] || "");
  const name = buildDisplayName(preferredName, storedName, authName, emailLocalPart, username);
  const createdAt = stored?.createdAt || stored?.created_at || new Date().toISOString();
  const avatarUrl = stored?.avatar_url ?? authUser.photoURL ?? null;

  await adminDb.ref(`users/${options.uid}`).update({
    id: options.uid,
    username,
    username_lower: username,
    name,
    name_lower: name.toLowerCase(),
    avatar_url: avatarUrl,
    createdAt,
  });

  return {
    id: options.uid,
    username,
    name,
    avatar_url: avatarUrl,
    created_at: createdAt,
  };
}
