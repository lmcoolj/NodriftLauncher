//! Minecraft installation + launching, with progress/console streamed to the UI.

use lyceris::auth::{microsoft, AuthMethod};
use lyceris::minecraft::{
    config::ConfigBuilder,
    emitter::{Emitter, Event},
    install::install,
    launch::launch,
    loader::{fabric::Fabric, forge::Forge, neoforge::NeoForge, quilt::Quilt, Loader},
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter as _, Manager, State};

use crate::accounts::{Account, AccountStore};

/// A mod loader selection coming from the frontend.
#[derive(Debug, Clone, Deserialize)]
pub struct LoaderSelection {
    /// "fabric" | "quilt" | "forge" | "neoforge"
    pub kind: String,
    pub version: String,
}

impl LoaderSelection {
    fn into_loader(self) -> Result<Box<dyn Loader>, String> {
        let v = self.version;
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
pub struct LaunchOptions {
    pub version: String,
    pub loader: Option<LoaderSelection>,
    /// Absolute game directory. If omitted, a shared "quicklaunch" dir is used.
    pub game_dir: Option<String>,
    pub java_args: Option<Vec<String>>,
}

/// A version entry from Mojang's manifest.
#[derive(Debug, Clone, Serialize)]
pub struct VersionInfo {
    pub id: String,
    #[serde(rename = "type")]
    pub kind: String,
}

#[tauri::command]
pub async fn list_versions(
    http: State<'_, reqwest::Client>,
) -> Result<Vec<VersionInfo>, String> {
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

/// Emit a small status string the UI can show (e.g. "Installing…", "Running").
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

    let a = app.clone();
    emitter
        .on(
            Event::MultipleDownloadProgress,
            move |(_, current, total, _): (String, u64, u64, String)| {
                let _ = a.emit("mc-progress", (current, total));
            },
        )
        .await;

    let a = app.clone();
    emitter
        .on(
            Event::SingleDownloadProgress,
            move |(path, current, total): (String, u64, u64)| {
                let _ = a.emit("mc-progress-single", (path, current, total));
            },
        )
        .await;

    emitter
}

/// Ensure the active account's token is valid, refreshing if needed, and return
/// it as a lyceris [`AuthMethod`].
async fn resolve_auth(
    http: &reqwest::Client,
    store: &AccountStore,
) -> Result<AuthMethod, String> {
    let account = store
        .active_account()
        .ok_or("No account signed in. Add a Microsoft account first.")?;

    let account = if microsoft::validate(account.exp) {
        account
    } else {
        // Token expired — refresh and persist.
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
    options: LaunchOptions,
) -> Result<(), String> {
    let auth = resolve_auth(&http, &store).await?;

    let game_dir = match &options.game_dir {
        Some(dir) => std::path::PathBuf::from(dir),
        None => app
            .path()
            .app_data_dir()
            .map_err(|e| e.to_string())?
            .join("instances")
            .join("quicklaunch"),
    };
    std::fs::create_dir_all(&game_dir).map_err(|e| e.to_string())?;

    let emitter = build_emitter(&app).await;

    let mut builder = ConfigBuilder::new(game_dir, options.version.clone(), auth)
        .client((*http).clone());
    if let Some(args) = options.java_args.filter(|a| !a.is_empty()) {
        builder = builder.custom_java_args(args);
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

    if let Some(selection) = options.loader {
        let loader = selection.into_loader()?;
        run!(builder.loader(loader).build());
    } else {
        run!(builder.build());
    }

    status(&app, "Stopped");
    Ok(())
}
