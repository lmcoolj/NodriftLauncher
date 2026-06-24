mod accounts;
mod launch;

use accounts::AccountStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(reqwest::Client::new())
        .manage(AccountStore::load())
        .invoke_handler(tauri::generate_handler![
            accounts::list_accounts,
            accounts::set_active_account,
            accounts::remove_account,
            accounts::login_microsoft,
            launch::list_versions,
            launch::launch_minecraft,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
