//! Minecraft installation + launching, with progress/console streamed to the UI.
//!
//! All instances share one `shared/` game directory (versions/libraries/assets/
//! runtimes); each instance's mods/saves/config live in its own folder via a
//! lyceris `Profile`.

use lyceris::auth::{microsoft, AuthMethod};
use lyceris::minecraft::{
    config::{ConfigBuilder, Memory, Profile},
    emitter::{Emitter, Event},
    install::install,
    launch::launch,
    loader::{fabric::Fabric, forge::Forge, neoforge::NeoForge, quilt::Quilt, Loader},
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter as _, State};

use crate::accounts::{Account, AccountStore};
use crate::instances::{self, LoaderInfo};
use crate::paths;

impl LoaderInfo {
    fn into_loader(&self) -> Result<Box<dyn Loader>, String> {
        let v = self.version.clone();
        Ok(match self.kind.to_lowercase().as_str() {
            "fabric" => Fabric(v).into(),
            "quilt" => Quilt(v).into(),
            "forge" => Forge(v).into(),
            "neoforge" => NeoForge(v).into(),
            other => return Err(format!("Unknown mod loader: {other}")),
        })
    }
}

#[derive(Debug, Clone, Deserialize)]
pub struct LaunchRequest {
    pub instance_id: String,
    /// Global default RAM in MB (used when the instance has no override).
    pub default_ram_mb: Option<u64>,
    /// Global default JVM args (used when the instance has no override).
    pub default_java_args: Option<String>,
    /// Game window resolution.
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct VersionInfo {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
}

#[tauri::command]
pub async fn list_versions(http: State<'_, reqwest::Client>) -> Result<Vec<VersionInfo>, String> {
    let manifest: serde_json::Value = http
        .get("https://launchermeta.mojang.com/mc/game/version_manifest_v2.json")
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())?;

    let versions = manifest
        .get("versions")
        .and_then(|v| v.as_array())
        .ok_or("Malformed version manifest")?
        .iter()
        .filter_map(|v| {
            Some(VersionInfo {
                id: v.get("id")?.as_str()?.to_string(),
                kind: v.get("type")?.as_str()?.to_string(),
            })
        })
        .collect();
    Ok(versions)
}

fn status(app: &AppHandle, value: &str) {
    let _ = app.emit("mc-status", value);
}

/// Wire lyceris emitter events to Tauri events for the console + progress UI.
async fn build_emitter(app: &AppHandle) -> Emitter {
    let emitter = Emitter::default();

    let a = app.clone();
    emitter
        .on(Event::Console, move |line: String| {
            let _ = a.emit("mc-console", line);
        })
        .await;

    // Per-file progress drives the progress bar. We deliberately do NOT listen
    // to SingleDownloadProgress: lyceris emits that on every ~8 KB chunk, and
    // forwarding tens of thousands of those across the Rust→webview IPC boundary
    // (through the emitter's single async mutex) serializes the parallel
    // downloads and made first installs ~15x slower than they should be.
    let a = app.clone();
    emitter
        .on(
            Event::MultipleDownloadProgress,
            move |(_, current, total, _): (String, u64, u64, String)| {
                let _ = a.emit("mc-progress", (current, total));
            },
        )
        .await;

    emitter
}

/// Ensure the active account's token is valid, refreshing if needed.
async fn resolve_auth(http: &reqwest::Client, store: &AccountStore) -> Result<AuthMethod, String> {
    let account = store
        .active_account()
        .ok_or("No account signed in. Add a Microsoft account first.")?;

    let account = if microsoft::validate(account.exp) {
        account
    } else {
        let refreshed: Account = microsoft::refresh(account.refresh_token.clone(), http)
            .await
            .map_err(|e| format!("Token refresh failed, please sign in again: {e}"))?
            .into();
        store.replace(refreshed.clone())?;
        refreshed
    };

    Ok(AuthMethod::Microsoft {
        username: account.username,
        xuid: account.xuid,
        uuid: account.uuid,
        access_token: account.access_token,
        refresh_token: account.refresh_token,
    })
}

#[tauri::command]
pub async fn launch_minecraft(
    app: AppHandle,
    http: State<'_, reqwest::Client>,
    store: State<'_, AccountStore>,
    request: LaunchRequest,
) -> Result<(), String> {
    let instance = instances::load_instance(&app, &request.instance_id)?;
    let auth = resolve_auth(&http, &store).await?;

    let shared = paths::shared_dir(&app)?;
    let instances_root = paths::instances_dir(&app)?;
    std::fs::create_dir_all(&shared).map_err(|e| e.to_string())?;

    let emitter = build_emitter(&app).await;
    instances::touch_last_played(&app, &instance.id);

    // Shared game files; per-instance working dir via Profile.
    let mut builder = ConfigBuilder::new(shared, instance.mc_version.clone(), auth)
        .client((*http).clone())
        .profile(Profile {
            name: instance.id.clone(),
            root: instances_root,
        });

    // RAM: instance override, else global default.
    if let Some(mb) = instance.ram_mb.or(request.default_ram_mb) {
        builder = builder.memory(Memory::Megabyte(mb));
    }

    // JVM args: instance override, else global default.
    let java_args = instance.java_args.or(request.default_java_args);
    if let Some(args) = java_args {
        let parts: Vec<String> = args.split_whitespace().map(String::from).collect();
        if !parts.is_empty() {
            builder = builder.custom_java_args(parts);
        }
    }

    // Window resolution as Minecraft game args.
    if let (Some(w), Some(h)) = (request.width, request.height) {
        builder = builder.custom_args(vec![
            "--width".into(),
            w.to_string(),
            "--height".into(),
            h.to_string(),
        ]);
    }

    status(&app, "Installing");

    // The loader changes the Config's static type, so each branch runs the full
    // install → launch → wait sequence.
    macro_rules! run {
        ($config:expr) => {{
            let config = $config;
            install(&config, Some(&emitter))
                .await
                .map_err(|e| e.to_string())?;
            status(&app, "Launching");
            let mut child = launch(&config, Some(&emitter))
                .await
                .map_err(|e| e.to_string())?;
            status(&app, "Running");
            child.wait().await.map_err(|e| e.to_string())?;
        }};
    }

    if let Some(loader) = &instance.loader {
        let boxed = loader.into_loader()?;
        run!(builder.loader(boxed).build());
    } else {
        run!(builder.build());
    }

    status(&app, "Stopped");
    Ok(())
}
