import { useEffect, useState } from "react";
import { LuArchive, LuArchiveRestore, LuCopy, LuCheck, LuShieldCheck, LuEyeOff, LuInfo, LuX } from "react-icons/lu";
import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Label,
  Select,
  Switch,
} from "@/components/ui";
import {
  AUTO_LOCK_OPTIONS,
  CLIPBOARD_CLEAR_OPTIONS,
  type Settings,
} from "@/lib/settings";

interface SettingsViewProps {
  settings: Settings;
  onUpdate: <K extends keyof Settings>(key: K, value: Settings[K]) => Promise<void>;
  onExport: () => void;
  onImport: () => void;
  onClose: () => void;
}

export function SettingsView({ settings, onUpdate, onExport, onImport, onClose }: SettingsViewProps) {
  const [version, setVersion] = useState<string>("");
  const [vaultPath, setVaultPath] = useState<string>("");
  const [pathCopied, setPathCopied] = useState(false);

  useEffect(() => {
    getVersion().then(setVersion).catch(() => setVersion("unknown"));
    invoke<string>("vault_data_dir").then(setVaultPath).catch(() => setVaultPath(""));
  }, []);

  async function handleCopyPath() {
    if (!vaultPath) return;
    await invoke("clipboard_copy", { text: vaultPath });
    setPathCopied(true);
    setTimeout(() => setPathCopied(false), 1500);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center justify-between border-b border-border p-2 px-6">
        <h1 className="flex h-10 items-center text-xl font-semibold">Settings</h1>
        <IconButton aria-label="Close settings" onClick={onClose}>
          <LuX />
        </IconButton>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="flex w-full max-w-4xl flex-col gap-5 p-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LuShieldCheck className="text-primary" /> Security
              </CardTitle>
              <CardDescription>Control how Keystone protects your vault when idle.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <SettingRow
                label="Auto-lock vault after"
                description="Keystone locks itself after this period of inactivity."
                control={
                  <Select
                    value={String(settings.autoLockMs)}
                    onChange={(e) => onUpdate("autoLockMs", Number(e.currentTarget.value))}
                    className="w-40"
                  >
                    {AUTO_LOCK_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                }
              />
              <SettingRow
                label="Show warning before locking"
                description="Display a 15-second countdown so you can keep the vault unlocked."
                control={
                  <Switch
                    checked={settings.showLockWarning}
                    onCheckedChange={(v) => onUpdate("showLockWarning", v)}
                    disabled={settings.autoLockMs === 0}
                  />
                }
              />

              <div className="border-t border-border pt-5" />

              <SettingRow
                label="Auto-clear clipboard"
                description="Wipe copied values from the clipboard after a delay."
                control={
                  <Switch
                    checked={settings.clipboardAutoClear}
                    onCheckedChange={(v) => onUpdate("clipboardAutoClear", v)}
                  />
                }
              />
              <SettingRow
                label="Clear clipboard after"
                description="Time before the clipboard is wiped."
                control={
                  <Select
                    value={String(settings.clipboardClearMs)}
                    onChange={(e) => onUpdate("clipboardClearMs", Number(e.currentTarget.value))}
                    disabled={!settings.clipboardAutoClear}
                    className="w-40"
                  >
                    {CLIPBOARD_CLEAR_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                }
              />
              <p className="text-xs text-muted-foreground">
                Note: Windows clipboard history (Win+V), if enabled, may retain copied values. Disable it in Windows
                Settings → System → Clipboard for full protection.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LuArchive className="text-primary" /> Backup
              </CardTitle>
              <CardDescription>Export an encrypted copy of your vault, or restore from one.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button variant="outline" onClick={onImport}>
                <LuArchiveRestore /> Import backup
              </Button>
              <Button variant="outline" onClick={onExport}>
                <LuArchive /> Export backup
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LuEyeOff className="text-primary" /> Privacy
              </CardTitle>
              <CardDescription>Keystone is fully offline.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                No telemetry. No analytics. No auto-update servers. No network calls of any kind. Your vault never
                leaves this device.
              </p>
              <div className="flex flex-col gap-1.5">
                <Label>Vault file location</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded-md border border-border bg-muted px-3 py-2 font-mono text-xs text-muted-foreground" title={vaultPath}>
                    {vaultPath || "…"}
                  </code>
                  <IconButton
                    aria-label="Copy vault path"
                    onClick={handleCopyPath}
                    disabled={!vaultPath}
                    className={pathCopied ? "text-success hover:text-success" : undefined}
                  >
                    {pathCopied ? <LuCheck /> : <LuCopy />}
                  </IconButton>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LuInfo className="text-primary" /> About
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Application</span>
                <span className="font-medium">Keystone</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Version</span>
                <span className="font-mono">{version || "…"}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  control,
}: {
  label: string;
  description?: string;
  control: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6">
      <div className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  );
}
