import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { UnlockScreen } from "@/features/lock/UnlockScreen";
import { useAutoLock } from "@/features/lock/useAutoLock";
import { Sidebar } from "@/features/vault/Sidebar";
import { ItemView } from "@/features/vault/ItemView";
import { ItemFormDialog, type ItemFormData } from "@/features/vault/ItemFormDialog";
import type { Item, VaultStatus } from "@/types";

const AUTO_LOCK_MS = 15 * 60 * 1000;

export default function App() {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [formDialog, setFormDialog] = useState<{ open: boolean; item: Item | null }>({
    open: false,
    item: null,
  });

  useEffect(() => {
    invoke<VaultStatus>("vault_status")
      .then(setStatus)
      .catch(() => setStatus("uninitialized"));
  }, []);

  // Listen for lock events emitted by the system tray "Lock Vault" menu item.
  const clearStateRef = useRef(() => {
    setItems([]);
    setSelectedId(null);
    setQuery("");
    setStatus("locked");
  });
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    listen("vault:locked", () => clearStateRef.current()).then((fn) => { cleanup = fn; });
    return () => cleanup?.();
  }, []);

  async function handleUnlockSubmit(password: string) {
    if (status === "uninitialized") {
      await invoke("vault_create", { password });
    } else {
      await invoke("vault_unlock", { password });
    }
    const list = await invoke<Item[]>("items_list");
    setItems(list);
    setStatus("unlocked");
  }

  async function handleLock() {
    await invoke("vault_lock");
    clearStateRef.current();
  }

  async function handleCopy(item: Item) {
    await navigator.clipboard.writeText(item.value);
    await invoke("item_mark_used", { id: item.id }).catch(() => {});
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id
          ? { ...it, lastUsedAt: Date.now(), copyCount: it.copyCount + 1 }
          : it,
      ),
    );
  }

  async function handleToggleFavorite(item: Item) {
    const next = !item.isFavorite;
    await invoke("item_set_favorite", { id: item.id, favorite: next });
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, isFavorite: next } : it)));
  }

  async function handleSave(data: ItemFormData) {
    if (formDialog.item) {
      // Edit
      await invoke("item_update", {
        id: formDialog.item.id,
        title: data.title,
        kind: data.kind,
        value: data.value,
        notes: data.notes || null,
        tags: data.tags,
      });
      setItems((prev) =>
        prev.map((it) =>
          it.id === formDialog.item!.id
            ? { ...it, title: data.title, kind: data.kind, value: data.value, notes: data.notes || null, tags: data.tags }
            : it,
        ),
      );
    } else {
      // Create
      const id = await invoke<string>("item_create", {
        title: data.title,
        kind: data.kind,
        value: data.value,
        notes: data.notes || null,
        tags: data.tags,
      });
      const newItem: Item = {
        id,
        title: data.title,
        kind: data.kind,
        value: data.value,
        notes: data.notes || null,
        tags: data.tags,
        isFavorite: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastUsedAt: null,
        copyCount: 0,
      };
      setItems((prev) => [...prev, newItem]);
      setSelectedId(id);
    }
  }

  async function handleDelete(item: Item) {
    await invoke("item_delete", { id: item.id });
    setItems((prev) => prev.filter((it) => it.id !== item.id));
    if (selectedId === item.id) setSelectedId(null);
  }

  useAutoLock(status === "unlocked", AUTO_LOCK_MS, () => {
    void handleLock();
  });

  if (status === null) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (status === "uninitialized" || status === "locked") {
    return (
      <UnlockScreen
        mode={status === "uninitialized" ? "create" : "unlock"}
        onSubmit={handleUnlockSubmit}
      />
    );
  }

  const selected = items.find((it) => it.id === selectedId) ?? null;

  return (
    <>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <Sidebar
          items={items}
          query={query}
          selectedId={selectedId}
          onQueryChange={setQuery}
          onSelect={setSelectedId}
          onCreate={() => setFormDialog({ open: true, item: null })}
          onLock={handleLock}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          <ItemView
            item={selected}
            onCopy={handleCopy}
            onToggleFavorite={handleToggleFavorite}
            onEdit={(item) => setFormDialog({ open: true, item })}
            onDelete={handleDelete}
          />
        </main>
      </div>

      <ItemFormDialog
        open={formDialog.open}
        item={formDialog.item}
        onClose={() => setFormDialog({ open: false, item: null })}
        onSave={handleSave}
      />
    </>
  );
}
