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

/// A mod tracked as installed in this instance (populated by the Modrinth step).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModEntry {
    pub project_id: String,
    pub version_id: String,
    pub name: String,
    pub file_name: String,
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
