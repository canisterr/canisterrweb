"use client";

import Link from "next/link";
import { ChevronRight, UserRoundCog, Upload, Shield, Bell, Users, KeyRound, LifeBuoy, UserCircle2 } from "lucide-react";
import SettingsPageFrame from "@/components/SettingsPageFrame";
import { useSettingsUser } from "./settings-shared";

const sections = [
  { href: "/profile/settings/profile", icon: UserRoundCog, title: "Profile", desc: "Photo, name, username and bio.", color: "bg-[#0a84ff]" },
  { href: "/profile/settings/import", icon: Upload, title: "Import", desc: "Letterboxd CSV and data export.", color: "bg-[#30b0c7]" },
  { href: "/profile/settings/privacy", icon: Shield, title: "Privacy", desc: "Profile, list and log visibility.", color: "bg-[#34c759]" },
  { href: "/profile/settings/notifications", icon: Bell, title: "Notifications", desc: "Follow, comment and email alerts.", color: "bg-[#ff9500]" },
  { href: "/profile/settings/social", icon: Users, title: "Social", desc: "Blocked users and collaborations.", color: "bg-[#af52de]" },
  { href: "/profile/settings/account", icon: KeyRound, title: "Account", desc: "Password, deactivate and delete profile.", color: "bg-[#ff3b30]" },
  { href: "mailto:support@canisterr.com", icon: LifeBuoy, title: "Support", desc: "Help, bug reports and contact.", color: "bg-[#5e5ce6]" },
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
      description="Manage your profile, privacy, alerts and account details."
      backHref="/profile"
    >
      <div className="space-y-8">
        <section className="rounded-[2rem] border border-white/10 bg-[#151515] p-4 shadow-[0_24px_90px_rgba(0,0,0,0.28)] sm:p-5">
          <div className="flex items-center gap-4 rounded-[1.6rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] px-4 py-4 sm:px-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-[#f5f0de] text-[#0a0a0a] shadow-[inset_0_1px_1px_rgba(255,255,255,0.65)]">
              <UserCircle2 className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-semibold text-[#f5f0de]">{user?.name || "User"}</p>
              <p className="truncate text-sm text-white/48">@{user?.username || "user"}</p>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-[1.6rem] border border-white/8 bg-[#0f0f0f]">
            {sections.map((section, index) => {
              const content = (
                <>
                  <span className={`flex h-10 w-10 items-center justify-center rounded-[0.95rem] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.22)] ${section.color}`}>
                    <section.icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-[#f5f0de]">{section.title}</span>
                    <span className="mt-0.5 block text-xs text-white/45">{section.desc}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-white/25" />
                </>
              );

              const className = `flex items-center gap-3 px-4 py-3.5 transition hover:bg-white/[0.04] sm:px-5 ${index !== sections.length - 1 ? "border-b border-white/7" : ""}`;

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
          <p className="mb-3 px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-white/34">More</p>
          <div className="overflow-hidden rounded-[1.6rem] border border-white/8 bg-[#151515] shadow-[0_20px_70px_rgba(0,0,0,0.24)]">
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
        </section>
      </div>
    </SettingsPageFrame>
  );
}
