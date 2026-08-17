import { auth, db } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  browserLocalPersistence,
  indexedDBLocalPersistence,
  inMemoryPersistence,
  signInWithEmailAndPassword,
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
  name: string
) {
  await ensureAuthPersistence();

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

  // Send email verification
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
      }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error || "Profile creation failed");
    }
  } catch (profileError) {
    console.warn("Profile creation failed, but auth succeeded:", profileError);
    // Don't fail signup if profile creation fails
  }

  return userCredential;
}

export async function signIn(email: string, password: string) {
  await ensureAuthPersistence();
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential;
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
