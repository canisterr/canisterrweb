import { NextResponse } from "next/server";
import { getFirebaseAdminDatabase, getFirebaseAdminMessaging } from "@/lib/firebase-admin";
import { fetchTmdb } from "@/lib/tmdb-transport";

type TrackedLog = {
  id?: string;
  user_id?: string;
  content_id?: number;
  content_type?: string;
  watch_later?: boolean;
  release_notify?: boolean;
  release_date_snapshot?: string | null;
  title_snapshot?: string;
  release_reminded_at?: string;
  release_reminder_claimed_at?: string;
};

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const db = getFirebaseAdminDatabase();
    const today = new Date().toISOString().slice(0, 10);
    const snapshot = await db.ref("movie_logs").orderByChild("watch_later").equalTo(true).get();
    if (!snapshot.exists()) return NextResponse.json({ checked: 0, sent: 0 });

    const due = Object.entries(snapshot.val() as Record<string, TrackedLog>).filter(([, log]) =>
      log.content_type === "movie" &&
      log.release_notify === true &&
      typeof log.user_id === "string" &&
      typeof log.content_id === "number" &&
      typeof log.release_date_snapshot === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(log.release_date_snapshot) &&
      log.release_date_snapshot <= today &&
      !log.release_reminded_at
    );

    let sent = 0;
    for (const [logId] of due) {
      const logRef = db.ref(`movie_logs/${logId}`);
      const claimedAt = new Date().toISOString();
      const claim = await logRef.transaction((current: TrackedLog | null) => {
        if (!current?.watch_later || !current.release_notify || current.release_reminded_at) return;
        if (!current.release_date_snapshot || current.release_date_snapshot > today) return;
        if (current.release_reminder_claimed_at &&
          Date.now() - new Date(current.release_reminder_claimed_at).getTime() < 10 * 60 * 1000) return;
        return { ...current, release_reminder_claimed_at: claimedAt };
      });
      if (!claim.committed) continue;

      const log = claim.snapshot.val() as TrackedLog;
      const userId = log.user_id;
      const movieId = log.content_id;
      if (!userId || typeof movieId !== "number") continue;

      try {
        // Release dates can move after a film is tracked. Confirm the date on
        // the day it becomes due before telling the user it is out.
        const movieResponse = await fetchTmdb(`movie/${movieId}`, undefined, { cache: "no-store" });
        if (movieResponse.ok) {
          const currentMovie = await movieResponse.json() as { release_date?: string };
          if (currentMovie.release_date && /^\d{4}-\d{2}-\d{2}$/.test(currentMovie.release_date) && currentMovie.release_date > today) {
            await logRef.update({ release_date_snapshot: currentMovie.release_date, release_reminder_claimed_at: null });
            continue;
          }
        }

        const title = log.title_snapshot?.trim() || "A tracked movie";
        const notificationId = `release-${movieId}`;
        await db.ref(`notifications/${userId}/${notificationId}`).set({
          type: "release_reminder",
          contentId: movieId,
          contentType: "movie",
          title,
          createdAt: claimedAt,
          seen: false,
        });

        const [userSnapshot, tokensSnapshot] = await Promise.all([
          db.ref(`users/${userId}/settings/notifications/pushNotifications`).get(),
          db.ref(`users/${userId}/push_tokens`).get(),
        ]);
        if (userSnapshot.val() === true && tokensSnapshot.exists()) {
          const tokens = Object.values(tokensSnapshot.val() as Record<string, { token?: string }>)
            .map((entry) => entry.token?.trim())
            .filter((token): token is string => Boolean(token));
          if (tokens.length) {
            try {
              await getFirebaseAdminMessaging().sendEachForMulticast({
                tokens,
                data: {
                  title: `${title} is out today`,
                  body: "The movie you tracked has reached its release date.",
                  url: `/movie/${movieId}`,
                  link: `/movie/${movieId}`,
                  tag: notificationId,
                  notificationId,
                  type: "release_reminder",
                },
                webpush: { fcmOptions: { link: `/movie/${movieId}` } },
              });
            } catch (error) {
              console.warn("Release reminder push failed; in-app notification was saved:", logId, error);
            }
          }
        }

        await logRef.update({ release_reminded_at: claimedAt, release_reminder_claimed_at: null });
        sent += 1;
      } catch (error) {
        await logRef.update({ release_reminder_claimed_at: null });
        console.error("Release reminder failed:", logId, error);
      }
    }

    return NextResponse.json({ checked: due.length, sent });
  } catch (error) {
    console.error("Release reminder cron failed:", error);
    return NextResponse.json({ error: "Release reminder check failed." }, { status: 500 });
  }
}
