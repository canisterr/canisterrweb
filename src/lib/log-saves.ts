import { db } from "@/lib/firebase";
import { ref, get, set, remove } from "firebase/database";

// Save a log
export async function saveLog(logId: string, userId: string): Promise<void> {
  const saveRef = ref(db, `log_saves/${logId}/${userId}`);
  await set(saveRef, true);
}

// Unsave a log
export async function unsaveLog(logId: string, userId: string): Promise<void> {
  const saveRef = ref(db, `log_saves/${logId}/${userId}`);
  await remove(saveRef);
}

// Get save count and whether the user saved
export async function getLogSaves(logId: string, userId: string): Promise<{ count: number; saved: boolean }> {
  const savesRef = ref(db, `log_saves/${logId}`);
  const snapshot = await get(savesRef);
  if (!snapshot.exists()) return { count: 0, saved: false };
  const saves = snapshot.val();
  const userSaved = !!saves[userId];
  return { count: Object.keys(saves).length, saved: userSaved };
}
