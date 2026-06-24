//! Rich installed-mod listing: reads each jar's loader metadata
//! (fabric.mod.json / quilt.mod.json) to surface name, version, author, and the
//! embedded icon — so the mod list looks like a real mod manager, even for mods
//! with no Modrinth id (e.g. the bundled Main Client).

use std::io::Read;
use std::path::Path;

use base64::Engine;
use serde::Serialize;
use tauri::{AppHandle, State};

use crate::{instances, paths};

#[derive(Debug, Default, Serialize)]
pub struct ModInfo {
    /// Base filename (without a `.disabled` suffix).
    pub file_name: String,
    pub name: String,
    pub version: String,
    pub authors: String,
    pub description: String,
    /// Embedded icon as a data URL, if the jar has one.
    pub icon: Option<String>,
    pub enabled: bool,
    /// Modrinth project id if this mod was installed from Modrinth.
    pub project_id: Option<String>,
}

fn icon_data_url(archive: &mut zip::ZipArchive<std::fs::File>, path: &str) -> Option<String> {
    let mut entry = archive.by_name(path).ok()?;
    let mut buf = Vec::new();
    entry.read_to_end(&mut buf).ok()?;
    let mime = match Path::new(path).extension().and_then(|e| e.to_str()) {
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("svg") => "image/svg+xml",
        _ => "image/png",
    };
    Some(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(&buf)
    ))
}

fn authors_to_string(v: &serde_json::Value) -> String {
    v.as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|a| {
                    a.as_str()
                        .map(|s| s.to_string())
                        .or_else(|| a.get("name").and_then(|n| n.as_str()).map(String::from))
                })
                .collect::<Vec<_>>()
                .join(", ")
        })
        .unwrap_or_default()
}

/// Read metadata + icon from a single mod jar. Falls back to the filename.
fn read_mod(path: &Path, base_name: &str) -> ModInfo {
    let mut info = ModInfo {
        file_name: base_name.to_string(),
        name: base_name.trim_end_matches(".jar").to_string(),
        ..Default::default()
    };

    let Ok(file) = std::fs::File::open(path) else {
        return info;
    };
    let Ok(mut archive) = zip::ZipArchive::new(file) else {
        return info;
    };

    // Fabric
    if let Ok(meta) = read_json(&mut archive, "fabric.mod.json") {
        if let Some(n) = meta.get("name").and_then(|v| v.as_str()) {
            info.name = n.to_string();
        }
        if let Some(v) = meta.get("version").and_then(|v| v.as_str()) {
            info.version = v.to_string();
        }
        if let Some(d) = meta.get("description").and_then(|v| v.as_str()) {
            info.description = d.to_string();
        }
        if let Some(a) = meta.get("authors") {
            info.authors = authors_to_string(a);
        }
        if let Some(icon) = meta.get("icon").and_then(|v| v.as_str()) {
            info.icon = icon_data_url(&mut archive, icon);
        }
        return info;
    }

    // Quilt
    if let Ok(meta) = read_json(&mut archive, "quilt.mod.json") {
        let ql = meta.get("quilt_loader");
        if let Some(v) = ql.and_then(|q| q.get("version")).and_then(|v| v.as_str()) {
            info.version = v.to_string();
        }
        if let Some(md) = ql.and_then(|q| q.get("metadata")) {
            if let Some(n) = md.get("name").and_then(|v| v.as_str()) {
                info.name = n.to_string();
            }
            if let Some(d) = md.get("description").and_then(|v| v.as_str()) {
                info.description = d.to_string();
            }
            if let Some(icon) = md.get("icon").and_then(|v| v.as_str()) {
                let icon = icon.to_string();
                info.icon = icon_data_url(&mut archive, &icon);
            }
            if let Some(c) = md.get("contributors").and_then(|v| v.as_object()) {
                info.authors = c.keys().cloned().collect::<Vec<_>>().join(", ");
            }
        }
        return info;
    }

    info
}

fn read_json(
    archive: &mut zip::ZipArchive<std::fs::File>,
    name: &str,
) -> Result<serde_json::Value, ()> {
    let mut entry = archive.by_name(name).map_err(|_| ())?;
    let mut s = String::new();
    entry.read_to_string(&mut s).map_err(|_| ())?;
    serde_json::from_str(&s).map_err(|_| ())
}

#[tauri::command]
pub fn list_mods(app: AppHandle, id: String) -> Result<Vec<ModInfo>, String> {
    let mods_dir = paths::instance_mods_dir(&app, &id)?;
    // Map base filename -> Modrinth project id from the tracked list.
    let project_ids: std::collections::HashMap<String, String> = instances::load_instance(&app, &id)
        .map(|i| {
            i.mods
                .into_iter()
                .filter(|m| !m.project_id.is_empty())
                .map(|m| (m.file_name, m.project_id))
                .collect()
        })
        .unwrap_or_default();

    let mut out: Vec<ModInfo> = Vec::new();
    if let Ok(entries) = std::fs::read_dir(&mods_dir) {
        for e in entries.flatten() {
            let raw = e.file_name().to_string_lossy().into_owned();
            let (base, enabled) = match raw.strip_suffix(".disabled") {
                Some(b) => (b.to_string(), false),
                None => (raw.clone(), true),
            };
            if !base.ends_with(".jar") {
                continue;
            }
            let mut info = read_mod(&e.path(), &base);
            info.enabled = enabled;
            info.project_id = project_ids.get(&base).cloned();
            out.push(info);
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}
