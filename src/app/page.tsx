import type { Metadata } from "next";
import { baseMetadata, canonical } from "@/lib/seo";
import Hero from "@/components/home/Hero";
import Footer from "@/components/home/Footer";
import { getHomepagePosters } from "@/lib/posters";

export const metadata: Metadata = baseMetadata({
  title: "Canisterr - Your Cinema Identity",
  description:
    "Canisterr is a social movie platform where you discover films through friends, track your taste, share reviews, and find what to watch next.",
  alternates: {
    canonical: canonical("/"),
  },
  openGraph: {
    type: "website",
    siteName: "Canisterr",
    locale: "en_US",
    url: canonical("/"),
    title: "Canisterr - Your Cinema Identity",
    description:
      "Canisterr is a social movie platform where you discover films through friends, track your taste, share reviews, and find what to watch next.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Canisterr - Your Cinema Identity",
    description:
      "Canisterr is a social movie platform where you discover films through friends, track your taste, share reviews, and find what to watch next.",
  },
});

export default async function HomePage() {
  const posters = await getHomepagePosters();

  return (
    <main className="min-h-screen overflow-hidden bg-[#020202] text-[#fff5e8]">
      <Hero posters={posters} />
      <Footer />
    </main>
  );
}
