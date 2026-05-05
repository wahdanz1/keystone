mod clipboard;
mod crypto;
mod db;
mod error;
mod vault;

use std::sync::Arc;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, State,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::db::{Collection, Item};
use crate::error::Result;
use crate::vault::{VaultState, VaultStatus};

type VaultStateRef<'a> = State<'a, Arc<VaultState>>;

fn toggle_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            window.hide().ok();
        } else {
            window.show().ok();
            window.set_focus().ok();
        }
    }
}

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
fn item_create(
    state: VaultStateRef<'_>,
    title: String,
    kind: String,
    value: String,
    notes: Option<String>,
    tags: Vec<String>,
    collection_id: Option<String>,
) -> Result<String> {
    state.create_item(
        &title,
        &kind,
        &value,
        notes.as_deref(),
        &tags,
        collection_id.as_deref(),
    )
}

#[tauri::command]
fn item_update(
    state: VaultStateRef<'_>,
    id: String,
    title: String,
    kind: String,
    value: String,
    notes: Option<String>,
    tags: Vec<String>,
    collection_id: Option<String>,
) -> Result<()> {
    state.update_item(
        &id,
        &title,
        &kind,
        &value,
        notes.as_deref(),
        &tags,
        collection_id.as_deref(),
    )
}

#[tauri::command]
fn collections_list(state: VaultStateRef<'_>) -> Result<Vec<Collection>> {
    state.list_collections()
}

#[tauri::command]
fn collection_create(state: VaultStateRef<'_>, name: String) -> Result<String> {
    state.create_collection(&name)
}

#[tauri::command]
fn collection_rename(state: VaultStateRef<'_>, id: String, name: String) -> Result<()> {
    state.rename_collection(&id, &name)
}

#[tauri::command]
fn collection_delete(state: VaultStateRef<'_>, id: String) -> Result<()> {
    state.delete_collection(&id)
}

#[tauri::command]
fn item_delete(state: VaultStateRef<'_>, id: String) -> Result<()> {
    state.delete_item(&id)
}

#[tauri::command]
fn item_set_favorite(state: VaultStateRef<'_>, id: String, favorite: bool) -> Result<()> {
    state.set_favorite(&id, favorite)
}

#[tauri::command]
fn item_mark_used(state: VaultStateRef<'_>, id: String) -> Result<()> {
    state.mark_used(&id)
}

#[tauri::command]
fn vault_export(state: VaultStateRef<'_>, path: String, passphrase: String) -> Result<usize> {
    state.export_vault(&path, &passphrase)
}

#[tauri::command]
fn vault_import(state: VaultStateRef<'_>, path: String, passphrase: String) -> Result<usize> {
    state.import_vault(&path, &passphrase)
}

#[tauri::command]
fn vault_data_dir(state: VaultStateRef<'_>) -> String {
    state.data_dir().to_string_lossy().into_owned()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_window(app);
                    }
                })
                .build(),
        )
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("could not resolve app data dir");
            std::fs::create_dir_all(&data_dir).ok();
            app.manage(Arc::new(VaultState::new(data_dir)));

            // Global hotkey: Ctrl+Shift+K (Cmd+Shift+K on macOS) toggles the window.
            app.global_shortcut().register("CmdOrCtrl+Shift+K")?;

            // System tray
            let show_hide =
                MenuItem::with_id(app, "show_hide", "Show / Hide Keystone", true, None::<&str>)?;
            let lock = MenuItem::with_id(app, "lock", "Lock Vault", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_hide, &lock, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Keystone")
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show_hide" => toggle_window(app),
                    "lock" => {
                        let vault = app.state::<Arc<VaultState>>();
                        vault.lock().ok();
                        app.emit("vault:locked", ()).ok();
                    }
                    "quit" => {
                        let vault = app.state::<Arc<VaultState>>();
                        vault.lock().ok();
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                window.hide().ok();
            }
        })
        .invoke_handler(tauri::generate_handler![
            vault_status,
            vault_create,
            vault_unlock,
            vault_lock,
            items_list,
            item_create,
            item_update,
            item_delete,
            item_set_favorite,
            item_mark_used,
            vault_export,
            vault_import,
            vault_data_dir,
            collections_list,
            collection_create,
            collection_rename,
            collection_delete,
            clipboard::clipboard_copy,
            clipboard::clipboard_clear,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
