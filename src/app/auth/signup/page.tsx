"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { signUp, checkUsernameAvailability, getAuthErrorMessage, getSignupPasswordError, signInWithGoogle } from "@/lib/auth";
import { auth, db } from "@/lib/firebase";
import { getUsernameValidationError } from "@/lib/username-index";
import AuthShell, { authInputClass, authLabelClass } from "@/components/auth/AuthShell";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { get, ref } from "firebase/database";

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const usernameCheckDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const usernameValidationError = username.trim() ? getUsernameValidationError(username) : null;

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        void get(ref(db, `users/${firebaseUser.uid}`)).then((profile) => {
          const username = profile.exists() ? profile.val()?.username : null;
          const hasUsableProfile = typeof username === "string" && !getUsernameValidationError(username);
          if (hasUsableProfile) router.replace("/dashboard");
          else if (firebaseUser.providerData.some((provider) => provider.providerId === "google.com")) {
            router.replace("/auth/complete-profile");
          }
        });
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (usernameCheckDebounceRef.current) {
      clearTimeout(usernameCheckDebounceRef.current);
      usernameCheckDebounceRef.current = null;
    }

    if (usernameValidationError || username.length < 3) {
      setUsernameAvailable(null);
      setCheckingUsername(false);
      return;
    }

    setCheckingUsername(true);
    usernameCheckDebounceRef.current = setTimeout(async () => {
      try {
        setUsernameAvailable(await checkUsernameAvailability(username));
      } catch {
        setUsernameAvailable(null);
      } finally {
        setCheckingUsername(false);
      }
    }, 500);

    return () => {
      if (usernameCheckDebounceRef.current) {
        clearTimeout(usernameCheckDebounceRef.current);
        usernameCheckDebounceRef.current = null;
      }
    };
  }, [username, usernameValidationError]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");

    if (!agreedToTerms) {
      setError("Please agree to the terms and conditions to continue.");
      return;
    }
    const passwordError = getSignupPasswordError(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (usernameValidationError) {
      setError(usernameValidationError);
      return;
    }
    if (usernameAvailable === false) {
      setError("Username is not available");
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password, username, name, {
        termsAccepted: agreedToTerms,
        privacyAccepted: agreedToTerms,
      });
      setVerificationSent(true);
    } catch (err) {
      setError(getAuthErrorMessage(err, "signup"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      router.replace(result.needsProfile ? "/auth/complete-profile" : "/dashboard");
    } catch (err) {
      setError(getAuthErrorMessage(err, "signup"));
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <AuthShell mode="signup">
      {verificationSent ? (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Check your email</h1>
          <p className="mt-3 text-sm leading-6 text-white/60 lg:text-white/50">
            We sent a verification link to <span className="font-semibold text-[#f5f0de] lg:text-[#f5f0de]">{email}</span>.
            You can use the app now, but please verify within 7 days.
          </p>
          <Link href="/dashboard" className="mt-8 flex w-full items-center justify-center rounded-xl bg-[#f5f0de] px-4 py-3.5 text-base font-bold text-[#0b0b0b] transition hover:bg-white lg:mx-auto lg:w-44 lg:rounded-full lg:bg-[#ff7a1a] lg:text-[#0b0b0b] lg:hover:bg-[#ff8c35]">
            Continue
          </Link>
        </div>
      ) : (
        <>
          <div className="mb-7 lg:mb-4 lg:text-center">
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl lg:uppercase" style={{ fontFamily: '"Ubuntu", ui-sans-serif, system-ui, sans-serif' }}>Create your account</h1>
            <p className="mt-1 text-sm text-white/50 lg:text-white/50">Keep every watch in one place.</p>
          </div>
          {error ? <p role="alert" className="mb-4 text-sm text-[#ff9d62] lg:text-[#ff9d62]">{error}</p> : null}
          <div className="mb-5">
            <GoogleSignInButton onClick={() => void handleGoogleSignUp()} disabled={loading || googleLoading} label={googleLoading ? "Connecting…" : "Continue with Google"} />
            <div className="mt-5 flex items-center gap-3 text-xs text-white/35">
              <span className="h-px flex-1 bg-white/10" />
              <span>OR SIGN UP WITH EMAIL</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-5 lg:space-y-3">
            <div className="space-y-1">
              <label htmlFor="signup-username" className={authLabelClass}>Username</label>
              <input
                id="signup-username" type="text" value={username}
                onChange={(event) => setUsername(event.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ""))}
                minLength={3} maxLength={20} autoCapitalize="none" autoCorrect="off"
                autoComplete="username" spellCheck={false} pattern="[a-z0-9._]{3,20}"
                required aria-describedby="username-help" className={authInputClass}
              />
              <p id="username-help" className={`pt-1 text-xs ${usernameValidationError || usernameAvailable === false ? "text-[#ff9d62] lg:text-[#ff9d62]" : "text-white/40 lg:text-white/40"}`}>
                {usernameValidationError || (username.length >= 3
                  ? checkingUsername ? "Checking username…" : usernameAvailable === true ? "Username available" : usernameAvailable === false ? "Username is taken" : "3–20 letters, numbers, dots, or underscores"
                  : "3–20 letters, numbers, dots, or underscores")}
              </p>
            </div>
            <div className="space-y-1">
              <label htmlFor="signup-email" className={authLabelClass}>Email</label>
              <input id="signup-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required className={authInputClass} />
            </div>
            <div className="space-y-1">
              <label htmlFor="signup-name" className={authLabelClass}>Full name</label>
              <input id="signup-name" type="text" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required className={authInputClass} />
            </div>
            <div className="space-y-1">
              <label htmlFor="signup-password" className={authLabelClass}>Password</label>
              <input id="signup-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="new-password" required aria-describedby="password-help" className={authInputClass} />
              <p id="password-help" className="pt-1 text-xs text-white/40">At least 6 characters, with a letter and a number. No symbols needed.</p>
            </div>
            <div className="space-y-1">
              <label htmlFor="signup-confirm-password" className={authLabelClass}>Confirm password</label>
              <input id="signup-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" required className={authInputClass} />
            </div>
            <div className="flex items-start gap-2.5 pt-1">
              <input id="signup-terms" type="checkbox" checked={agreedToTerms} onChange={(event) => setAgreedToTerms(event.target.checked)} className="canisterr-auth-checkbox" />
              <label htmlFor="signup-terms" className="text-xs leading-5 text-white/55 lg:text-white/50">
                I agree to the <Link href="/terms" className="text-[#ff9d62] underline underline-offset-2 lg:text-[#ff9d62]">Terms</Link> and <Link href="/privacy" className="text-[#ff9d62] underline underline-offset-2 lg:text-[#ff9d62]">Privacy Policy</Link>.
              </label>
            </div>
            <button type="submit" disabled={loading || usernameAvailable === false || !agreedToTerms} className="w-full rounded-xl bg-[#f5f0de] px-4 py-3.5 text-base font-bold text-[#0b0b0b] transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-45 lg:mx-auto lg:block lg:w-44 lg:rounded-full lg:bg-[#ff7a1a] lg:text-[#0b0b0b] lg:shadow-[0_6px_15px_rgba(255,122,26,0.25)] lg:hover:bg-[#ff8c35]">
              {loading ? "Creating account…" : "Sign up"}
            </button>
          </form>
        </>
      )}
    </AuthShell>
  );
}
