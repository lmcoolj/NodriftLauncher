# Logo generation prompt — Nodrift Launcher

Prompts for Nano Banana (Gemini image model) to create the Nodrift logo. Brand: purple
(#8B5CF6 / #7C3AED) on dark charcoal (#1E1E22), sleek/premium, "no drift = stable / on
track", with a subtle Minecraft hint. Single-letter "N" monograms render far more reliably
than full words.

## Primary — app icon (recommended)

```text
A modern app-icon logo for a Minecraft launcher called "Nodrift". A bold, geometric
capital letter "N" monogram, centered on a rounded-square tile (squircle) filled with a
smooth purple gradient from #8B5CF6 down to #7C3AED. The "N" is crisp white with clean
sharp edges; its rising diagonal stroke subtly extends into a slim upward arrow at the top,
hinting at "launch" and "staying on track / no drift". Flat vector style, minimal and
premium, high contrast, subtle soft inner glow and gentle depth. Perfectly centered, 1:1
square composition, dark charcoal background #1E1E22. No text, no clutter, smooth
anti-aliased edges, clean scalable icon design, dribbble-quality.
```

## Variant A — abstract "steady needle" mark (no letter)

```text
A minimal logo mark for "Nodrift", a Minecraft launcher: a single sleek vertical needle/
arrow pointing straight up, perfectly aligned (symbolizing "no drift"), inside a rounded
squircle with a purple gradient (#8B5CF6 → #7C3AED) on dark #1E1E22. Flat geometric vector,
premium, high contrast, soft glow, centered, 1:1, no text.
```

## Variant B — subtle Minecraft nod

```text
Same purple squircle app icon with a white "N" monogram, but the N is built from a clean
isometric cube edge / slight 3D block facet for a subtle Minecraft feel — kept minimal and
geometric, not pixelated. Flat vector, premium, #8B5CF6→#7C3AED gradient, dark #1E1E22
background, centered, 1:1, no text.
```

## Tips

- Set output **1:1 / square**; also request a **transparent PNG** version for app/web use
  (append: "on a transparent background, PNG").
- Generate **4 variations**, then iterate conversationally: "keep #2, make the N bolder and
  remove the arrow", "flatten the gradient", "add a soft outer shadow".
- Do the **wordmark separately** (text is the weak spot): "the word 'Nodrift' in a bold
  geometric sans, white" — expect to fix letterforms by hand.
- For the real app/installer icon: export at 512×512, then run Tauri's `tauri icon` to
  generate every size (replaces `src-tauri/icons/*`).
