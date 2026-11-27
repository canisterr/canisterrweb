"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import SettingsPageFrame from "@/components/SettingsPageFrame";
import { useSettingsUser, normalizeUsername } from "../settings-shared";
import { SettingLine, CompactToggle, SettingsGroup } from "../settings-ui";

export default function SettingsSocialPage() {
  const { user, loading, settings, updateSection, handleSignOut } = useSettingsUser();
  const [blockedUserInput, setBlockedUserInput] = useState("");

  const addBlockedUser = async () => {
    const username = normalizeUsername(blockedUserInput);
    if (!username) return;
    if (settings.social.blockedUsers.includes(username)) {
      setBlockedUserInput("");
      return;
    }
    await updateSection("social", { blockedUsers: [...settings.social.blockedUsers, username] });
    setBlockedUserInput("");
  };

  const removeBlockedUser = async (username: string) => {
    await updateSection("social", {
      blockedUsers: settings.social.blockedUsers.filter((entry) => entry !== username),
    });
  };

  return (
    <SettingsPageFrame
      user={user}
      loading={loading}
      onSignOut={handleSignOut}
      title="Social"
      description="A few switches and a tiny blocklist."
    >
      <div className="space-y-5">
        <SettingsGroup>
        <SettingLine title="Share lists publicly" description="Let public lists appear in discovery and profiles.">
          <CompactToggle
            checked={settings.social.shareListsPublicly}
            onChange={(next) => void updateSection("social", { shareListsPublicly: next })}
            label={settings.social.shareListsPublicly ? "On" : "Off"}
          />
        </SettingLine>

        <SettingLine title="Show shared movies" description="Keep the shared movies tab visible on your profile.">
          <CompactToggle
            checked={settings.social.showSharedMovies}
            onChange={(next) => void updateSection("social", { showSharedMovies: next })}
            label={settings.social.showSharedMovies ? "On" : "Off"}
          />
        </SettingLine>

        <SettingLine title="Allow collaborations" description="Let people add you to list collaboration projects.">
          <CompactToggle
            checked={settings.social.allowCollaborations}
            onChange={(next) => void updateSection("social", { allowCollaborations: next })}
            label={settings.social.allowCollaborations ? "On" : "Off"}
          />
        </SettingLine>
        </SettingsGroup>

        <SettingsGroup title="Blocked users">
          <SettingLine title="Blocked users" description="Accounts you do not want to see." stacked>
            <div className="">
              {settings.social.blockedUsers.length > 0 && <div className="mb-3 flex flex-wrap gap-2">
                {settings.social.blockedUsers.map((username) => (
                  <span key={username} className="inline-flex items-center gap-2 rounded-md border border-white/15 px-2.5 py-1 text-xs text-[#f5f0de]">
                    @{username}
                    <button type="button" onClick={() => void removeBlockedUser(username)} className="text-white/45 transition hover:text-red-400" aria-label={`Remove ${username}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>}
              <div className="flex gap-2">
                <input
                  value={blockedUserInput}
                  onChange={(event) => setBlockedUserInput(event.target.value)}
                  placeholder="Username"
                  aria-label="Username to block"
                  className="min-w-0 flex-1 rounded-md border border-white/15 bg-[#191919] px-3 py-2 text-xs text-[#f5f0de] outline-none transition focus:border-[#ff7a1a]"
                />
                <button type="button" onClick={() => void addBlockedUser()} className="rounded-md bg-[#ff7a1a] px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-[#ff8d3b]">
                  Add
                </button>
              </div>
            </div>
          </SettingLine>
        </SettingsGroup>
      </div>
    </SettingsPageFrame>
  );
}
