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
      description="Your photo and public details."
    >
      {!user ? null : (
        <div>
          <SettingsGroup>
            <div className="flex items-center gap-3 border-b border-white/10 px-4 py-4 sm:px-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#242424] text-base font-bold text-[#f5f0de]">
                {user.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img loading="lazy" src={user.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-[#f5f0de]">{user.name}</p>
                <p className="text-sm text-white/45">@{user.username}</p>
              </div>
            </div>

            <SettingLine icon={Camera} title="Profile picture" description="Change your photo and crop.">
              <Link href="/profile/edit" className="rounded-md border border-white/15 bg-transparent px-3 py-1.5 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/[0.08]">
                Edit avatar
              </Link>
            </SettingLine>

            <SettingLine icon={UserRoundCog} title="Name and bio" description="Edit your public details.">
              <Link href="/profile/edit" className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-[#f5f0de] transition hover:border-[#ff7a1a]/60">
                Edit
              </Link>
            </SettingLine>

            <SettingLine icon={PencilLine} title="Public profile" description="See how your profile looks.">
              <Link href={`/profile/${user.username}`} className="rounded-md border border-white/15 bg-transparent px-3 py-1.5 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/[0.08]">
                View profile
              </Link>
            </SettingLine>
          </SettingsGroup>
        </div>
      )}
    </SettingsPageFrame>
  );
}
