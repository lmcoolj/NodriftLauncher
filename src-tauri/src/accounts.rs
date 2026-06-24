//! Microsoft / Xbox Live account management.
//!
//! Tokens are persisted securely in the OS keychain (Windows Credential
//! Manager / macOS Keychain) as a single JSON blob. The frontend only ever
//! receives non-sensitive [`AccountInfo`] — access/refresh tokens never leave
//! the Rust side.

use std::sync::{Arc, Mutex};

use lyceris::auth::microsoft;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

const KEYRING_SERVICE: &str = "com.kookoo.launcher";
const KEYRING_USER: &str = "accounts";
const LOGIN_WINDOW: &str = "ms-login";

/// A stored account, including secret tokens. Never serialized to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Account {
    pub xuid: String,
    pub uuid: String,
    pub username: String,
    pub access_token: String,
    pub refresh_token: String,
    pub exp: u64,
    pub client_id: String,
}

impl From<microsoft::MinecraftAccount> for Account {
    fn from(a: microsoft::MinecraftAccount) -> Self {
        Account {
            xuid: a.xuid,
            uuid: a.uuid,
            username: a.username,
            access_token: a.access_token,
            refresh_token: a.refresh_token,
            exp: a.exp,
            client_id: a.client_id,
        }
    }
}

/// Whole persisted account set.
#[derive(Debug, Default, Clone, Serialize, Deserialize)]
pub struct AccountsData {
    pub accounts: Vec<Account>,
    /// UUID of the active account, if any.
    pub active: Option<String>,
}

/// Non-sensitive view sent to the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct AccountInfo {
    pub uuid: String,
    pub username: String,
    pub active: bool,
    /// True if the access token has expired and needs a refresh.
    pub expired: bool,
}

impl AccountsData {
    fn to_info(&self) -> Vec<AccountInfo> {
        self.accounts
            .iter()
            .map(|a| AccountInfo {
                uuid: a.uuid.clone(),
                username: a.username.clone(),
                active: self.active.as_deref() == Some(a.uuid.as_str()),
                expired: !microsoft::validate(a.exp),
            })
            .collect()
    }

    /// Insert or replace by UUID, and make it the active account.
    fn upsert(&mut self, account: Account) {
        let uuid = account.uuid.clone();
        if let Some(existing) = self.accounts.iter_mut().find(|a| a.uuid == uuid) {
            *existing = account;
        } else {
            self.accounts.push(account);
        }
        self.active = Some(uuid);
    }
}

fn keyring_entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())
}

fn load_from_keyring() -> AccountsData {
    match keyring_entry().and_then(|e| e.get_password().map_err(|err| err.to_string())) {
        Ok(json) => serde_json::from_str(&json).unwrap_or_default(),
        Err(_) => AccountsData::default(), // no entry yet, or locked — start empty
    }
}

fn save_to_keyring(data: &AccountsData) -> Result<(), String> {
    let json = serde_json::to_string(data).map_err(|e| e.to_string())?;
    keyring_entry()?
        .set_password(&json)
        .map_err(|e| e.to_string())
}

/// In-memory account cache, kept in sync with the keychain.
pub struct AccountStore(pub Mutex<AccountsData>);

impl AccountStore {
    pub fn load() -> Self {
        AccountStore(Mutex::new(load_from_keyring()))
    }

    /// Return a clone of the active account (with tokens) for launching.
    pub fn active_account(&self) -> Option<Account> {
        let data = self.0.lock().unwrap();
        let active = data.active.as_ref()?;
        data.accounts.iter().find(|a| &a.uuid == active).cloned()
    }

    /// Replace the active account's stored tokens (used after a refresh).
    pub fn replace(&self, account: Account) -> Result<(), String> {
        let mut data = self.0.lock().unwrap();
        if let Some(existing) = data.accounts.iter_mut().find(|a| a.uuid == account.uuid) {
            *existing = account;
        }
        save_to_keyring(&data)
    }
}

#[tauri::command]
pub fn list_accounts(store: State<'_, AccountStore>) -> Vec<AccountInfo> {
    store.0.lock().unwrap().to_info()
}

#[tauri::command]
pub fn set_active_account(
    uuid: String,
    store: State<'_, AccountStore>,
) -> Result<Vec<AccountInfo>, String> {
    let mut data = store.0.lock().unwrap();
    if data.accounts.iter().any(|a| a.uuid == uuid) {
        data.active = Some(uuid);
        save_to_keyring(&data)?;
    }
    Ok(data.to_info())
}

#[tauri::command]
pub fn remove_account(
    uuid: String,
    store: State<'_, AccountStore>,
) -> Result<Vec<AccountInfo>, String> {
    let mut data = store.0.lock().unwrap();
    data.accounts.retain(|a| a.uuid != uuid);
    if data.active.as_deref() == Some(uuid.as_str()) {
        data.active = data.accounts.first().map(|a| a.uuid.clone());
    }
    save_to_keyring(&data)?;
    Ok(data.to_info())
}

/// Pull a query-string parameter out of a redirect URL.
fn query_param(url: &str, key: &str) -> Option<String> {
    let query = url.split_once('?')?.1;
    for pair in query.split('&') {
        let (k, v) = pair.split_once('=')?;
        if k == key {
            return Some(urlencoding_decode(v));
        }
    }
    None
}

/// Minimal percent-decoding (auth codes are URL-safe but may contain %xx).
fn urlencoding_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        match bytes[i] {
            b'%' if i + 2 < bytes.len() => {
                let hi = (bytes[i + 1] as char).to_digit(16);
                let lo = (bytes[i + 2] as char).to_digit(16);
                if let (Some(hi), Some(lo)) = (hi, lo) {
                    out.push((hi * 16 + lo) as u8);
                    i += 3;
                    continue;
                }
                out.push(bytes[i]);
                i += 1;
            }
            b'+' => {
                out.push(b' ');
                i += 1;
            }
            b => {
                out.push(b);
                i += 1;
            }
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Open the Microsoft login window, capture the OAuth `code` from the redirect,
/// exchange it for a Minecraft account, and persist it as the active account.
#[tauri::command]
pub async fn login_microsoft(
    app: AppHandle,
    http: State<'_, reqwest::Client>,
    store: State<'_, AccountStore>,
) -> Result<Vec<AccountInfo>, String> {
    // If a login window is somehow already open, close it first.
    if let Some(w) = app.get_webview_window(LOGIN_WINDOW) {
        let _ = w.close();
    }

    let link = microsoft::create_link().map_err(|e| e.to_string())?;
    let url = link
        .parse()
        .map_err(|_| "Microsoft returned an invalid auth URL".to_string())?;

    // The on_navigation callback (Fn, may fire many times) hands the result
    // back through this oneshot exactly once.
    let (tx, rx) = tokio::sync::oneshot::channel::<Result<String, String>>();
    let tx = Arc::new(Mutex::new(Some(tx)));

    let _window = WebviewWindowBuilder::new(&app, LOGIN_WINDOW, WebviewUrl::External(url))
        .title("Sign in with Microsoft")
        .inner_size(520.0, 720.0)
        .focused(true)
        .on_navigation(move |nav| {
            let s = nav.as_str();
            if s.starts_with("https://login.live.com/oauth20_desktop.srf") {
                let result = if let Some(code) = query_param(s, "code") {
                    Some(Ok(code))
                } else {
                    query_param(s, "error_description")
                        .or_else(|| query_param(s, "error"))
                        .map(Err)
                };
                if let Some(result) = result {
                    if let Some(tx) = tx.lock().unwrap().take() {
                        let _ = tx.send(result);
                    }
                    return false; // don't actually load the blank redirect page
                }
            }
            true
        })
        .build()
        .map_err(|e| e.to_string())?;

    // Wait for the redirect (or the user closing the window).
    let code = match rx.await {
        Ok(Ok(code)) => code,
        Ok(Err(err)) => {
            let _ = close_login_window(&app);
            return Err(err);
        }
        Err(_) => {
            return Err("Login was cancelled".to_string());
        }
    };
    let _ = close_login_window(&app);

    let account: Account = microsoft::authenticate(code, &http)
        .await
        .map_err(|e| e.to_string())?
        .into();

    let mut data = store.0.lock().unwrap();
    data.upsert(account);
    save_to_keyring(&data)?;
    Ok(data.to_info())
}

fn close_login_window(app: &AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(LOGIN_WINDOW) {
        w.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}
