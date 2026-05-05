//! Cross-platform clipboard helpers.
//!
//! On Windows we use the WinRT clipboard API directly so we can mark
//! content as `IsAllowedInHistory = false` and `IsRoamable = false` —
//! this keeps copied secrets out of the Win+V history and out of cloud
//! sync. Other platforms fall back to the standard Tauri clipboard plugin.

use tauri::AppHandle;
#[cfg(not(target_os = "windows"))]
use tauri_plugin_clipboard_manager::ClipboardExt;

#[cfg(target_os = "windows")]
mod win {
    use windows::core::HSTRING;
    use windows::ApplicationModel::DataTransfer::{
        Clipboard, ClipboardContentOptions, DataPackage,
    };

    pub fn set_text(text: &str) -> Result<(), String> {
        let package = DataPackage::new().map_err(|e| e.to_string())?;
        package
            .SetText(&HSTRING::from(text))
            .map_err(|e| e.to_string())?;
        let options = ClipboardContentOptions::new().map_err(|e| e.to_string())?;
        options
            .SetIsAllowedInHistory(false)
            .map_err(|e| e.to_string())?;
        options
            .SetIsRoamable(false)
            .map_err(|e| e.to_string())?;
        Clipboard::SetContentWithOptions(&package, &options).map_err(|e| e.to_string())?;
        Clipboard::Flush().map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn clear() -> Result<(), String> {
        Clipboard::Clear().map_err(|e| e.to_string())?;
        Ok(())
    }
}

#[tauri::command]
pub fn clipboard_copy(app: AppHandle, text: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _ = app;
        win::set_text(&text)
    }
    #[cfg(not(target_os = "windows"))]
    {
        app.clipboard().write_text(text).map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub fn clipboard_clear(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _ = app;
        win::clear()
    }
    #[cfg(not(target_os = "windows"))]
    {
        app.clipboard()
            .write_text(String::new())
            .map_err(|e| e.to_string())
    }
}
