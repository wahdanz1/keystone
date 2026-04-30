export type ItemKind = "api_key" | "snippet" | "command" | "note";

export interface Item {
  id: string;
  title: string;
  value: string;
  kind: ItemKind;
  notes: string | null;
  tags: string[];
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
  copyCount: number;
}

export type VaultStatus = "uninitialized" | "locked" | "unlocked";
