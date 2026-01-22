"use client";

import { useMemo, useState } from "react";
import { FolderPlus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { FeedCard } from "@/components/feed/feed-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { BookmarkCollectionSummary, FeedQuestion } from "@/lib/types";

export function BookmarkLibrary({
  saved,
  initialCollections,
}: {
  saved: FeedQuestion[];
  initialCollections: BookmarkCollectionSummary[];
}) {
  const [items, setItems] = useState(saved);
  const [collections, setCollections] = useState(initialCollections);
  const [active, setActive] = useState("all");
  const [name, setName] = useState("");
  const [editName, setEditName] = useState("");
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);

  const activeCollection = collections.find(
    (collection) => collection.id === active,
  );
  const visible = useMemo(
    () =>
      items.filter((item) =>
        active === "all"
          ? true
          : active === "none"
            ? !item.collectionId
            : item.collectionId === active,
      ),
    [active, items],
  );

  async function createCollection() {
    if (name.trim().length < 2) return;
    setCreating(true);
    try {
      const response = await fetch("/api/bookmark-collections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        data?: { id?: string; name?: string };
        error?: { message: string };
      };
      if (!response.ok || !result.ok || !result.data?.id)
        throw new Error(
          result.error?.message ?? "Collection could not be created",
        );
      setCollections([
        {
          id: result.data.id,
          name: result.data.name ?? name,
          description: null,
          count: 0,
          createdAt: new Date().toISOString(),
        },
        ...collections,
      ]);
      setName("");
      toast.success("Collection created");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Collection could not be created",
      );
    } finally {
      setCreating(false);
    }
  }

  async function moveBookmark(bookmarkId: string, collectionId: string | null) {
    const previousItems = items;
    const previousCollections = collections;
    const currentItem = items.find((item) => item.bookmarkId === bookmarkId);
    setItems(
      items.map((item) =>
        item.bookmarkId === bookmarkId ? { ...item, collectionId } : item,
      ),
    );
    setCollections(
      collections.map((collection) => {
        const removed = currentItem?.collectionId === collection.id ? -1 : 0;
        const added = collectionId === collection.id ? 1 : 0;
        return {
          ...collection,
          count: Math.max(0, collection.count + removed + added),
        };
      }),
    );
    const response = await fetch("/api/bookmark-collections", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bookmarkId, collectionId }),
    });
    if (!response.ok) {
      setItems(previousItems);
      setCollections(previousCollections);
      toast.error("Bookmark could not be moved");
      return;
    }
    toast.success("Bookmark moved");
  }

  async function updateCollection(id: string) {
    const previous = collections;
    const nextName = editName.trim();
    setUpdating(true);
    setCollections(
      collections.map((collection) =>
        collection.id === id ? { ...collection, name: nextName } : collection,
      ),
    );
    try {
      const response = await fetch("/api/bookmark-collections", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, name: nextName }),
      });
      if (!response.ok) throw new Error("Collection could not be updated");
      toast.success("Collection updated");
    } catch {
      setCollections(previous);
      toast.error("Collection could not be updated");
    } finally {
      setUpdating(false);
    }
  }

  async function deleteCollection(id: string) {
    const previousCollections = collections;
    const previousItems = items;
    setUpdating(true);
    setCollections(collections.filter((collection) => collection.id !== id));
    setItems(
      items.map((item) =>
        item.collectionId === id ? { ...item, collectionId: null } : item,
      ),
    );
    setActive("all");
    try {
      const response = await fetch("/api/bookmark-collections", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error("Collection could not be deleted");
      toast.success("Collection deleted");
    } catch {
      setCollections(previousCollections);
      setItems(previousItems);
      setActive(id);
      toast.error("Collection could not be deleted");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="border-y bg-card p-4 sm:rounded-xl sm:border">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto scrollbar-none">
            <button onClick={() => setActive("all")}>
              <Badge
                className={
                  active === "all" ? "border-primary bg-primary text-white" : ""
                }
              >
                All {items.length}
              </Badge>
            </button>
            <button onClick={() => setActive("none")}>
              <Badge
                className={
                  active === "none"
                    ? "border-primary bg-primary text-white"
                    : ""
                }
              >
                Unsorted {items.filter((item) => !item.collectionId).length}
              </Badge>
            </button>
            {collections.map((collection) => (
              <button
                key={collection.id}
                onClick={() => {
                  setActive(collection.id);
                  setEditName(collection.name);
                }}
              >
                <Badge
                  className={
                    active === collection.id
                      ? "border-primary bg-primary text-white"
                      : ""
                  }
                >
                  {collection.name} {collection.count}
                </Badge>
              </button>
            ))}
          </div>
          <div className="flex gap-2 sm:w-80">
            <Input
              aria-label="New collection name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="New collection"
              className="h-9"
            />
            <Button
              size="sm"
              onClick={createCollection}
              disabled={creating || name.trim().length < 2}
            >
              <FolderPlus className="size-4" />
              Add
            </Button>
          </div>
        </div>
      </section>

      {activeCollection && (
        <section className="flex flex-col gap-3 border-y bg-card p-4 sm:flex-row sm:items-center sm:rounded-xl sm:border">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Manage collection</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {activeCollection.count} saved items
            </p>
          </div>
          <Input
            aria-label="Collection name"
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            className="h-9 sm:max-w-xs"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={
              updating ||
              editName.trim().length < 2 ||
              editName.trim() === activeCollection.name
            }
            onClick={() => updateCollection(activeCollection.id)}
          >
            <Save className="size-4" />
            Save
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive"
            disabled={updating}
            onClick={() => deleteCollection(activeCollection.id)}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </section>
      )}

      {visible.map((question) => (
        <div
          key={`${question.bookmarkId ?? question.id}-${question.bookmarkAnswerId ?? "question"}`}
          className="space-y-2"
        >
          {question.bookmarkId && (
            <div className="flex justify-end px-4 sm:px-0">
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                Collection
                <select
                  value={question.collectionId ?? ""}
                  onChange={(event) =>
                    moveBookmark(
                      question.bookmarkId!,
                      event.target.value || null,
                    )
                  }
                  className="h-8 rounded-md border bg-card px-2 text-xs outline-none focus:border-primary"
                >
                  <option value="">Unsorted</option>
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          <FeedCard question={question} />
        </div>
      ))}

      {visible.length === 0 && (
        <section className="border-y bg-card p-10 text-center sm:rounded-xl sm:border">
          <p className="text-sm font-semibold">No bookmarks here</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Save a question or answer and organize it into a collection.
          </p>
        </section>
      )}
    </div>
  );
}
