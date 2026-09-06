"use client";

// which emails / push alerts the user wants

import { useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";

type Initial = {
  emailDigest: boolean;
  emailAnswers: boolean;
  emailAnswerRequests: boolean;
  emailAcceptedAnswers: boolean;
  emailSpacePosts: boolean;
  emailComments: boolean;
  emailFollowers: boolean;
  pushNotifications: boolean;
};

type NotificationMuteTarget = {
  id: string;
  label: string;
  detail: string;
  avatar?: string | null;
  muted: boolean;
};

type NotificationMuteGroups = {
  users: NotificationMuteTarget[];
  topics: NotificationMuteTarget[];
};

export function NotificationPreferences({
  initial,
  notificationMutes,
}: {
  initial: Initial;
  notificationMutes: NotificationMuteGroups;
}) {
  const [values, setValues] = useState(initial);
  const [sources, setSources] = useState(notificationMutes);

  async function update(key: keyof Initial, value: boolean) {
    if (key === "pushNotifications") {
      const ready = value ? await enablePushNotifications() : true;
      if (!ready) return;
      if (!value) await disablePushNotifications();
    }
    setValues((current) => ({ ...current, [key]: value }));
  }

  async function save() {
    const response = await fetch("/api/settings/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    if (!response.ok) {
      toast.error("Notification preferences could not be saved");
      return;
    }
    toast.success("Notification preferences saved");
  }

  async function updateMute(
    kind: "users" | "topics",
    id: string,
    muted: boolean,
  ) {
    setSources((current) => setSourceMuted(current, kind, id, muted));

    const response = await fetch("/api/settings/notification-mutes", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        kind === "users" ? { targetUserId: id, muted } : { topicId: id, muted },
      ),
    });
    if (!response.ok) {
      setSources((current) => setSourceMuted(current, kind, id, !muted));
      toast.error("Alert setting could not be saved");
      return;
    }
    toast.success(muted ? "Alerts muted" : "Alerts unmuted");
  }

  const items: Array<{ key: keyof Initial; label: string; detail: string }> = [
    {
      key: "emailAnswers",
      label: "Answers to followed questions",
      detail: "When someone answers a question you follow",
    },
    {
      key: "emailAnswerRequests",
      label: "Answer requests",
      detail: "When someone asks you to answer a specific question",
    },
    {
      key: "emailAcceptedAnswers",
      label: "Best answer updates",
      detail: "When your answer is chosen as the best answer",
    },
    {
      key: "emailSpacePosts",
      label: "Space activity",
      detail: "When Space posts need review or your submission is reviewed",
    },
    {
      key: "emailComments",
      label: "Comments and replies",
      detail: "When people continue a discussion with you",
    },
    {
      key: "emailFollowers",
      label: "New followers",
      detail: "When someone follows your profile",
    },
    {
      key: "pushNotifications",
      label: "Push notifications",
      detail: "Immediate alerts in supported browsers",
    },
  ];

  return (
    <section className="rounded-xl border bg-card p-5 sm:p-6">
      <h2 className="text-lg font-bold">Notification preferences</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose what you hear about and where it reaches you.
      </p>
      <div className="mt-5 divide-y">
        {items.map((item) => (
          <div
            key={item.key}
            className="flex items-center gap-5 py-4 first:pt-0"
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{item.label}</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                {item.detail}
              </p>
            </div>
            <Toggle
              checked={values[item.key]}
              onCheckedChange={(value) => void update(item.key, value)}
              label={item.label}
            />
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center gap-5 rounded-xl bg-muted p-4">
        <div className="flex-1">
          <p className="text-sm font-semibold">Weekly knowledge digest</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            A curated roundup from topics and people you follow.
          </p>
        </div>
        <Toggle
          checked={values.emailDigest}
          onCheckedChange={(value) => update("emailDigest", value)}
          label="Weekly digest"
        />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <NotificationMutePanel
          title="People"
          empty="Follow people to tune alerts from them."
          items={sources.users}
          kind="users"
          onToggle={updateMute}
        />
        <NotificationMutePanel
          title="Topics"
          empty="Follow topics to tune alerts from them."
          items={sources.topics}
          kind="topics"
          onToggle={updateMute}
        />
      </div>
      <div className="mt-5 flex justify-end">
        <Button onClick={save}>Save preferences</Button>
      </div>
    </section>
  );
}

function NotificationMutePanel({
  title,
  empty,
  items,
  kind,
  onToggle,
}: {
  title: string;
  empty: string;
  items: NotificationMuteTarget[];
  kind: "users" | "topics";
  onToggle: (kind: "users" | "topics", id: string, muted: boolean) => void;
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">{title}</h3>
        {items.length > 0 && (
          <span className="text-[11px] font-semibold uppercase text-muted-foreground">
            Mute
          </span>
        )}
      </div>
      {items.length ? (
        <div className="mt-3 divide-y">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-3 py-3">
              {kind === "users" ? (
                <Avatar
                  src={item.avatar}
                  name={item.label}
                  className="size-9"
                />
              ) : (
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-xs font-black">
                  {item.label.slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {item.detail}
                </p>
              </div>
              <Toggle
                checked={item.muted}
                onCheckedChange={(value) => onToggle(kind, item.id, value)}
                label={`Mute alerts for ${item.label}`}
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

async function enablePushNotifications() {
  const publicKey = process.env.NEXT_PUBLIC_PUSH_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    toast.error("Push notifications need a browser public key.");
    return false;
  }
  if (!("Notification" in window) || !("serviceWorker" in navigator)) {
    toast.error("This browser does not support push notifications.");
    return false;
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    toast.error("Push notifications were not allowed.");
    return false;
  }

  try {
    const registration =
      await navigator.serviceWorker.register("/push-worker.js");
    const existing = await registration.pushManager.getSubscription();
    const subscription =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      }));
    const response = await fetch("/api/settings/push-subscription", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(subscription.toJSON()),
    });
    if (!response.ok) throw new Error("Push subscription was rejected");
    toast.success("Push notifications enabled");
    return true;
  } catch {
    toast.error("Push notifications could not be enabled");
    return false;
  }
}

async function disablePushNotifications() {
  if (!("serviceWorker" in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      registrations.map(async (registration) => {
        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) return;
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe();
        await fetch("/api/settings/push-subscription", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ endpoint }),
        });
      }),
    );
  } catch {
    toast.error("Push subscription could not be removed");
  }
}

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replaceAll("-", "+").replaceAll("_", "/");
  const rawData = window.atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1)
    output[index] = rawData.charCodeAt(index);
  return output;
}

function setSourceMuted(
  groups: NotificationMuteGroups,
  kind: "users" | "topics",
  id: string,
  muted: boolean,
) {
  return {
    ...groups,
    [kind]: groups[kind].map((item) =>
      item.id === id ? { ...item, muted } : item,
    ),
  };
}
