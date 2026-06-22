import { get, ref } from "firebase/database";
import { auth, db } from "@/lib/firebase";
import {
  getUsernameValidationError,
  normalizeUsernameKey,
} from "@/lib/username-utils";

export { getUsernameValidationError, normalizeUsernameKey } from "@/lib/username-utils";

function isPermissionDeniedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /permission/i.test(message) && /denied/i.test(message);
}

export function getUsernameIndexRef(username: string) {
  return ref(db, `usernames/${normalizeUsernameKey(username)}`);
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const normalizedUsername = normalizeUsernameKey(username);
  if (!normalizedUsername) return true;

  try {
    const snapshot = await get(getUsernameIndexRef(normalizedUsername));
    return !snapshot.exists();
  } catch (error) {
    if (!isPermissionDeniedError(error)) {
      console.warn("Username availability lookup failed, allowing signup to continue:", error);
    }
    return true;
  }
}

export async function syncUsernameIndex(userId: string, username: string, previousUsername?: string | null) {
  const nextUsername = normalizeUsernameKey(username);
  if (!nextUsername) return;
  if (auth.currentUser?.uid !== userId) {
    return;
  }

  const idToken = await auth.currentUser.getIdToken();
  const response = await fetch("/api/usernames/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idToken,
      username: nextUsername,
      previousUsername: previousUsername ? normalizeUsernameKey(previousUsername) : null,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "Username sync failed.");
  }
}
