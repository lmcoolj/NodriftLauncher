import { create } from "zustand";
import {
  listAccounts,
  loginMicrosoft,
  removeAccount,
  setActiveAccount,
  type AccountInfo,
} from "../lib/api";

interface AccountsState {
  accounts: AccountInfo[];
  loading: boolean;
  /** Set while a Microsoft login window is open. */
  loggingIn: boolean;
  error: string | null;
  active: AccountInfo | null;

  refresh: () => Promise<void>;
  login: () => Promise<void>;
  setActive: (uuid: string) => Promise<void>;
  remove: (uuid: string) => Promise<void>;
}

function withActive(accounts: AccountInfo[]) {
  return { accounts, active: accounts.find((a) => a.active) ?? null };
}

export const useAccounts = create<AccountsState>((set) => ({
  accounts: [],
  loading: false,
  loggingIn: false,
  error: null,
  active: null,

  refresh: async () => {
    set({ loading: true, error: null });
    try {
      set({ ...withActive(await listAccounts()), loading: false });
    } catch (e) {
      set({ error: String(e), loading: false });
    }
  },

  login: async () => {
    set({ loggingIn: true, error: null });
    try {
      set({ ...withActive(await loginMicrosoft()), loggingIn: false });
    } catch (e) {
      set({ error: String(e), loggingIn: false });
    }
  },

  setActive: async (uuid) => {
    try {
      set(withActive(await setActiveAccount(uuid)));
    } catch (e) {
      set({ error: String(e) });
    }
  },

  remove: async (uuid) => {
    try {
      set(withActive(await removeAccount(uuid)));
    } catch (e) {
      set({ error: String(e) });
    }
  },
}));
