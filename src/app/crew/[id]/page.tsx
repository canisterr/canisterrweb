import type { Metadata } from "next";
import { cache } from "react";
import { redirect } from "next/navigation";
import PageLayout from "@/components/PageLayout";
import CrewPageClient from "@/components/CrewPageClient";
import JsonLd from "@/components/JsonLd";
import { buildCrewPath, getCrewProfile, parseCrewRouteParam } from "@/lib/crew";
import { BASE_URL, breadcrumbSchema, crewMetadata, crewPersonSchema } from "@/lib/seo";

type Props = {
  params: Promise<{ id: string }>;
};

const getCrewPageData = cache(async (routeParam: string) => {
  const parsed = parseCrewRouteParam(routeParam);
  if (!parsed) {
    return { parsed: null, profile: null };
  }

  const profile = await getCrewProfile(parsed.id);
  return { parsed, profile };
});

function CrewStateCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <PageLayout user={null} theme="brutalist">
      <main className="mx-auto flex min-h-[70vh] w-full max-w-[880px] items-center px-3 py-8">
        <section className="w-full rounded-[2rem] border border-white/10 bg-[#111111] px-6 py-14 text-center shadow-[0_30px_100px_rgba(0,0,0,0.28)]">
          <p className="text-[11px] uppercase tracking-[0.26em] text-[#ffb36b]">Crew</p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#f5f0de]">{title}</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-white/60 sm:text-base">{description}</p>
        </section>
      </main>
    </PageLayout>
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const { profile } = await getCrewPageData(id);

  if (!profile) {
    return {
      title: "Crew | Canisterr",
      description: "Explore film people, careers, and credits on Canisterr.",
    };
  }

  return crewMetadata(profile);
}

export default async function CrewPage({ params }: Props) {
  const { id } = await params;

  try {
    const { parsed, profile } = await getCrewPageData(id);

    if (!parsed) {
      return (
        <CrewStateCard
          title="Invalid crew link"
          description="This career page URL is incomplete. Try opening the person again from search."
        />
      );
    }

    if (!profile) {
      return (
        <CrewStateCard
          title="Crew member not found"
          description="We could not find this person on TMDB right now. Try another search result or check back in a moment."
        />
      );
    }

    const canonicalPath = buildCrewPath({ id: profile.id, name: profile.name });
    if (`/crew/${id}` !== canonicalPath) {
      redirect(canonicalPath);
    }

    return (
      <>
        <JsonLd data={crewPersonSchema(profile)} />
        <JsonLd
          data={breadcrumbSchema([
            { name: "Home", url: BASE_URL },
            { name: profile.name, url: `${BASE_URL}${canonicalPath}` },
          ])}
        />
        <CrewPageClient profile={profile} />
      </>
    );
  } catch (error) {
    console.error("Crew page failed:", error);
    return (
      <CrewStateCard
        title="Career timeline unavailable"
        description="Something went wrong while loading this filmography. Refresh and try again in a moment."
      />
    );
  }
}
