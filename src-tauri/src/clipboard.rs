//! Clipboard helpers.
//!
//! On Windows we can opt copied content out of Win+V history by writing
//! via the Win32 clipboard API and tagging the entry with the registered
//! `CanIncludeInClipboardHistory` format set to `0`. The Win32 path is
//! best-effort — if anything fails we log to stderr and fall back to the
//! Tauri plugin so the basic copy still works.
//!
//! Other platforms always use the Tauri plugin.

use tauri::AppHandle;
#[cfg(target_os = "windows")]
use tauri::Manager;
use tauri_plugin_clipboard_manager::ClipboardExt;

#[cfg(target_os = "windows")]
mod win {
    use windows::core::PCWSTR;
    use windows::Win32::Foundation::{HANDLE, HGLOBAL, HWND};
    use windows::Win32::System::DataExchange::{
        CloseClipboard, EmptyClipboard, OpenClipboard, RegisterClipboardFormatW, SetClipboardData,
    };
    use windows::Win32::System::Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GMEM_MOVEABLE};

    const CF_UNICODETEXT: u32 = 13;

    /// Allocate movable global memory holding `text` as UTF-16 with a
    /// terminating null. The returned HGLOBAL is owned by the caller until
    /// passed to `SetClipboardData` (which transfers ownership to the OS).
    unsafe fn alloc_utf16(text: &str) -> Result<HGLOBAL, String> {
        let utf16: Vec<u16> = text.encode_utf16().chain(std::iter::once(0)).collect();
        let byte_len = utf16.len() * std::mem::size_of::<u16>();
        let h = GlobalAlloc(GMEM_MOVEABLE, byte_len)
            .map_err(|e| format!("GlobalAlloc({byte_len}): {e}"))?;
        let dst = GlobalLock(h);
        if dst.is_null() {
            return Err("GlobalLock returned null".into());
        }
        std::ptr::copy_nonoverlapping(utf16.as_ptr(), dst as *mut u16, utf16.len());
        let _ = GlobalUnlock(h);
        Ok(h)
    }

    /// Allocate a 4-byte global containing a single u32 — the format
    /// expected by `CanIncludeInClipboardHistory`.
    unsafe fn alloc_dword(value: u32) -> Result<HGLOBAL, String> {
        let h = GlobalAlloc(GMEM_MOVEABLE, 4).map_err(|e| format!("GlobalAlloc(4): {e}"))?;
        let dst = GlobalLock(h);
        if dst.is_null() {
            return Err("GlobalLock returned null".into());
        }
        *(dst as *mut u32) = value;
        let _ = GlobalUnlock(h);
        Ok(h)
    }

    /// Set the clipboard text and tag the entry to opt out of Win+V
    /// history. Markers are set before the text per Microsoft's docs.
    /// Pass `text = ""` to clear (still tagged so the empty entry is also
    /// excluded from Win+V).
    pub fn set_text_excluded(hwnd: HWND, text: &str) -> Result<(), String> {
        unsafe {
            if let Err(e) = OpenClipboard(Some(hwnd)) {
                let msg = format!("OpenClipboard: {e}");
                eprintln!("[clipboard] {msg}");
                return Err(msg);
            }

            if let Err(e) = EmptyClipboard() {
                let _ = CloseClipboard();
                let msg = format!("EmptyClipboard: {e}");
                eprintln!("[clipboard] {msg}");
                return Err(msg);
            }

            // Set the CanIncludeInClipboardHistory marker FIRST (DWORD = 0).
            // Best-effort — if this fails the text still gets set.
            let marker_name: Vec<u16> = "CanIncludeInClipboardHistory\0".encode_utf16().collect();
            let marker_format = RegisterClipboardFormatW(PCWSTR(marker_name.as_ptr()));
            if marker_format != 0 {
                if let Ok(h_marker) = alloc_dword(0) {
                    if let Err(e) = SetClipboardData(marker_format, Some(HANDLE(h_marker.0))) {
                        eprintln!("[clipboard] SetClipboardData(marker) failed: {e}");
                    }
                }
            }

            let h_text = match alloc_utf16(text) {
                Ok(h) => h,
                Err(e) => {
                    let _ = CloseClipboard();
                    eprintln!("[clipboard] alloc_utf16 failed: {e}");
                    return Err(e);
                }
            };
            if let Err(e) = SetClipboardData(CF_UNICODETEXT, Some(HANDLE(h_text.0))) {
                let _ = CloseClipboard();
                let msg = format!("SetClipboardData(text): {e}");
                eprintln!("[clipboard] {msg}");
                return Err(msg);
            }

            let _ = CloseClipboard();
        }

        Ok(())
    }
}

#[cfg(target_os = "windows")]
fn main_hwnd(app: &AppHandle) -> Result<windows::Win32::Foundation::HWND, String> {
    let window = app
        .get_webview_window("main")
        .ok_or_else(|| "main window not found".to_string())?;
    window.hwnd().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clipboard_copy(
    app: AppHandle,
    text: String,
    exclude_from_history: bool,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    if exclude_from_history {
        match main_hwnd(&app) {
            Ok(hwnd) => {
                if let Ok(()) = win::set_text_excluded(hwnd, &text) {
                    return Ok(());
                }
                eprintln!("[clipboard] Win32 path failed, falling back to plugin");
            }
            Err(e) => eprintln!("[clipboard] no main HWND ({e}), using plugin"),
        }
    }

    app.clipboard().write_text(text).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clipboard_clear(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if let Ok(hwnd) = main_hwnd(&app) {
            if let Ok(()) = win::set_text_excluded(hwnd, "") {
                return Ok(());
            }
            eprintln!("[clipboard] Win32 clear failed, falling back to plugin");
        }
    }

    app.clipboard()
        .write_text(String::new())
        .map_err(|e| e.to_string())
}
