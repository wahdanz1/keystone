import { LuKey, LuCode, LuTerminal, LuStickyNote, LuFileLock, LuListChecks } from "react-icons/lu";
import type { ReactNode } from "react";
import type { ItemKind } from "@/types";

export function typeIcon(kind: ItemKind): ReactNode {
  switch (kind) {
    case "api_key": return <LuKey />;
    case "snippet": return <LuCode />;
    case "command": return <LuTerminal />;
    case "note": return <LuStickyNote />;
    case "env_file": return <LuFileLock />;
    case "recovery_codes": return <LuListChecks />;
  }
}

export function typeLabel(kind: ItemKind): string {
  switch (kind) {
    case "api_key": return "API key";
    case "snippet": return "Snippet";
    case "command": return "Command";
    case "note": return "Note";
    case "env_file": return ".env file";
    case "recovery_codes": return "Recovery codes";
  }
}
