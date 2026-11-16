import { useMemo, useRef, useState } from "react";
import { LuCopy, LuCheck, LuStar, LuEye, LuEyeOff, LuTag, LuPencil, LuTrash2 } from "react-icons/lu";
import {
  Button,
  IconButton,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { typeIcon, typeLabel } from "./itemType";
import type { Item, ItemKind } from "@/types";

interface ItemViewProps {
  item: Item | null;
  isCopied: boolean;
  onCopy: (item: Item, override?: string) => void;
  onToggleFavorite: (item: Item) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onTagClick: (tag: string) => void;
}

function isMultiEntry(kind: ItemKind): boolean {
  return kind === "env_file" || kind === "recovery_codes";
}

export function ItemView({ item, isCopied, onCopy, onToggleFavorite, onEdit, onDelete, onTagClick }: ItemViewProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!item) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-muted-foreground">
        Select an item from the sidebar, or create a new one.
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-1 flex-col overflow-y-auto">
       <div className="flex w-full max-w-4xl flex-1 flex-col p-8">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className="flex shrink-0 items-center text-muted-foreground [&_svg]:size-6"
              title={typeLabel(item.kind)}
              aria-label={typeLabel(item.kind)}
            >
              {typeIcon(item.kind)}
            </span>
            <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
          </div>
          <div className="flex items-center gap-1">
            <IconButton
              aria-label="Edit item"
              onClick={() => onEdit(item)}
            >
              <LuPencil />
            </IconButton>
            <IconButton
              aria-label={item.isFavorite ? "Remove from favorites" : "Add to favorites"}
              variant={item.isFavorite ? "primary" : "ghost"}
              onClick={() => onToggleFavorite(item)}
            >
              <LuStar />
            </IconButton>
            <IconButton
              aria-label="Delete item"
              variant="destructive"
              onClick={() => setConfirmDelete(true)}
            >
              <LuTrash2 />
            </IconButton>
          </div>
        </header>

        {isMultiEntry(item.kind) ? (
          <MultiValueCard key={`${item.id}-${item.isSensitive}`} item={item} onCopy={onCopy} />
        ) : (
          <ValueCard key={`${item.id}-${item.isSensitive}`} item={item} isCopied={isCopied} onCopy={onCopy} />
        )}

        {item.notes && (
          <Card className="mt-5">
            <CardHeader>
              <CardTitle className="text-sm">Notes</CardTitle>
            </CardHeader>
            <CardContent className="selectable whitespace-pre-wrap text-sm text-muted-foreground">
              {item.notes}
            </CardContent>
          </Card>
        )}

        {item.tags.length > 0 && (
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-6">
            <LuTag className="text-muted-foreground" />
            {item.tags.map((tag) => (
              <button
                key={tag}
                onClick={() => onTagClick(tag)}
                className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground transition-opacity hover:opacity-70"
              >
                {tag}
              </button>
            ))}
          </div>
        )}
        </div>
      </div>

      <Dialog open={confirmDelete} onOpenChange={(o) => { if (!o) setConfirmDelete(false); }}>
        <DialogContent showClose={false}>
          <DialogHeader>
            <DialogTitle>Delete "{item.title}"?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will permanently remove the item from your vault. This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmDelete(false);
                onDelete(item);
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface Entry {
  label: string;
  value: string;
}

function parseEnvFile(text: string): Entry[] {
  const entries: Entry[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    let key = trimmed.slice(0, eq).trim();
    if (key.startsWith("export ")) key = key.slice("export ".length).trim();
    if (!key) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    entries.push({ label: key, value });
  }
  return entries;
}

function parseRecoveryCodes(text: string): Entry[] {
  const entries: Entry[] = [];
  let idx = 1;
  for (const raw of text.split("\n")) {
    let trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    trimmed = trimmed.replace(/^\d+[.):]\s*/, "");
    if (!trimmed) continue;
    entries.push({ label: `${idx}.`, value: trimmed });
    idx++;
  }
  return entries;
}

function parseEntries(kind: ItemKind, value: string): Entry[] {
  if (kind === "env_file") return parseEnvFile(value);
  if (kind === "recovery_codes") return parseRecoveryCodes(value);
  return [];
}

function MultiValueCard({ item, onCopy }: { item: Item; onCopy: (item: Item, override?: string) => void }) {
  const entries = useMemo(() => parseEntries(item.kind, item.value), [item.kind, item.value]);
  const [revealedRows, setRevealedRows] = useState<Set<number>>(() => (item.isSensitive ? new Set() : new Set(entries.map((_, i) => i))));
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const rowTimerRef = useRef<number | null>(null);
  const allTimerRef = useRef<number | null>(null);

  const allRevealed = entries.length > 0 && revealedRows.size === entries.length;

  function toggleRow(index: number) {
    setRevealedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleAll() {
    if (allRevealed) setRevealedRows(new Set());
    else setRevealedRows(new Set(entries.map((_, i) => i)));
  }

  function handleCopyEntry(index: number) {
    onCopy(item, entries[index].value);
    setCopiedIndex(index);
    if (rowTimerRef.current) window.clearTimeout(rowTimerRef.current);
    rowTimerRef.current = window.setTimeout(() => setCopiedIndex(null), 1500);
  }

  function handleCopyAll() {
    onCopy(item);
    setCopiedAll(true);
    if (allTimerRef.current) window.clearTimeout(allTimerRef.current);
    allTimerRef.current = window.setTimeout(() => setCopiedAll(false), 1500);
  }

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No entries parsed yet — edit the item to add some.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2 pb-1">
          <span className="text-xs text-muted-foreground">
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
          <div className="flex items-center gap-1">
            {item.isSensitive && (
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {allRevealed ? <><LuEyeOff /> Hide all</> : <><LuEye /> Reveal all</>}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={handleCopyAll}
              className={cn(copiedAll && "text-success hover:text-success")}
            >
              {copiedAll ? <><LuCheck /> Copied all</> : <><LuCopy /> Copy all</>}
            </Button>
          </div>
        </div>
        <div className="divide-y divide-border overflow-hidden rounded-md border border-border">
          {entries.map((entry, i) => {
            const revealed = revealedRows.has(i);
            const display = revealed || !item.isSensitive
              ? entry.value
              : "•".repeat(Math.min(entry.value.length, 24));
            const isCopied = copiedIndex === i;
            return (
              <div key={i} className="flex items-center gap-2 px-3 py-2">
                <span
                  className="w-40 shrink-0 truncate font-mono text-xs text-muted-foreground"
                  title={entry.label}
                >
                  {entry.label}
                </span>
                <pre className="selectable flex-1 truncate font-mono text-sm text-foreground">
                  {display}
                </pre>
                <div className="flex shrink-0 items-center gap-1">
                  {item.isSensitive && (
                    <IconButton
                      size="sm"
                      aria-label={revealed ? `Hide ${entry.label}` : `Reveal ${entry.label}`}
                      onClick={() => toggleRow(i)}
                    >
                      {revealed ? <LuEyeOff /> : <LuEye />}
                    </IconButton>
                  )}
                  <IconButton
                    size="sm"
                    aria-label={`Copy ${entry.label}`}
                    onClick={() => handleCopyEntry(i)}
                    className={cn(isCopied && "text-success hover:text-success")}
                  >
                    {isCopied ? <LuCheck /> : <LuCopy />}
                  </IconButton>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function ValueCard({ item, isCopied, onCopy }: { item: Item; isCopied: boolean; onCopy: (item: Item) => void }) {
  const [revealed, setRevealed] = useState(!item.isSensitive);

  const isMasked = item.isSensitive && !revealed;
  const display = isMasked ? "•".repeat(Math.min(item.value.length, 32)) : item.value;
  const isMultiline = item.value.includes("\n") || item.kind === "snippet" || item.kind === "command";
  const hasReveal = item.isSensitive;

  return (
    <Card>
      <CardContent className="flex items-start gap-2 p-3">
        <div className="relative flex-1">
          <pre
            className={cn(
              "selectable overflow-x-auto rounded-md bg-muted px-3 py-2.5 font-mono text-sm text-foreground",
              isMultiline ? "whitespace-pre" : "whitespace-pre-wrap break-all",
              hasReveal && "pr-11",
            )}
          >
            {display}
          </pre>
          {hasReveal && (
            <IconButton
              size="sm"
              aria-label={revealed ? "Hide value" : "Reveal value"}
              onClick={() => setRevealed((v) => !v)}
              className="absolute right-1.5 top-1.5"
            >
              {revealed ? <LuEyeOff /> : <LuEye />}
            </IconButton>
          )}
        </div>
        <Button
          onClick={() => onCopy(item)}
          variant="secondary"
          className={cn(
            "min-w-[6rem] transition-colors",
            isCopied && "text-success hover:text-success",
          )}
        >
          {isCopied ? <><LuCheck /> Copied</> : <><LuCopy /> Copy</>}
        </Button>
      </CardContent>
    </Card>
  );
}
