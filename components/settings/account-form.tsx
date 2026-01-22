"use client";

// account settings: email / password change + delete account

import { useState } from "react";
import { signOut } from "next-auth/react";
import { AlertTriangle, Laptop2, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useModalFocus } from "@/components/ui/use-modal-focus";

export function AccountForm({ email }: { email: string }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [saving, setSaving] = useState(false);
  const deleteDialogRef = useModalFocus(confirmDelete, () =>
    setConfirmDelete(false),
  );

  // save email and/or password
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const payload = {
      email:
        form.get("email")?.toString().trim() !== email
          ? form.get("email")
          : undefined,
      currentPassword: form.get("currentPassword") || undefined,
      newPassword: form.get("newPassword") || undefined,
    };
    const response = await fetch("/api/settings/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as {
      ok: boolean;
      data?: { emailChangePending?: boolean; passwordUpdated?: boolean };
      error?: { message: string };
    };
    setSaving(false);
    if (!response.ok || !result.ok) {
      toast.error(result.error?.message ?? "Account could not be updated");
      return;
    }
    toast.success(
      result.data?.emailChangePending
        ? "Account updated — check the new email to confirm the address"
        : "Account updated",
    );
  }

  async function deleteAccount() {
    const response = await fetch("/api/settings/account", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deleteConfirmation: "DELETE",
        currentPassword: deletePassword,
      }),
    });
    if (!response.ok) {
      toast.error("Account could not be scheduled for deletion");
      return;
    }
    await signOut({ callbackUrl: "/" });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="rounded-xl border bg-card p-5 sm:p-6">
        <h2 className="text-lg font-bold">Email and password</h2>
        <div className="mt-5 space-y-5">
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold">
              Email address
            </span>
            <Input name="email" type="email" defaultValue={email} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className="mb-1.5 block text-sm font-semibold">
                Current password
              </span>
              <Input name="currentPassword" type="password" />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-semibold">
                New password
              </span>
              <Input name="newPassword" type="password" />
            </label>
          </div>
          <Button disabled={saving}>
            {saving ? "Saving..." : "Update account"}
          </Button>
        </div>
      </form>
      <section className="rounded-xl border bg-card p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-emerald-600" />
          <h2 className="text-lg font-bold">Active session</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          This browser is signed in to your account.
        </p>
        <div className="mt-5 divide-y">
          <Session
            icon={Laptop2}
            device="Current browser session"
            location="This device"
            current
          />
        </div>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          <LogOut className="size-4" />
          Log out
        </Button>
      </section>
      <section className="rounded-xl border border-destructive/25 bg-card p-5 sm:p-6">
        <h2 className="text-lg font-bold text-destructive">Danger zone</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Deleting your account signs you out and hides the profile from the
          application.
        </p>
        <Button
          variant="destructive"
          className="mt-4"
          onClick={() => setConfirmDelete(true)}
        >
          Delete account
        </Button>
      </section>
      {confirmDelete && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
          <section
            ref={deleteDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="delete-account-title"
            className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl"
          >
            <AlertTriangle className="size-10 text-destructive" />
            <h2 id="delete-account-title" className="mt-4 text-xl font-bold">
              Delete your account?
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Type <strong>DELETE</strong> to confirm. This signs you out and
              marks the account deleted.
            </p>
            <Input
              className="mt-4"
              value={confirmText}
              onChange={(event) => setConfirmText(event.target.value)}
              placeholder="DELETE"
            />
            <Input
              className="mt-3"
              type="password"
              autoComplete="current-password"
              aria-label="Current password for account deletion"
              value={deletePassword}
              onChange={(event) => setDeletePassword(event.target.value)}
              placeholder="Current password"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={confirmText !== "DELETE" || !deletePassword}
                onClick={deleteAccount}
              >
                Delete account
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Session({
  icon: Icon,
  device,
  location,
  current,
}: {
  icon: typeof Laptop2;
  device: string;
  location: string;
  current?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-4 first:pt-0">
      <span className="grid size-10 place-items-center rounded-lg bg-muted">
        <Icon className="size-5" />
      </span>
      <div>
        <p className="text-sm font-semibold">
          {device}{" "}
          {current && (
            <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-700">
              Current
            </span>
          )}
        </p>
        <p className="text-xs text-muted-foreground">{location}</p>
      </div>
    </div>
  );
}
