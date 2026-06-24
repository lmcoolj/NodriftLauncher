//! Prism / MultiMC instance import, and first-run seeding of the bundled
//! "Main Client" template.
//!
//! A Prism instance folder has `mmc-pack.json` (components → MC version + loader
//! version), `instance.cfg` (name, RAM, JVM args), and `minecraft/` (the game
//! working dir). We map that onto our instance model.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::Deserialize;
use tauri::{AppHandle, Manager};

use crate::instances::{self, Instance, LoaderInfo, ModEntry, NewInstance};
use crate::paths;

/// Top-level entries under `minecraft/` that are caches/logs/junk, never copied.
const EXCLUDE: &[&str] = &[
    ".bobby",
    ".fabric",
    ".mixin.out",
    "backups",
    "logs",
    "debug",
    "downloads",
    "screenshots",
    "crash-reports",
];

#[derive(Deserialize)]
struct MmcPack {
    components: Vec<MmcComponent>,
}

#[derive(Deserialize)]
struct MmcComponent {
    uid: String,
    version: Option<String>,
}

fn loader_from_uid(uid: &str) -> Option<&'static str> {
    match uid {
        "net.fabricmc.fabric-loader" => Some("fabric"),
        "org.quiltmc.quilt-loader" => Some("quilt"),
        "net.minecraftforge" => Some("forge"),
        "net.neoforged" => Some("neoforge"),
        _ => None,
    }
}

/// Parse `instance.cfg`'s `key=value` lines (quotes stripped).
fn parse_cfg(content: &str) -> HashMap<String, String> {
    content
        .lines()
        .filter_map(|line| {
            let line = line.trim();
            if line.starts_with('[') || !line.contains('=') {
                return None;
            }
            let (k, v) = line.split_once('=')?;
            let v = v.trim().trim_matches('"');
            Some((k.trim().to_string(), v.to_string()))
        })
        .collect()
}

/// Recursively copy a directory.
fn copy_dir(src: &Path, dst: &Path) -> std::io::Result<()> {
    std::fs::create_dir_all(dst)?;
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if entry.file_type()?.is_dir() {
            copy_dir(&from, &to)?;
        } else {
            std::fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

/// Import a Prism/MultiMC instance folder into a new launcher instance.
/// `base` is the folder containing mmc-pack.json, instance.cfg, minecraft/.
pub fn import_prism(
    app: &AppHandle,
    base: &Path,
    name_override: Option<&str>,
) -> Result<Instance, String> {
    let pack: MmcPack = serde_json::from_str(
        &std::fs::read_to_string(base.join("mmc-pack.json"))
            .map_err(|e| format!("Couldn't read mmc-pack.json: {e}"))?,
    )
    .map_err(|e| format!("Invalid mmc-pack.json: {e}"))?;

    let mut mc_version = None;
    let mut loader = None;
    for c in &pack.components {
        if c.uid == "net.minecraft" {
            mc_version = c.version.clone();
        } else if let Some(kind) = loader_from_uid(&c.uid) {
            if let Some(v) = &c.version {
                loader = Some(LoaderInfo {
                    kind: kind.to_string(),
                    version: v.clone(),
                });
            }
        }
    }
    let mc_version = mc_version.ok_or("Prism pack has no Minecraft version")?;

    let cfg = std::fs::read_to_string(base.join("instance.cfg"))
        .map(|s| parse_cfg(&s))
        .unwrap_or_default();

    let name = name_override
        .map(|s| s.to_string())
        .or_else(|| cfg.get("name").cloned())
        .unwrap_or_else(|| "Imported instance".to_string());

    let instance = instances::create_instance(
        app.clone(),
        NewInstance {
            name,
            mc_version,
            loader,
            icon: Some("🟪".to_string()),
        },
    )?;

    // Copy the game working dir (minecraft/) into the instance, skipping junk.
    let mc_src = base.join("minecraft");
    let dst = paths::instance_dir(app, &instance.id)?;
    if mc_src.is_dir() {
        for entry in std::fs::read_dir(&mc_src).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let name = entry.file_name();
            if EXCLUDE.contains(&name.to_string_lossy().as_ref()) {
                continue;
            }
            let from = entry.path();
            let to = dst.join(&name);
            if from.is_dir() {
                copy_dir(&from, &to).map_err(|e| e.to_string())?;
            } else {
                std::fs::copy(&from, &to).map_err(|e| e.to_string())?;
            }
        }
    }

    // Apply RAM / JVM-args overrides + track mods.
    let mut instance = instances::load_instance(app, &instance.id)?;
    if cfg.get("OverrideMemory").map(|v| v == "true").unwrap_or(false) {
        if let Some(mb) = cfg.get("MaxMemAlloc").and_then(|v| v.parse::<u64>().ok()) {
            instance.ram_mb = Some(mb);
        }
    }
    if cfg.get("OverrideJavaArgs").map(|v| v == "true").unwrap_or(false) {
        if let Some(args) = cfg.get("JvmArgs").filter(|a| !a.is_empty()) {
            instance.java_args = Some(args.clone());
        }
    }
    let mods_dir = paths::instance_mods_dir(app, &instance.id)?;
    if let Ok(entries) = std::fs::read_dir(&mods_dir) {
        for e in entries.flatten() {
            let fname = e.file_name().to_string_lossy().into_owned();
            if fname.ends_with(".jar") {
                instance.mods.push(ModEntry {
                    project_id: String::new(),
                    version_id: String::new(),
                    name: fname.clone(),
                    file_name: fname,
                });
            }
        }
    }
    instances::save_instance(app, &instance)?;
    Ok(instance)
}

/// Locate the bundled Main Client template among the resource-dir candidates.
fn find_template(app: &AppHandle) -> Option<PathBuf> {
    let rd = app.path().resource_dir().ok()?;
    for candidate in [
        rd.join("resources").join("main-client"),
        rd.join("main-client"),
    ] {
        if candidate.join("mmc-pack.json").exists() {
            return Some(candidate);
        }
    }
    None
}

/// On first run, copy the bundled "Main Client" template into the instances dir.
/// Returns the created instance, or None if already seeded / not bundled.
#[tauri::command]
pub fn ensure_main_client(app: AppHandle) -> Result<Option<Instance>, String> {
    let marker = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(".main-client-seeded");
    if marker.exists() {
        return Ok(None);
    }

    // Already present (e.g. user re-created it) — mark and skip.
    if instances::list_instances(app.clone())?
        .iter()
        .any(|i| i.name == "Main Client")
    {
        let _ = std::fs::write(&marker, b"1");
        return Ok(None);
    }

    let Some(template) = find_template(&app) else {
        return Ok(None); // not bundled (e.g. dev without staged resource) — retry next launch
    };

    let instance = import_prism(&app, &template, Some("Main Client"))?;
    if let Some(parent) = marker.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(&marker, b"1");
    Ok(Some(instance))
}
