"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import { auth, db } from "@/lib/firebase";
import type { User } from "@/types";
import { DEFAULT_SETTINGS, mergeSettings, type SettingsData } from "@/lib/settings";
import { normalizeUserRecord } from "@/lib/users";
import { syncUsernameIndex } from "@/lib/username-index";

type CurrentUserContextValue = {
  user: User | null;
  settings: SettingsData;
  loading: boolean;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);
const USER_CACHE_PREFIX = "canisterr_current_user";

type CachedCurrentUser = {
  user: User;
  settings: SettingsData;
};

function readCachedCurrentUser(userId: string): CachedCurrentUser | null {
  try {
    const raw = window.localStorage.getItem(`${USER_CACHE_PREFIX}:${userId}`);
    if (!raw) return null;

    const cached = JSON.parse(raw) as CachedCurrentUser;
    return cached?.user?.id === userId ? cached : null;
  } catch {
    return null;
  }
}

function writeCachedCurrentUser(userId: string, value: CachedCurrentUser) {
  try {
    window.localStorage.setItem(`${USER_CACHE_PREFIX}:${userId}`, JSON.stringify(value));
  } catch {
    // A fresh network snapshot still works when storage is unavailable.
  }
}

function buildFallbackUser(firebaseUser: {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}): User {
  return normalizeUserRecord(firebaseUser.uid, {
    id: firebaseUser.uid,
    username: firebaseUser.email?.split("@")[0] || "user",
    name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
    avatar_url: firebaseUser.photoURL || null,
    created_at: new Date().toISOString(),
  });
}

export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [settings, setSettings] = useState<SettingsData>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setSettings(DEFAULT_SETTINGS);
        setLoading(false);
        return;
      }

      const fallbackUser = buildFallbackUser({
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName,
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
      });
      const cached = readCachedCurrentUser(firebaseUser.uid);

      setUser(cached?.user || fallbackUser);
      setSettings(cached?.settings || DEFAULT_SETTINGS);
      setLoading(false);

      try {
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.exists() ? userSnapshot.val() : null;

        const nextSettings = mergeSettings(userData?.settings);
        const normalizedUser = normalizeUserRecord(firebaseUser.uid, {
          id: userData?.id || firebaseUser.uid,
          username: userData?.username || firebaseUser.email?.split("@")[0] || "user",
          name: userData?.name || firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
          avatar_url: userData?.avatar_url || firebaseUser.photoURL || null,
          created_at: userData?.created_at || userData?.createdAt || new Date().toISOString(),
        });

        const nextUser: User = {
          ...normalizedUser,
          bio: userData?.bio || "",
          display_list_id: userData?.display_list_id || undefined,
          mood_tags: userData?.mood_tags || [],
          mood_tags_updated_at: userData?.mood_tags_updated_at,
        };

        setSettings(nextSettings);
        setUser(nextUser);
        writeCachedCurrentUser(firebaseUser.uid, { user: nextUser, settings: nextSettings });

        if (typeof userData?.username === "string" && userData.username.trim()) {
          void syncUsernameIndex(firebaseUser.uid, userData.username).catch(() => {});
        }
      } catch {
        if (!cached) {
          setSettings(DEFAULT_SETTINGS);
          setUser(fallbackUser);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  const value = useMemo(
    () => ({
      user,
      settings,
      loading,
    }),
    [user, settings, loading]
  );

  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  const context = useContext(CurrentUserContext);
  if (!context) {
    throw new Error("useCurrentUser must be used within a CurrentUserProvider");
  }

  return context;
}
