"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Clapperboard, Film, SlidersHorizontal, Sparkles, Tv } from "lucide-react";
import PageLayout from "@/components/PageLayout";
import { useCurrentUser } from "@/components/CurrentUserProvider";
import DiscoverSkeleton from "@/components/discover/DiscoverSkeleton";
import RecommendationCard from "@/components/discover/RecommendationCard";
import { addToWatchlist } from "@/lib/logs";
import { RECOMMENDATION_MOODS } from "@/lib/recommendation/moods";
import { getWatchProviderOptions } from "@/lib/recommendation/providers";
import { createRecommendationSession, recordRecommendationEvent } from "@/lib/recommendation/feedback";
import { createDefaultRecommendationContext, getRecommendationsForContext } from "@/lib/recommendation/service";
import type {
  ContentPreference,
  RankedRecommendation,
  RecommendationContext,
  RecommendationFeedbackAction,
  RecommendationLane,
  TasteProfile,
  WatchProviderOption,
} from "@/lib/recommendation/types";

const TIME_OPTIONS: Array<{ label: string; value: number | null }> = [
  { label: "30 min", value: 30 },
  { label: "1 hour", value: 60 },
  { label: "90 min", value: 90 },
  { label: "2 hours", value: 120 },
  { label: "No limit", value: null },
];

const CONTENT_OPTIONS: Array<{ label: string; value: ContentPreference; icon: typeof Film }> = [
  { label: "Movie", value: "movie", icon: Film },
  { label: "Series", value: "tv", icon: Tv },
  { label: "Either", value: "either", icon: Clapperboard },
];

const LANE_LABELS: Record<RecommendationLane, { title: string; detail: string }> = {
  safe: { title: "Safe bet", detail: "Closest to your taste" },
  stretch: { title: "The stretch", detail: "A smart step sideways" },
  wildcard: { title: "Wildcard", detail: "Unexpected, with potential" },
};

function getRegion(): string {
  if (typeof window === "undefined") return "IN";
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timezone === "Asia/Kolkata" || navigator.language.toUpperCase().endsWith("-IN") ? "IN" : "US";
}

function RecommendationSetup({
  context,
  onChange,
  onSubmit,
  loading,
  providers,
}: {
  context: RecommendationContext;
  onChange: (next: RecommendationContext) => void;
  onSubmit: (trustMode?: boolean) => void;
  loading: boolean;
  providers: WatchProviderOption[];
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="max-w-3xl">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-[#ff7a1a]">Canisterr Taste Engine</p>
        <h1 className="mt-4 text-4xl font-black leading-[0.96] tracking-[-0.055em] text-[#f5f0de] sm:text-6xl lg:text-7xl">What kind of night is it?</h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-white/45 sm:text-lg">A few signals. One confident answer. No endless wall of posters.</p>
      </div>

      <section className="mt-10" aria-labelledby="mood-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">Start here</p>
            <h2 id="mood-heading" className="mt-1 text-xl font-black text-[#f5f0de] sm:text-2xl">What are you in the mood for?</h2>
          </div>
          <span className="hidden text-xs text-white/30 sm:block">Pick one—or let Canisterr decide.</span>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
          {RECOMMENDATION_MOODS.map((mood) => {
            const active = context.mood === mood.id;
            return (
              <button
                key={mood.id}
                type="button"
                onClick={() => onChange({ ...context, mood: mood.id })}
                aria-pressed={active}
                className={`min-h-20 rounded-[1.25rem] border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff7a1a] ${active ? "border-[#ff7a1a] bg-[#ff7a1a] text-black" : "border-white/10 bg-[#111111] text-[#f5f0de] hover:border-[#ff7a1a]/40 hover:bg-white/[0.055]"}`}
              >
                <span className="text-sm font-black leading-tight">{mood.label}</span>
                <span className={`mt-1 block text-[10px] leading-4 ${active ? "text-black/55" : "text-white/30"}`}>{mood.prompt}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="mt-10 grid gap-8 border-t border-white/10 pt-8 lg:grid-cols-2">
        <section aria-labelledby="time-heading">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">Tonight</p>
          <h2 id="time-heading" className="mt-1 text-xl font-black text-[#f5f0de]">How much time do you have?</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {TIME_OPTIONS.map((option) => {
              const active = context.availableMinutes === option.value;
              return <button key={option.label} type="button" onClick={() => onChange({ ...context, availableMinutes: option.value })} aria-pressed={active} className={`min-h-11 rounded-full border px-4 text-sm font-bold transition ${active ? "border-[#ff7a1a] bg-[#ff7a1a]/12 text-[#ffb36b]" : "border-white/10 bg-white/[0.035] text-white/55 hover:text-white"}`}>{option.label}</button>;
            })}
          </div>
        </section>

        <section aria-labelledby="format-heading">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">Format</p>
          <h2 id="format-heading" className="mt-1 text-xl font-black text-[#f5f0de]">Movie, series, or either?</h2>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {CONTENT_OPTIONS.map((option) => {
              const active = context.contentType === option.value;
              const Icon = option.icon;
              return <button key={option.value} type="button" onClick={() => onChange({ ...context, contentType: option.value })} aria-pressed={active} className={`flex min-h-12 items-center justify-center gap-2 rounded-full border px-3 text-sm font-bold transition ${active ? "border-[#ff7a1a] bg-[#ff7a1a] text-black" : "border-white/10 bg-white/[0.035] text-white/55 hover:text-white"}`}><Icon className="h-4 w-4" />{option.label}</button>;
            })}
          </div>
        </section>
      </div>

      <details className="group mt-8 rounded-[1.5rem] border border-white/10 bg-[#0f0f0f]">
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 text-sm font-bold text-white/60 [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-[#ff7a1a]" /> Tune the recommendation</span>
          <span className="text-xs font-medium text-white/25 group-open:hidden">Optional</span>
        </summary>
        <div className="grid gap-7 border-t border-white/10 p-5 sm:grid-cols-2">
          <label className="block">
            <span className="flex items-center justify-between text-xs font-bold text-white/55"><span>Attention</span><span>{context.energyLevel < 0.4 ? "Easy watch" : context.energyLevel > 0.7 ? "Full focus" : "Balanced"}</span></span>
            <input type="range" min="0" max="1" step="0.05" value={context.energyLevel} onChange={(event) => onChange({ ...context, energyLevel: Number(event.target.value) })} className="mt-4 w-full accent-[#ff7a1a]" />
            <span className="mt-1 flex justify-between text-[10px] text-white/25"><span>Easy</span><span>Demanding</span></span>
          </label>
          <label className="block">
            <span className="flex items-center justify-between text-xs font-bold text-white/55"><span>Familiarity</span><span>{context.noveltyLevel < 0.4 ? "Safe" : context.noveltyLevel > 0.7 ? "Surprise me" : "A small stretch"}</span></span>
            <input type="range" min="0" max="1" step="0.05" value={context.noveltyLevel} onChange={(event) => onChange({ ...context, noveltyLevel: Number(event.target.value) })} className="mt-4 w-full accent-[#ff7a1a]" />
            <span className="mt-1 flex justify-between text-[10px] text-white/25"><span>Familiar</span><span>Adventurous</span></span>
          </label>
          <div className="sm:col-span-2">
            <p className="text-xs font-bold text-white/55">Watching</p>
            <div className="mt-3 flex gap-2">
              {([['solo', 'Solo'], ['together', 'With someone']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => onChange({ ...context, watchingWith: context.watchingWith === value ? null : value })} className={`min-h-11 rounded-full border px-4 text-sm font-bold ${context.watchingWith === value ? "border-[#ff7a1a] bg-[#ff7a1a]/12 text-[#ffb36b]" : "border-white/10 text-white/45"}`}>{label}</button>)}
            </div>
          </div>
          {providers.length ? (
            <div className="sm:col-span-2">
              <p className="text-xs font-bold text-white/55">Available to me</p>
              <p className="mt-1 text-[10px] text-white/25">Only verified provider matches will be treated as available.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {providers.map((provider) => {
                  const active = context.providerIds.includes(provider.id);
                  return <button key={provider.id} type="button" onClick={() => onChange({ ...context, providerIds: active ? context.providerIds.filter((id) => id !== provider.id) : [...context.providerIds, provider.id] })} aria-pressed={active} className={`min-h-11 rounded-full border px-4 text-sm font-bold transition ${active ? "border-[#ff7a1a] bg-[#ff7a1a]/12 text-[#ffb36b]" : "border-white/10 text-white/45 hover:text-white"}`}>{provider.name}</button>;
                })}
              </div>
            </div>
          ) : null}
        </div>
      </details>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={() => onSubmit(false)} disabled={loading || !context.mood} className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-full bg-[#ff7a1a] px-6 text-base font-black text-black transition hover:bg-[#ff8d3b] disabled:cursor-not-allowed disabled:opacity-35"><Sparkles className="h-5 w-5" />{loading ? "Finding the one…" : "Find my next watch"}</button>
        <button type="button" onClick={() => onSubmit(true)} disabled={loading} className="min-h-14 rounded-full border border-white/10 bg-white/[0.035] px-7 text-sm font-black text-[#f5f0de] transition hover:bg-white/[0.07] disabled:opacity-40">Trust Canisterr</button>
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  const router = useRouter();
  const { user, loading: userLoading } = useCurrentUser();
  const [context, setContext] = useState<RecommendationContext>(() => createDefaultRecommendationContext());
  const [recommendations, setRecommendations] = useState<RankedRecommendation[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  const [sessionId, setSessionId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [busyAction, setBusyAction] = useState<RecommendationFeedbackAction | "save" | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [excludedKeys, setExcludedKeys] = useState<Set<string>>(new Set());
  const [providers, setProviders] = useState<WatchProviderOption[]>([]);

  useEffect(() => {
    const region = getRegion();
    setContext((current) => ({ ...current, region }));
    void getWatchProviderOptions(region).then(setProviders);
  }, []);

  const activeRecommendation = recommendations[activeIndex] || null;
  const laneRecommendations = useMemo(() => recommendations.slice(0, 3), [recommendations]);
  const positiveTaste = useMemo(() => {
    if (!tasteProfile || tasteProfile.evidenceCount < 3) return [];
    return Object.entries(tasteProfile.genreVector).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [tasteProfile]);

  const track = async (
    recommendation: RankedRecommendation,
    action: RecommendationFeedbackAction,
    activeSessionId = sessionId,
    eventContext = context
  ) => {
    if (!user || !activeSessionId) return;
    await recordRecommendationEvent({ userId: user.id, sessionId: activeSessionId, recommendation, action, context: eventContext }).catch(() => {});
  };

  const findRecommendation = async (trustMode = false, exclusions = excludedKeys) => {
    setLoading(true);
    setError("");
    const nextContext: RecommendationContext = {
      ...context,
      mood: trustMode ? context.mood || "surprise" : context.mood,
      noveltyLevel: trustMode && !context.mood ? 0.58 : context.noveltyLevel,
      region: getRegion(),
      sessionTimestamp: new Date().toISOString(),
    };
    setContext(nextContext);
    try {
      const result = await getRecommendationsForContext(user, nextContext, exclusions);
      if (!result.recommendations.length) {
        setError("Nothing strong enough surfaced for those constraints. Try a little more time or choose Either.");
        return;
      }
      const nextSessionId = await createRecommendationSession(user?.id || "", nextContext).catch(() => `local-${Date.now()}`);
      setRecommendations(result.recommendations);
      setTasteProfile(result.tasteProfile);
      setActiveIndex(0);
      setSessionId(nextSessionId);
      await track(result.recommendations[0], "shown", nextSessionId, nextContext);
    } catch {
      setError("Discover could not reach the catalogue right now. Your choices are safe—try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  const showRecommendation = (index: number) => {
    const recommendation = recommendations[index];
    if (!recommendation) return;
    setActiveIndex(index);
    void track(recommendation, "shown");
  };

  const advance = async (action: RecommendationFeedbackAction) => {
    if (!activeRecommendation) return;
    setBusyAction(action);
    await track(activeRecommendation, action);
    const nextExcluded = new Set(excludedKeys);
    nextExcluded.add(`${activeRecommendation.candidate.contentType}:${activeRecommendation.candidate.id}`);
    setExcludedKeys(nextExcluded);
    const nextIndex = recommendations.findIndex((item, index) => index > activeIndex && !nextExcluded.has(`${item.candidate.contentType}:${item.candidate.id}`));
    if (nextIndex >= 0) {
      showRecommendation(nextIndex);
    } else {
      setRecommendations([]);
      setActiveIndex(0);
      await findRecommendation(false, nextExcluded);
    }
    setBusyAction(null);
  };

  const handleAction = async (action: RecommendationFeedbackAction | "save") => {
    if (!activeRecommendation) return;
    if (action === "save") {
      if (!user) {
        router.push(`/auth/login?redirect=${encodeURIComponent("/discover")}`);
        return;
      }
      setBusyAction("save");
      try {
        await addToWatchlist(user.id, activeRecommendation.candidate.id, activeRecommendation.candidate.contentType);
        await track(activeRecommendation, "saved");
        setSavedKeys((current) => new Set(current).add(`${activeRecommendation.candidate.contentType}:${activeRecommendation.candidate.id}`));
      } finally {
        setBusyAction(null);
      }
      return;
    }
    if (action === "accepted") {
      setBusyAction(action);
      await track(activeRecommendation, action);
      const path = activeRecommendation.candidate.contentType === "movie" ? `/movie/${activeRecommendation.candidate.id}` : `/tv/${activeRecommendation.candidate.id}`;
      router.push(path);
      return;
    }
    if (action === "another" || action === "seen" || action === "not_tonight" || action === "not_for_me") {
      await advance(action);
    }
  };

  if (userLoading) {
    return <PageLayout user={user} theme="brutalist"><DiscoverSkeleton /></PageLayout>;
  }

  return (
    <PageLayout user={user} theme="brutalist">
      <main className="mx-auto min-h-screen w-full max-w-6xl overflow-x-hidden px-2 pb-12 pt-5 text-[#f5f0de] sm:px-6 sm:pt-8">
        {activeRecommendation ? (
          <div className="mx-auto max-w-5xl">
            <div className="mb-6 flex items-center justify-between gap-4">
              <button type="button" onClick={() => { setRecommendations([]); setError(""); }} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 text-sm font-bold text-white/55 transition hover:text-white"><ArrowLeft className="h-4 w-4" /> Change the night</button>
              <p className="hidden text-[10px] font-black uppercase tracking-[0.24em] text-white/25 sm:block">One answer at a time</p>
            </div>

            <div className="mb-4 grid grid-cols-3 gap-2 rounded-[1.4rem] border border-white/10 bg-[#0f0f0f] p-1.5">
              {laneRecommendations.map((recommendation, index) => {
                const copy = LANE_LABELS[recommendation.lane];
                const active = recommendation.candidate.id === activeRecommendation.candidate.id && recommendation.candidate.contentType === activeRecommendation.candidate.contentType;
                return <button key={recommendation.lane} type="button" onClick={() => showRecommendation(index)} aria-pressed={active} className={`min-h-14 rounded-[1rem] px-2 text-center transition ${active ? "bg-[#ff7a1a] text-black" : "text-white/45 hover:bg-white/5 hover:text-white"}`}><span className="block text-xs font-black sm:text-sm">{copy.title}</span><span className={`mt-0.5 hidden text-[9px] sm:block ${active ? "text-black/55" : "text-white/25"}`}>{copy.detail}</span></button>;
              })}
            </div>

            <RecommendationCard recommendation={activeRecommendation} busyAction={busyAction} saved={savedKeys.has(`${activeRecommendation.candidate.contentType}:${activeRecommendation.candidate.id}`)} onAction={(action) => void handleAction(action)} />

            {positiveTaste.length ? (
              <section className="mt-10 border-t border-white/10 pt-8" aria-labelledby="taste-heading">
                <p className="text-[10px] font-black uppercase tracking-[0.28em] text-[#ff7a1a]">Your taste, quietly working</p>
                <h2 id="taste-heading" className="mt-2 text-2xl font-black tracking-tight">What shaped this answer</h2>
                <p className="mt-2 text-sm text-white/40">Based on {tasteProfile?.evidenceCount} real diary entries—not a generic popularity profile.</p>
                <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {positiveTaste.map(([genre, value]) => <div key={genre}><div className="flex justify-between text-xs"><span className="capitalize text-white/65">{genre}</span><span className="text-white/25">taste signal</span></div><div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-[#ff7a1a]" style={{ width: `${Math.max(12, value * 100)}%` }} /></div></div>)}
                </div>
              </section>
            ) : null}
          </div>
        ) : loading ? (
          <DiscoverSkeleton />
        ) : (
          <>
            <RecommendationSetup context={context} onChange={setContext} onSubmit={(trustMode) => void findRecommendation(trustMode)} loading={loading} providers={providers} />
            {error ? <div role="alert" className="mx-auto mt-6 max-w-3xl rounded-[1.25rem] border border-[#ff7a1a]/25 bg-[#ff7a1a]/8 px-5 py-4 text-sm leading-6 text-[#ffd4b3]">{error}</div> : null}
          </>
        )}
      </main>
    </PageLayout>
  );
}
