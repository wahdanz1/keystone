mod crypto;
mod db;
mod error;
mod vault;

use std::sync::Arc;

use tauri::{Manager, State};

use crate::db::Item;
use crate::error::Result;
use crate::vault::{VaultState, VaultStatus};

type VaultStateRef<'a> = State<'a, Arc<VaultState>>;

#[tauri::command]
fn vault_status(state: VaultStateRef<'_>) -> Result<VaultStatus> {
    state.status()
}

#[tauri::command]
fn vault_create(state: VaultStateRef<'_>, password: String) -> Result<()> {
    state.create(&password)
}

#[tauri::command]
fn vault_unlock(state: VaultStateRef<'_>, password: String) -> Result<()> {
    state.unlock(&password)
}

#[tauri::command]
fn vault_lock(state: VaultStateRef<'_>) -> Result<()> {
    state.lock()
}

#[tauri::command]
fn items_list(state: VaultStateRef<'_>) -> Result<Vec<Item>> {
    state.list_items()
}

#[tauri::command]
fn item_set_favorite(state: VaultStateRef<'_>, id: String, favorite: bool) -> Result<()> {
    state.set_favorite(&id, favorite)
}

#[tauri::command]
fn item_mark_used(state: VaultStateRef<'_>, id: String) -> Result<()> {
    state.mark_used(&id)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("could not resolve app data dir");
            std::fs::create_dir_all(&data_dir).ok();
            app.manage(Arc::new(VaultState::new(data_dir)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            vault_status,
            vault_create,
            vault_unlock,
            vault_lock,
            items_list,
            item_set_favorite,
            item_mark_used,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
