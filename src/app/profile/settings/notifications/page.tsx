"use client";

import { useEffect, useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import SettingsPageFrame from "@/components/SettingsPageFrame";
import { useSettingsUser } from "../settings-shared";
import { SettingLine, CompactToggle, SettingsGroup, SettingsMessage } from "../settings-ui";
import {
  disablePushNotificationsForUser,
  enablePushNotificationsForUser,
  getPushEnrollmentState,
  sendTestPushNotification,
  type PushEnrollmentState,
} from "@/lib/push-notifications";

export default function SettingsNotificationsPage() {
  const { user, loading, settings, updateSection, handleSignOut } = useSettingsUser();
  const [pushState, setPushState] = useState<PushEnrollmentState>({
    supported: false,
    permission: "unsupported",
    enabled: false,
  });
  const [pushBusy, setPushBusy] = useState(false);
  const [pushTestBusy, setPushTestBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const next = await getPushEnrollmentState();
      if (!cancelled) {
        setPushState(next);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const refreshPushState = async () => {
    setPushState(await getPushEnrollmentState());
  };

  const handlePushToggle = async () => {
    if (!user || pushBusy) return;

    setPushBusy(true);
    setPushMessage("");

    try {
      if (pushState.enabled) {
        await disablePushNotificationsForUser(user.id);
        await updateSection("notifications", { pushNotifications: false });
        setPushMessage("Push notifications disabled on this device.");
      } else {
        const result = await enablePushNotificationsForUser(user.id);
        if (!result.ok) {
          setPushMessage(result.message);
          return;
        }

        await updateSection("notifications", { pushNotifications: true });
        setPushMessage("Push notifications enabled on this device.");
      }

      await refreshPushState();
    } catch (error) {
      console.error("Error updating push notifications:", error);
      setPushMessage("Could not update push notifications right now.");
    } finally {
      setPushBusy(false);
    }
  };

  const handlePushTest = async () => {
    if (!user || pushTestBusy) return;

    setPushTestBusy(true);
    setPushMessage("");
    try {
      const result = await sendTestPushNotification(user.id);
      if (!result.ok) {
        setPushMessage(result.error || "Could not send a test notification.");
        return;
      }

      if (result.skipped) {
        setPushMessage(`Test notification skipped: ${result.skipped}.`);
        return;
      }

      if ((result.successCount || 0) > 0) {
        setPushMessage("Test notification sent to this device. If this app is open, you may see it instantly or in the browser tray.");
        return;
      }

      setPushMessage(result.error || "The test notification did not reach any registered device tokens.");
    } catch (error) {
      console.error("Error sending test push notification:", error);
      setPushMessage("Could not send a test notification right now.");
    } finally {
      setPushTestBusy(false);
    }
  };

  const pushStatusText = !pushState.supported
    ? "Not supported in this browser."
    : pushState.permission === "denied"
      ? "Notifications are blocked in browser settings."
      : pushState.enabled
        ? "Enabled on this device."
        : "Disabled on this device.";

  return (
    <SettingsPageFrame
      user={user}
      loading={loading}
      onSignOut={handleSignOut}
      title="Notifications"
      description="Only the updates you actually want."
    >
      <div className="space-y-5">
        <SettingsGroup title="Delivery">
          <SettingLine title="Web push notifications" description="Alerts on this device." stacked>
            <div className="flex flex-wrap items-center gap-3 ">
              <p className="w-full text-xs text-white/45">{pushStatusText}</p>
              <div className="flex flex-wrap gap-2">
                {pushState.enabled ? (
                  <button
                    type="button"
                    onClick={() => void handlePushTest()}
                    disabled={pushBusy || pushTestBusy}
                    className="inline-flex items-center gap-2 rounded-md border border-white/15 bg-transparent px-3 py-2 text-xs font-semibold text-[#f5f0de] transition hover:bg-white/[0.08] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {pushTestBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                    Send test
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handlePushToggle()}
                  disabled={pushBusy || pushTestBusy || (!pushState.supported && !pushState.enabled)}
                  className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition ${
                    pushState.enabled ? "border border-white/20 bg-transparent text-white/70 hover:border-white/40" : "bg-[#ff7a1a] text-black hover:bg-[#ff8d3b]"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {pushBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                  {pushState.enabled ? "Disable" : "Enable on this device"}
                </button>
              </div>
            </div>
          </SettingLine>
        </SettingsGroup>

        {pushMessage ? (
          <SettingsMessage tone={pushState.enabled ? "success" : "info"}>
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>{pushMessage}</p>
            </div>
          </SettingsMessage>
        ) : null}

        <SettingsGroup title="Activity">
        <SettingLine title="Follow notifications" description="Let people know when someone follows you.">
          <CompactToggle
            checked={settings.notifications.followRequests}
            onChange={(next) => void updateSection("notifications", { followRequests: next })}
            label={settings.notifications.followRequests ? "On" : "Off"}
          />
        </SettingLine>

        <SettingLine title="Like notifications" description="Likes and saves on your logs and comments.">
          <CompactToggle
            checked={settings.notifications.likeNotifications}
            onChange={(next) => void updateSection("notifications", { likeNotifications: next })}
            label={settings.notifications.likeNotifications ? "On" : "Off"}
          />
        </SettingLine>

        <SettingLine title="Comment notifications" description="Comments and replies on your logs and shares.">
          <CompactToggle
            checked={settings.notifications.commentNotifications}
            onChange={(next) => void updateSection("notifications", { commentNotifications: next })}
            label={settings.notifications.commentNotifications ? "On" : "Off"}
          />
        </SettingLine>

        <SettingLine title="Share notifications" description="When someone sends you a movie or TV recommendation.">
          <CompactToggle
            checked={settings.notifications.shareNotifications}
            onChange={(next) => void updateSection("notifications", { shareNotifications: next })}
            label={settings.notifications.shareNotifications ? "On" : "Off"}
          />
        </SettingLine>

        <SettingLine title="Log notifications" description="When someone posts a new log.">
          <CompactToggle
            checked={settings.notifications.logNotifications}
            onChange={(next) => void updateSection("notifications", { logNotifications: next })}
            label={settings.notifications.logNotifications ? "On" : "Off"}
          />
        </SettingLine>

        <SettingLine title="Collaboration invites" description="List collaboration requests and invites.">
          <CompactToggle
            checked={settings.notifications.collaborationInvites}
            onChange={(next) => void updateSection("notifications", { collaborationInvites: next })}
            label={settings.notifications.collaborationInvites ? "On" : "Off"}
          />
        </SettingLine>

        <SettingLine title="Email notifications" description="Optional email delivery for account messages.">
          <CompactToggle
            checked={settings.notifications.emailNotifications}
            onChange={(next) => void updateSection("notifications", { emailNotifications: next })}
            label={settings.notifications.emailNotifications ? "On" : "Off"}
          />
        </SettingLine>
        </SettingsGroup>
      </div>
    </SettingsPageFrame>
  );
}
