import { MovieReviewWithUser } from "@/types";
import { fetchContentActivity } from "./content-activity";

export async function getMovieReviewFeed(
  contentId: number,
  contentType: "movie" | "tv" = "movie"
): Promise<MovieReviewWithUser[]> {
  try {
    const payload = await fetchContentActivity(contentId, contentType);
    return payload.reviews;
  } catch (error) {
    console.warn("Skipping movie log reviews for movie feed:", error);
    return [];
  }
}
