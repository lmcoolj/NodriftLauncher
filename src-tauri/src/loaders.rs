//! Fetch available mod-loader versions for a given Minecraft version.
//!
//! Each loader returns the version string in exactly the form lyceris expects:
//! - Fabric / Quilt: the loader version (e.g. "0.16.9")
//! - NeoForge: the bare NeoForge version (e.g. "21.1.95")
//! - Forge: the bare build number (e.g. "52.0.63") — lyceris prepends the MC
//!   version itself when building the installer URL.

use serde::Serialize;
use tauri::State;

#[derive(Debug, Clone, Serialize)]
pub struct LoaderVersion {
    pub version: String,
    pub stable: bool,
}

/// Numeric sort key so "21.1.100" > "21.1.95" (lexical sort would get this wrong).
fn version_key(v: &str) -> Vec<u64> {
    v.split(|c: char| c == '.' || c == '-' || c == '+')
        .map(|p| p.parse::<u64>().unwrap_or(0))
        .collect()
}

#[tauri::command]
pub async fn list_loader_versions(
    http: State<'_, reqwest::Client>,
    loader: String,
    mc_version: String,
) -> Result<Vec<LoaderVersion>, String> {
    match loader.to_lowercase().as_str() {
        "fabric" => fabric(&http, &mc_version).await,
        "quilt" => quilt(&http, &mc_version).await,
        "neoforge" => neoforge(&http, &mc_version).await,
        "forge" => forge(&http, &mc_version).await,
        other => Err(format!("Unknown loader: {other}")),
    }
}

async fn fetch_json(http: &reqwest::Client, url: &str) -> Result<serde_json::Value, String> {
    http.get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())
}

/// Fabric meta returns loaders newest-first already.
async fn fabric(http: &reqwest::Client, mc: &str) -> Result<Vec<LoaderVersion>, String> {
    let url = format!("https://meta.fabricmc.net/v2/versions/loader/{mc}");
    let arr = fetch_json(http, &url).await?;
    Ok(arr
        .as_array()
        .ok_or("Unexpected Fabric response")?
        .iter()
        .filter_map(|x| {
            let l = x.get("loader")?;
            Some(LoaderVersion {
                version: l.get("version")?.as_str()?.to_string(),
                stable: l.get("stable").and_then(|s| s.as_bool()).unwrap_or(false),
            })
        })
        .collect())
}

/// Quilt meta returns loaders newest-first; betas carry a "-beta.N" suffix.
async fn quilt(http: &reqwest::Client, mc: &str) -> Result<Vec<LoaderVersion>, String> {
    let url = format!("https://meta.quiltmc.org/v3/versions/loader/{mc}");
    let arr = fetch_json(http, &url).await?;
    Ok(arr
        .as_array()
        .ok_or("Unexpected Quilt response")?
        .iter()
        .filter_map(|x| {
            let version = x.get("loader")?.get("version")?.as_str()?.to_string();
            let stable = !version.contains('-');
            Some(LoaderVersion { version, stable })
        })
        .collect())
}

/// NeoForge versions encode the MC version: MC 1.21.1 -> neoforge 21.1.x,
/// MC 1.21 -> 21.0.x. Filter the maven listing by that prefix.
async fn neoforge(http: &reqwest::Client, mc: &str) -> Result<Vec<LoaderVersion>, String> {
    let parts: Vec<&str> = mc.split('.').collect();
    if parts.len() < 2 {
        return Ok(vec![]); // snapshots etc. have no NeoForge build
    }
    let prefix = format!("{}.{}.", parts[1], parts.get(2).copied().unwrap_or("0"));

    let url = "https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge";
    let resp = fetch_json(http, url).await?;
    let mut out: Vec<LoaderVersion> = resp
        .get("versions")
        .and_then(|v| v.as_array())
        .ok_or("Unexpected NeoForge response")?
        .iter()
        .filter_map(|v| v.as_str())
        .filter(|v| v.starts_with(&prefix))
        .map(|v| LoaderVersion {
            version: v.to_string(),
            stable: !v.contains("beta"),
        })
        .collect();
    out.sort_by(|a, b| version_key(&b.version).cmp(&version_key(&a.version)));
    Ok(out)
}

/// Forge publishes a maven-metadata.xml of all builds as "<mc>-<build>".
/// We strip the "<mc>-" prefix so lyceris gets the bare build number.
async fn forge(http: &reqwest::Client, mc: &str) -> Result<Vec<LoaderVersion>, String> {
    let url = "https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml";
    let xml = http
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    let prefix = format!("{mc}-");
    let mut out: Vec<LoaderVersion> = xml
        .split("<version>")
        .skip(1)
        .filter_map(|chunk| chunk.split("</version>").next())
        .filter(|v| v.starts_with(&prefix))
        // Some legacy builds append a branch suffix ("1.20.1-47.2.0-branch"); keep
        // only the build component after the MC prefix.
        .map(|v| {
            let rest = &v[prefix.len()..];
            let build = rest.split('-').next().unwrap_or(rest);
            LoaderVersion {
                version: build.to_string(),
                stable: true,
            }
        })
        .collect();
    out.sort_by(|a, b| version_key(&b.version).cmp(&version_key(&a.version)));
    out.dedup_by(|a, b| a.version == b.version);
    Ok(out)
}
