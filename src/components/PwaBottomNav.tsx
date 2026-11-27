"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, Home, LibraryBig, Share2 } from "lucide-react";
import { useIsPwa } from "@/lib/pwa";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/share", label: "Share", icon: Share2 },
  { href: "/logs", label: "Log", icon: Clapperboard },
  { href: "/lists", label: "Lists", icon: LibraryBig },
];

export default function PwaBottomNav() {
  const pathname = usePathname();
  const isPwa = useIsPwa();

  if (!isPwa || pathname.startsWith("/auth") || pathname.startsWith("/scan")) {
    return null;
  }

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1.1rem)] z-40 px-3 sm:px-4 lg:hidden"
      aria-label="Bottom navigation"
    >
      <div className="pointer-events-auto mx-auto w-full max-w-md">
        <div className="grid min-h-[3.9rem] grid-cols-4 items-stretch rounded-[28px] border border-[#ff7a1a]/35 bg-[linear-gradient(180deg,rgba(20,20,20,0.88),rgba(8,8,8,0.92))] px-1 py-0.5 shadow-[0_20px_44px_rgba(0,0,0,0.42),0_0_0_1px_rgba(255,122,26,0.06),0_0_24px_rgba(255,122,26,0.14)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[linear-gradient(180deg,rgba(22,22,22,0.74),rgba(8,8,8,0.82))]">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className="group relative flex min-h-[3.4rem] flex-col items-center justify-center gap-1 rounded-[22px] px-1 py-1 text-center transition-transform duration-200 active:scale-[0.97]"
              >
                <span className={`absolute inset-x-2 top-1 h-px rounded-full transition-opacity duration-200 ${active ? "bg-[#ff7a1a]/40 opacity-100" : "bg-transparent opacity-0"}`} />
                <Icon className={`h-[18px] w-[18px] transition-colors duration-200 ${active ? "text-[#ff7a1a]" : "text-white/55 group-hover:text-white/72"}`} strokeWidth={1.8} />
                <span className={`text-[10px] leading-none tracking-[0.01em] transition-colors duration-200 ${active ? "font-medium text-[#ff7a1a]" : "font-normal text-white/58 group-hover:text-white/74"}`}>{label}</span>
                <span className={`absolute bottom-0.5 h-1.5 w-1.5 rounded-full bg-[#ff7a1a] shadow-[0_0_10px_rgba(255,122,26,0.8)] transition-all duration-200 ${active ? "scale-100 opacity-100" : "scale-50 opacity-0"}`} />
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
