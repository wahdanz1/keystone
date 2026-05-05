import { useState } from "react";
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
import type { Item } from "@/types";

interface ItemViewProps {
  item: Item | null;
  isCopied: boolean;
  onCopy: (item: Item) => void;
  onToggleFavorite: (item: Item) => void;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
  onTagClick: (tag: string) => void;
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

        <ValueCard key={item.id} item={item} isCopied={isCopied} onCopy={onCopy} />

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

function ValueCard({ item, isCopied, onCopy }: { item: Item; isCopied: boolean; onCopy: (item: Item) => void }) {
  const [revealed, setRevealed] = useState(item.kind !== "api_key");

  const isMasked = item.kind === "api_key" && !revealed;
  const display = isMasked ? "•".repeat(Math.min(item.value.length, 32)) : item.value;
  const isMultiline = item.value.includes("\n") || item.kind === "snippet" || item.kind === "command";
  const hasReveal = item.kind === "api_key";

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
