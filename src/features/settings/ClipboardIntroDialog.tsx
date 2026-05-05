import { LuClipboardCheck } from "react-icons/lu";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { formatDuration } from "@/lib/settings";

interface ClipboardIntroDialogProps {
  open: boolean;
  clearMs: number;
  onAcknowledge: () => void;
  onOpenSettings: () => void;
}

export function ClipboardIntroDialog({ open, clearMs, onAcknowledge, onOpenSettings }: ClipboardIntroDialogProps) {
  const duration = formatDuration(clearMs);
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onAcknowledge(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LuClipboardCheck className="text-primary" /> Clipboard auto-clear
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            For your security, Keystone will <strong className="text-foreground">automatically clear copied API
            keys from your clipboard after {duration}</strong>.
          </p>
          <p>
            Other item types (snippets, commands, notes) stay in your clipboard. If you copy something else within
            the timeout, your new copy is preserved — only the API key is wiped.
          </p>
          <p>
            You can change the duration or disable this in <strong className="text-foreground">Settings</strong>.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onOpenSettings}>
            Open settings
          </Button>
          <Button onClick={onAcknowledge} autoFocus>
            Got it
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
