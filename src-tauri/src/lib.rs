mod accounts;
mod app_settings;
mod instances;
mod launch;
mod loaders;
mod modpack;
mod mods;
mod modrinth;
mod paths;
mod prism;

use accounts::AccountStore;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
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
            instances::toggle_mod,
            instances::delete_mod_file,
            mods::list_mods,
            instances::list_instance_files,
            instances::instance_path,
            launch::list_versions,
            launch::launch_minecraft,
            loaders::list_loader_versions,
            modrinth::modrinth_search,
            modrinth::modrinth_project,
            modrinth::modrinth_resolve,
            modrinth::modrinth_install,
            modrinth::remove_mod,
            modpack::inspect_modpack,
            modpack::import_mrpack,
            modpack::import_zip,
            prism::ensure_main_client,
            app_settings::get_app_settings,
            app_settings::set_app_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
