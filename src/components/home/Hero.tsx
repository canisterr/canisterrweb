import Image from "@/components/AppImage";
import Link from "next/link";
import { ArrowRight, Compass } from "lucide-react";
import type { PosterItem } from "@/lib/posters";
import FloatingPosters from "./FloatingPosters";

type HeroProps = {
  posters: PosterItem[];
};

const navItems = ["Movies", "Logs", "Lists"];

export default function Hero({ posters }: HeroProps) {
  return (
    <section className="relative isolate overflow-hidden border-b border-white/10 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,122,26,0.14),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(255,122,26,0.08),transparent_22%),linear-gradient(180deg,#020202_0%,#050505_55%,#020202_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.02)_50%,transparent_100%)] opacity-20" />

      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[1600px] flex-col px-2 py-3 sm:min-h-screen sm:px-4 lg:px-6">
        <div className="relative flex items-center justify-between gap-4 py-2">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black">
              <Image
                src="/logo-ui.webp"
                alt="Canisterr logo"
                width={44}
                height={44}
                priority
                className="h-9 w-9 rounded-xl bg-black object-contain"
              />
            </div>
            <div>
              <p className="brand-wordmark text-2xl tracking-[0.04em] text-[#fff5e8]">Canisterr</p>
            </div>
          </div>

          <nav className="absolute left-[46.5%] hidden -translate-x-1/2 items-center justify-center gap-7 lg:flex">
            {navItems.map((item) => (
              <span key={item} className="text-sm font-medium text-white/68 transition hover:text-[#ffb073]">
                {item}
              </span>
            ))}
          </nav>

          <Link
            href="/auth/signup"
            className="inline-flex items-center gap-2 rounded-full border border-[#ff7a1a]/35 px-4 py-2 text-sm font-semibold text-[#ffb073] transition hover:border-[#ff7a1a]/55 hover:text-[#ffd2ab]"
          >
            Get Started
          </Link>
        </div>

        <div className="mx-auto flex w-full max-w-[1500px] flex-1 flex-col items-center justify-start py-8 text-center sm:justify-center sm:py-10">
          <h1
            className="mt-20 max-w-3xl text-4xl font-bold leading-[0.96] text-[#fff5e8] sm:mt-8 sm:text-5xl lg:text-[5.15rem]"
            style={{ fontFamily: 'var(--font-playfair), "Playfair Display", "Times New Roman", serif' }}
          >
            Your Cinema Identity
          </h1>
          <p
            className="mt-4 max-w-[20rem] text-[1.05rem] text-[#ffb073] sm:max-w-none sm:text-[1.5rem]"
            style={{ fontFamily: 'var(--font-playfair), "Playfair Display", "Times New Roman", serif' }}
          >
            Pure movie taste, shaped in Canisterr&apos;s own language.
          </p>

          <FloatingPosters posters={posters} />

          <p className="mx-auto max-w-[21rem] text-sm leading-7 text-[#f3e7d0]/70 sm:max-w-3xl sm:text-base">
            Log what moves you, track the shape of your taste, and turn your favorite posters, reviews, lists, and
            stats into a homepage that feels unmistakably yours.
          </p>

          <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/auth/signup"
              className="inline-flex min-w-[13rem] items-center justify-center gap-2 rounded-full border border-[#ff7a1a] bg-[#ff7a1a] px-6 py-3 text-sm font-semibold text-[#090909] transition hover:bg-[#ff9142]"
            >
              Start Logging
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/all-movies"
              className="inline-flex min-w-[13rem] items-center justify-center gap-2 rounded-full border border-white/14 px-6 py-3 text-sm font-semibold text-[#f5efe2] transition hover:border-[#ff7a1a]/55 hover:bg-white/7"
            >
              Explore Movies
              <Compass className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
