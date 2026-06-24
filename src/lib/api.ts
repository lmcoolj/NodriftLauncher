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
  enabled: boolean;
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

export interface ModInfo {
  file_name: string;
  name: string;
  version: string;
  authors: string;
  description: string;
  icon: string | null;
  enabled: boolean;
  project_id: string | null;
}
export const listMods = (id: string) => invoke<ModInfo[]>("list_mods", { id });

export const toggleMod = (id: string, fileName: string, enabled: boolean) =>
  invoke<Instance>("toggle_mod", { id, fileName, enabled });
export const deleteModFile = (id: string, fileName: string) =>
  invoke<Instance>("delete_mod_file", { id, fileName });

export interface FileEntry {
  name: string;
  is_dir: boolean;
  size: number;
}
export const listInstanceFiles = (id: string, rel: string) =>
  invoke<FileEntry[]>("list_instance_files", { id, rel });
export const instancePath = (id: string) =>
  invoke<string>("instance_path", { id });

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
  width?: number;
  height?: number;
}

export const killInstance = (instanceId: string) =>
  invoke<void>("kill_instance", { instanceId });

export const launchMinecraft = (req: LaunchRequest) =>
  invoke<void>("launch_minecraft", {
    request: {
      instance_id: req.instanceId,
      default_ram_mb: req.defaultRamMb ?? null,
      default_java_args: req.defaultJavaArgs ?? null,
      width: req.width ?? null,
      height: req.height ?? null,
    },
  });

// ---- App settings (backend: instance directory) ----
export interface AppSettings {
  instance_dir: string | null;
}
export const getAppSettings = () => invoke<AppSettings>("get_app_settings");
export const setAppSettings = (settings: AppSettings) =>
  invoke<void>("set_app_settings", { settings });

// ---- Modpack import ----
export interface ModpackInfo {
  kind: "mrpack" | "zip";
  name: string;
  mc_version: string | null;
  loader: LoaderInfo | null;
  mod_count: number;
}

export const inspectModpack = (path: string) =>
  invoke<ModpackInfo>("inspect_modpack", { path });

export const importMrpack = (path: string) =>
  invoke<Instance>("import_mrpack", { path });

export const importZip = (
  path: string,
  name: string,
  mcVersion: string,
  loader: LoaderInfo | null
) => invoke<Instance>("import_zip", { path, name, mcVersion, loader });

/** First-run: seed the bundled "Main Client". Returns it if just created. */
export const ensureMainClient = () =>
  invoke<Instance | null>("ensure_main_client");

// ---- Modrinth ----
export interface SearchHit {
  project_id: string;
  slug: string | null;
  title: string;
  description: string;
  author: string;
  downloads: number;
  icon_url: string | null;
  categories: string[];
}

export interface SearchResult {
  hits: SearchHit[];
  total_hits: number;
}

export interface PlanItem {
  project_id: string;
  version_id: string;
  title: string;
  filename: string;
  url: string;
  is_dependency: boolean;
}

export interface InstallPlan {
  items: PlanItem[];
}

export const modrinthSearch = (
  query: string,
  mcVersion: string,
  loader: string | null,
  offset: number
) =>
  invoke<SearchResult>("modrinth_search", {
    query,
    mcVersion,
    loader: loader ?? null,
    offset,
  });

export interface ProjectDetail {
  title: string;
  description: string;
  body: string;
  icon_url: string | null;
  downloads: number;
  followers: number;
  categories: string[];
  gallery: string[];
  source_url: string | null;
  issues_url: string | null;
  wiki_url: string | null;
}
export const modrinthProject = (projectId: string) =>
  invoke<ProjectDetail>("modrinth_project", { projectId });

export const modrinthResolve = (instanceId: string, projectId: string) =>
  invoke<InstallPlan>("modrinth_resolve", { instanceId, projectId });

export const modrinthInstall = (instanceId: string, items: PlanItem[]) =>
  invoke<Instance>("modrinth_install", { instanceId, items });

export const removeMod = (instanceId: string, projectId: string) =>
  invoke<Instance>("remove_mod", { instanceId, projectId });

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
