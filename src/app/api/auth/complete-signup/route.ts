import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp } from "@/lib/firebase-admin";
import { ensureUserProfileRecord } from "@/lib/server-user-profile";
import { getUsernameValidationError, normalizeUsernameKey } from "@/lib/username-utils";

type CompleteSignupBody = {
  idToken?: string;
  username?: string;
  name?: string;
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: CompleteSignupBody;

  try {
    body = (await request.json()) as CompleteSignupBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const idToken = body.idToken?.trim();
  const rawUsername = body.username || "";
  const username = normalizeUsernameKey(rawUsername);
  const name = body.name?.trim() || "";

  if (!idToken) {
    return NextResponse.json({ error: "Missing Firebase ID token." }, { status: 400 });
  }

  const usernameError = getUsernameValidationError(rawUsername);
  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ error: "Full name is required." }, { status: 400 });
  }

  try {
    const auth = getAuth(getFirebaseAdminApp());
    const decodedToken = await auth.verifyIdToken(idToken);
    await ensureUserProfileRecord({
      uid: decodedToken.uid,
      preferredUsername: username,
      preferredName: name,
      strictPreferredUsername: true,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Profile creation failed.";
    const status = message === "Username already taken." ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
