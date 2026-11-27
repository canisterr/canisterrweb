import { NextResponse } from "next/server";
import { getCachedServerMovieLogs } from "@/lib/movie-dna-server";
import {
  calculateTasteMatch,
  computeMovieDna,
  contentToTitleFeatures,
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

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { user_a?: string; user_b?: string };
    if (!body.user_a || !body.user_b) {
      return NextResponse.json({ error: "user_a and user_b are required" }, { status: 400 });
    }

    const [logsA, logsB] = await Promise.all([
      getCachedServerMovieLogs(body.user_a),
      getCachedServerMovieLogs(body.user_b),
    ]);
    const result = calculateTasteMatch(
      computeMovieDna(logsToDnaInputs(logsA)),
      computeMovieDna(logsToDnaInputs(logsB))
    );

    return NextResponse.json({
      overall_score: result.overallScore,
      overall_percentage: Math.round(Math.max(0, result.overallScore) * 100),
      sub_scores: result.subScores,
      confidence: result.confidence,
    });
  } catch (error) {
    console.error("Failed to calculate Taste Match:", error);
    return NextResponse.json({ error: "Failed to calculate Taste Match" }, { status: 500 });
  }
}
