# Keystone

A local-first desktop vault for API keys, dev snippets, commands, and reference notes. Built for developers who got tired of scattered `.txt` files and shared 1Password vaults that don't fit small personal stuff.

## Features

### Security
- **Encrypted at rest** — ChaCha20-Poly1305 per-record encryption with Argon2id key derivation. Master password never leaves your machine.
- **Per-record sealing** — every item's title, value, notes, and tags are sealed individually; only metadata (timestamps, favorites, kind) is plaintext.
- **Auto-lock on inactivity** — configurable timeout (5 min / 15 min / 30 min / 1 h, plus a 30 s dev option). Optional countdown warning blurs the app and requires an explicit "Keep unlocked" click — passive mouse activity does not extend the session.
- **Sleep-aware** — checks elapsed time on system wake, locks if the timeout passed during sleep.
- **Master password gate** — unlock is required after every lock; password strength meter shown when creating a new vault.

### Privacy
- **Fully offline.** No telemetry, analytics, auto-update servers, or network calls of any kind. The Cargo.toml has zero HTTP/network dependencies — the Tauri capabilities file lists every native API the app can use, and there's no `http:` permission.
- **Vault file** lives at `%APPDATA%\com.keystone.app\vault.db` (Windows) — readable from the Privacy section in Settings.

### Clipboard
- **Win+V exclusion (Windows)** — copied values are tagged with the documented `CanIncludeInClipboardHistory = 0` format, so they don't appear in Windows clipboard history. Best-effort with automatic fallback to the Tauri clipboard plugin if the Win32 path errors.
- **Type-aware auto-clear** — API keys are wiped from the clipboard after a configurable delay (15 s / 30 s / 1 m / 2 m). Snippets, commands, and notes stay in the clipboard so you can paste them multiple times.
- **Smart clear** — if you copy something else within the timeout, the timer reads the clipboard and skips wiping if your new copy doesn't match the API key.
- **Optional toggle** — "Allow non-sensitive copies in clipboard history" lets snippets/commands/notes appear in Win+V if you prefer (default off; API keys are always excluded regardless).

### Item types
- **API key** — masked by default with a reveal toggle; auto-clears on copy
- **Snippet** — multi-line code/text
- **Command** — shell commands
- **Note** — free-form text
- Items support tags, favorites, and notes; type icons in the sidebar.

### Backups
- **Encrypted `.kvault` exports** — separate passphrase, ChaCha20-Poly1305 sealed JSON. Import merges into the current vault.
- **Schema versioning** — automatic migration from v1 (plaintext titles) to v2 (encrypted titles + tags); rejects backups from newer schema versions with a clear error.

### Quality of life
- **System tray** with Show/Hide, Lock Vault, Quit
- **Global hotkey** `Ctrl+Shift+K` (Windows/Linux) / `Cmd+Shift+K` (macOS) summons the window from anywhere
- **In-app hotkeys**: `Ctrl+Tab` / `Ctrl+Shift+Tab` to cycle items (respects active filter), `Ctrl+Shift+C` to copy the selected item
- **Search** — filters across title, value, notes, tags, and item type (`command`, `api key`, etc.)
- **Sort** — alphabetical (case-insensitive); favorites pinned to a top section
- **Autostart** — optional toggle to launch Keystone on login (Windows registry Run key)
- **Tray-resident** — closing the window hides to tray; quit only via the tray menu

## Tech stack

- **Frontend:** React 19, TypeScript, Tailwind CSS v4, [react-icons (Lucide)](https://lucide.dev/), [@radix-ui](https://www.radix-ui.com/) primitives
- **Desktop:** Tauri v2 (Rust)
- **Storage:** SQLite via [rusqlite](https://github.com/rusqlite/rusqlite) (bundled), [tauri-plugin-store](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/store) for app settings
- **Crypto:** Argon2id KDF + ChaCha20-Poly1305 AEAD, [zeroize](https://github.com/RustCrypto/utils/tree/master/zeroize) for in-memory key wiping
- **Clipboard:** [tauri-plugin-clipboard-manager](https://github.com/tauri-apps/plugins-workspace/tree/v2/plugins/clipboard-manager) + Win32 native path for Win+V exclusion
- **Theme:** OKLCH tokens defined once in `globals.css`, propagating across all primitives

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

Outputs an `.msi` and `.exe` installer under `src-tauri/target/release/bundle/`.

> **Note on Windows SmartScreen:** unsigned builds will trigger a "Microsoft Defender SmartScreen prevented an unrecognized app from starting" dialog the first time you run them. Click *More info → Run anyway*. Code signing certificates from a CA (Sectigo, DigiCert, etc.) skip this — but for personal use, the warning is a one-time annoyance.

## License

[PolyForm Noncommercial 1.0.0](LICENSE) — free for personal and non-commercial use. Commercial use requires permission from the author. See the full license for details.
