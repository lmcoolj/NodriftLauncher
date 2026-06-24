//! Modpack import: `.mrpack` (Modrinth) and generic `.zip`.
//!
//! `.mrpack` carries `modrinth.index.json` with the MC version, loader, and a
//! list of files to download, plus an `overrides/` tree to copy in verbatim.
//! Generic `.zip` has no manifest, so the user supplies the version + loader and
//! we just extract the archive into a new instance.

use std::collections::HashMap;
use std::io::Read;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};
use zip::ZipArchive;

use crate::instances::{self, Instance, LoaderInfo, ModEntry, NewInstance};
use crate::paths;

const USER_AGENT: &str = "nodrift-launcher/0.1.0 (github.com/lmcoolj/nodrift)";

// ---------- modrinth.index.json ----------

#[derive(Debug, Deserialize)]
struct MrIndex {
    name: String,
    #[serde(default)]
    dependencies: HashMap<String, String>,
    #[serde(default)]
    files: Vec<MrIndexFile>,
}

#[derive(Debug, Deserialize)]
struct MrIndexFile {
    path: String,
    downloads: Vec<String>,
    #[serde(default)]
    env: Option<MrEnv>,
}

#[derive(Debug, Deserialize)]
struct MrEnv {
    #[serde(default)]
    client: Option<String>,
}

/// Preview info returned before the actual import.
#[derive(Debug, Serialize)]
pub struct ModpackInfo {
    /// "mrpack" | "zip"
    pub kind: String,
    pub name: String,
    pub mc_version: Option<String>,
    pub loader: Option<LoaderInfo>,
    pub mod_count: u32,
}

fn open_archive(path: &str) -> Result<ZipArchive<std::fs::File>, String> {
    let file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    ZipArchive::new(file).map_err(|e| format!("Not a valid archive: {e}"))
}

fn read_index(archive: &mut ZipArchive<std::fs::File>) -> Option<MrIndex> {
    let mut entry = archive.by_name("modrinth.index.json").ok()?;
    let mut s = String::new();
    entry.read_to_string(&mut s).ok()?;
    serde_json::from_str(&s).ok()
}

fn loader_from_deps(deps: &HashMap<String, String>) -> Option<LoaderInfo> {
    for (key, kind) in [
        ("fabric-loader", "fabric"),
        ("quilt-loader", "quilt"),
        ("neoforge", "neoforge"),
        ("forge", "forge"),
    ] {
        if let Some(version) = deps.get(key) {
            return Some(LoaderInfo {
                kind: kind.to_string(),
                version: version.clone(),
            });
        }
    }
    None
}

#[tauri::command]
pub fn inspect_modpack(path: String) -> Result<ModpackInfo, String> {
    let mut archive = open_archive(&path)?;

    if let Some(index) = read_index(&mut archive) {
        return Ok(ModpackInfo {
            kind: "mrpack".to_string(),
            name: index.name,
            mc_version: index.dependencies.get("minecraft").cloned(),
            loader: loader_from_deps(&index.dependencies),
            mod_count: index.files.len() as u32,
        });
    }

    // Generic zip: name from the file stem, count jars under mods/.
    let stem = Path::new(&path)
        .file_stem()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "Imported pack".to_string());
    let mut mods = 0u32;
    for i in 0..archive.len() {
        if let Ok(f) = archive.by_index(i) {
            let name = f.name();
            if name.contains("mods/") && name.ends_with(".jar") {
                mods += 1;
            }
        }
    }
    Ok(ModpackInfo {
        kind: "zip".to_string(),
        name: stem,
        mc_version: None,
        loader: None,
        mod_count: mods,
    })
}

/// Resolve a zip entry to a safe path inside `base` (guards against zip-slip).
fn safe_join(base: &Path, rel: &Path) -> Option<PathBuf> {
    let mut out = base.to_path_buf();
    for comp in rel.components() {
        match comp {
            std::path::Component::Normal(c) => out.push(c),
            std::path::Component::CurDir => {}
            _ => return None, // reject .. and absolute/root components
        }
    }
    Some(out)
}

/// Extract entries whose name starts with `prefix` into `dest`, stripping it.
fn extract_prefixed(
    archive: &mut ZipArchive<std::fs::File>,
    prefix: &str,
    dest: &Path,
) -> Result<(), String> {
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let Some(enclosed) = entry.enclosed_name() else {
            continue;
        };
        let name = enclosed.to_string_lossy().replace('\\', "/");
        let Some(rel) = name.strip_prefix(prefix) else {
            continue;
        };
        if rel.is_empty() {
            continue;
        }
        let Some(target) = safe_join(dest, Path::new(rel)) else {
            continue;
        };
        if entry.is_dir() {
            std::fs::create_dir_all(&target).map_err(|e| e.to_string())?;
            continue;
        }
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut buf = Vec::new();
        entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
        std::fs::write(&target, &buf).map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Parse a Modrinth CDN url to (project_id, version_id) for mod tracking.
/// e.g. https://cdn.modrinth.com/data/<PID>/versions/<VID>/<file>
fn parse_modrinth_url(url: &str) -> Option<(String, String)> {
    let segs: Vec<&str> = url.split('/').collect();
    let data_idx = segs.iter().position(|s| *s == "data")?;
    let pid = segs.get(data_idx + 1)?;
    if segs.get(data_idx + 2) != Some(&"versions") {
        return None;
    }
    let vid = segs.get(data_idx + 3)?;
    Some((pid.to_string(), vid.to_string()))
}

#[tauri::command]
pub async fn import_mrpack(
    app: AppHandle,
    http: State<'_, reqwest::Client>,
    path: String,
) -> Result<Instance, String> {
    let index = {
        let mut archive = open_archive(&path)?;
        read_index(&mut archive).ok_or("modrinth.index.json not found in .mrpack")?
    };

    let mc_version = index
        .dependencies
        .get("minecraft")
        .cloned()
        .ok_or("Modpack is missing its Minecraft version")?;
    let loader = loader_from_deps(&index.dependencies);

    let instance = instances::create_instance(
        app.clone(),
        NewInstance {
            name: index.name.clone(),
            mc_version,
            loader,
            icon: Some("📦".to_string()),
        },
    )?;

    let instance_root = paths::instance_dir(&app, &instance.id)?;
    let mut mods: Vec<ModEntry> = Vec::new();

    // Download every client-relevant file to its declared path.
    for file in &index.files {
        if file
            .env
            .as_ref()
            .and_then(|e| e.client.as_deref())
            .map(|c| c == "unsupported")
            .unwrap_or(false)
        {
            continue;
        }
        let url = file.downloads.first().ok_or("Modpack file has no download URL")?;
        let Some(target) = safe_join(&instance_root, Path::new(&file.path)) else {
            continue; // reject unsafe paths
        };
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let bytes = http
            .get(url)
            .header("User-Agent", USER_AGENT)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?
            .bytes()
            .await
            .map_err(|e| e.to_string())?;
        std::fs::write(&target, &bytes).map_err(|e| e.to_string())?;

        // Track jars under mods/ so they show as installed.
        if file.path.replace('\\', "/").starts_with("mods/") {
            let filename = Path::new(&file.path)
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_else(|| file.path.clone());
            let (project_id, version_id) =
                parse_modrinth_url(url).unwrap_or_default();
            mods.push(ModEntry {
                project_id,
                version_id,
                name: filename.clone(),
                file_name: filename,
                enabled: true,
            });
        }
    }

    // Copy overrides (and client-overrides) verbatim into the instance.
    {
        let mut archive = open_archive(&path)?;
        extract_prefixed(&mut archive, "overrides/", &instance_root)?;
        extract_prefixed(&mut archive, "client-overrides/", &instance_root)?;
    }

    let mut instance = instances::load_instance(&app, &instance.id)?;
    instance.mods = mods;
    instances::save_instance(&app, &instance)?;
    Ok(instance)
}

#[tauri::command]
pub fn import_zip(
    app: AppHandle,
    path: String,
    name: String,
    mc_version: String,
    loader: Option<LoaderInfo>,
) -> Result<Instance, String> {
    let instance = instances::create_instance(
        app.clone(),
        NewInstance {
            name,
            mc_version,
            loader,
            icon: Some("📦".to_string()),
        },
    )?;
    let instance_root = paths::instance_dir(&app, &instance.id)?;

    // Strip a single common top-level folder if the whole zip is nested in one.
    let mut archive = open_archive(&path)?;
    let prefix = common_top_level(&mut archive);
    extract_prefixed(&mut archive, &prefix, &instance_root)?;

    // Track any jars that landed in mods/.
    let mut instance = instances::load_instance(&app, &instance.id)?;
    let mods_dir = paths::instance_mods_dir(&app, &instance.id)?;
    if let Ok(entries) = std::fs::read_dir(&mods_dir) {
        for e in entries.flatten() {
            let fname = e.file_name().to_string_lossy().into_owned();
            if fname.ends_with(".jar") {
                instance.mods.push(ModEntry {
                    project_id: String::new(),
                    version_id: String::new(),
                    name: fname.clone(),
                    file_name: fname,
                    enabled: true,
                });
            }
        }
    }
    instances::save_instance(&app, &instance)?;
    Ok(instance)
}

/// If every entry shares one top-level directory, return "dir/" to strip it;
/// otherwise return "" (extract from the root).
fn common_top_level(archive: &mut ZipArchive<std::fs::File>) -> String {
    let mut top: Option<String> = None;
    for i in 0..archive.len() {
        let Ok(entry) = archive.by_index(i) else {
            return String::new();
        };
        let Some(enclosed) = entry.enclosed_name() else {
            return String::new();
        };
        let name = enclosed.to_string_lossy().replace('\\', "/");
        let first = name.split('/').next().unwrap_or("");
        if first.is_empty() {
            continue;
        }
        match &top {
            None => top = Some(first.to_string()),
            Some(t) if t != first => return String::new(),
            _ => {}
        }
    }
    match top {
        Some(t) => format!("{t}/"),
        None => String::new(),
    }
}
