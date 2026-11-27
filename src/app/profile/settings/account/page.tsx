"use client";

import { useState } from "react";
import SettingsPageFrame from "@/components/SettingsPageFrame";
import { useSettingsUser } from "../settings-shared";
import { SettingLine, SettingsGroup, SettingsMessage } from "../settings-ui";
import { auth } from "@/lib/firebase";
import { sendResetPasswordEmail, signOut as authSignOut } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function SettingsAccountPage() {
  const router = useRouter();
  const { user, loading, settings, updateSection, handleSignOut } = useSettingsUser();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [confirmLogs, setConfirmLogs] = useState(false);
  const [logConfirmation, setLogConfirmation] = useState("");

  const resetPassword = async () => {
    if (!auth.currentUser?.email) {
      setError("No email address is attached to this account.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage(null);
    try {
      await sendResetPasswordEmail(auth.currentUser.email);
      setMessage("Password reset email sent.");
    } catch {
      setError("Could not send a password reset email.");
    } finally {
      setBusy(false);
    }
  };

  const downloadData = async () => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return;
    setBusy(true);
    setError("");
    setMessage(null);
    try {
      const token = await firebaseUser.getIdToken();
      const response = await fetch("/api/account/data", { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error || "Could not prepare your data export.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "canisterr-data.json";
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Your data export has been downloaded.");
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Could not prepare your data export.");
    } finally {
      setBusy(false);
    }
  };

  const deactivateAccount = async () => {
    if (!user) return;
    const confirmed = window.confirm("Deactivate your account? You can sign back in later.");
    if (!confirmed) return;
    setBusy(true);
    setError("");
    setMessage(null);
    try {
      await updateSection("account", { status: "deactivated" });
      setMessage("Account deactivated.");
      await handleSignOut();
    } catch {
      setError("Could not deactivate the account.");
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (!user || !auth.currentUser) return;
    const first = window.confirm("Delete your account and all related data?");
    if (!first) return;
    const second = window.confirm("This cannot be undone. Delete everything now?");
    if (!second) return;

    setBusy(true);
    setError("");
    setMessage(null);

    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Could not delete the account.");
      await authSignOut();
      router.replace("/auth/login");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete the account.");
    } finally {
      setBusy(false);
    }
  };

  const deleteAllLogs = async () => {
    if (logConfirmation !== "DELETE" || !auth.currentUser) return;
    setBusy(true);
    setError("");
    setMessage(null);
    try {
      const token = await auth.currentUser.getIdToken();
      const response = await fetch("/api/account/logs", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      const payload = await response.json().catch(() => null) as { error?: string; deletedCount?: number } | null;
      if (!response.ok) throw new Error(payload?.error || "Could not delete your logs.");
      setMessage(`${payload?.deletedCount ?? 0} log${payload?.deletedCount === 1 ? "" : "s"} deleted.`);
      setConfirmLogs(false);
      setLogConfirmation("");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete your logs.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsPageFrame
      user={user}
      loading={loading}
      onSignOut={handleSignOut}
      title="Account"
      description="Password and account access."
    >
      <div className="space-y-5">
        <SettingsGroup>
        <SettingLine title="Download your data" description="Get a JSON copy of your Canisterr account data.">
          <button onClick={() => void downloadData()} disabled={busy} className="rounded-md border border-white/15 bg-transparent px-3 py-1.5 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/[0.08] disabled:opacity-50">
            Download
          </button>
        </SettingLine>
        <SettingLine title="Change password" description="Send a reset email to the connected address.">
          <button onClick={resetPassword} disabled={busy} className="rounded-md border border-white/15 bg-transparent px-3 py-1.5 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/[0.08] disabled:opacity-50">
            Reset email
          </button>
        </SettingLine>

        <SettingLine title="Deactivate account" description="Temporarily pause the account and sign out.">
          {settings.account.status === "deactivated" ? (
            <span className="rounded-md border border-white/15 bg-transparent px-3 py-1.5 text-xs font-semibold text-white/55">
              Deactivated
            </span>
          ) : (
            <button onClick={deactivateAccount} disabled={busy} className="rounded-md border border-white/15 bg-transparent px-3 py-1.5 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/[0.08] disabled:opacity-50">
              Deactivate
            </button>
          )}
        </SettingLine>
        </SettingsGroup>

        <SettingsGroup>
        <SettingLine title="Delete all logs" description="Permanently remove every movie and TV entry you have logged, along with activity on those logs." danger>
          <button
            type="button"
            onClick={() => { setConfirmLogs(true); setError(""); setMessage(null); }}
            disabled={busy}
            className="rounded-md border border-red-500/35 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            Delete logs
          </button>
        </SettingLine>
        {confirmLogs ? (
          <div className="border-b border-white/10 bg-red-500/[0.04] px-4 py-4 sm:px-5">
            <p className="text-sm font-semibold text-[#f5f0de]">This permanently deletes all your logs.</p>
            <p className="mt-1 text-xs text-white/45">Type DELETE to confirm. Your account will stay active.</p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <input
                value={logConfirmation}
                onChange={(event) => setLogConfirmation(event.target.value)}
                aria-label="Type DELETE to confirm log deletion"
                autoComplete="off"
                className="h-10 min-w-0 flex-1 rounded-md border border-white/15 bg-black/40 px-3 text-sm text-[#f5f0de] outline-none focus:border-red-400/60"
              />
              <button
                type="button"
                onClick={() => void deleteAllLogs()}
                disabled={busy || logConfirmation !== "DELETE"}
                className="h-10 rounded-md border border-red-500/35 px-4 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Deleting…" : "Delete all logs"}
              </button>
              <button
                type="button"
                onClick={() => { setConfirmLogs(false); setLogConfirmation(""); }}
                disabled={busy}
                className="h-10 rounded-md border border-white/15 px-4 text-xs font-semibold text-white/65 transition hover:bg-white/[0.06] disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
        <SettingLine title="Delete profile" description="Remove the profile and related data permanently." danger>
          <button onClick={deleteAccount} disabled={busy} className="rounded-md border border-red-500/35 px-3 py-1.5 text-xs font-semibold text-red-300 transition hover:bg-red-500/10 disabled:opacity-50">
            Delete
          </button>
        </SettingLine>
        </SettingsGroup>

        <SettingsGroup>
        <SettingLine title="Help" description="If something feels off, contact support.">
          <a href="mailto:support@canisterr.com" className="rounded-md border border-white/15 bg-transparent px-3 py-1.5 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/[0.08]">
            Email support
          </a>
        </SettingLine>
        </SettingsGroup>

        {message ? <SettingsMessage tone="success">{message}</SettingsMessage> : null}
        {error ? <SettingsMessage tone="error">{error}</SettingsMessage> : null}
      </div>
    </SettingsPageFrame>
  );
}
