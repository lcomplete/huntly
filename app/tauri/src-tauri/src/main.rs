// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::{Child, Command};
use std::sync::Mutex;

use reqwest::StatusCode;
use tauri::{
    command, AppHandle, CustomMenuItem, SystemTray, SystemTrayEvent, SystemTrayMenu,
    SystemTrayMenuItem,
};
use tauri::{Manager, RunEvent, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher};

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

#[command]
async fn save_settings(settings: Settings) {
    let settings_str = serde_json::to_string(&settings).unwrap();
    std::fs::write(get_settings_path(), settings_str).unwrap();
}

#[command]
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

#[command]
async fn is_server_running() -> bool {
    match reqwest::get(format!(
        "http://localhost:{}/api/health",
        get_settings().port
    ))
    .await
    {
        Ok(response) => response.status() == StatusCode::OK,
        Err(_) => false,
    }
}

#[command]
fn is_server_started() -> bool {
    let spring_boot_process = SPRING_BOOT_PROCESS.lock().unwrap();
    spring_boot_process.is_some()
}

#[command]
fn start_server(app: AppHandle) {
    // 获取 Spring Boot Jar 文件路径
    let settings: Settings = get_settings();
    let port = settings.port;
    let java_path = app
        .path_resolver()
        .resolve_resource("server_bin/jre11/bin/java.exe")
        .unwrap()
        .as_path()
        .to_str()
        .unwrap()
        .to_owned();
    let jar_file_path = get_jar_file_path(app);
    let child = Command::new(java_path)
        .arg("-jar")
        .arg(jar_file_path)
        .arg(format!("--server.port={}", port))
        .spawn()
        .expect("failed to start spring boot application");
    let mut spring_boot_process = SPRING_BOOT_PROCESS.lock().unwrap();
    *spring_boot_process = Some(child);
}

#[command]
fn stop_server() {
    // 获取 Spring Boot 进程对象
    let mut spring_boot_process = SPRING_BOOT_PROCESS.lock().unwrap();
    let child = spring_boot_process.take();

    // 如果存在进程对象，则终止它
    if let Some(mut process) = child {
        process.kill().expect("Failed to kill Spring Boot process");
    }

    println!("Backend gracefully shutdown.");
}

fn get_jar_file_path(app: AppHandle) -> String {
    let file_path = app
        .path_resolver()
        .resolve_resource("server_bin/huntly-server.jar")
        .unwrap()
        .as_path()
        .to_str()
        .unwrap()
        .to_owned();
    println!("jar file path: {}", file_path);
    file_path
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
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--silently"]),
        ))
        .setup(|_| Ok(()))
        .invoke_handler(tauri::generate_handler![
            save_settings,
            read_settings,
            start_server,
            stop_server,
            is_server_running,
            is_server_started
        ])
        .system_tray(menu())
        .on_system_tray_event(handler)
        .build(tauri::generate_context!())
        .expect("error while running tauri application");
    app.run(|app, event| match event {
        RunEvent::ExitRequested { api, .. } => {
            stop_server();
        }
        RunEvent::WindowEvent { label, event, .. } => {
            if label == "main" {
                match event {
                    WindowEvent::CloseRequested { api, .. } => {
                        let window = app.get_window("main").unwrap();
                        window.hide().unwrap();
                        api.prevent_close();
                    }
                    _ => {}
                }
            }
        }
        _ => {}
    })
}

fn menu() -> SystemTray {
    let tray_menu = SystemTrayMenu::new()
        .add_item(CustomMenuItem::new("config", "Config"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("open", "Open huntly"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("start", "Start server"))
        .add_item(CustomMenuItem::new("stop", "Stop server"))
        .add_item(CustomMenuItem::new("restart", "Restart server"))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(CustomMenuItem::new("quit", "Quit"));
    SystemTray::new().with_menu(tray_menu)
}

fn open_browser(url: &str) {
    let _ = Command::new("cmd").args(&["/C", "start"]).arg(url).spawn();
}

fn handler(app: &AppHandle, event: SystemTrayEvent) {
    match event {
        SystemTrayEvent::LeftClick {
            tray_id,
            position,
            size,
            ..
        } => {
            let window = app.get_window("main").unwrap();
            window.show().unwrap();
        }
        SystemTrayEvent::MenuItemClick { id, .. } => match id.as_str() {
            "config" => {
                let window = app.get_window("main").unwrap();
                window.show().unwrap();
            }
            "open" => {
                // open huntly server in web browser
                let settings: Settings = get_settings();
                let port = settings.port;
                let url = format!("http://localhost:{}", port);
                open_browser(url.as_str());
            }
            "restart" => {
                stop_server();
                start_server(app.clone());
            }
            "start" => {
                start_server(app.clone());
            }
            "stop" => {
                stop_server();
            }
            "quit" => {
                stop_server();
                app.exit(0);
            }
            _ => {}
        },
        _ => {}
    }
}
