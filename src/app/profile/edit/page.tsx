"use client";

import { useState, useEffect, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import { User } from "@/types";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, verifyBeforeUpdateEmail, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { ref, get } from "firebase/database";
import { signOut as authSignOut } from "@/lib/auth";
import { updateUserProfile } from "@/lib/profile";
import { getUsernameValidationError } from "@/lib/username-index";
import { Loader2, Upload, Camera, X } from "lucide-react";

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

async function compressImageToDataUrl(file: File): Promise<string> {
  const sourceUrl = await readFileAsDataUrl(file);

  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      // Keep avatars lightweight without making them blurry or over-processed.
      const maxWidth = 384;
      const maxHeight = 384;

      let { width, height } = image;
      if (width > maxWidth || height > maxHeight) {
        const scale = Math.min(maxWidth / width, maxHeight / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Failed to process image."));
        return;
      }

      context.drawImage(image, 0, 0, width, height);
      const compressed = canvas.toDataURL("image/jpeg", 0.78);
      resolve(compressed);
    };

    image.onerror = () => reject(new Error("Failed to process image."));
    image.src = sourceUrl;
  });
}

export default function EditProfilePage() {
  const [showReauthModal, setShowReauthModal] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [reauthError, setReauthError] = useState("");
  const [showVerifyMsg, setShowVerifyMsg] = useState(false);
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    username: "",
    email: "",
    bio: "",
    avatar_url: "",
    avatar_scale: 1,
  });
  const cleanUsername = formData.username.trim().toLowerCase();
  const currentUsername = user?.username?.trim().toLowerCase() || "";
  const usernameChanged = cleanUsername !== currentUsername;
  const usernameValidationError = usernameChanged ? getUsernameValidationError(formData.username) : null;

  useEffect(() => {
    // Show verify message if coming from /profile/edit?verify=1
    if (typeof window !== "undefined" && window.location.search.includes("verify=1")) {
      setShowVerifyMsg(true);
    }
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        router.push("/auth/login");
        return;
      }

      try {
        // Fetch user profile
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const userSnapshot = await get(userRef);
        const userData = userSnapshot.val();

        const currentUser: User = {
          id: userData?.id || firebaseUser.uid,
          username: userData?.username || firebaseUser.email?.split("@")
            [0] || "user",
          name: userData?.name || firebaseUser.displayName || "User",
          avatar_url: userData?.avatar_url || null,
          avatar_scale: typeof userData?.avatar_scale === "number" ? userData.avatar_scale : 1,
          created_at: userData?.createdAt || new Date().toISOString(),
          bio: userData?.bio || "",
        };

        setUser(currentUser);
        setFormData({
          name: currentUser.name,
          username: currentUser.username,
          email: userData?.email || firebaseUser.email || "",
          bio: currentUser.bio || "",
          avatar_url: currentUser.avatar_url || "",
          avatar_scale: currentUser.avatar_scale || 1,
        });

        setLoading(false);
      } catch (error) {
        console.error("Error loading profile:", error);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleSignOut = async () => {
    try {
      await authSignOut();
      router.push("/auth/login");
    } catch (error) {
      console.error("Sign out error:", error);
    }
  };

  const handleSave = async () => {
    if (!user || !auth.currentUser) return;

    const cleanName = formData.name.trim();
    const cleanBio = formData.bio.trim();
    const cleanEmail = formData.email.trim().toLowerCase();

    if (!cleanName) {
      setSaveError("Name is required.");
      return;
    }

    if (usernameValidationError) {
      setSaveError(usernameValidationError);
      return;
    }

    if (!cleanEmail || !/^\S+@\S+\.\S+$/.test(cleanEmail)) {
      setSaveError("Please enter a valid email address.");
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      if (auth.currentUser.email !== cleanEmail) {
        // Prevent changing to the same email
        if (auth.currentUser.email?.toLowerCase() === cleanEmail) {
          setSaveError("This is already your current email address.");
          setSaving(false);
          return;
        }
        try {
          await verifyBeforeUpdateEmail(auth.currentUser, cleanEmail);
          alert("A verification email has been sent to your new address. Please check your inbox and spam folder. If you do not receive the email within a few minutes, try resending or check your email provider's spam/junk folder.\n\nIf you still do not receive the email, please contact support or try a different email address.");
        } catch (emailError: any) {
          // Handle common Firebase errors with user-friendly messages
          if (emailError?.code === "auth/email-already-in-use") {
            setSaveError("This email address is already in use by another account.");
            setSaving(false);
            return;
          }
          if (emailError?.code === "auth/invalid-email") {
            setSaveError("Please enter a valid email address.");
            setSaving(false);
            return;
          }
          if (emailError?.code === "auth/requires-recent-login") {
            // Prompt for password and re-authenticate
            setPendingEmail(cleanEmail);
            setShowReauthModal(true);
            setSaving(false);
            return;
          }
          setSaveError(emailError?.message || "Failed to change email. Please try again.");
          setSaving(false);
          return;
        }
      }

      await updateUserProfile(user.id, {
        name: cleanName,
        ...(usernameChanged ? { username: cleanUsername } : {}),
        email: cleanEmail,
        bio: cleanBio,
        avatar_url: formData.avatar_url,
        avatar_scale: formData.avatar_scale,
      });

      window.location.assign(`/profile/${encodeURIComponent(cleanUsername)}`);
    } catch (error) {
      console.error("Error saving profile:", error);
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("username already taken")) {
        setSaveError("This username is already taken.");
      } else {
        setSaveError("Failed to save profile. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  // Handle re-authentication and retry email change
  async function handleReauth(e: React.FormEvent) {
    e.preventDefault();
    setReauthError("");
    if (!auth.currentUser || !pendingEmail) return;
    try {
      const cred = EmailAuthProvider.credential(auth.currentUser.email || "", reauthPassword);
      await reauthenticateWithCredential(auth.currentUser, cred);
      setShowReauthModal(false);
      setReauthPassword("");
      setPendingEmail(null);
      setSaving(true);
      await verifyBeforeUpdateEmail(auth.currentUser, pendingEmail!);
      alert("A verification email has been sent to your new address. Please check your inbox and spam folder. If you do not receive the email within a few minutes, try resending or check your email provider's spam/junk folder.\n\nIf you still do not receive the email, please contact support or try a different email address.");
    } catch (err: any) {
      setReauthError(err?.message || "Failed to re-authenticate. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please select an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("Image size must be 5MB or smaller.");
      return;
    }

    try {
      setUploadError("");
      setUploadingAvatar(true);
      const imageUrl = await compressImageToDataUrl(file);
      setFormData((prev) => ({ ...prev, avatar_url: imageUrl }));
    } catch (error) {
      console.error("Error processing avatar:", error);
      setUploadError(error instanceof Error ? error.message : "Failed to process image. Please try again.");
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
    }
  };

  if (loading || !user) {
    return null;
  }

  const closeEditor = () => {
    window.location.assign(`/profile/${encodeURIComponent(user.username)}`);
  };

  return (
    <PageLayout user={user} onSignOut={handleSignOut}>
      {/* Re-authentication Modal */}
      {showReauthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <form
            onSubmit={handleReauth}
            className="flex w-full max-w-xs flex-col gap-4 border border-white/10 bg-[#111111] p-6 text-[#f5f0de] shadow-2xl"
          >
            <h2 className="mb-2 text-lg font-black text-[#f5f0de]">Re-authenticate</h2>
            <p className="mb-2 text-sm leading-6 text-[#f5f0de]/60">For security, please enter your password to change your email.</p>
            <input
              type="password"
              className="w-full border border-white/10 bg-black px-3 py-2 text-[#f5f0de] outline-none placeholder:text-white/30 focus:border-[#ff7a1a] focus:ring-1 focus:ring-[#ff7a1a]"
              placeholder="Password"
              value={reauthPassword}
              onChange={e => setReauthPassword(e.target.value)}
              required
              autoFocus
            />
            {reauthError && <div className="text-xs text-[#ffb36b]">{reauthError}</div>}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                className="flex-1 border border-white/10 px-3 py-2 text-[#f5f0de] transition hover:bg-white/5"
                onClick={() => { setShowReauthModal(false); setReauthPassword(""); setPendingEmail(null); }}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 bg-[#ff7a1a] px-3 py-2 font-black text-black transition hover:bg-[#ff8d3b] disabled:opacity-60"
                disabled={saving || !reauthPassword}
              >
                Confirm
              </button>
            </div>
          </form>
        </div>
      )}
      <div className="min-h-screen bg-black px-4 py-6 text-[#f5f0de] sm:px-6 sm:py-10">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Edit profile</h1>
            <button type="button" onClick={closeEditor} aria-label="Close editor" className="flex h-9 w-9 items-center justify-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          {showVerifyMsg && (
            <p className="mt-5 border-l-2 border-[#ff7a1a] pl-3 text-sm text-white/70">Check your new inbox for the email verification link.</p>
          )}
          {saveError && <p role="alert" className="mt-5 text-sm text-[#ffb36b]">{saveError}</p>}

          <div className="mt-6 flex items-center gap-4">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-white/15 bg-[#191919] sm:h-24 sm:w-24">
              <div className="h-full w-full" style={{ transform: `scale(${formData.avatar_scale || 1})`, transformOrigin: "center" }}>
                {formData.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={formData.avatar_url} alt="Profile preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-white/45"><Camera className="h-6 w-6" /></div>
                )}
              </div>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Profile photo</p>
              <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-white/20 px-3 py-1.5 text-xs font-semibold text-white/80 transition hover:border-white/40 hover:text-white">
                {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                {uploadingAvatar ? "Processing..." : "Change photo"}
                <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarFileChange} disabled={uploadingAvatar} />
              </label>
              <p className="mt-1.5 text-xs text-white/40">JPG or PNG, up to 5 MB</p>
            </div>
          </div>
          {uploadError && <p role="alert" className="mt-3 text-xs text-[#ffb36b]">{uploadError}</p>}
          {formData.avatar_url && (
            <div className="mt-5 max-w-sm">
              <div className="mb-1 flex items-center justify-between text-xs text-white/55">
                <label htmlFor="avatar-zoom">Photo zoom</label>
                <span>{Math.round((formData.avatar_scale || 1) * 100)}%</span>
              </div>
              <input id="avatar-zoom" type="range" min="0.8" max="1.4" step="0.01" value={formData.avatar_scale} onChange={(event) => setFormData((prev) => ({ ...prev, avatar_scale: Number(event.target.value) }))} className="w-full accent-[#ff7a1a]" />
            </div>
          )}

          <div className="mt-8 grid gap-x-5 gap-y-5 sm:grid-cols-2">
            <div>
              <label htmlFor="edit-name" className="mb-1.5 block text-sm font-medium text-white/70">Name</label>
              <input id="edit-name" type="text" autoComplete="name" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} className="w-full rounded-md border border-white/15 bg-[#111] px-3 py-2.5 text-sm outline-none transition focus:border-[#ff7a1a]" placeholder="Your name" required />
            </div>
            <div>
              <label htmlFor="edit-username" className="mb-1.5 block text-sm font-medium text-white/70">Username</label>
              <input id="edit-username" type="text" autoCapitalize="none" autoCorrect="off" autoComplete="username" spellCheck={false} maxLength={20} value={formData.username} onChange={(event) => setFormData({ ...formData, username: event.target.value.toLowerCase().replace(/[^a-z0-9._]/g, "") })} className="w-full rounded-md border border-white/15 bg-[#111] px-3 py-2.5 text-sm outline-none transition focus:border-[#ff7a1a]" placeholder="username" required />
              {usernameValidationError && <p className="mt-1 text-xs text-[#ffb36b]">{usernameValidationError}</p>}
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="edit-email" className="mb-1.5 block text-sm font-medium text-white/70">Email</label>
              <input id="edit-email" type="email" autoComplete="email" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} className="w-full rounded-md border border-white/15 bg-[#111] px-3 py-2.5 text-sm outline-none transition focus:border-[#ff7a1a]" placeholder="name@example.com" required />
            </div>
            <div className="sm:col-span-2">
              <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                <label htmlFor="edit-bio" className="font-medium text-white/70">Bio</label>
                <span className="text-xs text-white/35">{formData.bio.length}/500</span>
              </div>
              <textarea id="edit-bio" value={formData.bio} onChange={(event) => setFormData({ ...formData, bio: event.target.value.slice(0, 500) })} className="w-full resize-y rounded-md border border-white/15 bg-[#111] px-3 py-2.5 text-sm outline-none transition focus:border-[#ff7a1a]" rows={3} placeholder="A little about you" />
            </div>
          </div>

          <div className="mt-7 flex items-center justify-end gap-4 border-t border-white/10 pt-5">
            <button type="button" onClick={closeEditor} className="px-2 py-2 text-sm text-white/55 transition hover:text-white">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving || uploadingAvatar || Boolean(usernameValidationError)} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#ff7a1a] px-4 py-2.5 text-sm font-semibold text-black transition hover:bg-[#ff8d3b] disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
