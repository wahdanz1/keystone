import { useCallback, useEffect, useState } from "react";
import { LazyStore } from "@tauri-apps/plugin-store";

export interface Settings {
  autoLockMs: number;
  showLockWarning: boolean;
  lockWarningMs: number;
  clipboardAutoClear: boolean;
  clipboardClearMs: number;
  allowNonSensitiveInHistory: boolean;
  hasSeenClipboardNotice: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  autoLockMs: 15 * 60 * 1000,
  showLockWarning: true,
  lockWarningMs: 15 * 1000,
  clipboardAutoClear: true,
  clipboardClearMs: 30 * 1000,
  allowNonSensitiveInHistory: false,
  hasSeenClipboardNotice: false,
};

const store = new LazyStore("settings.json");

async function loadAll(): Promise<Settings> {
  const result = { ...DEFAULT_SETTINGS };
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
    const stored = await store.get(key);
    if (stored !== undefined && stored !== null) {
      (result as Record<string, unknown>)[key] = stored;
    }
  }
  return result;
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    loadAll().then(setSettings);
  }, []);

  const update = useCallback(async <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev));
    await store.set(key, value);
    await store.save();
  }, []);

  return { settings, update };
}

export const AUTO_LOCK_OPTIONS = [
  { label: "Off", value: 0 },
  { label: "30 seconds (dev)", value: 30 * 1000 },
  { label: "5 minutes", value: 5 * 60 * 1000 },
  { label: "15 minutes", value: 15 * 60 * 1000 },
  { label: "30 minutes", value: 30 * 60 * 1000 },
  { label: "1 hour", value: 60 * 60 * 1000 },
] as const;

export const CLIPBOARD_CLEAR_OPTIONS = [
  { label: "15 seconds", value: 15 * 1000 },
  { label: "30 seconds", value: 30 * 1000 },
  { label: "1 minute", value: 60 * 1000 },
  { label: "2 minutes", value: 2 * 60 * 1000 },
] as const;

export function formatDuration(ms: number): string {
  if (ms < 60_000) {
    const seconds = Math.round(ms / 1000);
    return `${seconds} second${seconds === 1 ? "" : "s"}`;
  }
  const minutes = Math.round(ms / 60_000);
  return `${minutes} minute${minutes === 1 ? "" : "s"}`;
}
