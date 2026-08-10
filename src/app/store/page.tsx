"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import MovieStoreExperience from "@/components/store/MovieStoreExperience";
import LoadingOverlay from "@/components/store/hud/LoadingOverlay";
import { useStoreScene } from "@/lib/store/store-state";

function StoreExperienceWithUrlState() {
  const { user, loading } = useCurrentUser();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialSectionId = useRef(searchParams.get("section")).current;
  const initialMovieIdRaw = useRef(searchParams.get("movie")).current;
  const parsedInitialMovieId = initialMovieIdRaw ? Number(initialMovieIdRaw) : null;
  const initialMovieId = parsedInitialMovieId !== null && Number.isFinite(parsedInitialMovieId) ? parsedInitialMovieId : null;

  const selectedMovieId = useStoreScene((s) => s.selectedMovieId);
  const activeTeleportSection = useStoreScene((s) => s.teleportRequest?.targetSectionId ?? null);

  // Keep the URL shareable/refreshable without spamming browser history —
  // walking around freely doesn't rewrite the URL, only deliberate
  // navigation (map/search teleport, opening a movie) does.
  useEffect(() => {
    const params = new URLSearchParams();
    if (activeTeleportSection) params.set("section", activeTeleportSection);
    if (selectedMovieId !== null) params.set("movie", String(selectedMovieId));
    const query = params.toString();
    router.replace(query ? `/store?${query}` : "/store", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMovieId, activeTeleportSection]);

  if (loading) {
    return <LoadingOverlay />;
  }

  return (
    <ErrorBoundary>
      <MovieStoreExperience user={user} initialSectionId={initialSectionId} initialMovieId={initialMovieId} />
    </ErrorBoundary>
  );
}

export default function StorePage() {
  return (
    <Suspense fallback={<LoadingOverlay />}>
      <StoreExperienceWithUrlState />
    </Suspense>
  );
}
