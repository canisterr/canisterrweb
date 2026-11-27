"use client";

import Image from "@/components/AppImage";
import Link from "next/link";
import { useLayoutEffect, useRef, useState, type FormEvent } from "react";
import {
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  verifyPasswordResetCode,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import {
  AUTH_ACTION_OPERATIONS,
  getAuthActionFailureView,
  getAuthActionRequestError,
  getPasswordResetValidationError,
  isAuthActionMode,
  sanitizeAuthContinuation,
  type AuthActionMode,
} from "@/lib/auth-action-utils";

type Mode = AuthActionMode;
type View = "loading" | "verify" | "reset" | "change-email" | "recover-email" | "recover-factor" | "verified" | "password-changed" | "email-changed" | "email-recovered" | "factor-reverted" | "expired" | "invalid" | "error";
type Action = { mode: Mode; code: string; email: string; displayName: string; continuation: string; lang: string };

function failureView(error: unknown): View {
  const code = typeof error === "object" && error && "code" in error ? String((error as { code?: unknown }).code || "") : "";
  return getAuthActionFailureView(code);
}

const fieldClass = "w-full border-0 border-b border-white/25 bg-transparent px-0 py-3 text-base text-[#f5f0de] outline-none placeholder:text-white/30 focus:border-[#ff7a1a]";
const primaryClass = "inline-flex min-h-12 w-full items-center justify-center bg-[#ff7a1a] px-5 py-3 text-sm font-bold text-[#0b0b0b] transition hover:bg-[#ff8d35] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ff7a1a] disabled:cursor-wait disabled:opacity-60 sm:w-auto sm:min-w-52";

export default function AuthActionClient() {
  const started = useRef(false);
  const actionRef = useRef<Action | null>(null);
  const submitted = useRef(false);
  const [view, setView] = useState<View>("loading");
  const [action, setAction] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [formError, setFormError] = useState("");

  useLayoutEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const modeValue = params.get("mode");
    const code = params.get("oobCode") || "";
    const apiKey = params.get("apiKey") || "";
    const expectedApiKey = auth.app.options.apiKey || "";
    const langValue = params.get("lang") || "en";
    const lang = /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(langValue) ? langValue : "en";
    const continuation = sanitizeAuthContinuation(params.get("continueUrl"), window.location.origin);

    // Clear one-time credentials from browser history before starting any SDK request.
    window.history.replaceState(window.history.state, "", window.location.pathname);

    if (!isAuthActionMode(modeValue)) { setView("invalid"); return; }
    const request: Action = { mode: modeValue as Mode, code, email: "", displayName: "", continuation, lang };
    setAction(request);
    if (getAuthActionRequestError(modeValue, code, apiKey, expectedApiKey)) { setView("invalid"); return; }
    actionRef.current = request;
    setAction(request);
    document.documentElement.lang = lang;

    void (async () => {
      try {
        if (request.mode === "resetPassword") {
          const email = await verifyPasswordResetCode(auth, request.code);
          const next = { ...request, email };
          actionRef.current = next;
          setAction(next);
          setView("reset");
          return;
        }
        const info = await checkActionCode(auth, request.code);
        if (info.operation !== AUTH_ACTION_OPERATIONS[request.mode]) { setView("invalid"); return; }
        const details = info.data as { email?: string | null; previousEmail?: string | null; multiFactorInfo?: { displayName?: string | null } | null };
        const email = request.mode === "verifyAndChangeEmail" ? details.email || "" : details.email || "";
        const displayName = details.multiFactorInfo?.displayName || "";
        const next = { ...request, email, displayName };
        actionRef.current = next;
        setAction(next);
        setView(request.mode === "verifyEmail" ? "verify"
          : request.mode === "verifyAndChangeEmail" ? "change-email"
          : request.mode === "recoverEmail" ? "recover-email"
          : "recover-factor");
      } catch (error) {
        setView(failureView(error));
      }
    })();
  }, []);

  async function applyEmailAction() {
    const current = actionRef.current;
    if (!current || busy || submitted.current) return;
    submitted.current = true;
    setBusy(true);
    setFormError("");
    try {
      await applyActionCode(auth, current.code);
      setView(current.mode === "verifyEmail" ? "verified"
        : current.mode === "verifyAndChangeEmail" ? "email-changed"
        : current.mode === "recoverEmail" ? "email-recovered"
        : "factor-reverted");
    } catch (error) {
      submitted.current = false;
      setView(failureView(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = actionRef.current;
    if (!current || busy || submitted.current) return;
    const policyError = getPasswordResetValidationError(password, confirmPassword);
    if (policyError) { setFormError(policyError); return; }
    submitted.current = true;
    setBusy(true);
    setFormError("");
    try {
      await confirmPasswordReset(auth, current.code, password);
      setPassword("");
      setConfirmPassword("");
      setView("password-changed");
    } catch (error) {
      submitted.current = false;
      setFormError(error instanceof Error && "code" in error && String((error as { code?: unknown }).code) === "auth/weak-password"
        ? "Choose a stronger password with at least 6 characters, including a letter and a number."
        : "We couldn’t update the password. The link may have expired, or your connection may be interrupted.");
    } finally {
      setBusy(false);
    }
  }

  const success = ["verified", "password-changed", "email-changed", "email-recovered", "factor-reverted"].includes(view);
  const titles: Partial<Record<View, string>> = {
    verify: "Verify your email",
    reset: "Choose a new password",
    "change-email": "Confirm your new email",
    "recover-email": "Recover your email address",
    "recover-factor": "Review this security change",
    verified: "Email verified",
    "password-changed": "Password updated",
    "email-changed": "Email address updated",
    "email-recovered": "Email address recovered",
    "factor-reverted": "Sign-in factor removed",
    expired: "This link has expired",
    invalid: "This link can’t be used",
    error: "Connection problem",
    loading: "Checking your secure link",
  };
  const descriptions: Partial<Record<View, string>> = {
    verify: action?.email ? `Confirm that ${action.email} belongs to you.` : "Confirm that this email address belongs to you.",
    reset: action?.email ? `Set a new password for ${action.email}.` : "Choose a new password for your account.",
    "change-email": action?.email ? `Confirm the change to ${action.email}.` : "Confirm this email address change.",
    "recover-email": "This will restore the email address that was on your account before it changed.",
    "recover-factor": "Confirm removal of the recently added sign-in factor. If you didn’t add it, secure your account after recovery.",
    verified: "Your email address is confirmed. You can return to Canisterr.",
    "password-changed": "Your password has been changed. Sign in with your new password.",
    "email-changed": "Your account now uses the confirmed email address.",
    "email-recovered": "Your previous email address has been restored. If the change wasn’t yours, reset your password next.",
    "factor-reverted": "The recently added sign-in factor has been removed from your account.",
    expired: "This one-time link has expired or has already been used. Request a fresh link to continue.",
    invalid: "This link is incomplete or doesn’t match your account. Open the complete link from your email.",
    error: "We couldn’t process this link right now. Check your connection and try again.",
    loading: "We’re checking your secure link. This can take a moment.",
  };

  const confirmMode = view === "verify" || view === "change-email" || view === "recover-email" || view === "recover-factor";
  const primaryLabel = view === "verify" ? "Verify email"
    : view === "change-email" ? "Confirm email change"
    : view === "recover-email" ? "Restore previous email"
    : "Remove added sign-in factor";
  const continueHref = view === "password-changed" ? "/auth/login" : action?.continuation || "/dashboard";

  return (
    <main lang={action?.lang || "en"} className="min-h-dvh bg-[#0b0b0b] px-5 py-8 text-[#f5f0de] sm:px-8 sm:py-12">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-[30rem] flex-col">
        <Link href="/" aria-label="Canisterr home" className="mx-auto mb-14 inline-flex items-center gap-3 focus-visible:outline-2 focus-visible:outline-[#ff7a1a]">
          <Image src="/logo-ui.webp" alt="" width={48} height={48} priority className="size-11 object-contain" />
          <span className="text-2xl font-black tracking-tight">Canisterr</span>
        </Link>
        <section aria-labelledby="action-title" className="my-auto w-full border-y border-white/12 py-8 sm:py-10">
          <h1 id="action-title" className="text-3xl font-bold tracking-[-.04em] sm:text-4xl">{titles[view]}</h1>
          <p className="mt-3 text-sm leading-6 text-white/55">{descriptions[view]}</p>

          {view === "reset" && <form onSubmit={(event) => void submitPassword(event)} className="mt-7 space-y-6">
            <div><label htmlFor="action-password" className="mb-1 block text-sm font-semibold">New password</label><input id="action-password" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(event) => { setPassword(event.target.value); setFormError(""); }} className={fieldClass} required /></div>
            <div><label htmlFor="action-password-confirm" className="mb-1 block text-sm font-semibold">Confirm new password</label><input id="action-password-confirm" type="password" autoComplete="new-password" minLength={6} value={confirmPassword} onChange={(event) => { setConfirmPassword(event.target.value); setFormError(""); }} className={fieldClass} required /></div>
            <p className="text-xs text-white/40">At least 6 characters, with a letter and a number.</p>
            {formError && <p role="alert" className="text-sm text-[#ff9d62]">{formError}</p>}
            <button type="submit" className={primaryClass} disabled={busy}>{busy ? "Updating password…" : "Save new password"}</button>
          </form>}

          {confirmMode && <div className="mt-7"><button type="button" className={primaryClass} onClick={() => void applyEmailAction()} disabled={busy}>{busy ? "Confirming…" : primaryLabel}</button></div>}

          {(view === "expired" || view === "invalid") && <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            {action?.mode === "resetPassword" && <Link className={primaryClass} href="/auth/forgot-password">Request new link</Link>}
            {action?.mode !== "resetPassword" && <Link className={primaryClass} href="/auth/login">Sign in</Link>}
            <Link href="/" className="inline-flex min-h-12 items-center justify-center border border-white/15 px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-white/35 hover:text-[#f5f0de]">Back to home</Link>
          </div>}

          {view === "error" && <div className="mt-7 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={() => window.location.reload()} className={primaryClass}>Try again</button><Link href="/" className="inline-flex min-h-12 items-center justify-center border border-white/15 px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-white/35 hover:text-[#f5f0de]">Back to home</Link></div>}

          {success && <div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link href={continueHref} className={primaryClass}>{view === "password-changed" ? "Sign in" : "Continue to Canisterr"}</Link>{view === "email-recovered" && <Link href="/auth/forgot-password" className="inline-flex min-h-12 items-center justify-center border border-white/15 px-5 py-3 text-sm font-semibold text-white/70 transition hover:border-white/35 hover:text-[#f5f0de]">Reset password</Link>}</div>}
        </section>
        <footer className="pt-8 text-center text-xs text-white/35"><Link href="/" className="hover:text-white/70">canisterr.com</Link><span className="px-2 text-white/15">·</span><a href="mailto:support@canisterr.com" className="hover:text-white/70">Need help?</a></footer>
      </div>
    </main>
  );
}
