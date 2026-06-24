# CLAUDE.md

Guidance for working in this repo. Koo Koo Launcher is a custom Minecraft launcher.

## Stack

- **Tauri v2** (Rust backend) + **React 19 + TypeScript + Vite 7** frontend
- **Tailwind v4** (CSS-first, configured in `src/index.css` via `@theme`)
- **Zustand** for state, **lucide-react** icons, **react-markdown** for mod pages
- Minecraft launching via **lyceris** — vendored & patched at `vendor/lyceris/` (see below)
- Primary target OS is **Windows**; developed/tested on macOS. Keep code cross-platform.

## Run / build

```bash
npm install
npm run tauri dev      # run the app (needs Rust on PATH: source "$HOME/.cargo/env")
npm run build          # frontend typecheck + build (tsc && vite build)
cargo check --manifest-path src-tauri/Cargo.toml   # backend typecheck
npm run tauri build    # production bundle (.app/.dmg on macOS; .exe/.msi on Windows)
```

Rust was installed via rustup; if `cargo` isn't found, run `source "$HOME/.cargo/env"`.

## Architecture

**Frontend** (`src/`):
- `lib/api.ts` — the single typed wrapper over every Tauri command + event. Add new commands here.
- `store/` — Zustand stores: `accounts`, `instances`, `launch`, `settings` (frontend prefs, persisted to localStorage; accent applies live), `ui` (nav + which instance detail page is open).
- `pages/` — `InstancesPage` (grid), `InstanceDetailPage` (info + rich mod manager + file browser), `BrowsePage` (Modrinth search), `AccountsPage`, `SettingsPage`.
- `components/` — `ModDetail` (Modrinth project page), `ModCard`, `InstanceModal` (create/edit), `ImportModal`, `ConsoleDrawer`, `StopConfirm`, `Modal`, `Button`, `Sidebar`.

**Backend** (`src-tauri/src/`), one module per concern; commands registered in `lib.rs`:
- `accounts.rs` — Microsoft OAuth (webview redirect capture); tokens in the OS keychain (`keyring`).
- `instances.rs` — instance CRUD + mod enable/disable/delete + file listing. `Instance`/`ModEntry` models persisted as `instances/<id>/instance.json`.
- `launch.rs` — install + launch (by instance id), version list, **kill_instance** (PID tracked in `RunningInstances` state).
- `loaders.rs` — fetch loader versions (Fabric/Quilt/NeoForge/Forge).
- `modrinth.rs` — search (compat-filtered), project detail, resolve+install with deps, remove.
- `modpack.rs` — `.mrpack` / `.zip` import. `prism.rs` — Prism/MultiMC import + bundled Main Client seeding.
- `mods.rs` — reads jar metadata (`fabric.mod.json`/`quilt.mod.json`) for the rich mod list.
- `paths.rs` — on-disk layout. `app_settings.rs` — backend settings (instance dir).

## Key conventions & gotchas

- **Disk layout** (`paths.rs`): ALL instances share one `<app data>/shared/` game dir (versions/libraries/assets/Java) — same MC version is downloaded once. Per-instance files live in `<app data>/instances/<id>/` via a lyceris `Profile` (mods/saves/config). Instance dir is overridable in Settings.
- **lyceris is vendored & patched** at `vendor/lyceris/` (`src-tauri/Cargo.toml` uses `path = "../vendor/lyceris"`). Patches are marked `KOOKOO PATCH` in `src/http/downloader.rs`: (1) don't rebuild the HTTP client per file — it reloaded the OS trust store thousands of times and made installs ~15x slow; (2) no per-chunk progress emit; (3) `buffer_unordered(64)`. If upgrading lyceris, re-vendor and re-apply.
- **Never forward high-frequency events to React per-event.** The launch store batches console lines / throttles progress (~7x/sec) — emitting per line froze the UI.
- **Modrinth**: loader filter goes under the `categories` facet (not `loaders`). See `modrinth.rs`.
- **Loader version strings**: Forge/NeoForge want the bare build (e.g. `52.0.63` / `21.1.95`); lyceris builds the URL. Fabric/Quilt use the loader version directly.
- **Main Client**: a cleaned (modpack-only) Prism instance bundled at `src-tauri/resources/main-client/` (**gitignored**, ~191 MB) via `bundle.resources`; `ensure_main_client` seeds it on first run (marker `<app data>/.main-client-seeded`). A CI/Windows build needs this staged separately.
- Tauri converts JS camelCase command args to Rust snake_case automatically; nested object fields must already be snake_case (serde).

## Workflow

- Confirm builds after changes: `cargo check` (backend) and `npm run build` (frontend).
- Commit/push only when asked. Repo: github.com/lmcoolj/kookoolauncher.
