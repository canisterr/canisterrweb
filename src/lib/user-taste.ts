import { db } from "@/lib/firebase";
import { ref, set, get, push, remove, query, orderByChild, equalTo } from "firebase/database";
import { UserTaste, UserTasteWithContent, Content } from "@/types";
import { getMovieDetails } from "./tmdb";
import { getShowDetails } from "./tvmaze";

/**
 * Add movie/show to user's taste profile
 */
export async function addToUserTaste(
  userId: string,
  contentId: number,
  contentType: "movie" | "tv"
): Promise<UserTaste> {
  const tasteRef = push(ref(db, "user_tastes"));
  const tasteId = tasteRef.key;

  if (!tasteId) throw new Error("Failed to generate taste ID");

  const newTaste: UserTaste = {
    id: tasteId,
    user_id: userId,
    content_id: contentId,
    content_type: contentType,
    added_at: new Date().toISOString(),
  };

  await set(tasteRef, newTaste);
  triggerTasteSignatureRefresh(userId);
  return newTaste;
}

/**
 * Refresh the cached Movie Matcher taste signature after a taste pick
 * changes. Fire-and-forget (dynamic import breaks the user-taste.ts <->
 * taste-signature.ts cycle) so it never blocks the caller's UI update.
 */
function triggerTasteSignatureRefresh(userId: string): void {
  import("./taste-signature")
    .then(({ recomputeTasteSignature }) => recomputeTasteSignature(userId))
    .catch((error) => console.error("Failed to refresh taste signature:", userId, error));
}

/**
 * Get user's taste profile (all movies in their taste)
 */
export async function getUserTasteProfile(userId: string): Promise<UserTasteWithContent[]> {
  try {
    console.log("getUserTasteProfile: Fetching tastes for user:", userId);
    const tastesRef = ref(db, "user_tastes");
    const snapshot = await get(tastesRef);

    if (!snapshot.exists()) {
      console.log("getUserTasteProfile: No tastes found");
      return [];
    }

    const allTastes = snapshot.val();
    console.log("getUserTasteProfile: Total tastes in DB:", Object.keys(allTastes).length);
    
    const userTastes = Object.values(allTastes).filter(
      (taste: any) => taste.user_id === userId
    ) as UserTaste[];
    
    console.log("getUserTasteProfile: Found", userTastes.length, "tastes for user");

    // Enrich with content details
    const enrichedTastes: UserTasteWithContent[] = await Promise.all(
      userTastes.map(async (taste) => {
        try {
          console.log("getUserTasteProfile: Enriching", taste.content_type, taste.content_id);
          let content: any;
          if (taste.content_type === "tv") {
            const show = await getShowDetails(taste.content_id);
            content = show || ({} as Content);
            if (!show) {
              console.warn("getUserTasteProfile: Failed to fetch show", taste.content_id);
            }
          } else {
            const movie = await getMovieDetails(taste.content_id);
            content = movie || ({} as Content);
            if (!movie) {
              console.warn("getUserTasteProfile: Failed to fetch movie", taste.content_id);
            }
          }

          return {
            ...taste,
            content,
          };
        } catch (error) {
          console.error(`getUserTasteProfile: Error fetching content for taste ${taste.id}:`, error);
          return {
            ...taste,
            content: {} as Content,
          };
        }
      })
    );

    const filtered = enrichedTastes
      .filter((taste) => taste.content && Object.keys(taste.content).length > 0)
      .sort((a, b) => new Date(b.added_at).getTime() - new Date(a.added_at).getTime());
    
    console.log("getUserTasteProfile: Returning", filtered.length, "enriched tastes");
    return filtered;
  } catch (error) {
    console.error("getUserTasteProfile: Error fetching user taste profile:", error);
    throw error;
  }
}

/**
 * Remove movie/show from user's taste profile
 */
export async function removeFromUserTaste(tasteId: string): Promise<void> {
  const tasteRef = ref(db, `user_tastes/${tasteId}`);
  const snapshot = await get(tasteRef);
  const userId = snapshot.exists() ? (snapshot.val() as UserTaste).user_id : null;

  await remove(tasteRef);

  if (userId) {
    triggerTasteSignatureRefresh(userId);
  }
}

/**
 * Check if user has minimum taste profile (7 movies)
 */
export async function hasMinimumTaste(userId: string): Promise<boolean> {
  try {
    const tastes = await getUserTasteProfile(userId);
    return tastes.length >= 7;
  } catch (error) {
    console.error("Error checking minimum taste:", error);
    return false;
  }
}

