import { create } from "zustand";
import {
  launchMinecraft,
  onConsole,
  onProgress,
  onStatus,
  type LaunchOptions,
} from "../lib/api";

export type LaunchStatus =
  | "idle"
  | "Installing"
  | "Launching"
  | "Running"
  | "Stopped"
  | "error";

interface LaunchState {
  status: LaunchStatus;
  log: string[];
  progress: { current: number; total: number } | null;
  error: string | null;
  listening: boolean;

  /** Attach Tauri event listeners (once, on app start). */
  init: () => Promise<void>;
  clearLog: () => void;
  launch: (options: LaunchOptions) => Promise<void>;
}

const MAX_LOG_LINES = 2000;

export const useLaunch = create<LaunchState>((set, get) => ({
  status: "idle",
  log: [],
  progress: null,
  error: null,
  listening: false,

  init: async () => {
    if (get().listening) return;
    set({ listening: true });

    await onConsole((line) =>
      set((s) => ({ log: [...s.log, line].slice(-MAX_LOG_LINES) }))
    );

    await onStatus((status) =>
      set({
        status: status as LaunchStatus,
        progress: status === "Installing" ? get().progress : null,
      })
    );

    await onProgress((current, total) => set({ progress: { current, total } }));
  },

  clearLog: () => set({ log: [] }),

  launch: async (options) => {
    set({ status: "Installing", error: null, progress: null });
    try {
      await launchMinecraft(options);
      // launch_minecraft resolves when the game process exits.
      set({ status: "Stopped", progress: null });
    } catch (e) {
      set({ status: "error", error: String(e), progress: null });
    }
  },
}));
