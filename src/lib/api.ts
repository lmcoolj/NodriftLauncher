import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface AccountInfo {
  uuid: string;
  username: string;
  active: boolean;
  expired: boolean;
}

export interface VersionInfo {
  id: string;
  type: string; // "release" | "snapshot" | "old_beta" | "old_alpha"
}

export interface LoaderSelection {
  kind: "fabric" | "quilt" | "forge" | "neoforge";
  version: string;
}

export interface LaunchOptions {
  version: string;
  loader?: LoaderSelection;
  gameDir?: string;
  javaArgs?: string[];
}

// ---- Accounts ----
export const listAccounts = () => invoke<AccountInfo[]>("list_accounts");
export const loginMicrosoft = () => invoke<AccountInfo[]>("login_microsoft");
export const setActiveAccount = (uuid: string) =>
  invoke<AccountInfo[]>("set_active_account", { uuid });
export const removeAccount = (uuid: string) =>
  invoke<AccountInfo[]>("remove_account", { uuid });

// ---- Versions / launch ----
export const listVersions = () => invoke<VersionInfo[]>("list_versions");

export const launchMinecraft = (options: LaunchOptions) =>
  invoke<void>("launch_minecraft", {
    options: {
      version: options.version,
      loader: options.loader ?? null,
      game_dir: options.gameDir ?? null,
      java_args: options.javaArgs ?? null,
    },
  });

// ---- Launch events ----
export const onConsole = (cb: (line: string) => void): Promise<UnlistenFn> =>
  listen<string>("mc-console", (e) => cb(e.payload));

export const onStatus = (cb: (status: string) => void): Promise<UnlistenFn> =>
  listen<string>("mc-status", (e) => cb(e.payload));

/** Bulk download progress: [current, total] file counts. */
export const onProgress = (
  cb: (current: number, total: number) => void
): Promise<UnlistenFn> =>
  listen<[number, number]>("mc-progress", (e) =>
    cb(e.payload[0], e.payload[1])
  );
