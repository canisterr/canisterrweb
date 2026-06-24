"use client";

import Image from "next/image";
import { motion, useMotionValueEvent, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type FeatureCard = {
  title: string;
  eyebrow: string;
  description: string;
  image: string;
};

const features: FeatureCard[] = [
  {
    title: "Home Page",
    eyebrow: "Cineposts + Friend Activity",
    description:
      "Your home feed keeps cineposts, fresh logs, and friend activity in one place so the app always feels alive the second you open it.",
    image: "/home_cinepost.png",
  },
  {
    title: "Share Page",
    eyebrow: "Recommendations That Travel",
    description:
      "Send a film directly to a friend, keep the conversation around the share going, and make recommendations feel personal instead of disposable.",
    image: "/share.png",
  },
  {
    title: "Log Movies",
    eyebrow: "With Calendar Memory",
    description:
      "Capture what you watched, how it felt, and when it happened, then trace your viewing life across a calendar of nights, rewatches, and streaks.",
    image: "/log.png",
  },
  {
    title: "Lists",
    eyebrow: "Curated Public Shelves",
    description:
      "Build mood lists, marathons, favourites, and deep-cut collections that look polished enough to share as a real expression of taste.",
    image: "/list.png",
  },
  {
    title: "Reviews",
    eyebrow: "Write The Feeling",
    description:
      "Move beyond ratings with reactions and reviews that capture the exact texture of a watch, whether it is quick, thoughtful, or deeply personal.",
    image: "/review.png",
  },
  {
    title: "Profile Stats",
    eyebrow: "Patterns In Your Taste",
    description:
      "See the shape of your cinema identity through profile stats, genre habits, yearly patterns, and the numbers that make your taste feel distinct.",
    image: "/STATS.png",
  },
];

export default function FeatureGrid() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [viewportWidth, setViewportWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end end"],
  });

  const x = useTransform(scrollYProgress, [0, 1], [0, -(viewportWidth * (features.length - 1))]);

  useMotionValueEvent(scrollYProgress, "change", (value) => {
    const nextIndex = Math.min(features.length - 1, Math.max(0, Math.round(value * (features.length - 1))));
    setActiveIndex(nextIndex);
  });

  useEffect(() => {
    const measure = () => setViewportWidth(window.innerWidth);

    measure();
    window.addEventListener("resize", measure);

    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative border-b border-white/10"
      style={{ height: `${features.length * 100}vh` }}
    >
      <div className="sticky top-0 h-screen overflow-hidden px-6 py-14 sm:px-8 lg:px-12">
        <div className="mx-auto flex h-full max-w-7xl flex-col">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-[0.68rem] uppercase tracking-[0.32em] text-[#ff9a52]">Platform Features</p>
              <h2
                className="mt-4 text-4xl text-[#fff5e8] sm:text-5xl lg:text-6xl"
                style={{ fontFamily: 'var(--font-playfair), "Playfair Display", "Times New Roman", serif' }}
              >
                Scroll down. Move through Canisterr sideways.
              </h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-[#efe5d3]/72 sm:text-base">
                Each scroll step reveals a different part of the product: feed, sharing, logging, lists, reviews, and
                the stats that shape your cinema identity.
              </p>
            </div>

            <div className="hidden items-center gap-2 lg:flex">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className={`h-2.5 rounded-full transition-all duration-300 ${
                    index === activeIndex ? "w-12 bg-[#ff7a1a]" : "w-2.5 bg-white/18"
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="relative flex-1 overflow-hidden">
            <motion.div style={{ x }} className="flex h-full">
              {features.map((feature, index) => (
                <div key={feature.title} className="flex h-full w-screen shrink-0 items-center px-0">
                  <div className="mx-auto grid h-full w-full max-w-7xl gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-center">
                    <motion.div
                      initial={{ opacity: 0, y: 24 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.35 }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="order-2 flex flex-col justify-center lg:order-1"
                    >
                      <p className="text-[0.7rem] uppercase tracking-[0.3em] text-[#ff9a52]">{feature.eyebrow}</p>
                      <h3 className="mt-4 text-4xl font-semibold text-[#fff5e8] sm:text-5xl">{feature.title}</h3>
                      <p className="mt-6 max-w-xl text-sm leading-7 text-[#efe5d3]/72 sm:text-base">
                        {feature.description}
                      </p>
                      <div className="mt-8 inline-flex w-fit items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[0.72rem] uppercase tracking-[0.24em] text-white/52">
                        <span>{String(index + 1).padStart(2, "0")}</span>
                        <span className="h-px w-10 bg-white/14" />
                        <span>{String(features.length).padStart(2, "0")}</span>
                      </div>
                    </motion.div>

                    <motion.div
                      initial={{ opacity: 0, scale: 0.96, y: 24 }}
                      whileInView={{ opacity: 1, scale: 1, y: 0 }}
                      viewport={{ once: true, amount: 0.3 }}
                      transition={{ duration: 0.65, ease: "easeOut" }}
                      className="order-1 flex items-center justify-center lg:order-2"
                    >
                      <div className="relative w-full max-w-[22rem] overflow-hidden rounded-[2.4rem] border border-white/8 bg-[#0a0a0a] shadow-[0_30px_90px_rgba(0,0,0,0.38)] sm:max-w-[24rem] lg:max-w-[26rem]">
                        <div className="absolute inset-0 z-10 bg-[linear-gradient(180deg,transparent_0%,rgba(2,2,2,0.08)_55%,rgba(2,2,2,0.2)_100%)]" />
                        <Image
                          src={feature.image}
                          alt={`${feature.title} feature screenshot`}
                          width={1400}
                          height={2000}
                          priority={index < 2}
                          className="h-auto w-full object-cover object-top"
                        />
                      </div>
                    </motion.div>
                  </div>
                </div>
              ))}
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
