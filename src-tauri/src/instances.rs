//! Instance management: create / rename / delete / duplicate, persisted as
//! `instances/<id>/instance.json`. Instances share the global `shared/` game
//! directory; only mods/saves/config live in the instance folder.

use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::paths;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderInfo {
    /// "fabric" | "quilt" | "forge" | "neoforge"
    pub kind: String,
    pub version: String,
}

fn default_true() -> bool {
    true
}

/// A mod tracked as installed in this instance (populated by the Modrinth step).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModEntry {
    pub project_id: String,
    pub version_id: String,
    pub name: String,
    /// The mod's base filename (the enabled `.jar` name).
    pub file_name: String,
    /// When false, the file on disk is `<file_name>.disabled` and ignored by the loader.
    #[serde(default = "default_true")]
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Instance {
    pub id: String,
    pub name: String,
    pub mc_version: String,
    pub loader: Option<LoaderInfo>,
    /// Emoji or short key shown on the instance card.
    pub icon: Option<String>,
    #[serde(default)]
    pub mods: Vec<ModEntry>,
    /// RAM override in MB (falls back to the global default when None).
    pub ram_mb: Option<u64>,
    /// JVM args override (falls back to the global default when None).
    pub java_args: Option<String>,
    pub created_at: u64,
    pub last_played: Option<u64>,
}

#[derive(Debug, Deserialize)]
pub struct NewInstance {
    pub name: String,
    pub mc_version: String,
    pub loader: Option<LoaderInfo>,
    pub icon: Option<String>,
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn read_instance(dir: &Path) -> Option<Instance> {
    let json = fs::read_to_string(dir.join("instance.json")).ok()?;
    serde_json::from_str(&json).ok()
}

fn write_instance(app: &AppHandle, instance: &Instance) -> Result<(), String> {
    let dir = paths::instance_dir(app, &instance.id)?;
    fs::create_dir_all(dir.join("mods")).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(instance).map_err(|e| e.to_string())?;
    fs::write(dir.join("instance.json"), json).map_err(|e| e.to_string())
}

/// Recursively copy a directory tree.
fn copy_dir(src: &Path, dst: &Path) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&from, &to)?;
        } else {
            fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn list_instances(app: AppHandle) -> Result<Vec<Instance>, String> {
    let dir = paths::instances_dir(&app)?;
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut out: Vec<Instance> = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| e.path().is_dir())
        .filter_map(|e| read_instance(&e.path()))
        .collect();
    // Newest first.
    out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(out)
}

#[tauri::command]
pub fn create_instance(app: AppHandle, data: NewInstance) -> Result<Instance, String> {
    let name = data.name.trim();
    if name.is_empty() {
        return Err("Instance name cannot be empty".into());
    }
    let instance = Instance {
        id: uuid::Uuid::new_v4().simple().to_string(),
        name: name.to_string(),
        mc_version: data.mc_version,
        loader: data.loader,
        icon: data.icon,
        mods: vec![],
        ram_mb: None,
        java_args: None,
        created_at: now(),
        last_played: None,
    };
    write_instance(&app, &instance)?;
    Ok(instance)
}

/// Persist edits. The `id` is taken from the supplied instance; the folder must
/// already exist.
#[tauri::command]
pub fn update_instance(app: AppHandle, instance: Instance) -> Result<Instance, String> {
    if !paths::instance_dir(&app, &instance.id)?.exists() {
        return Err("Instance not found".into());
    }
    if instance.name.trim().is_empty() {
        return Err("Instance name cannot be empty".into());
    }
    write_instance(&app, &instance)?;
    Ok(instance)
}

#[tauri::command]
pub fn delete_instance(app: AppHandle, id: String) -> Result<(), String> {
    let dir = paths::instance_dir(&app, &id)?;
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn duplicate_instance(app: AppHandle, id: String) -> Result<Instance, String> {
    let src_dir = paths::instance_dir(&app, &id)?;
    let mut instance = read_instance(&src_dir).ok_or("Instance not found")?;

    instance.id = uuid::Uuid::new_v4().simple().to_string();
    instance.name = format!("{} (copy)", instance.name);
    instance.created_at = now();
    instance.last_played = None;

    let dst_dir = paths::instance_dir(&app, &instance.id)?;
    copy_dir(&src_dir, &dst_dir).map_err(|e| e.to_string())?;
    // Overwrite the copied instance.json with the new id/name.
    write_instance(&app, &instance)?;
    Ok(instance)
}

/// Stamp `last_played` (called by the launch flow). Best-effort.
pub fn touch_last_played(app: &AppHandle, id: &str) {
    let dir = match paths::instance_dir(app, id) {
        Ok(d) => d,
        Err(_) => return,
    };
    if let Some(mut instance) = read_instance(&dir) {
        instance.last_played = Some(now());
        let _ = write_instance(app, &instance);
    }
}

/// Load an instance by id (used by the launch + mod-install flows).
pub fn load_instance(app: &AppHandle, id: &str) -> Result<Instance, String> {
    let dir = paths::instance_dir(app, id)?;
    read_instance(&dir).ok_or_else(|| "Instance not found".into())
}

/// Persist an instance (used by the Modrinth mod-install flow).
pub fn save_instance(app: &AppHandle, instance: &Instance) -> Result<(), String> {
    write_instance(app, instance)
}

/// Enable/disable a mod by toggling its `.jar` ↔ `.jar.disabled` on disk.
#[tauri::command]
pub fn toggle_mod(
    app: AppHandle,
    id: String,
    file_name: String,
    enabled: bool,
) -> Result<Instance, String> {
    let mut instance = load_instance(&app, &id)?;
    let mods_dir = paths::instance_mods_dir(&app, &id)?;
    let entry = instance
        .mods
        .iter_mut()
        .find(|m| m.file_name == file_name)
        .ok_or("Mod not found")?;

    let active = mods_dir.join(&file_name);
    let disabled = mods_dir.join(format!("{file_name}.disabled"));
    if enabled && disabled.exists() {
        std::fs::rename(&disabled, &active).map_err(|e| e.to_string())?;
    } else if !enabled && active.exists() {
        std::fs::rename(&active, &disabled).map_err(|e| e.to_string())?;
    }
    entry.enabled = enabled;
    save_instance(&app, &instance)?;
    Ok(instance)
}

/// Delete a mod by filename (handles enabled or disabled on disk).
#[tauri::command]
pub fn delete_mod_file(
    app: AppHandle,
    id: String,
    file_name: String,
) -> Result<Instance, String> {
    let mut instance = load_instance(&app, &id)?;
    let mods_dir = paths::instance_mods_dir(&app, &id)?;
    let _ = std::fs::remove_file(mods_dir.join(&file_name));
    let _ = std::fs::remove_file(mods_dir.join(format!("{file_name}.disabled")));
    instance.mods.retain(|m| m.file_name != file_name);
    save_instance(&app, &instance)?;
    Ok(instance)
}

/// A file/folder entry inside an instance, for the file browser.
#[derive(Debug, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub is_dir: bool,
    pub size: u64,
}

/// List the contents of `rel` (relative path) inside an instance's folder.
#[tauri::command]
pub fn list_instance_files(
    app: AppHandle,
    id: String,
    rel: String,
) -> Result<Vec<FileEntry>, String> {
    let root = paths::instance_dir(&app, &id)?;
    // Resolve rel safely (reject `..` / absolute components).
    let mut dir = root.clone();
    for comp in Path::new(&rel).components() {
        match comp {
            std::path::Component::Normal(c) => dir.push(c),
            std::path::Component::CurDir => {}
            _ => return Err("Invalid path".into()),
        }
    }

    let mut out: Vec<FileEntry> = Vec::new();
    if dir.is_dir() {
        for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let meta = entry.metadata().map_err(|e| e.to_string())?;
            out.push(FileEntry {
                name: entry.file_name().to_string_lossy().into_owned(),
                is_dir: meta.is_dir(),
                size: meta.len(),
            });
        }
    }
    // Folders first, then alphabetical.
    out.sort_by(|a, b| b.is_dir.cmp(&a.is_dir).then(a.name.cmp(&b.name)));
    Ok(out)
}

/// Absolute path to an instance's folder (for "open in file manager").
#[tauri::command]
pub fn instance_path(app: AppHandle, id: String) -> Result<String, String> {
    Ok(paths::instance_dir(&app, &id)?.to_string_lossy().into_owned())
}
