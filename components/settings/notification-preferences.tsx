"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";

type Initial = {
  emailDigest: boolean;
  emailAnswers: boolean;
  emailComments: boolean;
  emailFollowers: boolean;
  pushNotifications: boolean;
};

export function NotificationPreferences({ initial }: { initial: Initial }) {
  const [values, setValues] = useState(initial);

  function update(key: keyof Initial, value: boolean) {
    setValues({ ...values, [key]: value });
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

  const items: Array<{ key: keyof Initial; label: string; detail: string }> = [
    {
      key: "emailAnswers",
      label: "Answers to followed questions",
      detail: "When someone answers a question you follow",
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
              onCheckedChange={(value) => update(item.key, value)}
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
      <div className="mt-5 flex justify-end">
        <Button onClick={save}>Save preferences</Button>
      </div>
    </section>
  );
}
