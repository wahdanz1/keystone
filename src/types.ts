export type ItemKind = "api_key" | "snippet" | "command" | "note" | "env_file" | "recovery_codes";

export interface Item {
  id: string;
  title: string;
  value: string;
  kind: ItemKind;
  notes: string | null;
  tags: string[];
  isFavorite: boolean;
  isSensitive: boolean;
  collectionId: string | null;
  createdAt: number;
  updatedAt: number;
  lastUsedAt: number | null;
  copyCount: number;
}

export interface Collection {
  id: string;
  name: string;
  createdAt: number;
}

export type VaultStatus = "uninitialized" | "locked" | "unlocked";
