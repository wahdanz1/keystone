import { LuSearch, LuStar, LuPlus, LuLock } from "react-icons/lu";
import { Input, IconButton, List, ListItem, ListSection, ListSectionLabel } from "@/components/ui";
import type { Item } from "@/types";

interface SidebarProps {
  items: Item[];
  query: string;
  selectedId: string | null;
  onQueryChange: (q: string) => void;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onLock: () => void;
}

export function Sidebar({ items, query, selectedId, onQueryChange, onSelect, onCreate, onLock }: SidebarProps) {
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
                <ListItem
                  key={it.id}
                  selected={it.id === selectedId}
                  onClick={() => onSelect(it.id)}
                  leadingIcon={it.isFavorite ? <LuStar /> : null}
                >
                  {it.title}
                </ListItem>
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
                    <ListItem
                      key={it.id}
                      selected={it.id === selectedId}
                      onClick={() => onSelect(it.id)}
                      leadingIcon={<LuStar />}
                    >
                      {it.title}
                    </ListItem>
                  ))}
                </List>
              </ListSection>
            )}
            <ListSection>
              {favorites.length > 0 && <ListSectionLabel>All</ListSectionLabel>}
              <List>
                {rest.map((it) => (
                  <ListItem
                    key={it.id}
                    selected={it.id === selectedId}
                    onClick={() => onSelect(it.id)}
                  >
                    {it.title}
                  </ListItem>
                ))}
              </List>
            </ListSection>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t border-border p-2">
        <span className="px-2 text-xs text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
        <IconButton aria-label="Lock vault" onClick={onLock}>
          <LuLock />
        </IconButton>
      </div>
    </aside>
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
