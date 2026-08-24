"use client";

import { DISCOVERY_MOODS } from "@/lib/discovery/moodMapping";
import type { DiscoveryMoodSlug } from "@/lib/discovery/discoveryTypes";

const MOOD_TONES: Record<DiscoveryMoodSlug, string> = {
  comfort: "from-[#ffd36b]/22 to-[#f5f0de]/6",
  lonely_reflective: "from-[#7dd3fc]/18 to-[#f5f0de]/5",
  romantic: "from-[#ff7ab6]/18 to-[#f5f0de]/5",
  feel_good_funny: "from-[#facc15]/20 to-[#f5f0de]/5",
  adrenaline: "from-[#ff453a]/18 to-[#f5f0de]/5",
  mind_bending: "from-[#64d2ff]/18 to-[#f5f0de]/5",
  dark_twisted: "from-[#a78bfa]/18 to-[#f5f0de]/5",
  emotional_cry: "from-[#fb7185]/18 to-[#f5f0de]/5",
  beautiful_dreamy: "from-[#5eead4]/18 to-[#f5f0de]/5",
  epic_immersive: "from-[#f97316]/18 to-[#f5f0de]/5",
};

export default function MoodSelector({
  selectedMood,
  onSelect,
}: {
  selectedMood: DiscoveryMoodSlug | null;
  onSelect: (mood: DiscoveryMoodSlug) => void;
}) {
  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.26em] text-[#ff7a1a]">Discover</p>
        <h1 className="mt-3 text-4xl font-black leading-none text-[#f5f0de] sm:text-5xl">
          What are you in the mood for?
        </h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {DISCOVERY_MOODS.map((mood) => {
          const active = selectedMood === mood.slug;
          return (
            <button
              key={mood.slug}
              type="button"
              onClick={() => onSelect(mood.slug)}
              className={`min-h-24 rounded-[1.4rem] border bg-gradient-to-br p-4 text-left transition ${
                active
                  ? "border-[#f5f0de]/70 shadow-[0_18px_70px_rgba(255,122,26,0.18)]"
                  : "border-white/10 hover:border-white/20"
              } ${MOOD_TONES[mood.slug]}`}
            >
              <span className="block text-lg font-black text-[#f5f0de]">{mood.name}</span>
              <span className="mt-2 block text-xs leading-5 text-white/52">{mood.reason}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
