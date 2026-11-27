import { notFound } from "next/navigation";
import { GAME_CATEGORIES, type GameCategoryId } from "@/lib/games/types";
import GamesPage from "../page";

export default async function GameRoute({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const [{ kind }, query] = await Promise.all([params, searchParams]);
  if (!["reveal", "connection", "grid"].includes(kind)) notFound();
  const category = GAME_CATEGORIES.some((item) => item.id === query.category)
    ? query.category as GameCategoryId
    : "english";
  return <GamesPage routeKind={kind as "reveal" | "connection" | "grid"} initialCategory={category} />;
}
