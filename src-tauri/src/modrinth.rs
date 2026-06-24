//! Modrinth integration (public API v2, no key).
//!
//! Search is compatibility-filtered to the selected instance's MC version and
//! mod loader via facets, so only installable mods are shown. Installing resolves
//! the latest compatible version, pulls in required dependencies, downloads the
//! files into the instance's `mods/` folder, and tracks them in instance.json.

use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, State};

use crate::instances::{self, ModEntry};
use crate::paths;

const API: &str = "https://api.modrinth.com/v2";
const USER_AGENT: &str = "kookoolauncher/0.1.0 (github.com/lmcoolj/kookoolauncher)";

// ---------- Search ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHit {
    pub project_id: String,
    pub slug: Option<String>,
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub downloads: u64,
    pub icon_url: Option<String>,
    #[serde(default)]
    pub categories: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct SearchResponse {
    hits: Vec<SearchHit>,
    total_hits: u32,
}

#[derive(Debug, Serialize)]
pub struct SearchResult {
    pub hits: Vec<SearchHit>,
    pub total_hits: u32,
}

#[tauri::command]
pub async fn modrinth_search(
    http: State<'_, reqwest::Client>,
    query: String,
    mc_version: String,
    loader: Option<String>,
    offset: u32,
) -> Result<SearchResult, String> {
    // facets: AND of [OR-groups]. Restrict to mods compatible with this instance.
    let mut facets: Vec<Vec<String>> = vec![
        vec!["project_type:mod".to_string()],
        vec![format!("versions:{mc_version}")],
    ];
    if let Some(loader) = loader.filter(|l| !l.is_empty()) {
        facets.push(vec![format!("categories:{loader}")]);
    }
    let facets_json = serde_json::to_string(&facets).map_err(|e| e.to_string())?;

    let resp: SearchResponse = http
        .get(format!("{API}/search"))
        .header("User-Agent", USER_AGENT)
        .query(&[
            ("query", query.as_str()),
            ("facets", facets_json.as_str()),
            ("limit", "20"),
            ("offset", &offset.to_string()),
            ("index", "relevance"),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    Ok(SearchResult {
        hits: resp.hits,
        total_hits: resp.total_hits,
    })
}

// ---------- Versions / install ----------

#[derive(Debug, Deserialize)]
struct MrVersion {
    id: String,
    #[serde(default)]
    dependencies: Vec<MrDependency>,
    files: Vec<MrFile>,
}

#[derive(Debug, Deserialize)]
struct MrDependency {
    project_id: Option<String>,
    dependency_type: String,
}

#[derive(Debug, Deserialize)]
struct MrFile {
    url: String,
    filename: String,
    #[serde(default)]
    primary: bool,
}

/// One file to be installed (the main mod or a required dependency).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanItem {
    pub project_id: String,
    pub version_id: String,
    pub title: String,
    pub filename: String,
    pub url: String,
    pub is_dependency: bool,
}

#[derive(Debug, Serialize)]
pub struct InstallPlan {
    pub items: Vec<PlanItem>,
}

/// Fetch the latest version of a project compatible with the given loader + MC version.
async fn latest_compatible(
    http: &reqwest::Client,
    project_id: &str,
    mc_version: &str,
    loader: &str,
) -> Result<Option<MrVersion>, String> {
    let loaders = format!("[\"{loader}\"]");
    let game_versions = format!("[\"{mc_version}\"]");
    let mut versions: Vec<MrVersion> = http
        .get(format!("{API}/project/{project_id}/version"))
        .header("User-Agent", USER_AGENT)
        .query(&[
            ("loaders", loaders.as_str()),
            ("game_versions", game_versions.as_str()),
        ])
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;
    // Modrinth returns versions newest-first.
    Ok(if versions.is_empty() {
        None
    } else {
        Some(versions.remove(0))
    })
}

fn primary_file(version: &MrVersion) -> Option<&MrFile> {
    version
        .files
        .iter()
        .find(|f| f.primary)
        .or_else(|| version.files.first())
}

/// Look up display titles for a set of project ids.
async fn project_titles(
    http: &reqwest::Client,
    ids: &[String],
) -> std::collections::HashMap<String, String> {
    if ids.is_empty() {
        return Default::default();
    }
    let ids_json = serde_json::to_string(ids).unwrap_or_default();
    #[derive(Deserialize)]
    struct P {
        id: String,
        title: String,
    }
    let result: Result<Vec<P>, _> = async {
        http.get(format!("{API}/projects"))
            .header("User-Agent", USER_AGENT)
            .query(&[("ids", ids_json.as_str())])
            .send()
            .await?
            .json()
            .await
    }
    .await;
    result
        .map(|ps| ps.into_iter().map(|p| (p.id, p.title)).collect())
        .unwrap_or_default()
}

/// Build an install plan: the chosen mod plus every required dependency not
/// already installed in the instance (resolved transitively).
#[tauri::command]
pub async fn modrinth_resolve(
    app: AppHandle,
    http: State<'_, reqwest::Client>,
    instance_id: String,
    project_id: String,
) -> Result<InstallPlan, String> {
    let instance = instances::load_instance(&app, &instance_id)?;
    let loader = instance
        .loader
        .as_ref()
        .map(|l| l.kind.clone())
        .ok_or("This instance has no mod loader, so mods can't be installed.")?;
    let mc = instance.mc_version.clone();

    let mut seen: HashSet<String> =
        instance.mods.iter().map(|m| m.project_id.clone()).collect();

    let mut items: Vec<PlanItem> = Vec::new();
    let mut queue: Vec<(String, bool)> = vec![(project_id.clone(), false)];

    while let Some((pid, is_dep)) = queue.pop() {
        if seen.contains(&pid) {
            continue;
        }
        seen.insert(pid.clone());

        let version = match latest_compatible(&http, &pid, &mc, &loader).await? {
            Some(v) => v,
            None => {
                if !is_dep {
                    return Err(format!(
                        "No version of this mod is compatible with {loader} {mc}."
                    ));
                }
                continue; // skip a dependency with no compatible build
            }
        };
        let file = primary_file(&version)
            .ok_or("Mod version has no downloadable file")?;

        items.push(PlanItem {
            project_id: pid.clone(),
            version_id: version.id.clone(),
            title: pid.clone(), // filled in below
            filename: file.filename.clone(),
            url: file.url.clone(),
            is_dependency: is_dep,
        });

        for dep in &version.dependencies {
            if dep.dependency_type == "required" {
                if let Some(dep_id) = &dep.project_id {
                    if !seen.contains(dep_id) {
                        queue.push((dep_id.clone(), true));
                    }
                }
            }
        }
    }

    // Fill in human-readable titles.
    let ids: Vec<String> = items.iter().map(|i| i.project_id.clone()).collect();
    let titles = project_titles(&http, &ids).await;
    for item in &mut items {
        if let Some(t) = titles.get(&item.project_id) {
            item.title = t.clone();
        }
    }

    Ok(InstallPlan { items })
}

/// Download the planned files into the instance's mods folder and track them.
#[tauri::command]
pub async fn modrinth_install(
    app: AppHandle,
    http: State<'_, reqwest::Client>,
    instance_id: String,
    items: Vec<PlanItem>,
) -> Result<instances::Instance, String> {
    let mut instance = instances::load_instance(&app, &instance_id)?;
    let mods_dir = paths::instance_mods_dir(&app, &instance_id)?;
    std::fs::create_dir_all(&mods_dir).map_err(|e| e.to_string())?;

    for item in items {
        let bytes = http
            .get(&item.url)
            .header("User-Agent", USER_AGENT)
            .send()
            .await
            .map_err(|e| e.to_string())?
            .error_for_status()
            .map_err(|e| e.to_string())?
            .bytes()
            .await
            .map_err(|e| e.to_string())?;
        std::fs::write(mods_dir.join(&item.filename), &bytes).map_err(|e| e.to_string())?;

        // Replace any existing entry for this project, else add.
        let entry = ModEntry {
            project_id: item.project_id.clone(),
            version_id: item.version_id,
            name: item.title,
            file_name: item.filename,
        };
        if let Some(existing) = instance
            .mods
            .iter_mut()
            .find(|m| m.project_id == entry.project_id)
        {
            *existing = entry;
        } else {
            instance.mods.push(entry);
        }
    }

    instances::save_instance(&app, &instance)?;
    Ok(instance)
}

/// Remove an installed mod (delete its file and untrack it).
#[tauri::command]
pub fn remove_mod(
    app: AppHandle,
    instance_id: String,
    project_id: String,
) -> Result<instances::Instance, String> {
    let mut instance = instances::load_instance(&app, &instance_id)?;
    let mods_dir = paths::instance_mods_dir(&app, &instance_id)?;

    if let Some(pos) = instance.mods.iter().position(|m| m.project_id == project_id) {
        let entry = instance.mods.remove(pos);
        let _ = std::fs::remove_file(mods_dir.join(&entry.file_name));
        instances::save_instance(&app, &instance)?;
    }
    Ok(instance)
}
