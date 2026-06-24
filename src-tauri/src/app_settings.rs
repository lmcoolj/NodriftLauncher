//! Backend-side app settings (just the instance directory for now).
//!
//! Most settings (accent, default RAM/Java args, resolution) live in the
//! frontend and flow into launch requests. The instance directory must be known
//! by Rust so `paths` can resolve it, so it's persisted here in
//! `<app config>/settings.json`.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};

#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    /// Absolute instance directory. Empty/None = launcher default (app data).
    #[serde(default)]
    pub instance_dir: Option<String>,
}

fn settings_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?
        .join("settings.json"))
}

pub fn read(app: &AppHandle) -> AppSettings {
    settings_path(app)
        .ok()
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

/// The configured instance directory override, if any (non-empty).
pub fn instance_dir_override(app: &AppHandle) -> Option<std::path::PathBuf> {
    read(app)
        .instance_dir
        .filter(|s| !s.trim().is_empty())
        .map(std::path::PathBuf::from)
}

#[tauri::command]
pub fn get_app_settings(app: AppHandle) -> AppSettings {
    read(&app)
}

#[tauri::command]
pub fn set_app_settings(app: AppHandle, settings: AppSettings) -> Result<(), String> {
    let path = settings_path(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())
}
