import { NextResponse } from "next/server";
import { getFirebaseAdminDatabase } from "@/lib/firebase-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_POSTER = {
  title: "Dune: Part Three",
  poster_url: "https://image.tmdb.org/t/p/w1280/gknAq4pAuToh1Aq5CJfVkGQkExT.jpg",
};

export async function GET() {
  try {
    const value = (await getFirebaseAdminDatabase().ref("site_settings/login_page_poster").get()).val();
    const title = typeof value?.title === "string" ? value.title : DEFAULT_POSTER.title;
    const poster_url = typeof value?.poster_url === "string" && value.poster_url.startsWith("https://")
      ? value.poster_url
      : DEFAULT_POSTER.poster_url;
    return NextResponse.json({ title, poster_url }, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch {
    return NextResponse.json(DEFAULT_POSTER, { headers: { "Cache-Control": "public, max-age=60" } });
  }
}
