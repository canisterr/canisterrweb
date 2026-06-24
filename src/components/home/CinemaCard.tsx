"use client";

import { motion } from "framer-motion";
import { BadgeCheck, Film, Flame, Star } from "lucide-react";

const signatureTitles = ["La La Land", "12 Angry Men", "The Dark Knight", "Breaking Bad"];

const spotlightStats = [
  { label: "Watched", value: "284" },
  { label: "Favourite Genre", value: "Neo-noir" },
  { label: "Match Score", value: "96%" },
];

export default function CinemaCard() {
  return (
    <section className="px-6 py-24 sm:px-8 lg:px-12">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
        >
          <p className="text-[0.68rem] uppercase tracking-[0.32em] text-[#ff9a52]">Cinema Card</p>
          <h2
            className="mt-4 text-4xl text-[#fff5e8] sm:text-5xl"
            style={{ fontFamily: 'var(--font-playfair), "Playfair Display", "Times New Roman", serif' }}
          >
            A premium identity card for the way you watch.
          </h2>
          <p className="mt-5 max-w-xl text-sm leading-7 text-[#efe5d3]/72 sm:text-base">
            Your Cinema Card distills the signal in your watch history into something sharp, shareable, and unmistakably
            yours, from favourite genres to signature titles and compatibility.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {spotlightStats.map((item) => (
              <div key={item.label} className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] px-5 py-4">
                <p className="text-[0.64rem] uppercase tracking-[0.28em] text-white/36">{item.label}</p>
                <p className="mt-2 text-lg font-semibold text-[#fff5e8]">{item.value}</p>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 34 }}
          whileInView={{ opacity: 1, scale: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.75, ease: "easeOut" }}
          className="relative"
        >
          <div className="absolute -inset-6 rounded-[2.5rem] bg-[radial-gradient(circle,rgba(255,122,26,0.22),transparent_62%)] blur-3xl" />
          <div className="relative overflow-hidden rounded-[2.5rem] border border-[#ff7a1a]/28 bg-[linear-gradient(145deg,rgba(20,10,6,0.98),rgba(6,6,6,0.98))] p-7 shadow-[0_34px_90px_rgba(0,0,0,0.5)] sm:p-8">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,122,26,0.2),transparent_32%),linear-gradient(180deg,transparent,rgba(255,122,26,0.06))]" />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-[#ff7a1a]/28 bg-[#1b120d] px-4 py-2 text-[0.68rem] uppercase tracking-[0.3em] text-[#ffb073]">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Verified Taste
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-medium text-[#f5efe2]">
                  <Flame className="h-3.5 w-3.5 text-[#ff9a52]" />
                  Top 4% similarity score
                </div>
              </div>

              <div className="mt-8 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.28em] text-white/36">@framesbymaya</p>
                  <p className="brand-wordmark mt-2 text-4xl tracking-[0.06em] text-[#fff6ea] sm:text-5xl">
                    Cinema Card
                  </p>
                </div>
                <div className="rounded-[1.6rem] border border-white/10 bg-black/30 px-5 py-4 text-right">
                  <p className="text-[0.62rem] uppercase tracking-[0.28em] text-white/35">Identity Score</p>
                  <p className="mt-2 text-3xl font-semibold text-[#ffb073]">96</p>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] p-5">
                  <p className="text-[0.62rem] uppercase tracking-[0.28em] text-white/36">Watched This Year</p>
                  <p className="mt-3 text-4xl font-semibold text-[#fff5e8]">137</p>
                </div>
                <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] p-5">
                  <p className="text-[0.62rem] uppercase tracking-[0.28em] text-white/36">Favourite Genre</p>
                  <p className="mt-3 text-2xl font-semibold text-[#fff5e8]">Neo-noir Romance</p>
                </div>
                <div className="rounded-[1.6rem] border border-white/8 bg-white/[0.03] p-5">
                  <p className="text-[0.62rem] uppercase tracking-[0.28em] text-white/36">Match Signal</p>
                  <p className="mt-3 text-2xl font-semibold text-[#fff5e8]">Character-led</p>
                </div>
              </div>

              <div className="mt-8 rounded-[2rem] border border-white/8 bg-black/30 p-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[0.62rem] uppercase tracking-[0.28em] text-white/36">Top Films</p>
                    <p className="mt-2 text-sm text-[#efe5d3]/66">The titles that define the card at a glance.</p>
                  </div>
                  <Film className="h-5 w-5 text-[#ff9a52]" />
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  {signatureTitles.map((title) => (
                    <span
                      key={title}
                      className="inline-flex items-center gap-2 rounded-full border border-[#ff7a1a]/22 bg-[#1a120d] px-4 py-2 text-sm text-[#fff0de]"
                    >
                      <Star className="h-3.5 w-3.5 text-[#ff9a52]" />
                      {title}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
