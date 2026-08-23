"use client";

import Link from "next/link";
import { Camera, PencilLine, UserRoundCog } from "lucide-react";
import SettingsPageFrame from "@/components/SettingsPageFrame";
import { useSettingsUser } from "../settings-shared";
import { SettingLine, SettingsGroup } from "../settings-ui";

export default function SettingsProfilePage() {
  const { user, loading, handleSignOut } = useSettingsUser();

  return (
    <SettingsPageFrame
      user={user}
      loading={loading}
      onSignOut={handleSignOut}
      title="Profile"
      description="Photo, name, username and bio. Keep it quick, small and easy to edit."
    >
      {!user ? null : (
        <div className="space-y-8">
          <SettingsGroup>
            <div className="flex items-center gap-4 border-b border-white/7 px-4 py-4 sm:px-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f0de] text-base font-bold text-[#0a0a0a]">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-[#f5f0de]">{user.name}</p>
                <p className="text-sm text-white/45">@{user.username}</p>
              </div>
            </div>

            <SettingLine icon={Camera} title="Profile picture" description="Change your avatar from the profile editor.">
              <Link href="/profile/edit" className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/[0.08]">
                Edit avatar
              </Link>
            </SettingLine>

            <SettingLine icon={UserRoundCog} title="Name, username and bio" description="Update your identity and short bio in one place.">
              <Link href="/profile/edit" className="rounded-full bg-[#0a84ff] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#2994ff]">
                Open editor
              </Link>
            </SettingLine>

            <SettingLine icon={PencilLine} title="Public profile" description="See the profile your followers view.">
              <Link href={`/profile/${user.username}`} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/[0.08]">
                View profile
              </Link>
            </SettingLine>
          </SettingsGroup>
        </div>
      )}
    </SettingsPageFrame>
  );
}
