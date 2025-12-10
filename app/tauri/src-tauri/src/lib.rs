use reqwest::StatusCode;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::Path;
use std::process::{Child, Command};
use std::sync::Mutex;
use tauri::{
    command, AppHandle,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconEvent},
    Manager, RunEvent, WindowEvent,
};
#[cfg(target_os = "macos")]
use tauri::ActivationPolicy;
use tauri_plugin_autostart::MacosLauncher;

#[macro_use]
extern crate lazy_static;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

lazy_static! {
    static ref SPRING_BOOT_PROCESS: Mutex<Option<Child>> = Mutex::new(None);
}

#[derive(serde::Serialize, serde::Deserialize)]
struct Settings {
    port: u16,
    auto_start_up: bool,
}

fn get_app_data_dir(app: &AppHandle) -> String {
    #[cfg(debug_assertions)]
    {
        let current_dir = std::env::current_dir().unwrap();
        let src_tauri_dir = if current_dir.ends_with("src-tauri") {
            current_dir
        } else {
            current_dir.join("src-tauri")
        };
        if src_tauri_dir.exists() {
            return src_tauri_dir.to_str().unwrap().to_owned();
        }
    }
    
    let app_dir = app.path().app_data_dir().unwrap();
    if !app_dir.exists() {
        std::fs::create_dir(&app_dir).unwrap();
    }
    app_dir.to_str().unwrap().to_owned()
}

fn get_settings_path(app: &AppHandle) -> String {
    let app_dir = app.path().app_config_dir().unwrap();
    if !app_dir.exists() {
        std::fs::create_dir(&app_dir).unwrap();
    }
    let path = app_dir.join("app.settings.json");
    path.to_str().unwrap().to_owned()
}

#[command]
fn save_settings(app: AppHandle, settings: Settings) {
    let settings_str = serde_json::to_string(&settings).unwrap();
    std::fs::write(get_settings_path(&app), settings_str).unwrap();
}

#[command]
fn read_settings(app: AppHandle) -> String {
    std_read_settings(&app)
}

fn std_read_settings(app: &AppHandle) -> String {
    std::fs::read_to_string(get_settings_path(app)).unwrap()
}

fn get_default_settings() -> Settings {
    Settings {
        port: 8123,
        auto_start_up: false,
    }
}

fn get_settings(app: &AppHandle) -> Settings {
    let settings_str = std_read_settings(app);
    serde_json::from_str(&settings_str).unwrap()
}

#[command]
async fn is_server_running(app: AppHandle) -> bool {
    match reqwest::get(format!(
        "http://localhost:{}/api/health",
        get_settings(&app).port
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
    handle_start_server(&app);
}

fn handle_start_server(app: &AppHandle) {
    let settings: Settings = get_settings(app);
    let port = settings.port;
    let mut java_resource_path = "server_bin/jre11/bin/java.exe";
    if cfg!(not(target_os = "windows")) {
        java_resource_path = "server_bin/jre11/bin/java";
    }
    let java_path = app.path().resolve(java_resource_path, tauri::path::BaseDirectory::Resource).unwrap();
    let file_path = app.path().resolve("server_bin/huntly-server.jar", tauri::path::BaseDirectory::Resource).unwrap();
    println!("java path:{}", canonicalize(&java_path));
    println!("jar file path:{}", canonicalize(&file_path));
    let java_path_str = canonicalize(&java_path);
    let cmd_path = java_path_str.clone();
    let mut cmd = Command::new(cmd_path);
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    println!("Starting Spring Boot application... ");
    let data_dir = get_app_data_dir(app);
    println!("data dir:{}", data_dir);
    #[cfg(target_os = "windows")]
    {
        let child = cmd
            .raw_arg("-jar")
            .raw_arg(format!("\"{}\"", canonicalize(&file_path)))
            .raw_arg(format!("--server.port={}", port))
            .raw_arg(format!("--huntly.dataDir=\"{}/\"", data_dir))
            .raw_arg(format!("--huntly.luceneDir=\"{}/lucene\"", data_dir))
            .spawn()
            .expect("failed to start spring boot application");
        let mut spring_boot_process = SPRING_BOOT_PROCESS.lock().unwrap();
        *spring_boot_process = Some(child);
    }
    #[cfg(target_os = "macos")]
    {
        let child = cmd
            .arg("-jar")
            .arg(format!("{}", canonicalize(&file_path)))
            .arg(format!("--server.port={}", port))
            .arg(format!("--huntly.dataDir={}/", data_dir))
            .arg(format!("--huntly.luceneDir={}/lucene", data_dir))
            .spawn()
            .expect("failed to start spring boot application");
        let mut spring_boot_process = SPRING_BOOT_PROCESS.lock().unwrap();
        *spring_boot_process = Some(child);
    }
    println!("Spring Boot application started. ");
}

fn canonicalize<P: AsRef<Path>>(path: P) -> String {
    let str = path
        .as_ref()
        .as_os_str()
        .to_os_string()
        .into_string()
        .unwrap();
    if str.starts_with("\\\\?\\") {
        str.replace("\\\\?\\", "")
    } else {
        str
    }
}

#[command]
fn stop_server() {
    let mut spring_boot_process = SPRING_BOOT_PROCESS.lock().unwrap();
    let child = spring_boot_process.take();

    if let Some(mut process) = child {
        process.kill().expect("Failed to kill Spring Boot process");
    }

    println!("Backend gracefully shutdown.");
}

#[cfg(target_os = "windows")]
fn open_browser(url: &str) {
    let _ = Command::new("cmd")
        .creation_flags(CREATE_NO_WINDOW)
        .args(&["/C", "start"])
        .arg(url)
        .spawn();
}

#[cfg(target_os = "macos")]
fn open_browser(url: &str) {
    let _ = Command::new("open").arg(url).spawn();
}

fn setup_tray(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let config_item = MenuItemBuilder::with_id("config", "Config").build(app)?;
    let open_item = MenuItemBuilder::with_id("open", "Open huntly").build(app)?;
    let open_dir_item = MenuItemBuilder::with_id("open_dir", "Open data directory").build(app)?;
    let start_item = MenuItemBuilder::with_id("start", "Start server").build(app)?;
    let stop_item = MenuItemBuilder::with_id("stop", "Stop server").build(app)?;
    let restart_item = MenuItemBuilder::with_id("restart", "Restart server").build(app)?;
    let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;

    let menu = MenuBuilder::new(app)
        .item(&config_item)
        .separator()
        .item(&open_item)
        .item(&open_dir_item)
        .separator()
        .item(&start_item)
        .item(&stop_item)
        .item(&restart_item)
        .separator()
        .item(&quit_item)
        .build()?;

    // Get the tray icon created from tauri.conf.json and set menu + events
    if let Some(tray) = app.tray_by_id("main-tray") {
        tray.set_menu(Some(menu))?;
        tray.set_show_menu_on_left_click(true)?;

        tray.on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "config" => {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.set_focus();
                        let _ = window.unminimize();
                        let _ = window.show();
                    }
                }
                "open" => {
                    let settings: Settings = get_settings(app);
                    let url = format!("http://localhost:{}", settings.port);
                    open_browser(&url);
                }
                "open_dir" => {
                    #[cfg(target_os = "windows")]
                    {
                        let data_dir = get_app_data_dir(app);
                        Command::new("explorer")
                            .creation_flags(CREATE_NO_WINDOW)
                            .raw_arg(&format!("/open,\"{}\"", data_dir))
                            .spawn()
                            .unwrap();
                    }
                    #[cfg(target_os = "macos")]
                    {
                        let data_dir = get_app_data_dir(app);
                        Command::new("open")
                            .args(&["-R", &data_dir])
                            .spawn()
                            .unwrap();
                    }
                }
                "restart" => {
                    stop_server();
                    handle_start_server(app);
                }
                "start" => {
                    stop_server();
                    handle_start_server(app);
                }
                "stop" => {
                    stop_server();
                }
                "quit" => {
                    stop_server();
                    app.exit(0);
                }
                _ => {}
            }
        });

        tray.on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                #[cfg(target_os = "windows")]
                {
                    let app = tray.app_handle();
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.show();
                    }
                }
                let _ = tray;
            }
        });
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--silently"]),
        ))
        .setup(|app| {
            let settings_path = get_settings_path(&app.handle());
            let metadata_settings = std::fs::metadata(&settings_path);
            match metadata_settings {
                Ok(_) => {}
                Err(_) => {
                    let default_settings = get_default_settings();
                    let settings_str = serde_json::to_string(&default_settings).unwrap();
                    std::fs::write(&settings_path, settings_str).unwrap();
                }
            }

            setup_tray(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_settings,
            read_settings,
            start_server,
            stop_server,
            is_server_running,
            is_server_started
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    #[cfg(target_os = "macos")]
    {
        app.set_activation_policy(ActivationPolicy::Accessory);
    }

    app.run(|app, event| match event {
        RunEvent::Exit { .. } => {
            stop_server();
        }
        RunEvent::ExitRequested { .. } => {
            stop_server();
        }
        RunEvent::WindowEvent { label, event, .. } => {
            if label == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                    }
                    api.prevent_close();
                }
            }
        }
        _ => {}
    })
}

