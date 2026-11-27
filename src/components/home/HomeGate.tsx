"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import { useIsPwa } from "@/lib/pwa";
import LandingExperience from "./LandingExperience";

export default function HomeGate() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();
  const isPwa = useIsPwa();

  useEffect(() => {
    if (isPwa || (!loading && user)) {
      router.replace("/dashboard");
    }
  }, [isPwa, loading, router, user]);

  if (isPwa || loading || user) return <div className="min-h-screen bg-[#0b0b0b]" />;

  return <LandingExperience />;
}
