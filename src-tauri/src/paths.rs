//! Centralized on-disk layout.
//!
//! ```text
//! <app data>/
//!   shared/            single shared game_dir: versions, libraries, assets, runtimes (Java)
//!   instances/<id>/    per-instance Profile working dir: mods, saves, config, instance.json
//! ```
//!
//! All instances point at the SAME `shared/` game_dir, so the same MC version is
//! only downloaded once. Each instance gets its own `instances/<id>/` folder.

use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn app_data(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|e| e.to_string())
}

/// Shared game directory (versions/libraries/assets/runtimes) for all instances.
pub fn shared_dir(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_data(app)?.join("shared"))
}

/// Root directory containing all instance folders.
/// Honors a user-configured instance directory if set (Settings).
pub fn instances_dir(app: &AppHandle) -> Result<PathBuf, String> {
    if let Some(dir) = crate::app_settings::instance_dir_override(app) {
        return Ok(dir);
    }
    Ok(app_data(app)?.join("instances"))
}

/// A single instance's folder.
pub fn instance_dir(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    Ok(instances_dir(app)?.join(id))
}

/// A single instance's mods folder.
pub fn instance_mods_dir(app: &AppHandle, id: &str) -> Result<PathBuf, String> {
    Ok(instance_dir(app, id)?.join("mods"))
}
