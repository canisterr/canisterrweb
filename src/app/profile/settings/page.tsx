"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import SettingsPageFrame from "@/components/SettingsPageFrame";
import { useSettingsUser } from "./settings-shared";

const sections = [
  { href: "/profile/settings/import", title: "Import", desc: "Letterboxd CSV and data export." },
  { href: "/profile/settings/privacy", title: "Privacy", desc: "Profile, list and log visibility." },
  { href: "/profile/settings/notifications", title: "Notifications", desc: "Follow, comment and email alerts." },
  { href: "/profile/settings/social", title: "Social", desc: "Blocked users and collaborations." },
  { href: "/profile/settings/account", title: "Account", desc: "Password and account access." },
  { href: "mailto:support@canisterr.com", title: "Support", desc: "Help and contact." },
];

const legalLinks = [
  { href: "/terms", label: "Terms and Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/credits", label: "Credits" },
  {
    href: "https://docs.google.com/forms/d/e/1FAIpQLSf7nTphksaZ23GKZGo8VnzI14EKaeiQ7T7cdtAdqoOFCeRqgQ/viewform?usp=publish-editor",
    label: "Feedback",
    external: true,
  },
];

export default function ProfileSettingsIndexPage() {
  const { user, loading, handleSignOut } = useSettingsUser();

  return (
    <SettingsPageFrame
      user={user}
      loading={loading}
      onSignOut={handleSignOut}
      title="Settings"
      description="Privacy, alerts and account details."
      backHref="/profile"
    >
      <div className="space-y-5">
        <section className="rounded-xl border border-white/10 bg-[#111] p-3 sm:p-4">
          <div className="flex items-center gap-4 px-2 py-2 sm:px-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#242424] text-[#f5f0de]">
              {user?.avatar_url ? <img src={user.avatar_url} alt="" className="h-full w-full object-cover" /> : user?.name?.charAt(0).toUpperCase() || "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold text-[#f5f0de]">{user?.name || "User"}</p>
              <p className="truncate text-sm text-white/48">@{user?.username || "user"}</p>
            </div>
          </div>

          <div className="mt-3 overflow-hidden rounded-lg border border-white/10 bg-black/30">
            {sections.map((section, index) => {
              const content = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-[#f5f0de]">{section.title}</span>
                    <span className="mt-0.5 block text-xs text-white/45">{section.desc}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-white/25" />
                </>
              );

              const className = `flex items-center gap-3 px-3 py-3 transition hover:bg-white/[0.04] sm:px-4 ${index !== sections.length - 1 ? "border-b border-white/7" : ""}`;

              return section.href.startsWith("mailto:") ? (
                <a key={section.title} href={section.href} className={className}>
                  {content}
                </a>
              ) : (
                <Link key={section.href} href={section.href} className={className}>
                  {content}
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <p className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#ff9b52]">More</p>
          <div className="overflow-hidden rounded-xl border border-white/10 bg-[#111]">
            {legalLinks.map((link, index) =>
              link.external ? (
                <a
                  key={link.href}
                  href={link.href}
                  target="_blank"
                  rel="noreferrer noopener"
                  className={`flex items-center justify-between px-5 py-4 text-sm font-medium text-[#f5f0de] transition hover:bg-white/[0.04] ${
                    index !== legalLinks.length - 1 ? "border-b border-white/7" : ""
                  }`}
                >
                  <span>{link.label}</span>
                  <ChevronRight className="h-4 w-4 text-white/25" />
                </a>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center justify-between px-5 py-4 text-sm font-medium text-[#f5f0de] transition hover:bg-white/[0.04] ${
                    index !== legalLinks.length - 1 ? "border-b border-white/7" : ""
                  }`}
                >
                  <span>{link.label}</span>
                  <ChevronRight className="h-4 w-4 text-white/25" />
                </Link>
              )
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              void handleSignOut();
            }}
            className="mt-3 flex h-14 w-full items-center justify-center rounded-xl border border-white/15 bg-[#111] text-base font-semibold text-[#f5f0de] transition hover:border-[#ff7a1a]/50 hover:bg-[#1a1511]"
          >
            Sign out
          </button>
        </section>
      </div>
    </SettingsPageFrame>
  );
}
