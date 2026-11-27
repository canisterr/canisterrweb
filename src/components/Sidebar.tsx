"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "@/components/AppImage";
import { usePathname } from "next/navigation";
import type { User } from "@/types";
import { ChevronRight, Clapperboard, Gamepad2, House, LibraryBig, Send, X } from "lucide-react";

interface SidebarProps {
  user: User | null;
  onSignOut?: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
  theme?: "default" | "brutalist";
}

export default function Sidebar({
  user,
  onSignOut,
  mobileOpen = false,
  onCloseMobile,
  theme = "default",
}: SidebarProps) {
  const pathname = usePathname();
  const isBrutalist = theme === "brutalist";
  const [showInstallHelp, setShowInstallHelp] = useState(false);

  const isActive = (path: string) => pathname.startsWith(path);

  const handleInstallClick = () => {
    setShowInstallHelp(true);
  };

  const handleSignOutClick = () => {
    void onSignOut?.();
    if (typeof window !== "undefined") {
      window.location.assign("/auth/login");
    }
  };

  const navItems = [
    { href: "/dashboard", label: "Home", icon: House },
    { href: "/games", label: "Games", icon: Gamepad2 },
    { href: "/lists", label: "Lists", icon: LibraryBig },
    { href: "/share?panel=share", label: "Recommend", icon: Send },
    { href: "/logs", label: "Log", icon: Clapperboard },
  ];

  // Sidebar classes for mobile/desktop
  const sidebarBase = isBrutalist
    ? "flex h-dvh w-[min(18rem,85vw)] flex-col border-r border-white/10 bg-[#0a0a0a]/95 text-[#f5f0de] backdrop-blur z-50 transition-transform duration-300 lg:fixed lg:left-0 lg:top-0 lg:h-dvh lg:w-72"
    : "flex h-dvh w-[min(18rem,85vw)] flex-col border-r border-slate-200/80 bg-white/95 backdrop-blur z-50 transition-transform duration-300 lg:fixed lg:left-0 lg:top-0 lg:h-dvh lg:w-72";
  const sidebarMobile = mobileOpen
    ? "fixed left-0 top-0 translate-x-0 lg:translate-x-0 lg:pointer-events-auto"
    : "fixed left-0 top-0 -translate-x-full pointer-events-none lg:translate-x-0 lg:pointer-events-auto";

  return (
    <div className={`${sidebarBase} ${sidebarMobile} min-w-0`}>
      <div className="flex min-h-20 items-center gap-2 px-4 py-3">
        {user ? (
          <Link
            href={user.username ? `/profile/${encodeURIComponent(user.username)}` : "/profile"}
            onClick={onCloseMobile}
            className="group flex min-w-0 flex-1 items-center gap-3"
            aria-label={`Open ${user.name}'s profile`}
          >
            <span className={`relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border text-sm font-bold ${isBrutalist ? "border-white/15 bg-[#1a1a1a] text-[#f5f0de]" : "border-slate-200 bg-slate-100 text-slate-900"}`}>
              {user.avatar_url ? <Image src={user.avatar_url} alt="" fill sizes="44px" className="object-cover" unoptimized /> : user.name?.charAt(0)?.toUpperCase() || "U"}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-base font-semibold leading-tight ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>{user.name}</span>
              <span className={`mt-0.5 block truncate text-xs ${isBrutalist ? "text-white/45" : "text-slate-500"}`}><span className="lg:hidden">@{user.username}</span><span className="hidden lg:inline">View profile</span></span>
            </span>
            <ChevronRight className={`h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 ${isBrutalist ? "text-white/35" : "text-slate-400"}`} />
          </Link>
        ) : <span className={`flex-1 text-sm font-semibold ${isBrutalist ? "text-[#f5f0de]" : "text-slate-900"}`}>Menu</span>}
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close menu"
          className={`ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition lg:hidden ${isBrutalist ? "text-white/55 hover:bg-white/10 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}
        >
          <X className="h-5 w-5" strokeWidth={1.8} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-2 p-5 lg:pt-5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onCloseMobile}
              className={`flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive(item.href)
                  ? isBrutalist
                    ? "bg-[#f5f0de] text-[#0a0a0a] shadow-sm"
                    : "bg-slate-900 text-white shadow-sm"
                  : isBrutalist
                    ? "text-[#f5f0de] hover:bg-white/5"
                    : "text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {user && (
        <div className="border-t border-slate-200/80 p-5">
          <button
            type="button"
            onClick={handleInstallClick}
            className={`mb-3 w-full rounded-full border px-4 py-2.5 text-sm font-medium shadow-sm transition ${
              isBrutalist
                ? "border-[#ff7a1a]/30 bg-[#ff7a1a] text-[#0a0a0a] hover:bg-[#ff8d3b]"
                : "border-[#ff7a1a]/30 bg-[#ff7a1a] text-black hover:bg-[#ff8d3b]"
            }`}
          >
            Download app
          </button>
          <button
            onClick={handleSignOutClick}
            className={`w-full rounded-full border px-4 py-2.5 text-sm font-medium shadow-sm transition ${
              isBrutalist
                ? "border-white/10 bg-[#161616] text-[#f5f0de] hover:bg-white/5"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Sign Out
          </button>
        </div>
      )}

      {showInstallHelp && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4 py-6 backdrop-blur-sm">
          <div className={`w-full max-w-md rounded-[1.5rem] border p-5 shadow-2xl ${
            isBrutalist ? "border-white/10 bg-[#111111] text-[#f5f0de]" : "border-slate-200 bg-white text-slate-900"
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.28em] text-[#ffb36b]">Install app</p>
                <h2 className="mt-2 text-2xl font-black">Add Canisterr to Home Screen</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowInstallHelp(false)}
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  isBrutalist ? "bg-white/5 text-[#f5f0de] hover:bg-white/10" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm leading-6">
              <p className={isBrutalist ? "text-[#f5f0de]/70" : "text-slate-600"}>
                Use the browser menu and choose the install or add-to-home-screen option.
              </p>

              <ol className="space-y-2 pl-5">
                <li>Open Canisterr in your browser.</li>
                <li>Tap the browser menu.</li>
                <li>Choose <span className="font-semibold text-[#ffb36b]">Add to Home Screen</span> or <span className="font-semibold text-[#ffb36b]">Install app</span>.</li>
                <li>Confirm the install.</li>
              </ol>

              <p className={isBrutalist ? "text-[#f5f0de]/60" : "text-slate-500"}>
                On iPhone: tap Share, then Add to Home Screen. On Android: tap the menu, then Install app.
              </p>
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => setShowInstallHelp(false)}
                className="rounded-full bg-[#ff7a1a] px-4 py-2.5 text-sm font-black text-black transition hover:bg-[#ff8d3b]"
              >
                Got it
              </button>
              <button
                type="button"
                onClick={() => setShowInstallHelp(false)}
                className={`rounded-full border px-4 py-2.5 text-sm font-semibold ${
                  isBrutalist ? "border-white/10 bg-white/5 text-[#f5f0de] hover:bg-white/10" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
