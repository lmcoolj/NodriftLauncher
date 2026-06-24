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
  /** Id of the instance pending a stop confirmation, if any. */
  confirmKill: string | null;
  /** Ask to stop an instance (defaults to the active one) — opens the confirm. */
  requestKill: (id?: string) => void;
  cancelKill: () => void;
  /** Actually stop the pending instance. */
  confirmKillNow: () => Promise<void>;
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

  confirmKill: null,
  requestKill: (id) => set({ confirmKill: id ?? get().activeId ?? null }),
  cancelKill: () => set({ confirmKill: null }),
  confirmKillNow: async () => {
    const id = get().confirmKill;
    set({ confirmKill: null });
    if (id) await killInstance(id);
  },
}));
