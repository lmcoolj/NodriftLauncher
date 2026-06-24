import { create } from "zustand";
import {
  createInstance,
  deleteInstance,
  duplicateInstance,
  listInstances,
  updateInstance,
  type Instance,
  type NewInstance,
} from "../lib/api";

interface InstancesState {
  instances: Instance[];
  loading: boolean;
  error: string | null;
  /** Instance selected for mod browsing / details. */
  selectedId: string | null;

  refresh: () => Promise<void>;
  create: (data: NewInstance) => Promise<Instance>;
  update: (instance: Instance) => Promise<void>;
  remove: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<void>;
  select: (id: string | null) => void;
}

export const useInstances = create<InstancesState>((set, get) => ({
  instances: [],
  loading: false,
  error: null,
  selectedId: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      set({ instances: await listInstances(), loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  create: async (data) => {
    const created = await createInstance(data);
    set({ instances: [created, ...get().instances] });
    return created;
  },

  update: async (instance) => {
    const saved = await updateInstance(instance);
    set({
      instances: get().instances.map((i) => (i.id === saved.id ? saved : i)),
    });
  },

  remove: async (id) => {
    await deleteInstance(id);
    set({
      instances: get().instances.filter((i) => i.id !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
    });
  },

  duplicate: async (id) => {
    const copy = await duplicateInstance(id);
    set({ instances: [copy, ...get().instances] });
  },

  select: (selectedId) => set({ selectedId }),
}));
