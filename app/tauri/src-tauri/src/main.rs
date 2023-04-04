// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::{App, Event, Manager, RunEvent};

#[macro_use]
extern crate lazy_static;

lazy_static! {
    static ref SPRING_BOOT_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
}

#[derive(serde::Serialize, serde::Deserialize)]
struct Settings {
    port: u16,
    auto_start_up: bool,
}

fn get_settings_path() -> String {
    if cfg!(debug_assertions) {
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

fn get_default_settings() -> Settings {
    Settings {
        port: 8123,
        auto_start_up: true,
    }
}

fn get_settings() -> Settings {
    let settings_str = read_settings();
    let settings: Settings = serde_json::from_str(&settings_str).unwrap();
    settings
}

#[tauri::command]
fn start_server() {
    // 获取 Spring Boot Jar 文件路径
    let settings: Settings = get_settings();
    let port = settings.port;
    let jar_file_path = get_jar_file_path();
    let child = Command::new("java")
        .arg("-jar")
        .arg(jar_file_path)
        .arg(format!("--server.port={}", port))
        .spawn()
        .expect("failed to start spring boot application");
    let mut spring_boot_process = SPRING_BOOT_PROCESS.lock().unwrap();
    *spring_boot_process = Some(child);
}

fn stop_server() {
    // 获取 Spring Boot 进程对象
    let mut spring_boot_process = SPRING_BOOT_PROCESS.lock().unwrap();
    let child = spring_boot_process.take();

    // 如果存在进程对象，则终止它
    if let Some(mut process) = child {
        process.kill().expect("Failed to kill Spring Boot process");
    }
}

fn get_jar_file_path() -> String {
    return "assets/huntly-server.jar".to_owned();
}

fn main() {
    let settings_path = get_settings_path();
    let metadata_settings = std::fs::metadata(settings_path);
    match metadata_settings {
        Ok(_) => {}
        Err(_) => {
            let default_settings = get_default_settings();
            let settings_str = serde_json::to_string(&default_settings).unwrap();
            std::fs::write(get_settings_path(), settings_str).unwrap();
        }
    }

    let app = tauri::Builder::default()
        .setup(|_| {
            start_server();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_settings,
            read_settings,
            start_server
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");
    app.run(|_app_handle, event| match event {
        RunEvent::ExitRequested { api, .. } => {
            stop_server();
            println!("Backend gracefully shutdown.");
        }
        _ => {}
    })
}
