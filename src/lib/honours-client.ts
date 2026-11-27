import { auth } from "@/lib/firebase";

const pending = new Map<string, ReturnType<typeof setTimeout>>();

export function scheduleHonoursRecalculation(userId: string): void {
  if (typeof window === "undefined" || auth.currentUser?.uid !== userId) return;
  const existing = pending.get(userId);
  if (existing) clearTimeout(existing);
  pending.set(userId, setTimeout(() => {
    pending.delete(userId);
    const user = auth.currentUser;
    if (!user || user.uid !== userId) return;
    void user.getIdToken().then((token) => fetch("/api/honours", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    })).then((response) => {
      if (!response.ok) throw new Error(`Honours update failed (${response.status})`);
    }).catch((error) => console.warn("Could not refresh Canisterr Honours:", error));
  }, 1000));
}

export function scheduleAcceptedFollowHonoursRecalculation(followId: string): void {
  if (typeof window === "undefined") return;
  const user = auth.currentUser;
  if (!user) return;
  void user.getIdToken().then((token) => fetch("/api/honours", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ acceptedFollowId: followId }),
  })).then((response) => {
    if (!response.ok) throw new Error(`Honours update failed (${response.status})`);
  }).catch((error) => console.warn("Could not refresh Canisterr Honours after follow acceptance:", error));
}
