import { LuSearch, LuStar, LuPlus, LuLock, LuArchive, LuArchiveRestore, LuEllipsisVertical, LuCopy, LuCheck } from "react-icons/lu";
import {
  Input,
  IconButton,
  List,
  ListSection,
  ListSectionLabel,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import { typeIcon } from "./itemType";
import type { Item } from "@/types";

interface SidebarProps {
  items: Item[];
  query: string;
  selectedId: string | null;
  copiedId: string | null;
  onQueryChange: (q: string) => void;
  onSelect: (id: string) => void;
  onCopy: (item: Item) => void;
  onCreate: () => void;
  onLock: () => void;
  onExport: () => void;
  onImport: () => void;
}

export function Sidebar({ items, query, selectedId, copiedId, onQueryChange, onSelect, onCopy, onCreate, onLock, onExport, onImport }: SidebarProps) {
  const isSearching = query.trim().length > 0;
  const sorted = [...items].sort((a, b) => a.title.localeCompare(b.title));
  const favorites = sorted.filter((it) => it.isFavorite);
  const rest = sorted.filter((it) => !it.isFavorite);

  const filtered = isSearching
    ? sorted.filter((it) => matches(it, query))
    : null;

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <Input
          placeholder="Filter items…"
          leadingIcon={<LuSearch />}
          value={query}
          onChange={(e) => onQueryChange(e.currentTarget.value)}
        />
        <IconButton aria-label="New item" variant="primary" onClick={onCreate}>
          <LuPlus />
        </IconButton>
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
        ) : items.length === 0 ? (
          <EmptyHint message="Vault is empty. Add your first item." />
        ) : (
          <div className="flex flex-col gap-2">
            {favorites.length > 0 && (
              <ListSection>
                <ListSectionLabel>Favorites</ListSectionLabel>
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
              </ListSection>
            )}
            <ListSection>
              {favorites.length > 0 && <ListSectionLabel>All</ListSectionLabel>}
              <List>
                {rest.map((it) => (
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
            </ListSection>
          </div>
        )}
      </div>

      <div className="px-3 pb-1.5 pt-1 text-[10px] text-muted-foreground/60">
        <kbd className="font-sans">Ctrl+Tab</kbd> to navigate
      </div>
      <div className="flex items-center justify-between border-t border-border p-2">
        <span className="px-2 text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <IconButton aria-label="Vault actions">
              <LuEllipsisVertical />
            </IconButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onLock}>
              <LuLock /> Lock vault
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onImport}>
              <LuArchiveRestore /> Import backup
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onExport}>
              <LuArchive /> Export backup
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
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
  function handleCopyClick(e: React.MouseEvent) {
    e.stopPropagation();
    onCopy();
  }

  return (
    <li className="contents">
      <div className="group relative">
        <button
          type="button"
          data-selected={selected ? "true" : undefined}
          onClick={onSelect}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 pr-9 text-left text-sm outline-none transition-colors",
            "text-foreground hover:bg-accent hover:text-accent-foreground",
            "focus-visible:ring-2 focus-visible:ring-ring",
            "data-[selected=true]:bg-accent data-[selected=true]:text-foreground",
          )}
        >
          <span
            className={cn(
              "flex shrink-0 items-center [&_svg]:size-4",
              selected
                ? "text-primary"
                : "text-muted-foreground group-hover:text-accent-foreground",
            )}
          >
            {typeIcon(item.kind)}
          </span>
          <span className="flex-1 truncate">{item.title}</span>
        </button>

        {showFavoriteIndicator && item.isFavorite && !isCopied && (
          <LuStar className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 fill-primary text-primary group-hover:hidden" />
        )}

        <button
          type="button"
          aria-label={`Copy value of ${item.title}`}
          onClick={handleCopyClick}
          className={cn(
            "absolute right-1.5 top-1/2 size-7 -translate-y-1/2 items-center justify-center rounded-md transition-colors [&_svg]:size-3.5",
            isCopied
              ? "inline-flex text-success hover:text-success"
              : "hidden text-muted-foreground hover:text-foreground group-hover:inline-flex",
          )}
        >
          {isCopied ? <LuCheck /> : <LuCopy />}
        </button>
      </div>
    </li>
  );
}

function EmptyHint({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 py-10 text-center text-sm text-muted-foreground">
      {message}
    </div>
  );
}

function matches(item: Item, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (item.title.toLowerCase().includes(q)) return true;
  if (item.value.toLowerCase().includes(q)) return true;
  if (item.notes && item.notes.toLowerCase().includes(q)) return true;
  if (item.tags.some((t) => t.toLowerCase().includes(q))) return true;
  return false;
}
