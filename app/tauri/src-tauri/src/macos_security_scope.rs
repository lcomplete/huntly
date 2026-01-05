#[cfg(target_os = "macos")]
use std::{
    fs,
    os::raw::c_void,
    path::{Path, PathBuf},
    ptr::NonNull,
};

#[cfg(target_os = "macos")]
use objc2_foundation::{
    NSData, NSString, NSURL, NSURLBookmarkCreationOptions, NSURLBookmarkResolutionOptions,
};

#[cfg(target_os = "macos")]
use tauri::{AppHandle, Manager};

#[cfg(target_os = "macos")]
fn bookmark_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("sync.export_folder.bookmark"))
}

#[cfg(target_os = "macos")]
fn path_to_url(path: &Path) -> Result<objc2::rc::Retained<NSURL>, String> {
    let s = path
        .to_str()
        .ok_or_else(|| "Invalid (non-UTF8) path".to_string())?;
    let ns_path = NSString::from_str(s);
    Ok(NSURL::fileURLWithPath_isDirectory(&ns_path, true))
}

#[cfg(target_os = "macos")]
pub fn save_export_folder_bookmark(app: &AppHandle, export_folder: &Path) -> Result<(), String> {
    let url = path_to_url(export_folder)?;
    let options = NSURLBookmarkCreationOptions::WithSecurityScope;
    let data = url
        .bookmarkDataWithOptions_includingResourceValuesForKeys_relativeToURL_error(
            options,
            None,
            None,
        )
        .map_err(|e| format!("Failed to create security-scoped bookmark: {e:?}"))?;

    let len = data.length() as usize;
    let mut bytes = vec![0u8; len];
    unsafe {
        data.getBytes_length(
            NonNull::new(bytes.as_mut_ptr().cast::<c_void>()).unwrap(),
            len as _,
        );
    }
    fs::write(bookmark_file_path(app)?, bytes).map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(target_os = "macos")]
pub struct SecurityScopeGuard {
    url: objc2::rc::Retained<NSURL>,
    started: bool,
}

#[cfg(target_os = "macos")]
impl Drop for SecurityScopeGuard {
    fn drop(&mut self) {
        if self.started {
            unsafe { self.url.stopAccessingSecurityScopedResource() };
        }
    }
}

#[cfg(target_os = "macos")]
pub fn begin_export_folder_access(
    app: &AppHandle,
    export_folder: &Path,
) -> Result<SecurityScopeGuard, String> {
    let bookmark_path = bookmark_file_path(app)?;
    if !bookmark_path.exists() {
        // No persisted bookmark; still try "best effort" direct access.
        let url = path_to_url(export_folder)?;
        let started = unsafe { url.startAccessingSecurityScopedResource() };
        return Ok(SecurityScopeGuard { url, started });
    }

    let bookmark_bytes = fs::read(bookmark_path).map_err(|e| e.to_string())?;
    if bookmark_bytes.is_empty() {
        return Err("Security-scoped bookmark is empty".to_string());
    }

    let data = unsafe {
        NSData::dataWithBytes_length(
            bookmark_bytes.as_ptr().cast::<c_void>(),
            bookmark_bytes.len() as _,
        )
    };

    let options = NSURLBookmarkResolutionOptions::WithSecurityScope;
    let url = unsafe {
        NSURL::URLByResolvingBookmarkData_options_relativeToURL_bookmarkDataIsStale_error(
            &data,
            options,
            None,
            std::ptr::null_mut(),
        )
    }
    .map_err(|e| format!("Failed to resolve security-scoped bookmark: {e:?}"))?;

    let started = unsafe { url.startAccessingSecurityScopedResource() };
    if !started {
        return Err(format!(
            "Failed to start security-scoped access (path={})",
            export_folder.to_string_lossy()
        ));
    }
    Ok(SecurityScopeGuard { url, started })
}

#[cfg(not(target_os = "macos"))]
pub fn save_export_folder_bookmark(_app: &tauri::AppHandle, _export_folder: &Path) -> Result<(), String> {
    Ok(())
}

#[cfg(not(target_os = "macos"))]
pub struct SecurityScopeGuard;

#[cfg(not(target_os = "macos"))]
pub fn begin_export_folder_access(
    _app: &tauri::AppHandle,
    _export_folder: &Path,
) -> Result<SecurityScopeGuard, String> {
    Ok(SecurityScopeGuard)
}
