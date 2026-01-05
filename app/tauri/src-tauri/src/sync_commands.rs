use crate::sync::*;
use std::fs;
use std::path::PathBuf;
use tauri::{command, AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

/// Get the tokens directory path
fn get_tokens_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let base = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let tokens_dir = base.join("tokens");
    fs::create_dir_all(&tokens_dir).map_err(|e| e.to_string())?;
    Ok(tokens_dir)
}

/// Sanitize server URL for use as filename
fn sanitize_server_url(url: &str) -> String {
    url.replace("://", "_")
        .replace("/", "_")
        .replace(":", "_")
        .replace(".", "_")
}

#[command]
pub fn get_default_export_folder(app: AppHandle) -> Result<String, String> {
    let base = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;
    let export_dir = base.join("exports");
    fs::create_dir_all(&export_dir).map_err(|e| e.to_string())?;
    Ok(export_dir.to_string_lossy().to_string())
}

#[command]
pub fn save_sync_settings(app: AppHandle, settings: SyncSettings) -> Result<(), String> {
    crate::sync_persistence::save_sync_settings(&app, &settings)
}

#[command]
pub fn read_sync_settings(app: AppHandle) -> Result<SyncSettings, String> {
    crate::sync_persistence::load_sync_settings(&app)
}

#[command]
pub fn get_sync_state() -> SyncState {
    SYNC_STATE.lock().unwrap().clone()
}

/// Save sync token to file (simple file-based storage instead of keychain)
#[command]
pub fn save_sync_token(app: AppHandle, server_url: String, token: String) -> Result<(), String> {
    let tokens_dir = get_tokens_dir(&app)?;
    let token_file = tokens_dir.join(format!("{}.token", sanitize_server_url(&server_url)));
    fs::write(&token_file, &token).map_err(|e| format!("Failed to save token: {}", e))?;
    Ok(())
}

/// Get sync token from file
#[command]
pub fn get_sync_token(app: AppHandle, server_url: String) -> Result<Option<String>, String> {
    let tokens_dir = get_tokens_dir(&app)?;
    let token_file = tokens_dir.join(format!("{}.token", sanitize_server_url(&server_url)));
    match fs::read_to_string(&token_file) {
        Ok(token) => {
            let token = token.trim().to_string();
            if token.is_empty() {
                Ok(None)
            } else {
                Ok(Some(token))
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Failed to read token: {}", e)),
    }
}

/// Delete sync token file
#[command]
pub fn delete_sync_token(app: AppHandle, server_url: String) -> Result<(), String> {
    let tokens_dir = get_tokens_dir(&app)?;
    let token_file = tokens_dir.join(format!("{}.token", sanitize_server_url(&server_url)));
    match fs::remove_file(&token_file) {
        Ok(_) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(format!("Failed to delete token: {}", e)),
    }
}

#[command]
pub async fn check_server_connection(server_url: String) -> Result<bool, String> {
    let client = create_http_client()?;
    let health_url = format!("{}/api/health", server_url.trim_end_matches('/'));

    match client.get(&health_url).send().await {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[command]
pub async fn verify_sync_token(server_url: String, token: String) -> Result<bool, String> {
    let client = create_http_client()?;
    let verify_url = format!("{}/api/sync/verify", server_url.trim_end_matches('/'));
    match client
        .get(&verify_url)
        .header("X-Huntly-Sync-Token", token)
        .send()
        .await
    {
        Ok(response) => Ok(response.status().is_success()),
        Err(_) => Ok(false),
    }
}

/// Select a folder using native dialog and validate write access.
/// This must be done from Rust side to properly handle macOS security-scoped bookmarks.
#[command]
pub async fn select_export_folder(app: AppHandle) -> Result<Option<String>, String> {
    use std::sync::mpsc;
    let (tx, rx) = mpsc::channel();

    app.dialog()
        .file()
        .set_title("Select Export Folder")
        .pick_folder(move |folder_path| {
            let _ = tx.send(folder_path);
        });

    let folder_path = rx.recv().map_err(|e| e.to_string())?;

    match folder_path {
        Some(file_path) => {
            let path = file_path.into_path().map_err(|e| e.to_string())?;

            // On macOS sandboxed builds, persist a security-scoped bookmark
            #[cfg(target_os = "macos")]
            {
                let _ = crate::macos_security_scope::save_export_folder_bookmark(&app, &path);
            }

            // Acquire security-scoped access before attempting to write
            let _guard = crate::macos_security_scope::begin_export_folder_access(&app, &path)
                .map_err(|e| format!("Cannot access folder: {}", e))?;

            // Try to write a test file
            let test_file = path.join(format!(".huntly_sync_test_{}", std::process::id()));
            match fs::write(&test_file, "test") {
                Ok(_) => {
                    let _ = fs::remove_file(&test_file);
                    Ok(Some(path.to_string_lossy().to_string()))
                }
                Err(e) => Err(format!(
                    "Cannot write to folder: {} ({})",
                    path.to_string_lossy(),
                    e
                )),
            }
        }
        None => Ok(None), // User cancelled
    }
}

#[command]
pub fn validate_folder(app: AppHandle, folder_path: String) -> Result<bool, String> {
    let path = PathBuf::from(&folder_path);
    if !path.exists() {
        return Err("Folder does not exist".to_string());
    }
    if !path.is_dir() {
        return Err("Path is not a directory".to_string());
    }

    // On macOS sandboxed builds, persist a security-scoped bookmark so the folder remains
    // accessible across restarts.
    #[cfg(target_os = "macos")]
    {
        let _ = crate::macos_security_scope::save_export_folder_bookmark(&app, &path);
    }

    // Acquire security-scoped access before attempting to write
    let _guard = crate::macos_security_scope::begin_export_folder_access(&app, &path)
        .map_err(|e| format!("Cannot access folder: {}", e))?;

    // Try to write a test file
    let test_file = path.join(format!(
        ".huntly_sync_test_{}",
        std::process::id()
    ));
    match fs::write(&test_file, "test") {
        Ok(_) => {
            let _ = fs::remove_file(&test_file);
            Ok(true)
        }
        Err(e) => Err(format!(
            "Cannot write to folder: {} ({})",
            path.to_string_lossy(),
            e
        )),
    }
}

// ==================== Device Authorization Grant Commands ====================

#[derive(serde::Serialize, serde::Deserialize)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub expires_in: u64,
    pub interval: u32,
}

#[derive(serde::Serialize, serde::Deserialize)]
pub struct DeviceTokenResponse {
    pub sync_token: String,
    pub server_url: String,
}

#[derive(serde::Deserialize)]
struct ApiResponse<T> {
    code: i32,
    message: Option<String>,
    data: Option<T>,
}

/// Create HTTP client with proxy bypass for localhost and appropriate timeouts
fn create_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .no_proxy()  // Don't use system proxy for local connections
        .timeout(std::time::Duration::from_secs(60))  // 60 second timeout for auth requests
        .connect_timeout(std::time::Duration::from_secs(30))  // 30 second connection timeout
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))
}

/// Request device code from server for Device Authorization Grant flow
#[command]
pub async fn request_device_code(server_url: String) -> Result<DeviceCodeResponse, String> {
    let client = create_http_client()?;
    let url = format!("{}/api/auth/desktop/device", server_url.trim_end_matches('/'));

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server returned status {}", response.status()));
    }

    let api_response: ApiResponse<DeviceCodeResponse> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if api_response.code != 0 {
        return Err(api_response.message.unwrap_or_else(|| "Unknown error".to_string()));
    }

    api_response.data.ok_or_else(|| "No data in response".to_string())
}

/// Poll for authorization token using device code
#[command]
pub async fn poll_device_token(server_url: String, device_code: String) -> Result<Option<DeviceTokenResponse>, String> {
    let client = create_http_client()?;
    let url = format!("{}/api/auth/desktop/token", server_url.trim_end_matches('/'));

    let response = client
        .post(&url)
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({ "device_code": device_code }))
        .send()
        .await
        .map_err(|e| format!("Network error: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server returned status {}", response.status()));
    }

    let api_response: ApiResponse<DeviceTokenResponse> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Code 428 means authorization pending - return None to indicate polling should continue
    if api_response.code == 428 {
        return Ok(None);
    }

    if api_response.code != 0 {
        return Err(api_response.message.unwrap_or_else(|| "Unknown error".to_string()));
    }

    Ok(api_response.data)
}
