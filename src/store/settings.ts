import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * Global, user-customizable settings.
 *
 * For now these persist to localStorage so the UI works standalone.
 * In a later step we'll mirror them into a Tauri-managed config file
 * (instance directory, etc. live on the Rust side).
 */
export interface Settings {
  /** Hex accent color used across the UI. */
  accent: string;
  /** Default JVM arguments applied to instances without an override. */
  defaultJavaArgs: string;
  /** Default RAM allocation in MB. */
  defaultRamMb: number;
  /** Default game window resolution. */
  resolution: { width: number; height: number };
  /** Where instances are stored on disk (empty = launcher default dir). */
  instanceDir: string;
}

interface SettingsState extends Settings {
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  reset: () => void;
}

const DEFAULTS: Settings = {
  accent: "#8b5cf6",
  defaultJavaArgs: "-XX:+UseG1GC -XX:+ParallelRefProcEnabled",
  defaultRamMb: 4096,
  resolution: { width: 1280, height: 720 },
  instanceDir: "",
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
      reset: () => set({ ...DEFAULTS }),
    }),
    { name: "nodrift-settings" }
  )
);

/** Lighten a hex color by a 0..1 amount (for deriving the soft accent). */
function lighten(hex: string, amount: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return hex;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix(parseInt(m[1], 16));
  const g = mix(parseInt(m[2], 16));
  const b = mix(parseInt(m[3], 16));
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Push the current accent into the document's CSS variables. */
export function applyAccent(accent: string) {
  const root = document.documentElement;
  root.style.setProperty("--accent", accent);
  root.style.setProperty("--accent-soft", lighten(accent, 0.25));
}

// Apply on load and whenever the accent changes.
applyAccent(useSettings.getState().accent);
useSettings.subscribe((s) => applyAccent(s.accent));
