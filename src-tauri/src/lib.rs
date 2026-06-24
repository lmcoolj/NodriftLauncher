mod accounts;
mod instances;
mod launch;
mod loaders;
mod modrinth;
mod paths;

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
            instances::list_instances,
            instances::create_instance,
            instances::update_instance,
            instances::delete_instance,
            instances::duplicate_instance,
            launch::list_versions,
            launch::launch_minecraft,
            loaders::list_loader_versions,
            modrinth::modrinth_search,
            modrinth::modrinth_resolve,
            modrinth::modrinth_install,
            modrinth::remove_mod,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
