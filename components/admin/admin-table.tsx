"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Search,
  ShieldBan,
  SlidersHorizontal,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useModalFocus } from "@/components/ui/use-modal-focus";
import type { AdminRow } from "@/lib/types";

type Kind = "users" | "content" | "reports" | "topics";

export function AdminTable({
  kind,
  rows: initialRows,
  initialQuery = "",
}: {
  kind: Kind;
  rows: AdminRow[];
  initialQuery?: string;
}) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{
    id: string;
    action: string;
    endpointAction: string;
    endpoint: string;
    target?: AdminRow["target"];
  } | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const pageSize = 10;
  const filteredRows = useMemo(
    () =>
      rows
        .filter(
          (item) =>
            `${item.primary} ${item.secondary} ${item.meta} ${item.status}`
              .toLowerCase()
              .includes(query.toLowerCase()) &&
            (filter === "All" || item.status === filter),
        )
        .sort((a, b) =>
          sortAsc
            ? a.primary.localeCompare(b.primary)
            : b.primary.localeCompare(a.primary),
        ),
    [filter, query, rows, sortAsc],
  );
  const shown = filteredRows.slice((page - 1) * pageSize, page * pageSize);
  const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const title = {
    users: "Community members",
    content: "Questions and answers",
    reports: "Open reports",
    topics: "Knowledge topics",
  }[kind];

  async function confirm(note: string) {
    if (!dialog) return;
    const body =
      dialog.endpoint === "/api/admin/content"
        ? {
            target: dialog.target,
            id: dialog.id,
            action: dialog.endpointAction,
            note,
          }
        : { action: dialog.endpointAction, note };
    const response = await fetch(dialog.endpoint, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as {
      ok: boolean;
      data?: { id: string; status: string };
      error?: { message: string };
    };
    if (!response.ok || !result.ok || !result.data) {
      toast.error(result.error?.message ?? "Action failed");
      return;
    }
    setRows(
      rows.map((row) =>
        row.id === result.data?.id
          ? { ...row, status: result.data.status }
          : row,
      ),
    );
    setDialog(null);
    toast.success(`${dialog.action} completed`);
  }

  function exportCsv() {
    const csv = [
      "Primary,Secondary,Meta,Status,Activity",
      ...filteredRows.map((row) =>
        [row.primary, row.secondary, row.meta, row.status, row.date]
          .map(csvCell)
          .join(","),
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `queryhub-${kind}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function openAction(
    row: AdminRow,
    action: "dismiss" | "hide" | "restore" | "suspend" | "unsuspend",
  ) {
    if (kind === "reports") {
      const profile = row.target === "user";
      setDialog({
        id: row.id,
        action:
          action === "dismiss"
            ? "Dismiss report"
            : action === "restore"
              ? profile
                ? "Unsuspend user"
                : "Restore content"
              : profile
                ? "Suspend user"
                : "Hide content",
        endpointAction:
          action === "dismiss"
            ? "DISMISS_REPORT"
            : action === "restore"
              ? profile
                ? "UNSUSPEND_USER"
                : "RESTORE_CONTENT"
              : profile
                ? "SUSPEND_USER"
                : "HIDE_CONTENT",
        endpoint: `/api/admin/reports/${row.id}`,
      });
    } else if (kind === "users") {
      setDialog({
        id: row.id,
        action: action === "unsuspend" ? "Unsuspend user" : "Suspend user",
        endpointAction:
          action === "unsuspend" ? "UNSUSPEND_USER" : "SUSPEND_USER",
        endpoint: `/api/admin/users/${row.id}`,
      });
    } else if (kind === "content") {
      setDialog({
        id: row.id,
        target: row.target,
        action: action === "restore" ? "Restore content" : "Hide content",
        endpointAction:
          action === "restore" ? "RESTORE_CONTENT" : "HIDE_CONTENT",
        endpoint: "/api/admin/content",
      });
    } else if (kind === "topics") {
      setDialog({
        id: row.id,
        target: "topic",
        action: action === "restore" ? "Restore topic" : "Hide topic",
        endpointAction:
          action === "restore" ? "RESTORE_CONTENT" : "HIDE_CONTENT",
        endpoint: "/api/admin/content",
      });
    }
  }

  return (
    <div className="space-y-4">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-extrabold">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {filteredRows.length} records
          </p>
        </div>
        <Button className="sm:ml-auto" onClick={exportCsv}>
          <Download className="size-4" />
          Export CSV
        </Button>
      </section>
      <section className="overflow-hidden rounded-xl border bg-card">
        <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              aria-label={`Search ${kind}`}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder={`Search ${kind}`}
              className="h-10 w-full rounded-lg border bg-muted/40 pl-9 pr-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="relative">
            <SlidersHorizontal className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <select
              aria-label={`Filter ${kind} by status`}
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setPage(1);
              }}
              className="h-10 appearance-none rounded-lg border bg-card pl-9 pr-8 text-sm"
            >
              <option>All</option>
              <option>Active</option>
              <option>Pending</option>
              <option>Reviewing</option>
              <option>Actioned</option>
              <option>Dismissed</option>
              <option>Published</option>
              <option>Suspended</option>
              <option>Hidden</option>
            </select>
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="bg-muted/50 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3">
                  <button
                    onClick={() => setSortAsc(!sortAsc)}
                    className="flex items-center gap-1"
                  >
                    {kind === "users"
                      ? "User"
                      : kind === "topics"
                        ? "Topic"
                        : "Item"}
                    <ArrowUpDown className="size-3" />
                  </button>
                </th>
                <th className="px-3 py-3">Type / role</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Activity</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {shown.map((item) => (
                <tr key={item.id} className="text-sm hover:bg-muted/30">
                  <td className="max-w-sm px-3 py-3">
                    <div className="flex items-center gap-3">
                      {item.avatar && (
                        <Avatar
                          src={item.avatar}
                          name={item.primary}
                          className="size-8"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">
                          {item.primary}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {item.secondary}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs">{item.meta}</td>
                  <td className="px-3 py-3">
                    <Badge
                      className={
                        ["Pending", "Suspended", "Hidden"].includes(item.status)
                          ? "border-rose-200 bg-rose-50 text-rose-700 dark:bg-rose-950"
                          : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:bg-emerald-950"
                      }
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td
                    suppressHydrationWarning
                    className="px-3 py-3 text-xs text-muted-foreground"
                  >
                    {formatDate(item.date)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      {item.href && (
                        <Link
                          aria-label="View details"
                          href={item.href}
                          className="grid size-8 place-items-center rounded-md hover:bg-muted"
                        >
                          <Eye className="size-4" />
                        </Link>
                      )}
                      {kind === "reports" && (
                        <>
                          <button
                            aria-label="Dismiss report"
                            onClick={() => openAction(item, "dismiss")}
                            className="grid size-8 place-items-center rounded-md text-emerald-600 hover:bg-muted"
                          >
                            <CheckCircle2 className="size-4" />
                          </button>
                          <button
                            aria-label={
                              item.target === "user"
                                ? "Suspend reported user"
                                : "Hide reported content"
                            }
                            onClick={() => openAction(item, "hide")}
                            className="grid size-8 place-items-center rounded-md text-rose-600 hover:bg-muted"
                          >
                            <XCircle className="size-4" />
                          </button>
                          {item.status === "Actioned" && (
                            <button
                              aria-label={
                                item.target === "user"
                                  ? "Unsuspend reported user"
                                  : "Restore reported content"
                              }
                              onClick={() => openAction(item, "restore")}
                              className="grid size-8 place-items-center rounded-md text-emerald-600 hover:bg-muted"
                            >
                              <CheckCircle2 className="size-4" />
                            </button>
                          )}
                        </>
                      )}
                      {kind === "users" && (
                        <button
                          aria-label={
                            item.status === "Suspended"
                              ? "Unsuspend user"
                              : "Suspend user"
                          }
                          onClick={() =>
                            openAction(
                              item,
                              item.status === "Suspended"
                                ? "unsuspend"
                                : "suspend",
                            )
                          }
                          className="grid size-8 place-items-center rounded-md text-rose-600 hover:bg-muted"
                        >
                          <ShieldBan className="size-4" />
                        </button>
                      )}
                      {kind === "content" && (
                        <button
                          aria-label={
                            item.status === "Hidden"
                              ? "Restore content"
                              : "Hide content"
                          }
                          onClick={() =>
                            openAction(
                              item,
                              item.status === "Hidden" ? "restore" : "hide",
                            )
                          }
                          className="grid size-8 place-items-center rounded-md text-rose-600 hover:bg-muted"
                        >
                          <ShieldBan className="size-4" />
                        </button>
                      )}
                      {kind === "topics" && (
                        <button
                          aria-label={
                            item.status === "Hidden"
                              ? "Restore topic"
                              : "Hide topic"
                          }
                          onClick={() =>
                            openAction(
                              item,
                              item.status === "Hidden" ? "restore" : "hide",
                            )
                          }
                          className="grid size-8 place-items-center rounded-md text-rose-600 hover:bg-muted"
                        >
                          <ShieldBan className="size-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && (
            <div className="p-12 text-center text-sm text-muted-foreground">
              No records match these filters.
            </div>
          )}
        </div>
        <footer className="flex items-center justify-between border-t p-4 text-xs text-muted-foreground">
          <span>
            Showing {(page - 1) * pageSize + (shown.length ? 1 : 0)}-
            {Math.min(page * pageSize, filteredRows.length)} of{" "}
            {filteredRows.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Previous page"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span>
              Page {page} of {pages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              aria-label="Next page"
              disabled={page === pages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </footer>
      </section>
      {dialog && (
        <ConfirmDialog
          action={dialog.action}
          onCancel={() => setDialog(null)}
          onConfirm={confirm}
          destructive={
            dialog.action.includes("Hide") || dialog.action.includes("Suspend")
          }
        />
      )}
    </div>
  );
}

function csvCell(value: string) {
  const escapedFormula = /^[=+\-@]/.test(value.trimStart())
    ? `'${value}`
    : value;
  return `"${escapedFormula.replaceAll('"', '""')}"`;
}

function ConfirmDialog({
  action,
  onCancel,
  onConfirm,
  destructive,
}: {
  action: string;
  onCancel: () => void;
  onConfirm: (note: string) => void;
  destructive: boolean;
}) {
  const [note, setNote] = useState("");
  const dialogRef = useModalFocus(true, onCancel);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4">
      <section
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="moderation-confirm-title"
        className="w-full max-w-md rounded-2xl border bg-card p-6 shadow-2xl"
      >
        <ShieldBan className="size-10 text-amber-500" />
        <h2 id="moderation-confirm-title" className="mt-4 text-xl font-bold">
          Confirm {action.toLowerCase()}
        </h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This change takes effect immediately and will be recorded in the
          moderation audit trail.
        </p>
        <label className="mt-4 block text-sm font-semibold">
          Moderation note
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            className="mt-1.5 min-h-20 w-full rounded-lg border bg-card p-3 text-sm font-normal outline-none focus:border-primary"
            placeholder="Add context for other moderators"
          />
        </label>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            onClick={() => onConfirm(note)}
          >
            Confirm action
          </Button>
        </div>
      </section>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
