import Image from "@/components/AppImage";
import Link from "next/link";
import type { ReactNode } from "react";

export const authInputClass = "w-full rounded-none border-0 border-b border-white/25 bg-transparent px-0 py-2.5 text-base text-[#f5f0de] outline-none transition placeholder:text-white/25 focus:border-[#ff7a1a] focus:ring-0";
export const authLabelClass = "block text-sm font-semibold text-[#f5f0de]";

export default function AuthShell({ mode, children }: { mode: "login" | "signup" | "forgot"; children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-[#ff7a1a] text-[#f5f0de] min-[540px]:bg-black">
      <div className="mx-auto flex min-h-dvh w-full max-w-[32rem] flex-col overflow-hidden bg-[#ff7a1a] min-[540px]:max-w-none min-[540px]:bg-black lg:grid lg:grid-cols-[43%_57%]">
        <div className="relative hidden min-h-full overflow-hidden bg-black lg:block">
          <Image src="https://image.tmdb.org/t/p/w1280/gknAq4pAuToh1Aq5CJfVkGQkExT.jpg" alt="Dune: Part Three poster" fill sizes="43vw" className="object-cover object-center" priority />
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/25 via-transparent to-black/35" />
          <nav aria-label="Account" className="absolute -right-px top-1/2 z-10 flex w-40 -translate-y-1/2 flex-col gap-2 text-sm font-bold uppercase tracking-wide">
            <Link href="/auth/signup" aria-current={mode === "signup" ? "page" : undefined} className={`rounded-l-full px-7 py-4 transition ${mode === "signup" ? "bg-black text-[#ff7a1a]" : "bg-black/60 text-[#f5f0de] hover:bg-black/80"}`}>Sign up</Link>
            <Link href="/auth/login" aria-current={mode === "login" ? "page" : undefined} className={`rounded-l-full px-7 py-4 transition ${mode === "login" ? "bg-black text-[#ff7a1a]" : "bg-black/60 text-[#f5f0de] hover:bg-black/80"}`}>Login</Link>
          </nav>
        </div>
        <figure className="flex h-44 shrink-0 flex-col items-center justify-center px-3 pb-5 text-center text-[#0b0b0b] min-[540px]:hidden">
          <blockquote className="whitespace-nowrap text-[clamp(12px,4.4vw,24px)] font-bold leading-tight" style={{ fontFamily: '"Snell Roundhand", "Apple Chancery", "Brush Script MT", cursive' }}>
            “This is the beginning of a beautiful friendship.”
          </blockquote>
          <figcaption className="mt-2 text-xs font-semibold tracking-wide text-[#0b0b0b]/75">
            Casablanca · 1942
          </figcaption>
        </figure>

        <div className="relative -mt-5 flex flex-1 flex-col rounded-t-[2rem] bg-[#0b0b0b] px-7 pb-10 pt-8 min-[540px]:mt-0 min-[540px]:rounded-none min-[540px]:bg-black min-[540px]:px-12 min-[540px]:pt-10 lg:px-[clamp(2.5rem,6vw,8rem)]">
          <div className="mb-7 flex items-center justify-center gap-2 text-[1.75rem] font-black tracking-tight text-[#f5f0de] lg:mb-0 lg:gap-3 lg:text-4xl">
            <Image src="/logo-ui.webp" alt="" width={64} height={64} className="h-12 w-12 object-contain lg:h-16 lg:w-16" priority />
            <span>Canisterr</span>
          </div>
          <nav aria-label="Account" className="grid grid-cols-2 rounded-full border border-white/15 bg-[#1c1c1c] p-1 text-center text-sm font-semibold lg:hidden">
            <Link href="/auth/login" aria-current={mode === "login" ? "page" : undefined} className={`rounded-full px-4 py-2.5 transition ${mode === "login" ? "bg-[#f5f0de] text-[#0b0b0b]" : "text-white/65 hover:text-white"}`}>
              Login
            </Link>
            <Link href="/auth/signup" aria-current={mode === "signup" ? "page" : undefined} className={`rounded-full px-4 py-2.5 transition ${mode === "signup" ? "bg-[#f5f0de] text-[#0b0b0b]" : "text-white/65 hover:text-white"}`}>
              Sign up
            </Link>
          </nav>

          <div className="flex flex-1 flex-col justify-center py-8 lg:py-2">{children}</div>
        </div>
      </div>
    </main>
  );
}
