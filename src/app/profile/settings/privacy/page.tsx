"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import SettingsPageFrame from "@/components/SettingsPageFrame";
import { getAnalyticsConsent, setAnalyticsConsent, type AnalyticsConsentChoice } from "@/lib/analytics-consent";
import { useSettingsUser } from "../settings-shared";
import { SettingLine, SettingsGroup } from "../settings-ui";

const selectClass =
  "max-w-28 rounded-md border border-white/15 bg-[#191919] px-2 py-1.5 text-xs font-semibold text-[#f5f0de] outline-none transition focus:border-[#ff7a1a]";

export default function SettingsPrivacyPage() {
  const { user, loading, settings, updateSection, handleSignOut } = useSettingsUser();
  const analyticsChoice = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("canisterr-analytics-consent-change", onChange);
      return () => window.removeEventListener("canisterr-analytics-consent-change", onChange);
    },
    getAnalyticsConsent,
    () => null,
  );

  function chooseAnalytics(choice: AnalyticsConsentChoice) {
    setAnalyticsConsent(choice);
  }

  return (
    <SettingsPageFrame
      user={user}
      loading={loading}
      onSignOut={handleSignOut}
      title="Privacy"
      description="Profile, list and log visibility in a few small controls."
    >
      <SettingsGroup>
        <SettingLine title="Optional analytics" description="Analytics stay off until you allow them. You can change this choice at any time on this device.">
          <div className="flex flex-col items-end gap-2">
            <span className="text-xs text-white/55">{analyticsChoice === "accepted" ? "Allowed" : analyticsChoice === "rejected" ? "Rejected" : "No choice yet"}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => chooseAnalytics("accepted")} className="rounded-md border border-[#ff7a1a]/60 px-3 py-1.5 text-xs font-semibold text-[#ffb36b]">Allow</button>
              <button type="button" onClick={() => chooseAnalytics("rejected")} className="rounded-md border border-white/15 px-3 py-1.5 text-xs font-semibold text-white/70">Turn off</button>
            </div>
          </div>
        </SettingLine>
        <SettingLine title="Profile visibility" description="Who can open your profile page.">
          <select
            className={selectClass}
            value={settings.privacy.profileVisibility}
            onChange={(event) => void updateSection("privacy", { profileVisibility: event.target.value as any })}
          >
            <option value="public">Public</option>
            <option value="followers">Followers</option>
            <option value="private">Private</option>
          </select>
        </SettingLine>

        <SettingLine title="Who can follow you" description="Who can follow your profile.">
          <select
            className={selectClass}
            value={settings.privacy.followRequests}
            onChange={(event) => void updateSection("privacy", { followRequests: event.target.value as any })}
          >
            <option value="everyone">Everyone</option>
            <option value="followers">Followers</option>
            <option value="nobody">Nobody</option>
          </select>
        </SettingLine>

        <SettingLine title="Lists visibility" description="Who can see your public lists and collection pages.">
          <select
            className={selectClass}
            value={settings.privacy.listVisibility}
            onChange={(event) => void updateSection("privacy", { listVisibility: event.target.value as any })}
          >
            <option value="public">Public</option>
            <option value="followers">Followers</option>
            <option value="private">Private</option>
          </select>
        </SettingLine>

        <SettingLine title="Logs visibility" description="Who can see your watched logs and activity.">
          <select
            className={selectClass}
            value={settings.privacy.logVisibility}
            onChange={(event) => void updateSection("privacy", { logVisibility: event.target.value as any })}
          >
            <option value="public">Public</option>
            <option value="followers">Followers</option>
            <option value="private">Private</option>
          </select>
        </SettingLine>

        <SettingLine title="Activity visibility" description="Who can see the activity style surfaces on your profile.">
          <select
            className={selectClass}
            value={settings.privacy.activityVisibility}
            onChange={(event) => void updateSection("privacy", { activityVisibility: event.target.value as any })}
          >
            <option value="public">Public</option>
            <option value="followers">Followers</option>
            <option value="private">Private</option>
          </select>
        </SettingLine>
      </SettingsGroup>

      <SettingsGroup title="Legal">
        <SettingLine title="Privacy Policy" description="Read how Canisterr uses and protects account information.">
          <Link href="/privacy" className="text-sm font-semibold text-[#ffb36b] underline underline-offset-4">Read policy</Link>
        </SettingLine>
        <SettingLine title="Terms & Conditions" description="Review the rules for using Canisterr.">
          <Link href="/terms" className="text-sm font-semibold text-[#ffb36b] underline underline-offset-4">Read terms</Link>
        </SettingLine>
      </SettingsGroup>
    </SettingsPageFrame>
  );
}
