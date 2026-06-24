# Website generation prompt — Nodrift Launcher

Paste the block below into an AI website builder (v0 / Lovable / Bolt) or hand it to a
designer to generate the Nodrift Launcher marketing site.

```text
ROLE
You are a senior product designer + front-end engineer. Build a modern, polished
marketing/landing website for a desktop Minecraft launcher called "Nodrift Launcher".

TECH
- Next.js (App Router) + TypeScript + Tailwind CSS, fully responsive, dark theme only.
- Framer Motion for subtle scroll/hover animations. lucide-react for icons.
- Static site (no backend). Clean, accessible (WCAG AA), fast (optimized images, lazy-load).

BRAND
- Name: Nodrift Launcher (often just "Nodrift"). Logo: a rounded square tile with a bold
  "N" (purple bg, white N), next to the wordmark. Sleek and premium with a hint of play.
- Accent: purple #8B5CF6 (primary) and #A78BFA (lighter). Surfaces: near-black #1E1E22,
  cards #2A2A2E, borders #36363C. Text #ECECEE, muted #9A9AA3.
- Mood: sleek, dark, fast, dependable. Big bold display headings, generous spacing,
  rounded-2xl cards, soft purple glows/shadows, smooth hover transitions. Energy of
  Prism Launcher / Modrinth App, with a purple coat.
- Font: a strong geometric sans for headings (Inter/Geist, very large/bold); clean sans body.
- The name means "no drift" — stable, precise, no lag/stutter, rock-solid. Lean into that.
  Hero headline options (pick one, large): "Minecraft, without the drift.",
  "Launch. Mod. Play.", "Rock-solid Minecraft." Subline nods to stability + simplicity.

POSITIONING (weave into copy)
- Free and open. A friendly, dependable launcher — not a closed cosmetics client.
- One-click Modrinth mods, filtered to your exact version + loader, with automatic
  dependency resolution — never install something incompatible.
- Instances that SHARE one game install, so each Minecraft version downloads only once.
- Fabric, Quilt, NeoForge, and Forge — loader versions picked automatically.
- Import .mrpack / .zip modpacks. Microsoft login with multiple accounts.
- Built on Tauri: tiny, fast, native (the installer is a few MB, not hundreds).

SECTIONS (in order)
1. Sticky translucent navbar: logo + wordmark left; links (Features, Mods, Download,
   GitHub, Docs); a primary purple "Download" button right. Mobile menu.
2. HERO (full-viewport): dark, blurred Minecraft screenshot background with a purple
   gradient overlay and a floating Minecraft character render bleeding off the left edge.
   Huge bold headline + one-sentence subhead ("A clean, fast, open Minecraft launcher
   with one-click mods and instant modpacks."). Primary CTA "Download for Windows"
   (purple, Windows glyph) + secondary "View on GitHub". Small line: "Free · Windows &
   macOS · Open source". Optional "vX.X.X beta" pill.
3. Trust strip: "Powered by Modrinth", loader logos (Fabric/Quilt/NeoForge/Forge),
   "Built with Tauri".
4. FEATURE GRID (3 cols, rounded cards, icon + title + 1-2 lines, hover lift):
   one-click mods · instances (shared installs, per-instance RAM/Java) · all loaders ·
   modpack import (.mrpack/.zip) · Microsoft login (multi-account, secure tokens) ·
   fully customizable (accent color, RAM, Java args, resolution).
5. SHOWCASE (alternating text+screenshot, rounded, soft purple glow):
   "Mods, the easy way" (Modrinth search + cards) · "A real instance manager"
   (instance grid + per-instance mod list with toggles) · "Make it yours" (settings
   page recoloring the UI via the accent picker).
6. PERFORMANCE band: punchy stats — "Native app, ~4 MB installer" · "Download each
   version once" · "Launches in seconds".
7. DOWNLOAD section: prominent card; primary button auto-labels by OS; link to all
   releases on GitHub.
8. FAQ accordion: free/open? · which MC versions? · need a Microsoft account? · where
   are files stored? · Windows & macOS?
9. Footer: logo, blurb, columns (Product, Resources, Community), GitHub, copyright.
   Decline non-essential cookies by default if any analytics is added.

INTERACTIONS & POLISH
- Smooth scroll, fade/slide-in on scroll, card hover lift + purple ring, animated glow
  accents. Respect prefers-reduced-motion.
- Real links:
    Download: https://github.com/lmcoolj/NodriftLauncher/releases/latest
    GitHub:   https://github.com/lmcoolj/NodriftLauncher
- Use clearly-labeled placeholder images where app screenshots / character render aren't
  provided, so they can be swapped.

DELIVERABLE
A complete, runnable Next.js + Tailwind project: single landing page, componentized
sections, responsive to mobile, dark purple theme as specified.
```
