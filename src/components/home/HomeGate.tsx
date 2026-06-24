"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import type { PosterItem } from "@/lib/posters";
import Hero from "./Hero";
import Footer from "./Footer";

type HomeGateProps = {
  posters: PosterItem[];
};

export default function HomeGate({ posters }: HomeGateProps) {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, router, user]);

  if (loading) {
    return <main className="min-h-screen bg-[#020202]" />;
  }

  if (user) {
    return <main className="min-h-screen bg-[#020202]" />;
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#020202] text-[#fff5e8]">
      <Hero posters={posters} />
      <Footer />
    </main>
  );
}
