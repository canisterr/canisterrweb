"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import AuthShell, { authInputClass, authLabelClass } from "@/components/auth/AuthShell";
import { auth, db } from "@/lib/firebase";
import { checkUsernameAvailability, completeGoogleSignup } from "@/lib/auth";
import { getUsernameValidationError } from "@/lib/username-index";
import type { User } from "firebase/auth";

function safeReturnPath(path: string | null): string {
  return path?.startsWith("/") && !path.startsWith("//") ? path : "/dashboard";
}

function makeUsername(value: string): string {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 20);
  return cleaned.length >= 3 ? cleaned : "cinephile";
}

export default function CompleteGoogleProfilePage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [username, setUsername] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [returnPath] = useState(() => typeof window === "undefined"
    ? "/dashboard"
    : safeReturnPath(new URLSearchParams(window.location.search).get("redirect")));
  const usernameCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameValidationError = getUsernameValidationError(username);

  useEffect(() => {
    if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current);
    if (usernameValidationError) return;
    usernameCheckTimer.current = setTimeout(() => {
      void checkUsernameAvailability(username).then(setUsernameAvailable).catch(() => setUsernameAvailable(null)).finally(() => setCheckingUsername(false));
    }, 450);
    return () => {
      if (usernameCheckTimer.current) clearTimeout(usernameCheckTimer.current);
    };
  }, [username, usernameValidationError]);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (!user) {
        window.location.replace("/auth/signup");
        return;
      }
      void get(ref(db, `users/${user.uid}`)).then((profile) => {
        const profileData = profile.val();
        const storedUsername = typeof profileData?.username === "string" ? profileData.username : "";
        if (profile.exists() && !getUsernameValidationError(storedUsername)) {
          window.location.replace(safeReturnPath(new URLSearchParams(window.location.search).get("redirect")));
          return;
        }
        setCurrentUser(user);
        setUsername(makeUsername(storedUsername || user.displayName || user.email?.split("@")[0] || "cinephile"));
        setUsernameAvailable(null);
        setCheckingUsername(true);
        setLoading(false);
      }).catch(() => {
        setError("Could not load your account profile. Please try again.");
        setLoading(false);
      });
    });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const usernameError = getUsernameValidationError(username);
    if (usernameError) return setError(usernameError);
    if (checkingUsername || usernameAvailable !== true) return setError("Choose a username that is available before continuing.");
    if (!accepted) return setError("Please agree to the Terms and Privacy Policy to continue.");
    if (!currentUser) return setError("Your sign-in session expired. Please sign in again.");

    setSaving(true);
    try {
      await completeGoogleSignup(currentUser, username, currentUser.displayName || "", {
        termsAccepted: accepted,
        privacyAccepted: accepted,
      });
      window.location.assign(returnPath);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not complete your profile.");
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="min-h-dvh bg-black" aria-label="Loading profile setup" />;
  }

  return (
    <AuthShell mode="signup">
      <div className="mb-6 lg:text-center">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl" style={{ fontFamily: '"Ubuntu", ui-sans-serif, system-ui, sans-serif' }}>Fix your username</h1>
        <p className="mt-2 text-sm text-white/50">Choose how people will find you on Canisterr.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? <p role="alert" className="text-sm text-[#ff9d62]">{error}</p> : null}
        <div className="space-y-1">
          <label htmlFor="google-profile-username" className={authLabelClass}>Username</label>
          <input id="google-profile-username" value={username} onChange={(event) => {
            const nextUsername = event.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "");
            setUsername(nextUsername);
            setUsernameAvailable(null);
            setCheckingUsername(!getUsernameValidationError(nextUsername));
          }} required minLength={3} maxLength={20} autoComplete="username" aria-describedby="google-username-status" className={authInputClass} />
          <p id="google-username-status" aria-live="polite" className={`pt-1 text-xs ${usernameValidationError || usernameAvailable === false ? "text-[#ff9d62]" : "text-white/40"}`}>
            {usernameValidationError || (checkingUsername ? "Checking username…" : usernameAvailable === true ? "Username available" : usernameAvailable === false ? "Username is taken" : "3–20 letters, numbers, dots, or underscores")}
          </p>
        </div>
        <div className="flex items-start gap-2.5">
          <input id="google-profile-terms" type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="canisterr-auth-checkbox" />
          <label htmlFor="google-profile-terms" className="text-xs leading-5 text-white/55">
            I agree to the <Link href="/terms" className="text-[#ff9d62] underline underline-offset-2">Terms</Link> and <Link href="/privacy" className="text-[#ff9d62] underline underline-offset-2">Privacy Policy</Link>.
          </label>
        </div>
        <button type="submit" disabled={saving || checkingUsername || usernameAvailable !== true} className="w-full rounded-xl bg-[#ff7a1a] px-4 py-3.5 text-base font-bold text-[#0b0b0b] transition hover:bg-[#ff8c35] disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? "Creating your profile…" : "Continue"}
        </button>
      </form>
    </AuthShell>
  );
}
