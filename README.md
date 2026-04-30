# Keystone

A local-first desktop vault for API keys, dev snippets, and reference items.
Built with [Tauri](https://tauri.app) (Rust backend) + React + TypeScript.

## Features

- **Encrypted at rest** — ChaCha20-Poly1305 per-record encryption; master password
  never leaves your machine. Key derived with Argon2id.
- **No network** — no backend, no telemetry, no cloud sync.
- **Searchable sidebar** — filter by title, value, notes, or tags; favorites pinned at top.
- **System tray + global hotkey** — summon the vault from anywhere (Phase 2).
- **Auto-lock** — locks after 15 minutes of inactivity.

## Development

```bash
pnpm install
pnpm tauri dev
```

Requires: [Rust + Cargo](https://rustup.rs), [Node.js 20+](https://nodejs.org), [pnpm](https://pnpm.io), and the [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

## License

Copyright © 2024 Daniel Wahlgren.
Licensed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/).

You may use, copy, modify, and redistribute this software for **non-commercial purposes** only.
Commercial use requires a separate written agreement.
