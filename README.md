# Keystone

A local-first desktop vault for API keys, dev snippets, and reference items.

## Features

- Encrypted at rest — ChaCha20-Poly1305 per-record encryption, master password never leaves your machine
- No network — no backend, no telemetry, no cloud sync
- Searchable, filterable sidebar with favorites pinning
- System tray + global hotkey (`Ctrl+Shift+K`) — summon the vault from anywhere
- Auto-lock after 15 minutes of inactivity
- Close to tray — app lives in the system tray, not in the taskbar

## Tech Stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4
- **Desktop:** Tauri v2 (Rust), SQLite via rusqlite, Argon2id + ChaCha20-Poly1305

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/)
- [Rust](https://rustup.rs/)
- [Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS

### Run locally

```bash
pnpm install
pnpm tauri dev
```

### Build

```bash
pnpm tauri build
```

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free for personal and non-commercial use. Commercial use requires permission from the author. See the full license for details.
