import { useEffect, useState, type FormEvent } from "react";
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
import { basename } from "@/lib/utils";

interface ImportDialogProps {
  path: string | null;
  onClose: () => void;
  onImported: (count: number) => Promise<void>;
}

export function ImportDialog({ path, onClose, onImported }: ImportDialogProps) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (path) {
      setPassphrase("");
      setError(null);
      setIsPending(false);
    }
  }, [path]);

  function handleClose() {
    if (!isPending) onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!path || !passphrase) return;

    setIsPending(true);
    setError(null);
    try {
      const count = await invoke<number>("vault_import", { path, passphrase });
      await onImported(count);
      onClose();
    } catch (err) {
      const msg = typeof err === "string" ? err : String(err);
      const isWrongPassword =
        msg.includes("incorrect master password") || msg.includes("crypto error");
      setError(isWrongPassword ? "Wrong passphrase or corrupt file." : msg);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={path !== null} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import vault backup</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Items will be added to your current vault. Enter the passphrase used when this backup was created.
        </p>
        {path && (
          <p className="truncate font-mono text-xs text-muted-foreground" title={path}>
            {basename(path)}
          </p>
        )}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="import-passphrase">Backup passphrase</Label>
            <Input
              id="import-passphrase"
              type="password"
              placeholder="Enter passphrase…"
              value={passphrase}
              onChange={(e) => setPassphrase(e.currentTarget.value)}
              disabled={isPending}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !passphrase}>
              {isPending ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
