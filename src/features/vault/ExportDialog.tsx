import { useState, type FormEvent } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@/components/ui";

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ExportDialog({ open, onClose }: ExportDialogProps) {
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  function reset() {
    setPassphrase("");
    setConfirm("");
    setError(null);
  }

  function handleClose() {
    if (!isPending) { reset(); onClose(); }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!passphrase) { setError("Passphrase is required."); return; }
    if (passphrase !== confirm) { setError("Passphrases do not match."); return; }

    const path = await save({
      filters: [{ name: "Keystone Backup", extensions: ["kvault"] }],
      defaultPath: "keystone-backup.kvault",
    });
    if (!path) return;

    setIsPending(true);
    setError(null);
    try {
      await invoke<number>("vault_export", { path, passphrase });
      reset();
      onClose();
    } catch (err) {
      setError(typeof err === "string" ? err : "Export failed.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export vault backup</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          All items will be encrypted with a separate export passphrase. You'll need it to import.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="export-passphrase">Export passphrase</Label>
            <Input
              id="export-passphrase"
              type="password"
              placeholder="Choose a passphrase…"
              value={passphrase}
              onChange={(e) => setPassphrase(e.currentTarget.value)}
              disabled={isPending}
              autoFocus
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="export-confirm">Confirm passphrase</Label>
            <Input
              id="export-confirm"
              type="password"
              placeholder="Confirm passphrase…"
              value={confirm}
              onChange={(e) => setConfirm(e.currentTarget.value)}
              disabled={isPending}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Exporting…" : "Export"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
