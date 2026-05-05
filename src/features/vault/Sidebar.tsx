import { useState, type FormEvent, type ReactNode } from "react";
import {
  LuSearch, LuStar, LuPlus, LuLock, LuSettings, LuCopy, LuCheck, LuX,
  LuChevronRight, LuFolderPlus, LuEllipsisVertical, LuPencil, LuTrash2, LuFileText,
} from "react-icons/lu";
import {
  Input,
  IconButton,
  List,
  ListItem,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Label,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { typeIcon, typeLabel } from "./itemType";
import type { Collection, Item } from "@/types";

interface SidebarProps {
  items: Item[];
  collections: Collection[];
  query: string;
  selectedId: string | null;
  copiedId: string | null;
  onQueryChange: (q: string) => void;
  onSelect: (id: string) => void;
  onCopy: (item: Item) => void;
  onCreate: () => void;
  onLock: () => void;
  onSettings: () => void;
  isSettingsActive: boolean;
  onCollectionCreate: (name: string) => Promise<string>;
  onCollectionRename: (id: string, name: string) => Promise<void>;
  onCollectionDelete: (id: string) => Promise<void>;
}

const FAVORITES_KEY = "favorites";
const UNCATEGORIZED_KEY = "uncategorized";

export function Sidebar({
  items, collections, query, selectedId, copiedId,
  onQueryChange, onSelect, onCopy, onCreate, onLock, onSettings, isSettingsActive,
  onCollectionCreate, onCollectionRename, onCollectionDelete,
}: SidebarProps) {
  const isSearching = query.trim().length > 0;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([FAVORITES_KEY, UNCATEGORIZED_KEY]));
  const [createOpen, setCreateOpen] = useState(false);
  const [renaming, setRenaming] = useState<Collection | null>(null);
  const [deleting, setDeleting] = useState<Collection | null>(null);

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const filtered = isSearching ? items.filter((it) => matches(it, query)) : null;
  const favorites = items.filter((it) => it.isFavorite);
  const uncategorized = items.filter((it) => it.collectionId === null);
  const itemsByCollection = new Map<string, Item[]>();
  for (const it of items) {
    if (it.collectionId !== null) {
      if (!itemsByCollection.has(it.collectionId)) itemsByCollection.set(it.collectionId, []);
      itemsByCollection.get(it.collectionId)!.push(it);
    }
  }

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border p-2">
        <Input
          className="flex-1"
          placeholder="Filter items…"
          leadingIcon={<LuSearch />}
          trailingIcon={
            query.length > 0 ? (
              <IconButton
                size="sm"
                aria-label="Clear filter"
                tabIndex={-1}
                onClick={() => onQueryChange("")}
                className="-mr-1.5"
              >
                <LuX />
              </IconButton>
            ) : undefined
          }
          value={query}
          onChange={(e) => onQueryChange(e.currentTarget.value)}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton aria-label="New" variant="primary" className="shrink-0">
              <LuPlus />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onCreate}>
              <LuFileText /> New item
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
              <LuFolderPlus /> New collection
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filtered ? (
          filtered.length === 0 ? (
            <EmptyHint message={`No matches for "${query}"`} />
          ) : (
            <List>
              {filtered.map((it) => (
                <SidebarItem
                  key={it.id}
                  item={it}
                  selected={it.id === selectedId}
                  isCopied={it.id === copiedId}
                  onSelect={() => onSelect(it.id)}
                  onCopy={() => onCopy(it)}
                  showFavoriteIndicator
                />
              ))}
            </List>
          )
        ) : items.length === 0 && collections.length === 0 ? (
          <EmptyHint message="Vault is empty. Add your first item." />
        ) : (
          <div className="flex flex-col gap-1">
            {favorites.length > 0 && (
              <CollapsibleSection
                title="Favorites"
                expanded={expanded.has(FAVORITES_KEY)}
                onToggle={() => toggle(FAVORITES_KEY)}
              >
                <List>
                  {favorites.map((it) => (
                    <SidebarItem
                      key={it.id}
                      item={it}
                      selected={it.id === selectedId}
                      isCopied={it.id === copiedId}
                      onSelect={() => onSelect(it.id)}
                      onCopy={() => onCopy(it)}
                    />
                  ))}
                </List>
              </CollapsibleSection>
            )}

            {collections.map((c) => {
              const key = `collection-${c.id}`;
              const collectionItems = itemsByCollection.get(c.id) ?? [];
              return (
                <CollapsibleSection
                  key={c.id}
                  title={c.name}
                  expanded={expanded.has(key)}
                  onToggle={() => toggle(key)}
                  muted={collectionItems.length === 0}
                  rightSlot={
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton
                          size="sm"
                          aria-label={`Actions for ${c.name}`}
                          onClick={(e) => e.stopPropagation()}
                          className="opacity-0 transition-opacity group-hover/section:opacity-100 data-[state=open]:opacity-100"
                        >
                          <LuEllipsisVertical />
                        </IconButton>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setRenaming(c)}>
                          <LuPencil /> Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => setDeleting(c)}>
                          <LuTrash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  }
                >
                  {collectionItems.length === 0 ? (
                    <EmptyMessage>No items in this collection</EmptyMessage>
                  ) : (
                    <List>
                      {collectionItems.map((it) => (
                        <SidebarItem
                          key={it.id}
                          item={it}
                          selected={it.id === selectedId}
                          isCopied={it.id === copiedId}
                          onSelect={() => onSelect(it.id)}
                          onCopy={() => onCopy(it)}
                        />
                      ))}
                    </List>
                  )}
                </CollapsibleSection>
              );
            })}

            {uncategorized.length > 0 && (
              <CollapsibleSection
                title="Uncategorized"
                expanded={expanded.has(UNCATEGORIZED_KEY)}
                onToggle={() => toggle(UNCATEGORIZED_KEY)}
              >
                <List>
                  {uncategorized.map((it) => (
                    <SidebarItem
                      key={it.id}
                      item={it}
                      selected={it.id === selectedId}
                      isCopied={it.id === copiedId}
                      onSelect={() => onSelect(it.id)}
                      onCopy={() => onCopy(it)}
                    />
                  ))}
                </List>
              </CollapsibleSection>
            )}
          </div>
        )}
      </div>

      <div className="px-3 pb-1.5 pt-1 text-[10px] text-muted-foreground/60">
        <kbd className="font-sans">Ctrl+Tab</kbd> / <kbd className="font-sans">Ctrl+Shift+Tab</kbd> to navigate
      </div>
      <div className="flex items-center gap-1 border-t border-border p-1.5">
        <IconButton aria-label="Lock vault" onClick={onLock} fullWidth>
          <LuLock />
        </IconButton>
        <IconButton aria-label="Settings" onClick={onSettings} active={isSettingsActive} fullWidth>
          <LuSettings />
        </IconButton>
      </div>

      <CollectionNameDialog
        open={createOpen}
        title="New collection"
        submitLabel="Create"
        onClose={() => setCreateOpen(false)}
        onSubmit={async (name) => {
          await onCollectionCreate(name);
        }}
      />
      <CollectionNameDialog
        open={renaming !== null}
        title="Rename collection"
        submitLabel="Save"
        initialName={renaming?.name ?? ""}
        onClose={() => setRenaming(null)}
        onSubmit={async (name) => {
          if (renaming) await onCollectionRename(renaming.id, name);
        }}
      />
      <CollectionDeleteDialog
        collection={deleting}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) await onCollectionDelete(deleting.id);
        }}
      />
    </aside>
  );
}

function CollapsibleSection({
  title,
  expanded,
  onToggle,
  rightSlot,
  muted,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  rightSlot?: ReactNode;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="group/section flex flex-col">
      <div className="flex items-center pr-1">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "flex flex-1 items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium uppercase tracking-wide hover:text-foreground",
            muted ? "text-muted-foreground/50" : "text-muted-foreground",
          )}
        >
          <LuChevronRight className={cn("size-3 shrink-0 transition-transform", expanded && "rotate-90")} />
          <span className="truncate normal-case">{title}</span>
        </button>
        {rightSlot}
      </div>
      {expanded && <div className="pb-1">{children}</div>}
    </div>
  );
}

function EmptyMessage({ children }: { children: ReactNode }) {
  return <p className="px-3 py-1 text-xs italic text-muted-foreground/60">{children}</p>;
}

function CollectionNameDialog({
  open,
  title,
  submitLabel,
  initialName = "",
  onClose,
  onSubmit,
}: {
  open: boolean;
  title: string;
  submitLabel: string;
  initialName?: string;
  onClose: () => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (!pending) {
      setName(initialName);
      setError(null);
      onClose();
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name is required.");
      return;
    }
    setPending(true);
    try {
      await onSubmit(trimmed);
      setName("");
      setError(null);
      onClose();
    } catch (err) {
      setError(typeof err === "string" ? err : err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) handleClose();
        else setName(initialName);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="collection-name">Name</Label>
            <Input
              id="collection-name"
              placeholder="e.g. Work"
              value={name}
              onChange={(e) => setName(e.currentTarget.value)}
              disabled={pending}
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={handleClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Saving…" : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CollectionDeleteDialog({
  collection,
  onClose,
  onConfirm,
}: {
  collection: Collection | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const [pending, setPending] = useState(false);

  async function handleConfirm() {
    setPending(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={collection !== null} onOpenChange={(o) => { if (!o && !pending) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete "{collection?.name}"?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Items in this collection will become uncategorized. The items themselves are not deleted.
        </p>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={pending}>
            {pending ? "Deleting…" : "Delete collection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SidebarItem({
  item,
  selected,
  isCopied,
  onSelect,
  onCopy,
  showFavoriteIndicator = false,
}: {
  item: Item;
  selected: boolean;
  isCopied: boolean;
  onSelect: () => void;
  onCopy: () => void;
  showFavoriteIndicator?: boolean;
}) {
  const showFavorite = showFavoriteIndicator && item.isFavorite && !isCopied;
  return (
    <ListItem
      selected={selected}
      onClick={onSelect}
      leadingIcon={typeIcon(item.kind)}
      trailingIcon={
        showFavorite ? (
          <LuStar className="fill-primary text-primary group-hover/row:hidden" />
        ) : undefined
      }
      trailingAction={
        <IconButton
          size="sm"
          aria-label={`Copy value of ${item.title}`}
          onClick={(e) => {
            e.stopPropagation();
            onCopy();
          }}
          className={cn(
            "absolute right-1.5 top-1/2 -translate-y-1/2",
            isCopied
              ? "inline-flex text-success hover:text-success"
              : "hidden group-hover/row:inline-flex",
          )}
        >
          {isCopied ? <LuCheck /> : <LuCopy />}
        </IconButton>
      }
    >
      {item.title}
    </ListItem>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

export function matches(item: Item, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (item.title.toLowerCase().includes(q)) return true;
  if (item.value.toLowerCase().includes(q)) return true;
  if (item.notes && item.notes.toLowerCase().includes(q)) return true;
  if (item.tags.some((t) => t.toLowerCase().includes(q))) return true;
  if (item.kind.toLowerCase().includes(q)) return true;
  if (typeLabel(item.kind).toLowerCase().includes(q)) return true;
  return false;
}
