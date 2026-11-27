"use client";

import { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import SettingsPageFrame from "@/components/SettingsPageFrame";
import { useSettingsUser } from "../settings-shared";
import { SettingLine, SettingsGroup, SettingsMessage } from "../settings-ui";
import { auth } from "@/lib/firebase";
import { signOut as authSignOut } from "@/lib/auth";
import { useRouter } from "next/navigation";

export default function SettingsAccountPage() {
  const router = useRouter();
  const { user, loading, settings, updateSection, handleSignOut } = useSettingsUser();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState("");

  const resetPassword = async () => {
    if (!auth.currentUser?.email) {
      setError("No email address is attached to this account.");
      return;
    }
    setBusy(true);
    setError("");
    setMessage(null);
    try {
      await sendPasswordResetEmail(auth, auth.currentUser.email);
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

        <SettingsGroup title="Danger zone">
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
