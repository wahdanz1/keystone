import { useEffect, useState, type FormEvent } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  Textarea,
} from "@/components/ui";
import type { Item, ItemKind } from "@/types";

export interface ItemFormData {
  title: string;
  kind: ItemKind;
  value: string;
  notes: string;
  tags: string[];
}

interface ItemFormDialogProps {
  open: boolean;
  item?: Item | null;
  onClose: () => void;
  onSave: (data: ItemFormData) => Promise<void>;
}

export function ItemFormDialog({ open, item, onClose, onSave }: ItemFormDialogProps) {
  const isEdit = !!item;

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ItemKind>("api_key");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(item?.title ?? "");
      setKind(item?.kind ?? "api_key");
      setValue(item?.value ?? "");
      setNotes(item?.notes ?? "");
      setTagsRaw(item?.tags.join(", ") ?? "");
      setError(null);
    }
  }, [open, item]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    if (!value.trim()) { setError("Value is required."); return; }
    setError(null);
    setIsPending(true);
    try {
      const tags = [...new Set(tagsRaw.split(",").map((t) => t.trim()).filter(Boolean))];
      await onSave({ title: title.trim(), kind, value: value.trim(), notes: notes.trim(), tags });
      onClose();
    } catch (err) {
      setError(typeof err === "string" ? err : err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit item" : "New item"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-kind">Type</Label>
            <Select
              id="item-kind"
              value={kind}
              onChange={(e) => setKind(e.currentTarget.value as ItemKind)}
              disabled={isPending}
            >
              <option value="api_key">API Key</option>
              <option value="snippet">Snippet</option>
              <option value="command">Command</option>
              <option value="note">Note</option>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-title">Title</Label>
            <Input
              id="item-title"
              placeholder="e.g. OpenAI API Key"
              value={title}
              onChange={(e) => setTitle(e.currentTarget.value)}
              disabled={isPending}
              autoFocus={!isEdit}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-value">Value</Label>
            <Textarea
              id="item-value"
              placeholder={valuePlaceholder(kind)}
              value={value}
              onChange={(e) => setValue(e.currentTarget.value)}
              disabled={isPending}
              rows={kind === "snippet" || kind === "command" ? 5 : 2}
              className={kind !== "note" ? "font-mono" : undefined}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-notes">
              Notes{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="item-notes"
              placeholder="Any context or notes…"
              value={notes}
              onChange={(e) => setNotes(e.currentTarget.value)}
              disabled={isPending}
              rows={2}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-tags">
              Tags{" "}
              <span className="font-normal text-muted-foreground">(optional, comma-separated)</span>
            </Label>
            <Input
              id="item-tags"
              placeholder="e.g. openai, production"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.currentTarget.value)}
              disabled={isPending}
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : isEdit ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function valuePlaceholder(kind: ItemKind): string {
  switch (kind) {
    case "api_key": return "sk-…";
    case "snippet": return "const x = …";
    case "command": return "docker run …";
    case "note": return "Notes or reference text…";
  }
}
