import { getAuth } from "firebase-admin/auth";
import { getFirebaseAdminApp } from "@/lib/firebase-admin";

function csvSet(value: string | undefined, lowercase = false) {
  return new Set((value || "").split(",").map((part) => {
    const trimmed = part.trim();
    return lowercase ? trimmed.toLowerCase() : trimmed;
  }).filter(Boolean));
}

export async function getAdminIdentity(request: Request): Promise<{ uid: string; email: string } | null> {
  const token = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (!token) return null;
  try {
    const decoded = await getAuth(getFirebaseAdminApp()).verifyIdToken(token, true);
    const email = (decoded.email || "").trim().toLowerCase();
    const configuredEmails = csvSet(process.env.CANISTERR_ADMIN_EMAILS, true);
    const allowedByEmail = Boolean(email && decoded.email_verified === true && configuredEmails.has(email));
    const allowedByUid = csvSet(process.env.CANISTERR_ADMIN_UIDS).has(decoded.uid);
    if (!allowedByEmail && !allowedByUid && decoded.admin !== true) return null;
    return { uid: decoded.uid, email };
  } catch (error) {
    console.warn("Admin token verification failed:", error instanceof Error ? error.message : String(error));
    return null;
  }
}
