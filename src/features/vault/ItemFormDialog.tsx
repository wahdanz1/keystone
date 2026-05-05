import { useEffect, useState, type FormEvent } from "react";
import { LuEye, LuEyeOff } from "react-icons/lu";
import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  IconButton,
  Input,
  Label,
  Select,
  Switch,
  Textarea,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Collection, Item, ItemKind } from "@/types";

const NEW_COLLECTION_VALUE = "__new__";

export interface ItemFormData {
  title: string;
  kind: ItemKind;
  value: string;
  notes: string;
  tags: string[];
  collectionId: string | null;
  isSensitive: boolean;
}

function defaultSensitiveFor(kind: ItemKind): boolean {
  return kind === "api_key";
}

interface ItemFormDialogProps {
  open: boolean;
  item?: Item | null;
  collections: Collection[];
  onClose: () => void;
  onSave: (data: ItemFormData) => Promise<void>;
  onCollectionCreate: (name: string) => Promise<string>;
}

export function ItemFormDialog({ open, item, collections, onClose, onSave, onCollectionCreate }: ItemFormDialogProps) {
  const isEdit = !!item;

  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ItemKind>("api_key");
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [tagsRaw, setTagsRaw] = useState("");
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [isSensitive, setIsSensitive] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [newCollectionOpen, setNewCollectionOpen] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");

  useEffect(() => {
    if (open) {
      const initialKind = item?.kind ?? "api_key";
      const initialSensitive = item?.isSensitive ?? defaultSensitiveFor(initialKind);
      setTitle(item?.title ?? "");
      setKind(initialKind);
      setValue(item?.value ?? "");
      setNotes(item?.notes ?? "");
      setTagsRaw(item?.tags.join(", ") ?? "");
      setCollectionId(item?.collectionId ?? null);
      setIsSensitive(initialSensitive);
      setRevealed(!initialSensitive);
      setError(null);
      setNewCollectionOpen(false);
      setNewCollectionName("");
    }
  }, [open, item]);

  function handleKindChange(nextKind: ItemKind) {
    setKind(nextKind);
    if (!item) setIsSensitive(defaultSensitiveFor(nextKind));
  }

  function handleCollectionSelect(value: string) {
    if (value === NEW_COLLECTION_VALUE) {
      setNewCollectionOpen(true);
      return;
    }
    setCollectionId(value === "" ? null : value);
  }

  async function handleCreateCollection() {
    const name = newCollectionName.trim();
    if (!name) return;
    try {
      const id = await onCollectionCreate(name);
      setCollectionId(id);
      setNewCollectionOpen(false);
      setNewCollectionName("");
    } catch (err) {
      setError(typeof err === "string" ? err : err instanceof Error ? err.message : "Could not create collection.");
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    if (!value.trim()) { setError("Value is required."); return; }
    setError(null);
    setIsPending(true);
    try {
      const tags = [...new Set(tagsRaw.split(",").map((t) => t.trim()).filter(Boolean))];
      await onSave({
        title: title.trim(),
        kind,
        value: value.trim(),
        notes: notes.trim(),
        tags,
        collectionId,
        isSensitive,
      });
      onClose();
    } catch (err) {
      setError(typeof err === "string" ? err : err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit item" : "New item"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          <div className="flex gap-4">
            <div className="flex w-1/2 flex-col gap-1.5">
              <Label htmlFor="item-kind">Type</Label>
              <Select
                id="item-kind"
                value={kind}
                onChange={(e) => handleKindChange(e.currentTarget.value as ItemKind)}
                disabled={isPending}
              >
                <option value="api_key">API Key</option>
                <option value="snippet">Snippet</option>
                <option value="command">Command</option>
                <option value="note">Note</option>
              </Select>
            </div>

            <div className="flex w-1/2 flex-col gap-1.5">
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
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="item-value">Value</Label>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                Treat as sensitive
                <Switch
                  checked={isSensitive}
                  onCheckedChange={setIsSensitive}
                  disabled={isPending}
                  aria-label="Treat as sensitive"
                />
              </label>
            </div>
            <div className="relative">
              <Textarea
                id="item-value"
                placeholder={valuePlaceholder(kind)}
                value={value}
                onChange={(e) => setValue(e.currentTarget.value)}
                disabled={isPending}
                rows={kind === "snippet" || kind === "command" ? 5 : 2}
                className={cn(
                  kind !== "note" && "font-mono",
                  isSensitive && "pr-11",
                  isSensitive && !revealed && "[-webkit-text-security:disc]",
                )}
              />
              {isSensitive && (
                <IconButton
                  type="button"
                  size="sm"
                  aria-label={revealed ? "Hide value" : "Reveal value"}
                  onClick={() => setRevealed((v) => !v)}
                  disabled={isPending}
                  className="absolute right-1.5 top-1.5"
                >
                  {revealed ? <LuEyeOff /> : <LuEye />}
                </IconButton>
              )}
            </div>
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
              rows={3}
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

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="item-collection">
              Collection{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            {newCollectionOpen ? (
              <div className="flex gap-2">
                <Input
                  placeholder="New collection name"
                  value={newCollectionName}
                  onChange={(e) => setNewCollectionName(e.currentTarget.value)}
                  disabled={isPending}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleCreateCollection();
                    } else if (e.key === "Escape") {
                      setNewCollectionOpen(false);
                      setNewCollectionName("");
                    }
                  }}
                  className="flex-1"
                />
                <Button type="button" variant="outline" onClick={handleCreateCollection} disabled={!newCollectionName.trim()}>
                  Create
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setNewCollectionOpen(false); setNewCollectionName(""); }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Select
                id="item-collection"
                value={collectionId ?? ""}
                onChange={(e) => handleCollectionSelect(e.currentTarget.value)}
                disabled={isPending}
              >
                <option value="">None (Uncategorized)</option>
                {collections.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value={NEW_COLLECTION_VALUE}>+ Create new collection…</option>
              </Select>
            )}
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
