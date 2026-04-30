import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { UnlockScreen } from "@/features/lock/UnlockScreen";
import { useAutoLock } from "@/features/lock/useAutoLock";
import { Sidebar } from "@/features/vault/Sidebar";
import { ItemView } from "@/features/vault/ItemView";
import type { Item, VaultStatus } from "@/types";

const AUTO_LOCK_MS = 15 * 60 * 1000;

export default function App() {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    invoke<VaultStatus>("vault_status")
      .then(setStatus)
      .catch(() => setStatus("uninitialized"));
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
    setItems([]);
    setSelectedId(null);
    setQuery("");
    setStatus("locked");
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

  useAutoLock(status === "unlocked", AUTO_LOCK_MS, () => {
    void handleLock();
  });

  if (status === null) {
    return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Loading…</div>;
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
    <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
      <Sidebar
        items={items}
        query={query}
        selectedId={selectedId}
        onQueryChange={setQuery}
        onSelect={setSelectedId}
        onCreate={() => {
          /* TODO: open new-item dialog (Phase 2) */
        }}
        onLock={handleLock}
      />
      <main className="flex flex-1 flex-col overflow-hidden">
        <ItemView item={selected} onCopy={handleCopy} onToggleFavorite={handleToggleFavorite} />
      </main>
    </div>
  );
}
