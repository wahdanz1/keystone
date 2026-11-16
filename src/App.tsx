import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open as openFile } from "@tauri-apps/plugin-dialog";
import { readText as clipboardReadText } from "@tauri-apps/plugin-clipboard-manager";
import { UnlockScreen } from "@/features/lock/UnlockScreen";
import { useAutoLock } from "@/features/lock/useAutoLock";
import { LockWarningOverlay } from "@/features/lock/LockWarningOverlay";
import { Sidebar, matches } from "@/features/vault/Sidebar";
import { ItemView } from "@/features/vault/ItemView";
import { ItemFormDialog, type ItemFormData } from "@/features/vault/ItemFormDialog";
import { ExportDialog } from "@/features/vault/ExportDialog";
import { ImportDialog } from "@/features/vault/ImportDialog";
import { SettingsView } from "@/features/settings/SettingsView";
import { ClipboardIntroDialog } from "@/features/settings/ClipboardIntroDialog";
import { useSettings } from "@/lib/settings";
import type { Collection, Item, VaultStatus } from "@/types";

type View = "vault" | "settings";

export default function App() {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("vault");
  const [formDialog, setFormDialog] = useState<{ open: boolean; item: Item | null }>({
    open: false,
    item: null,
  });
  const [exportOpen, setExportOpen] = useState(false);
  const [importPath, setImportPath] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClipboardIntro, setShowClipboardIntro] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { settings, update: updateSetting } = useSettings();

  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);

  useEffect(() => {
    invoke<VaultStatus>("vault_status")
      .then(setStatus)
      .catch(() => setStatus("uninitialized"));
  }, []);

  const clearStateRef = useRef(() => {
    setItems([]);
    setCollections([]);
    setSelectedId(null);
    setQuery("");
    setView("vault");
    setStatus("locked");
  });
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    listen("vault:locked", () => clearStateRef.current()).then((fn) => { cleanup = fn; });
    return () => cleanup?.();
  }, []);

  async function refreshAll() {
    const [itemList, collectionList] = await Promise.all([
      invoke<Item[]>("items_list"),
      invoke<Collection[]>("collections_list"),
    ]);
    setItems(itemList);
    setCollections(collectionList);
  }

  async function handleUnlockSubmit(password: string) {
    if (status === "uninitialized") {
      await invoke("vault_create", { password });
    } else {
      await invoke("vault_unlock", { password });
    }
    await refreshAll();
    setStatus("unlocked");
  }

  async function handleLock() {
    await invoke("vault_lock");
    clearStateRef.current();
  }

  async function handleCopy(item: Item, override?: string) {
    const copiedValue = override ?? item.value;
    const isSensitive = item.isSensitive;
    const excludeFromHistory = isSensitive || !(settings?.allowNonSensitiveInHistory ?? false);
    await invoke("clipboard_copy", { text: copiedValue, excludeFromHistory });
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

    // Only sensitive types (currently just api_key) auto-clear from the clipboard.
    if (isSensitive && settings?.clipboardAutoClear) {
      const clearMs = settings.clipboardClearMs;
      setTimeout(async () => {
        try {
          const current = await clipboardReadText();
          if (current === copiedValue) await invoke("clipboard_clear");
        } catch { /* clipboard unavailable */ }
      }, clearMs);

      if (settings && !settings.hasSeenClipboardNotice) {
        setShowClipboardIntro(true);
      }
    }
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
        collectionId: data.collectionId,
        isSensitive: data.isSensitive,
      });
    } else {
      const id = await invoke<string>("item_create", {
        title: data.title,
        kind: data.kind,
        value: data.value,
        notes: data.notes || null,
        tags: data.tags,
        collectionId: data.collectionId,
        isSensitive: data.isSensitive,
      });
      setSelectedId(id);
    }
    await refreshAll();
  }

  async function handleCollectionCreate(name: string): Promise<string> {
    const id = await invoke<string>("collection_create", { name });
    const list = await invoke<Collection[]>("collections_list");
    setCollections(list);
    return id;
  }

  async function handleCollectionRename(id: string, name: string) {
    await invoke("collection_rename", { id, name });
    setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  }

  async function handleCollectionDelete(id: string) {
    await invoke("collection_delete", { id });
    setCollections((prev) => prev.filter((c) => c.id !== id));
    setItems((prev) => prev.map((it) => (it.collectionId === id ? { ...it, collectionId: null } : it)));
  }

  async function handleImported() {
    await refreshAll();
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

  async function handleAcknowledgeClipboard() {
    setShowClipboardIntro(false);
    await updateSetting("hasSeenClipboardNotice", true);
  }

  async function handleClipboardIntroOpenSettings() {
    await handleAcknowledgeClipboard();
    setView("settings");
  }

  function handleSelectItem(id: string) {
    setSelectedId(id);
    setView("vault");
  }

  const lockState = useAutoLock({
    active: status === "unlocked" && !!settings,
    autoLockMs: settings?.autoLockMs ?? 0,
    showWarning: settings?.showLockWarning ?? true,
    warningLeadMs: settings?.lockWarningMs ?? 15_000,
    onLock: () => { void handleLock(); },
  });

  useEffect(() => {
    if (status !== "unlocked") return;
    let activeItems: Item[];
    if (query.trim()) {
      activeItems = items.filter((it) => matches(it, query));
    } else {
      activeItems = [];
      for (const c of collections) {
        activeItems.push(...items.filter((it) => it.collectionId === c.id));
      }
      activeItems.push(...items.filter((it) => it.collectionId === null));
    }
    function handleKey(e: KeyboardEvent) {
      if (formDialog.open || exportOpen || importPath !== null || showClipboardIntro || lockState.warningActive) return;
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
        handleSelectItem(activeItems[nextIdx].id);
      } else if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        const sel = items.find((it) => it.id === selectedId);
        if (sel) void handleCopy(sel);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [items, collections, selectedId, status, query, formDialog.open, exportOpen, importPath, showClipboardIntro, lockState.warningActive]);

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
  const warningTotalMs = settings?.lockWarningMs ?? 15_000;

  return (
    <>
      <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground">
        <Sidebar
          items={items}
          collections={collections}
          query={query}
          selectedId={view === "vault" ? selectedId : null}
          copiedId={copiedId}
          onQueryChange={setQuery}
          onSelect={handleSelectItem}
          onCopy={handleCopy}
          onCreate={() => setFormDialog({ open: true, item: null })}
          onLock={handleLock}
          onSettings={() => setView("settings")}
          isSettingsActive={view === "settings"}
          onCollectionCreate={handleCollectionCreate}
          onCollectionRename={handleCollectionRename}
          onCollectionDelete={handleCollectionDelete}
        />
        <main className="flex flex-1 flex-col overflow-hidden">
          {view === "settings" && settings ? (
            <SettingsView
              settings={settings}
              onUpdate={updateSetting}
              onExport={() => setExportOpen(true)}
              onImport={handleImportClick}
              onClose={() => setView("vault")}
            />
          ) : (
            <>
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
            </>
          )}
        </main>
      </div>

      <ItemFormDialog
        open={formDialog.open}
        item={formDialog.item}
        collections={collections}
        onClose={() => setFormDialog({ open: false, item: null })}
        onSave={handleSave}
        onCollectionCreate={handleCollectionCreate}
      />
      <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} />
      <ImportDialog
        path={importPath}
        onClose={() => setImportPath(null)}
        onImported={handleImported}
      />
      <ClipboardIntroDialog
        open={showClipboardIntro}
        clearMs={settings?.clipboardClearMs ?? 30_000}
        onAcknowledge={handleAcknowledgeClipboard}
        onOpenSettings={handleClipboardIntroOpenSettings}
      />
      {lockState.warningActive && (
        <LockWarningOverlay
          msRemaining={lockState.msRemaining}
          totalMs={warningTotalMs}
          onKeepUnlocked={lockState.keepUnlocked}
          onLockNow={lockState.lockNow}
        />
      )}
    </>
  );
}
