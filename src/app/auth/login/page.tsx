"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getAuthErrorMessage, signIn, signInWithGoogle } from "@/lib/auth";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { get, ref } from "firebase/database";
import AuthShell, { authInputClass, authLabelClass } from "@/components/auth/AuthShell";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { getUsernameValidationError } from "@/lib/username-utils";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect");
  const safeRedirect = redirectTarget?.startsWith("/") && !redirectTarget.startsWith("//") ? redirectTarget : "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        void get(ref(db, `users/${firebaseUser.uid}`)).then((profile) => {
          const username = profile.exists() ? profile.val()?.username : null;
          const hasUsableProfile = typeof username === "string" && !getUsernameValidationError(username);
          if (hasUsableProfile) router.replace(safeRedirect);
          else if (firebaseUser.providerData.some((provider) => provider.providerId === "google.com")) {
            router.replace(`/auth/complete-profile?redirect=${encodeURIComponent(safeRedirect)}`);
          }
        });
      }
    });

    return () => unsubscribe();
  }, [router, safeRedirect]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signIn(email, password);
      router.push(safeRedirect);
    } catch (err) {
      setError(getAuthErrorMessage(err, "login"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      router.replace(result.needsProfile
        ? `/auth/complete-profile?redirect=${encodeURIComponent(safeRedirect)}`
        : safeRedirect);
    } catch (err) {
      setError(getAuthErrorMessage(err, "login"));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthShell mode="login">
      <div className="mb-9 lg:text-center">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl lg:uppercase" style={{ fontFamily: '"Ubuntu", ui-sans-serif, system-ui, sans-serif' }}>Welcome back</h1>
        <p className="mt-1 text-sm text-white/50 lg:text-white/50">Pick up where you left off.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-7">
        {error ? <p role="alert" className="text-sm text-[#ff9d62] lg:text-[#ff9d62]">{error}</p> : null}
        <div className="space-y-2">
          <label htmlFor="login-email" className={authLabelClass}>Email</label>
          <input id="login-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className={authInputClass} />
        </div>
        <div className="space-y-2">
          <label htmlFor="login-password" className={authLabelClass}>Password</label>
          <input id="login-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required className={authInputClass} />
        </div>
        <div className="text-right">
          <Link href="/auth/forgot-password" className="text-sm text-white/60 underline underline-offset-4 hover:text-[#f5f0de] lg:text-white/50 lg:hover:text-[#ff7a1a]">Forgot password?</Link>
        </div>
        <button type="submit" disabled={loading} className="w-full rounded-xl bg-[#f5f0de] px-4 py-3.5 text-base font-bold text-[#211f20] transition hover:bg-white disabled:opacity-60 lg:mx-auto lg:block lg:w-44 lg:rounded-full lg:bg-[#ff7a1a] lg:text-[#0b0b0b] lg:shadow-[0_6px_15px_rgba(255,122,26,0.25)] lg:hover:bg-[#ff8c35]">
        {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-white/35">
        <span className="h-px flex-1 bg-white/10" />
        <span>OR</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
      <GoogleSignInButton onClick={() => void handleGoogleSignIn()} disabled={loading || googleLoading} label={googleLoading ? "Connecting…" : "Continue with Google"} />
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#050505]" aria-label="Loading sign in" />}>
      <LoginPageContent />
    </Suspense>
  );
}
