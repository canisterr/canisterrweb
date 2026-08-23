"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signOut as firebaseSignOut } from "firebase/auth";
import { ref, update } from "firebase/database";
import { auth, db } from "@/lib/firebase";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import type { SettingsData } from "@/lib/settings";

export { DEFAULT_SETTINGS, mergeSettings, normalizeUsername } from "@/lib/settings";
export type { SettingsData } from "@/lib/settings";

export function useSettingsUser() {
  const router = useRouter();
  const { user, settings: currentSettings, loading, setCurrentSettings } = useCurrentUser();
  const settingsRef = useRef(currentSettings);

  useEffect(() => {
    settingsRef.current = currentSettings;
  }, [currentSettings]);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [loading, router, user]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.cineTheme = currentSettings.appearance.theme;
    root.dataset.cineTextSize = currentSettings.appearance.textSize;
    root.dataset.cineReduceMotion = currentSettings.appearance.reduceMotion ? "true" : "false";
    root.style.colorScheme = currentSettings.appearance.theme === "dark" ? "dark" : "light";
  }, [currentSettings.appearance]);

  const saveSettings = async (nextSettings: SettingsData) => {
    if (!user) return;

    const previousSettings = settingsRef.current;
    settingsRef.current = nextSettings;
    setCurrentSettings(nextSettings);

    try {
      await update(ref(db, `users/${user.id}`), {
        settings: nextSettings,
        settings_updated_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error saving settings:", error);
      settingsRef.current = previousSettings;
      setCurrentSettings(previousSettings);
      throw error;
    }
  };

  const updateSection = async <K extends keyof SettingsData>(
    key: K,
    patch: Partial<SettingsData[K]>
  ) => {
    const next = {
      ...settingsRef.current,
      [key]: {
        ...settingsRef.current[key],
        ...patch,
      },
    } as SettingsData;

    await saveSettings(next);
  };

  const handleSignOut = async () => {
    await firebaseSignOut(auth);
    router.push("/auth/login");
  };

  return {
    user,
    settings: currentSettings,
    setSettings: setCurrentSettings,
    loading,
    saveSettings,
    updateSection,
    handleSignOut,
  };
}
