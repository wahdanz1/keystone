import { useState } from "react";
import { LuCopy, LuStar, LuEye, LuEyeOff, LuTag } from "react-icons/lu";
import { Button, IconButton, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import type { Item } from "@/types";

interface ItemViewProps {
  item: Item | null;
  onCopy: (item: Item) => void;
  onToggleFavorite: (item: Item) => void;
}

export function ItemView({ item, onCopy, onToggleFavorite }: ItemViewProps) {
  if (!item) {
    return (
      <div className="flex flex-1 items-center justify-center p-10 text-center text-sm text-muted-foreground">
        Select an item from the sidebar, or create a new one.
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-8">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {kindLabel(item.kind)}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <IconButton
            aria-label={item.isFavorite ? "Remove from favorites" : "Add to favorites"}
            variant={item.isFavorite ? "primary" : "ghost"}
            onClick={() => onToggleFavorite(item)}
          >
            <LuStar />
          </IconButton>
        </div>
      </header>

      <ValueCard item={item} onCopy={onCopy} />

      {item.tags.length > 0 && (
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <LuTag className="text-muted-foreground" />
          {item.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-secondary px-2.5 py-1 text-xs text-secondary-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
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
    </div>
  );
}

function ValueCard({ item, onCopy }: { item: Item; onCopy: (item: Item) => void }) {
  const [revealed, setRevealed] = useState(item.kind !== "api_key");
  const isMasked = item.kind === "api_key" && !revealed;
  const display = isMasked ? "•".repeat(Math.min(item.value.length, 32)) : item.value;
  const isMultiline = item.value.includes("\n") || item.kind === "snippet" || item.kind === "command";

  return (
    <Card>
      <CardContent className="flex items-stretch gap-2 p-3">
        <pre
          className={
            "selectable flex-1 overflow-x-auto rounded-md bg-muted px-3 py-2.5 font-mono text-sm text-foreground" +
            (isMultiline ? " whitespace-pre" : " whitespace-pre-wrap break-all")
          }
        >
          {display}
        </pre>
        <div className="flex flex-col gap-1">
          {item.kind === "api_key" && (
            <IconButton
              aria-label={revealed ? "Hide value" : "Reveal value"}
              onClick={() => setRevealed((v) => !v)}
            >
              {revealed ? <LuEyeOff /> : <LuEye />}
            </IconButton>
          )}
          <Button onClick={() => onCopy(item)} size="sm" variant="secondary">
            <LuCopy /> Copy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function kindLabel(kind: Item["kind"]): string {
  switch (kind) {
    case "api_key":
      return "API key";
    case "snippet":
      return "Snippet";
    case "command":
      return "Command";
    case "note":
      return "Note";
  }
}
