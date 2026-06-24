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

export type LoaderKind = "fabric" | "quilt" | "forge" | "neoforge";

export interface LoaderInfo {
  kind: LoaderKind;
  version: string;
}

export interface ModEntry {
  project_id: string;
  version_id: string;
  name: string;
  file_name: string;
}

export interface Instance {
  id: string;
  name: string;
  mc_version: string;
  loader: LoaderInfo | null;
  icon: string | null;
  mods: ModEntry[];
  ram_mb: number | null;
  java_args: string | null;
  created_at: number;
  last_played: number | null;
}

export interface NewInstance {
  name: string;
  mc_version: string;
  loader: LoaderInfo | null;
  icon: string | null;
}

// ---- Accounts ----
export const listAccounts = () => invoke<AccountInfo[]>("list_accounts");
export const loginMicrosoft = () => invoke<AccountInfo[]>("login_microsoft");
export const setActiveAccount = (uuid: string) =>
  invoke<AccountInfo[]>("set_active_account", { uuid });
export const removeAccount = (uuid: string) =>
  invoke<AccountInfo[]>("remove_account", { uuid });

// ---- Instances ----
export const listInstances = () => invoke<Instance[]>("list_instances");
export const createInstance = (data: NewInstance) =>
  invoke<Instance>("create_instance", { data });
export const updateInstance = (instance: Instance) =>
  invoke<Instance>("update_instance", { instance });
export const deleteInstance = (id: string) =>
  invoke<void>("delete_instance", { id });
export const duplicateInstance = (id: string) =>
  invoke<Instance>("duplicate_instance", { id });

// ---- Versions / launch ----
export const listVersions = () => invoke<VersionInfo[]>("list_versions");

export interface LoaderVersion {
  version: string;
  stable: boolean;
}

export const listLoaderVersions = (loader: LoaderKind, mcVersion: string) =>
  invoke<LoaderVersion[]>("list_loader_versions", { loader, mcVersion });

export interface LaunchRequest {
  instanceId: string;
  defaultRamMb?: number;
  defaultJavaArgs?: string;
}

export const launchMinecraft = (req: LaunchRequest) =>
  invoke<void>("launch_minecraft", {
    request: {
      instance_id: req.instanceId,
      default_ram_mb: req.defaultRamMb ?? null,
      default_java_args: req.defaultJavaArgs ?? null,
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
