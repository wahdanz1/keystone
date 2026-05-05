import { LuSearch, LuStar, LuPlus, LuLock, LuSettings, LuCopy, LuCheck, LuX } from "react-icons/lu";
import {
  Input,
  IconButton,
  List,
  ListItem,
  ListSection,
  ListSectionLabel,
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
  onSettings: () => void;
  isSettingsActive: boolean;
}

export function Sidebar({ items, query, selectedId, copiedId, onQueryChange, onSelect, onCopy, onCreate, onLock, onSettings, isSettingsActive }: SidebarProps) {
  const isSearching = query.trim().length > 0;
  const favorites = items.filter((it) => it.isFavorite);
  const rest = items.filter((it) => !it.isFavorite);

  const filtered = isSearching
    ? items.filter((it) => matches(it, query))
    : null;

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
        <IconButton aria-label="New item" variant="primary" onClick={onCreate} className="shrink-0">
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
  return false;
}
