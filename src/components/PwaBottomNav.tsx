"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, Compass, Ellipsis, Home, LibraryBig, Share2, ShoppingBag } from "lucide-react";
import { useIsPwa } from "@/lib/pwa";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Home;
  exact?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",     label: "Home",    icon: Home,        exact: false },
  { href: "/share",         label: "Share",   icon: Share2,      exact: false },
  { href: "/logs",          label: "Log",     icon: Clapperboard, exact: false },
  { href: "/lists",         label: "Lists",   icon: LibraryBig,  exact: false },
];

const MORE_ITEMS: NavItem[] = [
  { href: "/discover", label: "Discover", icon: Compass, exact: false },
  { href: "/store", label: "Store", icon: ShoppingBag, exact: false },
];

function isActivePath(pathname: string, href: string, exact?: boolean): boolean {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function PwaBottomNav() {
  const pathname = usePathname();
  const isPwa = useIsPwa();
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const isAuthRoute = pathname.startsWith("/auth");
  const isScanRoute = pathname.startsWith("/scan");
  // The store is a full-viewport immersive takeover with its own minimal chrome.
  const isStoreRoute = pathname.startsWith("/store");
  const moreMenuActive = MORE_ITEMS.some(({ href, exact }) => isActivePath(pathname, href, exact));

  useEffect(() => {
    if (!showMoreMenu) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (moreMenuRef.current?.contains(target)) return;
      setShowMoreMenu(false);
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowMoreMenu(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [showMoreMenu]);

  if (!isPwa || isAuthRoute || isScanRoute || isStoreRoute) {
    return null;
  }

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1.1rem)] z-40 px-3 sm:px-4 lg:hidden"
      aria-label="Bottom navigation"
    >
      <div className="pointer-events-auto mx-auto w-full max-w-md">
        <div
          ref={moreMenuRef}
          className="relative"
        >
          {showMoreMenu && (
            <div className="absolute bottom-[calc(100%+0.8rem)] right-2 w-56 overflow-hidden rounded-[28px] border border-[#ff7a1a]/28 bg-[linear-gradient(180deg,rgba(18,18,18,0.96),rgba(8,8,8,0.98))] p-2 shadow-[0_24px_54px_rgba(0,0,0,0.52),0_0_22px_rgba(255,122,26,0.12)] backdrop-blur-2xl">
              <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/42">
                More
              </p>
              <div className="space-y-1">
                {MORE_ITEMS.map(({ href, label, icon: Icon, exact }) => {
                  const active = isActivePath(pathname, href, exact);

                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setShowMoreMenu(false)}
                      aria-current={active ? "page" : undefined}
                      className="flex items-center gap-3 rounded-[20px] px-3 py-3 transition hover:bg-white/[0.06]"
                    >
                      <span className={`flex h-10 w-10 items-center justify-center rounded-2xl border ${
                        active
                          ? "border-[#ff7a1a]/60 bg-[#ff7a1a]/14 text-[#ff7a1a]"
                          : "border-white/10 bg-white/[0.04] text-white/65"
                      }`}>
                        <Icon className="h-5 w-5" strokeWidth={1.8} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${
                          active ? "font-semibold text-[#ff7a1a]" : "font-medium text-[#f5f0de]"
                        }`}>
                          {label}
                        </span>
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

        <div className="grid min-h-[4.7rem] grid-cols-5 items-stretch rounded-[32px] border border-[#ff7a1a]/35 bg-[linear-gradient(180deg,rgba(20,20,20,0.88),rgba(8,8,8,0.92))] px-1.5 py-1 shadow-[0_20px_44px_rgba(0,0,0,0.42),0_0_0_1px_rgba(255,122,26,0.06),0_0_24px_rgba(255,122,26,0.14)] backdrop-blur-2xl supports-[backdrop-filter]:bg-[linear-gradient(180deg,rgba(22,22,22,0.74),rgba(8,8,8,0.82))]">
          {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
            const active = isActivePath(pathname, href, exact);

            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={label}
                className="group relative flex min-h-[4rem] flex-col items-center justify-center gap-1 rounded-[26px] px-1 pt-1.5 pb-1.5 text-center transition-transform duration-200 active:scale-[0.97]"
              >
                <span
                  className={`absolute inset-x-2 top-1 h-px rounded-full transition-opacity duration-200 ${
                    active ? "bg-[#ff7a1a]/40 opacity-100" : "bg-transparent opacity-0"
                  }`}
                />
                <Icon
                  className={`h-[18px] w-[18px] transition-colors duration-200 ${
                    active ? "text-[#ff7a1a]" : "text-white/55 group-hover:text-white/72"
                  }`}
                  strokeWidth={1.8}
                />
                <span
                  className={`text-[10px] leading-none tracking-[0.01em] transition-colors duration-200 ${
                    active ? "font-medium text-[#ff7a1a]" : "font-normal text-white/58 group-hover:text-white/74"
                  }`}
                >
                  {label}
                </span>
                <span
                  className={`absolute bottom-0.5 h-1.5 w-1.5 rounded-full bg-[#ff7a1a] shadow-[0_0_10px_rgba(255,122,26,0.8)] transition-all duration-200 ${
                    active ? "scale-100 opacity-100" : "scale-50 opacity-0"
                  }`}
                />
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setShowMoreMenu((current) => !current)}
            aria-expanded={showMoreMenu}
            aria-label="More"
            className="group relative flex min-h-[4rem] flex-col items-center justify-center gap-1 rounded-[26px] px-1 pt-1.5 pb-1.5 text-center transition-transform duration-200 active:scale-[0.97]"
          >
            <span
              className={`absolute inset-x-2 top-1 h-px rounded-full transition-opacity duration-200 ${
                moreMenuActive || showMoreMenu ? "bg-[#ff7a1a]/40 opacity-100" : "bg-transparent opacity-0"
              }`}
            />
            <Ellipsis
              className={`h-[18px] w-[18px] transition-colors duration-200 ${
                moreMenuActive || showMoreMenu ? "text-[#ff7a1a]" : "text-white/55 group-hover:text-white/72"
              }`}
              strokeWidth={1.8}
            />
            <span
              className={`text-[10px] leading-none tracking-[0.01em] transition-colors duration-200 ${
                moreMenuActive || showMoreMenu ? "font-medium text-[#ff7a1a]" : "font-normal text-white/58 group-hover:text-white/74"
              }`}
            >
              More
            </span>
            <span
              className={`absolute bottom-0.5 h-1.5 w-1.5 rounded-full bg-[#ff7a1a] shadow-[0_0_10px_rgba(255,122,26,0.8)] transition-all duration-200 ${
                moreMenuActive || showMoreMenu ? "scale-100 opacity-100" : "scale-50 opacity-0"
              }`}
            />
          </button>
        </div>
        </div>
      </div>
    </nav>
  );
}
