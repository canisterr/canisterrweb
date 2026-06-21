import { NextRequest, NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp, getFirebaseAdminDatabase } from "@/lib/firebase-admin";
import { getUsernameValidationError, normalizeUsernameKey } from "@/lib/username-utils";

type SyncUsernameBody = {
  idToken?: string;
  username?: string;
  previousUsername?: string | null;
};

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: SyncUsernameBody;

  try {
    body = (await request.json()) as SyncUsernameBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const idToken = body.idToken?.trim();
  const rawUsername = body.username || "";
  const username = normalizeUsernameKey(rawUsername);
  const previousUsername = body.previousUsername
    ? normalizeUsernameKey(body.previousUsername)
    : "";

  if (!idToken) {
    return NextResponse.json({ error: "Missing Firebase ID token." }, { status: 400 });
  }

  const usernameError = getUsernameValidationError(rawUsername);
  if (usernameError) {
    return NextResponse.json({ error: usernameError }, { status: 400 });
  }

  try {
    const auth = getAuth(getFirebaseAdminApp());
    const decodedToken = await auth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const adminDb = getFirebaseAdminDatabase();
    const usernameRef = adminDb.ref(`usernames/${username}`);

    const usernameClaim = await usernameRef.transaction((current) => {
      if (current === null || current === uid) {
        return uid;
      }
      return;
    });

    if (!usernameClaim.committed || usernameClaim.snapshot.val() !== uid) {
      return NextResponse.json({ error: "Username already taken." }, { status: 409 });
    }

    if (previousUsername && previousUsername !== username) {
      const previousRef = adminDb.ref(`usernames/${previousUsername}`);
      await previousRef.transaction((current) => (current === uid ? null : current));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Username sync failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
