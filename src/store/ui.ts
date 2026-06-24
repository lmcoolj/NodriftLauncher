import { create } from "zustand";

export type View = "instances" | "browse" | "accounts" | "settings";

interface UIState {
  view: View;
  setView: (view: View) => void;
}

export const useUI = create<UIState>((set) => ({
  view: "instances",
  setView: (view) => set({ view }),
}));
