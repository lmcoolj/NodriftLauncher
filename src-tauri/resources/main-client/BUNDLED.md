# Main Client template

The bundled "Main Client" modpack goes in this folder. It's a cleaned, modpack-only
Prism/MultiMC instance:

```
main-client/
  mmc-pack.json          # Minecraft version + loader (and loader version)
  instance.cfg           # name, RAM, JVM args
  minecraft/
    mods/  config/  resourcepacks/  shaderpacks/  options.txt
```

Everything here except this file is **gitignored** (the mods are large binaries),
so a fresh clone / CI build won't include the modpack — the app simply skips
seeding "Main Client" on first run when `mmc-pack.json` is absent.

To ship it in a build, stage the cleaned template into this folder before
`npm run tauri build`. This placeholder exists so the `bundle.resources` glob in
`tauri.conf.json` always matches at least one file.
