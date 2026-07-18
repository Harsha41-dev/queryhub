"use client";

// privacy + theme toggles on settings

import { useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

type Preferences = {
  theme: string;
  profilePublic: boolean;
  showActivity: boolean;
  allowMessages: boolean;
};

export function PrivacyForm({ initial }: { initial: Preferences }) {
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState(initial.profilePublic);
  const [activity, setActivity] = useState(initial.showActivity);
  const [messages, setMessages] = useState(initial.allowMessages);
  const [selectedTheme, setSelectedTheme] = useState(initial.theme);

  // save current toggles (and theme if it just changed)
  async function save(nextTheme = selectedTheme) {
    const response = await fetch("/api/settings/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        theme: nextTheme,
        profilePublic: profile,
        showActivity: activity,
        allowMessages: messages,
      }),
    });
    if (!response.ok) {
      toast.error("Preferences could not be saved");
      return;
    }
    toast.success("Privacy preferences saved");
  }

  function chooseTheme(value: string) {
    setSelectedTheme(value);
    setTheme(value);
    void save(value);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-bold">Privacy</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Control how people find and interact with you.
        </p>
        <div className="mt-5 divide-y">
          <Preference
            label="Public profile"
            detail="Allow your profile and contributions to appear in search."
            value={profile}
            onChange={setProfile}
          />
          <Preference
            label="Show activity"
            detail="Let people see the topics and posts you interact with."
            value={activity}
            onChange={setActivity}
          />
          <Preference
            label="Allow direct messages"
            detail="People you follow can contact you when messaging is enabled."
            value={messages}
            onChange={setMessages}
          />
        </div>
        <div className="mt-5 flex justify-end">
          <Button onClick={() => void save()}>Save preferences</Button>
        </div>
      </section>
      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-bold">Appearance</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose how QueryHub looks on this device.
        </p>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { value: "light", label: "Light", icon: Sun },
            { value: "dark", label: "Dark", icon: Moon },
            { value: "system", label: "System", icon: Monitor },
          ].map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => chooseTheme(value)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-semibold hover:bg-muted",
                (theme ?? selectedTheme) === value &&
                  "border-primary bg-primary/5 text-primary ring-1 ring-primary",
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function Preference({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-5 py-4 first:pt-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{label}</p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {detail}
        </p>
      </div>
      <Toggle checked={value} onCheckedChange={onChange} label={label} />
    </div>
  );
}
