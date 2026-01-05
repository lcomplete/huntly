use crate::sync::{SyncSettings, SyncState};
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "sync.store.json";
const KEY_SETTINGS: &str = "sync_settings";
const KEY_STATE: &str = "sync_state";

pub fn load_sync_state(app: &AppHandle) -> Result<SyncState, String> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    match store.get(KEY_STATE) {
        Some(value) => serde_json::from_value(value.clone())
            .map_err(|e| format!("Failed to parse sync state: {}", e)),
        None => Ok(SyncState::default()),
    }
}

pub fn save_sync_state(app: &AppHandle, state: &SyncState) -> Result<(), String> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let value = serde_json::to_value(state)
        .map_err(|e| format!("Failed to serialize sync state: {}", e))?;

    store.set(KEY_STATE, value);
    store
        .save()
        .map_err(|e| format!("Failed to save store: {}", e))
}

pub fn load_sync_settings(app: &AppHandle) -> Result<SyncSettings, String> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    match store.get(KEY_SETTINGS) {
        Some(value) => serde_json::from_value(value.clone())
            .map_err(|e| format!("Failed to parse sync settings: {}", e)),
        None => Ok(SyncSettings::default()),
    }
}

pub fn save_sync_settings(app: &AppHandle, settings: &SyncSettings) -> Result<(), String> {
    let store = app
        .store(STORE_FILE)
        .map_err(|e| format!("Failed to open store: {}", e))?;

    let value = serde_json::to_value(settings)
        .map_err(|e| format!("Failed to serialize sync settings: {}", e))?;

    store.set(KEY_SETTINGS, value);
    store
        .save()
        .map_err(|e| format!("Failed to save store: {}", e))
}

