<div align="center">

# 🟪 Nodrift Launcher

A clean, fast, customizable **Minecraft launcher** with Microsoft login, mod-loader
support, and one-click Modrinth mods.

Built with Tauri v2 · React · Rust.

</div>

---

## Features

- **Microsoft / Xbox login** — play online, multiple accounts, automatic token refresh (tokens stored in the OS keychain).
- **Mod loaders** — Fabric, Quilt, NeoForge, and Forge, with loader versions fetched and selected automatically.
- **Instances** — create, rename, duplicate, and delete. Each instance has its own mods, saves, config, RAM, and Java-args overrides. Same-version instances **share one game install**, so a version is only downloaded once.
- **Modrinth integration** — search and install mods filtered to your instance's exact Minecraft version + loader, with automatic dependency resolution. Full project pages with descriptions and galleries.
- **Mod manager** — per-instance list showing each mod's icon, name, version, and author, with enable/disable toggles and delete.
- **Modpack import** — import Modrinth `.mrpack` files and generic `.zip` packs into new instances.
- **Bundled "Main Client"** — ships a ready-to-play modpack that's created automatically on first run.
- **Customizable** — accent color, default RAM, Java args, window resolution, and instance directory.
- **Live console** with launch progress, and a **Stop** button to kill a running game.

## Tech stack

| | |
|---|---|
| Shell | [Tauri v2](https://tauri.app) (Rust) |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, Zustand |
| Minecraft | [lyceris](https://github.com/BatuhanAksoyy/lyceris) (vendored & patched) |
| Mods | [Modrinth API v2](https://docs.modrinth.com) |

## Development

Prerequisites: [Node.js](https://nodejs.org), [Rust](https://rustup.rs), and the
[Tauri prerequisites](https://tauri.app/start/prerequisites/) for your OS.

```bash
npm install
npm run tauri dev      # run the app in development
npm run tauri build    # produce a production bundle
```

> The bundled "Main Client" modpack lives in `src-tauri/resources/main-client/`
> and is gitignored (it's large). The app runs fine without it — it just won't
> auto-create the Main Client instance.

## Platform

Windows is the primary target; macOS works for development. Windows installers
are produced on Windows or via CI (Tauri can't cross-compile to Windows from macOS).

## License

Nodrift Launcher is released under the [MIT License](LICENSE).

The vendored `lyceris` library is also MIT licensed (see `vendor/lyceris/LICENSE`).
