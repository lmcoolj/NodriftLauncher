import { create } from "zustand";
import {
  launchMinecraft,
  killInstance,
  onConsole,
  onProgress,
  onStatus,
  type LaunchRequest,
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
  /** Id of the instance currently launching/running, if any. */
  activeId: string | null;
  log: string[];
  progress: { current: number; total: number } | null;
  error: string | null;
  listening: boolean;
  consoleOpen: boolean;

  init: () => Promise<void>;
  clearLog: () => void;
  setConsoleOpen: (open: boolean) => void;
  launch: (req: LaunchRequest) => Promise<void>;
  /** Force-stop a running instance (defaults to the active one). */
  kill: (id?: string) => Promise<void>;
}

const MAX_LOG_LINES = 2000;

export const useLaunch = create<LaunchState>((set, get) => ({
  status: "idle",
  activeId: null,
  log: [],
  progress: null,
  error: null,
  listening: false,
  consoleOpen: false,

  init: async () => {
    if (get().listening) return;
    set({ listening: true });

    await onConsole((line) =>
      set((s) => ({ log: [...s.log, line].slice(-MAX_LOG_LINES) }))
    );
    await onStatus((status) => set({ status: status as LaunchStatus }));
    await onProgress((current, total) => set({ progress: { current, total } }));
  },

  clearLog: () => set({ log: [] }),
  setConsoleOpen: (consoleOpen) => set({ consoleOpen }),

  launch: async (req) => {
    set({
      status: "Installing",
      error: null,
      progress: null,
      activeId: req.instanceId,
      consoleOpen: true,
    });
    try {
      await launchMinecraft(req);
      set({ status: "Stopped", progress: null, activeId: null });
    } catch (e) {
      set({ status: "error", error: String(e), progress: null, activeId: null });
    }
  },

  kill: async (id) => {
    const target = id ?? get().activeId;
    if (target) await killInstance(target);
  },
}));
