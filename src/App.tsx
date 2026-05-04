import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as openFile } from "@tauri-apps/plugin-dialog";
import { UnlockScreen } from "@/features/lock/UnlockScreen";
import { useAutoLock } from "@/features/lock/useAutoLock";
import { Sidebar, matches } from "@/features/vault/Sidebar";
import { ItemView } from "@/features/vault/ItemView";
import { ItemFormDialog, type ItemFormData } from "@/features/vault/ItemFormDialog";
import { ExportDialog } from "@/features/vault/ExportDialog";
import { ImportDialog } from "@/features/vault/ImportDialog";
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
  const [exportOpen, setExportOpen] = useState(false);
  const [importPath, setImportPath] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

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

  function handleQuit() {
    invoke("app_quit").catch(() => {});
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
    setCopiedId(item.id);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopiedId(null), 1500);
    setTimeout(() => {
      navigator.clipboard.writeText("").catch(() => {});
    }, 30_000);
  }

  async function handleToggleFavorite(item: Item) {
    const next = !item.isFavorite;
    await invoke("item_set_favorite", { id: item.id, favorite: next });
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, isFavorite: next } : it)));
  }

  async function handleSave(data: ItemFormData) {
    if (formDialog.item) {
      await invoke("item_update", {
        id: formDialog.item.id,
        title: data.title,
        kind: data.kind,
        value: data.value,
        notes: data.notes || null,
        tags: data.tags,
      });
    } else {
      const id = await invoke<string>("item_create", {
        title: data.title,
        kind: data.kind,
        value: data.value,
        notes: data.notes || null,
        tags: data.tags,
      });
      setSelectedId(id);
    }
    const list = await invoke<Item[]>("items_list");
    setItems(list);
  }

  async function handleImported() {
    const list = await invoke<Item[]>("items_list");
    setItems(list);
  }

  async function handleImportClick() {
    const selected = await openFile({
      multiple: false,
      filters: [{ name: "Keystone Backup", extensions: ["kvault"] }],
    });
    if (selected && typeof selected === "string") {
      setImportPath(selected);
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

  useEffect(() => {
    if (status !== "unlocked") return;
    const activeItems = query.trim() ? items.filter((it) => matches(it, query)) : items;
    function handleKey(e: KeyboardEvent) {
      if (formDialog.open || exportOpen || importPath !== null) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      if (e.ctrlKey && e.key === "Tab") {
        e.preventDefault();
        if (activeItems.length === 0) return;
        const idx = activeItems.findIndex((it) => it.id === selectedId);
        const nextIdx =
          idx === -1
            ? 0
            : e.shiftKey
              ? (idx === 0 ? activeItems.length - 1 : idx - 1)
              : (idx === activeItems.length - 1 ? 0 : idx + 1);
        setSelectedId(activeItems[nextIdx].id);
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        const sel = items.find((it) => it.id === selectedId);
        if (sel) void handleCopy(sel);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [items, selectedId, status, query, formDialog.open, exportOpen, importPath]);

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
          copiedId={copiedId}
          onQueryChange={setQuery}
          onSelect={setSelectedId}
          onCopy={handleCopy}
          onCreate={() => setFormDialog({ open: true, item: null })}
          onLock={handleLock}
          onExport={() => setExportOpen(true)}
          onImport={handleImportClick}
          onQuit={handleQuit}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          <ItemView
            item={selected}
            isCopied={selected ? selected.id === copiedId : false}
            onCopy={handleCopy}
            onToggleFavorite={handleToggleFavorite}
            onEdit={(item) => setFormDialog({ open: true, item })}
            onDelete={handleDelete}
            onTagClick={setQuery}
          />
          {selected && (
            <div className="border-t border-border px-4 py-1.5 text-right text-[10px] text-muted-foreground/60">
              <kbd className="font-sans">Ctrl+Shift+C</kbd> to copy value
            </div>
          )}
        </main>
      </div>

      <ItemFormDialog
        open={formDialog.open}
        item={formDialog.item}
        onClose={() => setFormDialog({ open: false, item: null })}
        onSave={handleSave}
      />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <ImportDialog
        path={importPath}
        onClose={() => setImportPath(null)}
        onImported={handleImported}
      />
    </>
  );
}
