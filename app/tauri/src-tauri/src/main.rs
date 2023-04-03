// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
#[derive(serde::Serialize, serde::Deserialize)]
struct Settings {
    port: u16,
    auto_start_up: bool,
}

fn get_settings_path() -> String {
    if cfg!(debug_assertions){
        return "../app.settings.json".to_owned();
    }
    return "app.settings.json".to_owned();
}

#[tauri::command]
fn save_settings(settings: Settings) {
    let settings_str = serde_json::to_string(&settings).unwrap();
    std::fs::write(get_settings_path(), settings_str).unwrap();
}

#[tauri::command]
fn read_settings() -> String {
    return std::fs::read_to_string(get_settings_path()).unwrap();
}

fn get_default_settings() -> Settings{
    Settings {
        port: 8123,
        auto_start_up: true,
    }
}

fn main() {
    let settings_path = get_settings_path();
    let metadata_settings = std::fs::metadata(settings_path);
    match metadata_settings {
        Ok(_) => {
        }
        Err(_) => {
            let default_settings = get_default_settings();
            let settings_str = serde_json::to_string(&default_settings).unwrap();
            std::fs::write(get_settings_path(), settings_str).unwrap();
        }
    }

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![save_settings,read_settings])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
