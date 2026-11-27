import { NextResponse } from "next/server";
import { getCachedServerMovieLogs, getCachedServerTasteProfile } from "@/lib/movie-dna-server";
import {
  computeMovieDna,
  contentToTitleFeatures,
  topDnaFeatures,
  type DnaLogInput,
} from "@/lib/movie-dna";

export const runtime = "nodejs";

function logsToDnaInputs(logs: Awaited<ReturnType<typeof getCachedServerMovieLogs>>): DnaLogInput[] {
  return logs.map((log) => ({
    title: contentToTitleFeatures(log.content as unknown as Record<string, unknown>, log.content_id, log.content_type),
    rating: log.reaction,
    loggedAt: log.watched_date || log.created_at,
  }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

    const [logs, priorTastes] = await Promise.all([
      getCachedServerMovieLogs(userId),
      getCachedServerTasteProfile(userId),
    ]);
    const dna = computeMovieDna(logsToDnaInputs(logs));
    const prior = computeMovieDna(
      priorTastes.map((taste) => ({
        title: contentToTitleFeatures(taste.content as unknown as Record<string, unknown>, taste.content_id, taste.content_type),
        rating: 2,
        loggedAt: taste.added_at,
      }))
    );

    return NextResponse.json({
      ...dna,
      top_genres: topDnaFeatures(dna, "genres"),
      top_keywords: topDnaFeatures(dna, "keywords"),
      top_directors: topDnaFeatures(dna, "director"),
      prior_log_count: prior.logCount,
    });
  } catch (error) {
    console.error("Failed to compute Movie DNA:", error);
    return NextResponse.json({ error: "Failed to compute Movie DNA" }, { status: 500 });
  }
}
