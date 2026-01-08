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
    #[serde(default = "default_listen_public")]
    listen_public: bool,
    auto_start_up: bool,
    #[serde(default = "default_auto_update")]
    auto_update: bool,
    #[serde(default = "default_show_tray_icon")]
    show_tray_icon: bool,
    #[serde(default = "default_show_dock_icon")]
    show_dock_icon: bool,
}

fn default_show_tray_icon() -> bool {
    true
}

fn default_listen_public() -> bool {
    false
}

fn default_auto_update() -> bool {
    false
}

fn default_show_dock_icon() -> bool {
    true
}

#[derive(serde::Serialize)]
struct ServerInfo {
    jar_version: Option<String>,
    java_version: Option<String>,
    jar_path: Option<String>,
    java_path: Option<String>,
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub(crate) fn get_app_data_dir(app: &AppHandle) -> String {
    let app_dir = app.path().app_data_dir().unwrap();
    if !app_dir.exists() {
        std::fs::create_dir_all(&app_dir).unwrap();
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
        port: 31234,
        listen_public: false,
        auto_start_up: false,
        auto_update: false,
        show_tray_icon: true,
        show_dock_icon: true,
    }
}

pub(crate) fn get_settings(app: &AppHandle) -> Settings {
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
fn has_server_jar(app: AppHandle) -> bool {
    server_jar_exists(&app)
}

fn server_jar_exists(app: &AppHandle) -> bool {
    if server_jar_disabled_by_env() {
        return false;
    }
    app.path()
        .resolve(
            "server_bin/huntly-server.jar",
            tauri::path::BaseDirectory::Resource,
        )
        .map(|p| p.exists())
        .unwrap_or(false)
}

fn server_jar_disabled_by_env() -> bool {
    matches!(
        std::env::var("HUNTLY_NO_SERVER_JAR").as_deref(),
        Ok("1") | Ok("true") | Ok("TRUE")
    )
}

#[command]
fn get_server_info(app: AppHandle) -> ServerInfo {
    let mut java_resource_path = "server_bin/jre11/bin/java.exe";
    if cfg!(not(target_os = "windows")) {
        java_resource_path = "server_bin/jre11/bin/java";
    }

    let java_path = app
        .path()
        .resolve(java_resource_path, tauri::path::BaseDirectory::Resource)
        .ok()
        .filter(|p| p.exists())
        .map(|p| canonicalize(&p));

    let jar_path = app
        .path()
        .resolve(
            "server_bin/huntly-server.jar",
            tauri::path::BaseDirectory::Resource,
        )
        .ok()
        .filter(|p| p.exists())
        .map(|p| canonicalize(&p));

    // Get Java version by running java -version
    let java_version = java_path.as_ref().and_then(|jp| {
        let output = Command::new(jp)
            .arg("-version")
            .output()
            .ok()?;
        // java -version outputs to stderr
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Parse version from first line, e.g. "openjdk version \"11.0.21\" 2023-10-17"
        stderr
            .lines()
            .next()
            .and_then(|line| {
                if let Some(start) = line.find('"') {
                    if let Some(end) = line[start + 1..].find('"') {
                        return Some(line[start + 1..start + 1 + end].to_string());
                    }
                }
                None
            })
    });

    // Get JAR version from MANIFEST.MF (Implementation-Version)
    let jar_version = jar_path.as_ref().and_then(|jp| {
        use std::fs::File;
        use std::io::{BufRead, BufReader};
        use zip::ZipArchive;

        let file = File::open(jp).ok()?;
        let mut archive = ZipArchive::new(file).ok()?;
        let manifest = archive.by_name("META-INF/MANIFEST.MF").ok()?;
        let reader = BufReader::new(manifest);
        for line in reader.lines().map_while(Result::ok) {
            if line.starts_with("Implementation-Version:") {
                return Some(line.replace("Implementation-Version:", "").trim().to_string());
            }
        }
        None
    });

    ServerInfo {
        jar_version,
        java_version,
        jar_path,
        java_path,
    }
}

#[command]
fn set_tray_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    if let Some(tray) = app.tray_by_id("main-tray") {
        tray.set_visible(visible).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
fn set_dock_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if visible {
            app.set_activation_policy(ActivationPolicy::Regular);
        } else {
            app.set_activation_policy(ActivationPolicy::Accessory);
        }
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = (app, visible); // Suppress unused warnings on non-macOS
    }
    Ok(())
}

fn open_server_url_internal(app: &AppHandle) {
    let settings: Settings = get_settings(app);
    let url = format!("http://localhost:{}", settings.port);
    open_browser(&url);
}

fn open_data_dir_internal(app: &AppHandle) -> Result<(), String> {
    let data_dir = get_app_data_dir(app);
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .creation_flags(CREATE_NO_WINDOW)
            .raw_arg(&format!("/open,\"{}\"", data_dir))
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(&["-R", &data_dir])
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())?;
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(&data_dir)
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[command]
fn open_server_url(app: AppHandle) {
    open_server_url_internal(&app);
}

#[command]
fn open_data_dir(app: AppHandle) -> Result<(), String> {
    open_data_dir_internal(&app)
}

#[command]
fn start_server(app: AppHandle) -> Result<(), String> {
    handle_start_server(&app)
}

fn handle_start_server(app: &AppHandle) -> Result<(), String> {
    let settings: Settings = get_settings(app);
    let port = settings.port;
    let server_address = if settings.listen_public {
        "0.0.0.0"
    } else {
        "127.0.0.1"
    };
    let mut java_resource_path = "server_bin/jre11/bin/java.exe";
    if cfg!(not(target_os = "windows")) {
        java_resource_path = "server_bin/jre11/bin/java";
    }
    let java_path = app
        .path()
        .resolve(java_resource_path, tauri::path::BaseDirectory::Resource)
        .map_err(|e| e.to_string())?;
    let file_path = app
        .path()
        .resolve(
            "server_bin/huntly-server.jar",
            tauri::path::BaseDirectory::Resource,
        )
        .map_err(|e| e.to_string())?;

    if server_jar_disabled_by_env() || !file_path.exists() {
        return Err(
            "Server bundle not found. This desktop client was built without the Huntly server."
                .to_string(),
        );
    }
    if !java_path.exists() {
        return Err("Embedded Java runtime not found.".to_string());
    }

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
            .raw_arg(format!("--server.address={}", server_address))
            .raw_arg(format!("--huntly.dataDir=\"{}/\"", data_dir))
            .raw_arg(format!("--huntly.luceneDir=\"{}/lucene\"", data_dir))
            .spawn()
            .map_err(|e| e.to_string())?;
        let mut spring_boot_process = SPRING_BOOT_PROCESS.lock().unwrap();
        *spring_boot_process = Some(child);
    }
    #[cfg(target_os = "macos")]
    {
        let child = cmd
            .arg("-jar")
            .arg(format!("{}", canonicalize(&file_path)))
            .arg(format!("--server.port={}", port))
            .arg(format!("--server.address={}", server_address))
            .arg(format!("--huntly.dataDir={}/", data_dir))
            .arg(format!("--huntly.luceneDir={}/lucene", data_dir))
            .spawn()
            .map_err(|e| e.to_string())?;
        let mut spring_boot_process = SPRING_BOOT_PROCESS.lock().unwrap();
        *spring_boot_process = Some(child);
    }
    println!("Spring Boot application started. ");
    Ok(())
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
fn stop_server(app: AppHandle) {
    handle_stop_server(&app);
}

fn handle_stop_server(app: &AppHandle) {
    let settings = get_settings(app);
    let port = settings.port;

    let mut spring_boot_process = SPRING_BOOT_PROCESS.lock().unwrap();
    let child = spring_boot_process.take();

    if let Some(mut process) = child {
        // Best-effort shutdown: try to kill and then wait a bit to reap.
        if let Err(e) = process.kill() {
            eprintln!("Failed to kill Spring Boot process: {}", e);
        }
        // Wait up to ~2s for the process to exit.
        for _ in 0..20 {
            match process.try_wait() {
                Ok(Some(_status)) => break,
                Ok(None) => std::thread::sleep(std::time::Duration::from_millis(100)),
                Err(e) => {
                    eprintln!("Failed to wait Spring Boot process: {}", e);
                    break;
                }
            }
        }
    } else {
        // Process handle not available (e.g., app restarted while server was running).
        // Try to find and kill the process by port.
        kill_process_by_port(port);
    }

    println!("Backend gracefully shutdown.");
}

/// Finds and kills the process listening on the specified port.
#[cfg(target_os = "macos")]
fn kill_process_by_port(port: u16) {
    // Use lsof to find PID listening on the port
    let output = Command::new("lsof")
        .args(["-t", "-i", &format!(":{}", port)])
        .output();

    if let Ok(output) = output {
        let pids_str = String::from_utf8_lossy(&output.stdout);
        for pid_str in pids_str.lines() {
            if let Ok(pid) = pid_str.trim().parse::<i32>() {
                println!("Killing process {} on port {}", pid, port);
                // Send SIGTERM first for graceful shutdown
                let _ = Command::new("kill").arg(pid.to_string()).output();
                // Wait a bit, then force kill if still running
                std::thread::sleep(std::time::Duration::from_millis(500));
                let _ = Command::new("kill").args(["-9", &pid.to_string()]).output();
            }
        }
    }
}

#[cfg(target_os = "windows")]
fn kill_process_by_port(port: u16) {
    // Use netstat to find PID listening on the port
    let output = Command::new("netstat")
        .creation_flags(CREATE_NO_WINDOW)
        .args(["-ano"])
        .output();

    if let Ok(output) = output {
        let output_str = String::from_utf8_lossy(&output.stdout);
        let port_pattern = format!(":{}", port);
        for line in output_str.lines() {
            if line.contains(&port_pattern) && line.contains("LISTENING") {
                // Extract PID from the last column
                if let Some(pid_str) = line.split_whitespace().last() {
                    if let Ok(pid) = pid_str.parse::<u32>() {
                        println!("Killing process {} on port {}", pid, port);
                        let _ = Command::new("taskkill")
                            .creation_flags(CREATE_NO_WINDOW)
                            .args(["/F", "/PID", &pid.to_string()])
                            .output();
                    }
                }
            }
        }
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
fn kill_process_by_port(port: u16) {
    // Linux: use fuser or lsof
    let output = Command::new("fuser")
        .args([&format!("{}/tcp", port)])
        .output();

    if let Ok(output) = output {
        let pids_str = String::from_utf8_lossy(&output.stdout);
        for pid_str in pids_str.split_whitespace() {
            if let Ok(pid) = pid_str.trim().parse::<i32>() {
                println!("Killing process {} on port {}", pid, port);
                let _ = Command::new("kill").arg(pid.to_string()).output();
                std::thread::sleep(std::time::Duration::from_millis(500));
                let _ = Command::new("kill").args(["-9", &pid.to_string()]).output();
            }
        }
    }
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

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
fn open_browser(url: &str) {
    let _ = Command::new("xdg-open").arg(url).spawn();
}

#[command]
fn open_url(url: String) -> Result<(), String> {
    open_browser(&url);
    Ok(())
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
        tray.set_show_menu_on_left_click(false)?;

        tray.on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "config" => {
                    show_main_window(app);
                }
                "open" => {
                    open_server_url_internal(app);
                }
                "open_dir" => {
                    if let Err(e) = open_data_dir_internal(app) {
                        eprintln!("Failed to open data directory: {}", e);
                    }
                }
                "restart" => {
                    handle_stop_server(app);
                    if let Err(e) = handle_start_server(app) {
                        eprintln!("Failed to start server: {}", e);
                    }
                }
                "start" => {
                    handle_stop_server(app);
                    if let Err(e) = handle_start_server(app) {
                        eprintln!("Failed to start server: {}", e);
                    }
                }
                "stop" => {
                    handle_stop_server(app);
                }
                "quit" => {
                    handle_stop_server(app);
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
                let app = tray.app_handle();
                show_main_window(&app);
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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
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
            has_server_jar,
            get_server_info,
            set_tray_visible,
            set_dock_visible,
            open_server_url,
            open_url,
            open_data_dir,
            start_server,
            stop_server,
            is_server_running,
            is_server_started,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    #[cfg(target_os = "macos")]
    {
        // Apply saved dock icon visibility setting
        let settings = get_settings(app.handle());
        if settings.show_dock_icon {
            app.set_activation_policy(ActivationPolicy::Regular);
        } else {
            app.set_activation_policy(ActivationPolicy::Accessory);
        }
    }

    app.run(|app, event| match event {
        #[cfg(target_os = "macos")]
        RunEvent::Reopen { .. } => {
            show_main_window(app);
        }
        RunEvent::Exit { .. } => {
            handle_stop_server(app);
        }
        RunEvent::ExitRequested { .. } => {
            handle_stop_server(app);
        }
        RunEvent::WindowEvent { label, event, .. } => {
            if label == "main" {
                if let WindowEvent::CloseRequested { api, .. } = event {
                    // Treat window close as app exit intent: stop embedded server.
                    handle_stop_server(app);
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
