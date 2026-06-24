import { create } from "zustand";

export type View = "instances" | "browse" | "accounts" | "settings";

interface UIState {
  view: View;
  setView: (view: View) => void;
  /** When set (on the instances view), show that instance's detail page. */
  instanceDetailId: string | null;
  openInstance: (id: string) => void;
  closeInstance: () => void;
}

export const useUI = create<UIState>((set) => ({
  view: "instances",
  setView: (view) => set({ view }),
  instanceDetailId: null,
  openInstance: (id) => set({ view: "instances", instanceDetailId: id }),
  closeInstance: () => set({ instanceDetailId: null }),
}));
