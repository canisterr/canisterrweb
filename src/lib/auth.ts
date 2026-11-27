import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  inMemoryPersistence,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  setPersistence,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
} from "firebase/auth";
import { get, ref } from "firebase/database";
import { User as DBUser } from "@/types";
import { normalizeUserRecord } from "@/lib/users";
import {
  getUsernameValidationError,
  normalizeUsernameKey,
} from "@/lib/username-utils";
import {
  isUsernameAvailable,
} from "@/lib/username-index";

let persistencePromise: Promise<void> | null = null;

export function getSignupPasswordError(password: string): string | null {
  return password.length >= 6 && /[A-Za-z]/.test(password) && /\d/.test(password)
    ? null
    : "Use at least 6 characters, including a letter and a number.";
}

export function getAuthErrorMessage(error: unknown, action: "login" | "signup"): string {
  const maybeError = error as { code?: string; message?: string } | null;
  const message = typeof maybeError?.message === "string" ? maybeError.message : "";
  const code = maybeError?.code || message.match(/auth\/[a-z-]+/i)?.[0] || "";
  const messages: Record<string, string> = {
    "auth/invalid-credential": "The email or password is incorrect.",
    "auth/user-not-found": "No account was found with that email. Check it or create an account.",
    "auth/wrong-password": "The password is incorrect. Try again or reset it.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/email-already-in-use": "An account already uses this email. Try logging in instead.",
    "auth/weak-password": "Choose a stronger password with at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Wait a little, then try again.",
    "auth/network-request-failed": "We couldn’t connect. Check your internet connection and try again.",
    "auth/user-disabled": "This account is disabled. Contact support for help.",
    "auth/operation-not-allowed": "This sign-in method is not enabled yet. Please contact support.",
    "auth/unauthorized-domain": "This website domain is not enabled for sign-in. Contact support.",
    "auth/popup-blocked": "Your browser blocked the sign-in window. Allow pop-ups and try again.",
    "auth/popup-closed-by-user": "The sign-in window was closed before finishing.",
    "auth/account-exists-with-different-credential": "An account already uses this email with another sign-in method. Sign in with that method first.",
    "auth/missing-email": "Enter your email address.",
    "auth/missing-password": "Enter your password.",
  };

  if (messages[code]) return messages[code];
  if (/FirebaseError|Firebase:|auth\/[a-z-]+/i.test(message)) {
    return action === "login"
      ? "We couldn’t sign you in. Check your details and try again."
      : "We couldn’t create your account. Please try again.";
  }
  return message || (action === "login" ? "Login failed. Please try again." : "Sign up failed. Please try again.");
}

function isPermissionDeniedError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /permission/i.test(message) && /denied/i.test(message);
}

async function ensureAuthPersistence() {
  if (!persistencePromise) {
    persistencePromise = (async () => {
      try {
        await setPersistence(auth, indexedDBLocalPersistence);
      } catch (error) {
        console.warn("IndexedDB auth persistence failed, falling back to browser persistence:", error);
        try {
          await setPersistence(auth, browserLocalPersistence);
        } catch (browserError) {
          console.warn("Browser auth persistence failed, falling back to in-memory persistence:", browserError);
          await setPersistence(auth, inMemoryPersistence);
        }
      }
    })();
  }

  return persistencePromise;
}

export async function signUp(
  email: string,
  password: string,
  username: string,
  name: string,
  acceptance: { termsAccepted: boolean; privacyAccepted: boolean }
) {
  await ensureAuthPersistence();

  if (!acceptance.termsAccepted || !acceptance.privacyAccepted) {
    throw new Error("Accept the Terms and Privacy Policy to create an account.");
  }

  const passwordError = getSignupPasswordError(password);
  if (passwordError) throw new Error(passwordError);

  const usernameError = getUsernameValidationError(username);
  if (usernameError) {
    throw new Error(usernameError);
  }

  const normalizedUsername = normalizeUsernameKey(username);
  try {
    if (!(await isUsernameAvailable(normalizedUsername))) {
      throw new Error("Username already taken");
    }
  } catch (err) {
    if (err instanceof Error && err.message === "Username already taken") {
      throw err;
    }
    // DB rules may deny unauthenticated reads — server-side transaction enforces uniqueness
    if (!isPermissionDeniedError(err)) {
      console.warn("Client-side username check failed, proceeding:", err);
    }
  }

  // Sign up with Firebase auth
  const userCredential = await createUserWithEmailAndPassword(
    auth,
    email,
    password
  );

  if (!userCredential.user) {
    throw new Error("User creation failed");
  }

  await sendEmailVerification(userCredential.user);

  // Create user profile in Realtime Database (non-blocking)
  try {
    const idToken = await userCredential.user.getIdToken();
    const response = await fetch("/api/auth/complete-signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idToken,
        username: normalizedUsername,
        name: name.trim(),
        termsAccepted: acceptance.termsAccepted,
        privacyAccepted: acceptance.privacyAccepted,
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || "Profile creation failed");
    }
  } catch (profileError) {
    console.error("Profile creation failed; rolling back the incomplete signup:", profileError);
    try {
      await deleteUser(userCredential.user);
    } catch {
      await firebaseSignOut(auth);
    }
    throw profileError;
  }

  return userCredential;
}

export async function signIn(email: string, password: string) {
  await ensureAuthPersistence();
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential;
}

export async function signInWithGoogle() {
  await ensureAuthPersistence();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(auth, provider);
  const profile = await get(ref(db, `users/${credential.user.uid}`));
  const username = profile.exists() ? profile.val()?.username : null;
  return {
    user: credential.user,
    needsProfile: !profile.exists() || typeof username !== "string" || Boolean(getUsernameValidationError(username)),
  };
}

export async function completeGoogleSignup(
  user: import("firebase/auth").User,
  username: string,
  name: string,
  acceptance: { termsAccepted: boolean; privacyAccepted: boolean }
) {
  if (!acceptance.termsAccepted || !acceptance.privacyAccepted) {
    throw new Error("Accept the Terms and Privacy Policy to create an account.");
  }
  const response = await fetch("/api/auth/complete-signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idToken: await user.getIdToken(),
      username,
      name,
      termsAccepted: acceptance.termsAccepted,
      privacyAccepted: acceptance.privacyAccepted,
    }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "Could not complete your profile.");
  }
}

export async function sendResetPasswordEmail(email: string) {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export async function signOut() {
  await firebaseSignOut(auth);
}

type FirebaseUserLike = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  getIdToken: () => Promise<string>;
};

export async function ensureCurrentUserProfile(firebaseUser: FirebaseUserLike): Promise<DBUser> {
  const idToken = await firebaseUser.getIdToken();
  const response = await fetch("/api/auth/ensure-profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      idToken,
      name: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || undefined,
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "Profile repair failed");
  }

  const payload = (await response.json()) as {
    user?: {
      id?: string;
      username?: string;
      name?: string;
      avatar_url?: string | null;
      created_at?: string;
    };
  };

  const user = payload.user;
  return normalizeUserRecord(firebaseUser.uid, {
    id: user?.id || firebaseUser.uid,
    username: user?.username,
    name: user?.name,
    avatar_url: user?.avatar_url || firebaseUser.photoURL || null,
    created_at: user?.created_at || new Date().toISOString(),
  }) as DBUser;
}

export async function getCurrentUser(): Promise<DBUser | null> {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribe();

      if (!firebaseUser) {
        resolve(null);
        return;
      }

      // Try to fetch user profile from Realtime Database
      try {
        const userRef = ref(db, `users/${firebaseUser.uid}`);
        const snapshot = await get(userRef);

        if (snapshot.exists()) {
          const userData = snapshot.val();
          const hasStoredUsername =
            typeof userData?.username === "string"
            && !getUsernameValidationError(userData.username);

          if (!hasStoredUsername) {
            try {
              const repairedUser = await ensureCurrentUserProfile({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                displayName: firebaseUser.displayName,
                photoURL: firebaseUser.photoURL,
                getIdToken: () => firebaseUser.getIdToken(),
              });
              resolve(repairedUser);
              return;
            } catch (repairError) {
              console.warn("Profile repair failed, using stored data:", repairError);
            }
          }

          resolve(
            normalizeUserRecord(firebaseUser.uid, {
              id: userData.id || firebaseUser.uid,
              username: userData.username,
              name: userData.name,
              avatar_url: userData.avatar_url || firebaseUser.photoURL || null,
              created_at: userData.createdAt || userData.created_at || new Date().toISOString(),
            }) as DBUser
          );
          return;
        }

        try {
          const repairedUser = await ensureCurrentUserProfile({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            getIdToken: () => firebaseUser.getIdToken(),
          });
          resolve(repairedUser);
          return;
        } catch (repairError) {
          console.warn("Profile repair failed, using auth fallback:", repairError);
        }

        resolve(
          normalizeUserRecord(firebaseUser.uid, {
            id: firebaseUser.uid,
            username: firebaseUser.email?.split("@")[0] || "user",
            name: firebaseUser.displayName || firebaseUser.email || "User",
            avatar_url: firebaseUser.photoURL || null,
            created_at: new Date().toISOString(),
          }) as DBUser
        );
      } catch (err) {
        console.warn("Database query failed, using auth data:", err);
        try {
          const repairedUser = await ensureCurrentUserProfile({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
            getIdToken: () => firebaseUser.getIdToken(),
          });
          resolve(repairedUser);
          return;
        } catch (repairError) {
          console.warn("Profile repair failed after DB read issue, using auth fallback:", repairError);
        }

        resolve(
          normalizeUserRecord(firebaseUser.uid, {
            id: firebaseUser.uid,
            username: firebaseUser.email?.split("@")[0] || "user",
            name: firebaseUser.displayName || firebaseUser.email || "User",
            avatar_url: firebaseUser.photoURL || null,
            created_at: new Date().toISOString(),
          }) as DBUser
        );
      }
    });
  });
}

export async function checkUsernameAvailability(username: string) {
  if (getUsernameValidationError(username)) {
    return false;
  }

  try {
    return await isUsernameAvailable(username);
  } catch (err) {
    if (!isPermissionDeniedError(err)) {
      console.warn("Username check failed:", err);
    }
    return true; // Allow signup to proceed if check fails
  }
}
