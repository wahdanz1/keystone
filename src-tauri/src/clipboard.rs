//! Clipboard helpers — wraps the Tauri clipboard plugin so the frontend
//! can call a single `clipboard_copy` / `clipboard_clear` command without
//! caring about the platform.
//!
//! Note: a previous version of this module attempted to use the Win32
//! clipboard API directly to tag entries with the
//! `ExcludeClipboardContentFromMonitorProcessing` /
//! `CanIncludeInClipboardHistory` formats, opting them out of Win+V
//! history. That implementation broke the clipboard in some Tauri dev
//! configurations (clipboard writes appeared to succeed but pasted as
//! empty), so we've reverted to the plugin path. Win+V exclusion is
//! tracked as a follow-up.

use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

#[tauri::command]
pub fn clipboard_copy(app: AppHandle, text: String) -> Result<(), String> {
    app.clipboard().write_text(text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clipboard_clear(app: AppHandle) -> Result<(), String> {
    app.clipboard()
        .write_text(String::new())
        .map_err(|e| e.to_string())
}
