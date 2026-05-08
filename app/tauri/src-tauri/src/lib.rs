use reqwest::{StatusCode, Url};
use sha2::{Digest, Sha256};
use std::fs::File;
use std::io::{BufRead, BufReader};
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Child, Command};
use std::sync::Mutex;
#[cfg(target_os = "macos")]
use tauri::ActivationPolicy;
use tauri::{
    command,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconEvent},
    AppHandle, Manager, ResourceId, RunEvent, Webview, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_updater::UpdaterExt;

#[macro_use]
extern crate lazy_static;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;
const SERVER_JAR_FILE_NAME: &str = "huntly-server.jar";
const SERVER_JAR_VERSION_FILE_NAME: &str = "huntly-server.version";
const SERVER_JWT_SECRET_FILE_NAME: &str = "server.jwt.secret";
const SERVER_JAR_RESOURCE_PATH: &str = "server_bin/huntly-server.jar";
const SERVER_JAR_DATA_DIR: &str = "server_bin";
const GITHUB_RELEASES_API: &str =
    "https://api.github.com/repos/lcomplete/huntly/releases?per_page=100";
const GITHUB_USER_AGENT: &str = "Huntly-Tauri";
const TAURI_RELEASE_TAG_PREFIX: &str = "tauri/v";
const TAURI_UPDATE_MANIFEST_FILE_NAME: &str = "latest.json";

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
    #[serde(default = "default_server_auto_update")]
    server_auto_update: bool,
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

fn default_server_auto_update() -> bool {
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

#[derive(serde::Serialize)]
struct ServerUpdateInfo {
    current_version: Option<String>,
    latest_version: Option<String>,
    latest_tag: Option<String>,
    available: bool,
    notes: Option<String>,
    date: Option<String>,
    asset_name: Option<String>,
    asset_size: Option<u64>,
    release_url: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TauriUpdateMetadata {
    rid: ResourceId,
    current_version: String,
    version: String,
    date: Option<String>,
    body: Option<String>,
    raw_json: serde_json::Value,
}

#[derive(Clone)]
struct ServerRelease {
    version: String,
    tag_name: String,
    notes: Option<String>,
    published_at: Option<String>,
    html_url: Option<String>,
    asset: GithubReleaseAsset,
    sha256_asset: GithubReleaseAsset,
}

#[derive(serde::Deserialize)]
struct GithubRelease {
    tag_name: String,
    draft: bool,
    prerelease: bool,
    body: Option<String>,
    published_at: Option<String>,
    html_url: Option<String>,
    assets: Vec<GithubReleaseAsset>,
}

#[derive(Clone, serde::Deserialize)]
struct GithubReleaseAsset {
    name: String,
    browser_download_url: String,
    size: Option<u64>,
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub(crate) fn get_app_data_dir(app: &AppHandle) -> Result<String, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    if !app_dir.exists() {
        std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    }
    path_to_string(app_dir)
}

fn get_settings_path(app: &AppHandle) -> Result<String, String> {
    let app_dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    if !app_dir.exists() {
        std::fs::create_dir_all(&app_dir).map_err(|e| e.to_string())?;
    }
    let path = app_dir.join("app.settings.json");
    path_to_string(path)
}

#[command]
fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    let settings_str = serde_json::to_string(&settings).map_err(|e| e.to_string())?;
    std::fs::write(get_settings_path(&app)?, settings_str).map_err(|e| e.to_string())
}

#[command]
fn read_settings(app: AppHandle) -> Result<String, String> {
    std_read_settings(&app)
}

fn std_read_settings(app: &AppHandle) -> Result<String, String> {
    std::fs::read_to_string(get_settings_path(app)?).map_err(|e| e.to_string())
}

fn get_default_settings() -> Settings {
    Settings {
        port: 31234,
        listen_public: false,
        auto_start_up: false,
        auto_update: false,
        server_auto_update: false,
        show_tray_icon: true,
        show_dock_icon: true,
    }
}

pub(crate) fn get_settings(app: &AppHandle) -> Settings {
    match try_get_settings(app) {
        Ok(settings) => settings,
        Err(e) => {
            eprintln!("Failed to read Huntly settings, using defaults: {}", e);
            get_default_settings()
        }
    }
}

fn try_get_settings(app: &AppHandle) -> Result<Settings, String> {
    let settings_str = std_read_settings(app)?;
    serde_json::from_str(&settings_str).map_err(|e| e.to_string())
}

fn path_to_string(path: PathBuf) -> Result<String, String> {
    path.into_os_string()
        .into_string()
        .map_err(|_| "Path contains invalid UTF-8.".to_string())
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
    active_server_jar_path(app).is_some()
}

fn server_jar_disabled_by_env() -> bool {
    matches!(
        std::env::var("HUNTLY_NO_SERVER_JAR").as_deref(),
        Ok("1") | Ok("true") | Ok("TRUE")
    )
}

#[command]
fn get_server_info(app: AppHandle) -> ServerInfo {
    collect_server_info(&app)
}

fn collect_server_info(app: &AppHandle) -> ServerInfo {
    let java_path_buf = active_java_path(app);
    let jar_path_buf = active_server_jar_path(app);

    let java_version = java_path_buf.as_ref().and_then(read_java_version);
    let jar_version = current_server_jar_version(app);

    ServerInfo {
        jar_version,
        java_version,
        jar_path: jar_path_buf.as_ref().map(canonicalize),
        java_path: java_path_buf.as_ref().map(canonicalize),
    }
}

fn active_java_path(app: &AppHandle) -> Option<PathBuf> {
    let mut java_resource_path = "server_bin/jre11/bin/java.exe";
    if cfg!(not(target_os = "windows")) {
        java_resource_path = "server_bin/jre11/bin/java";
    }

    app.path()
        .resolve(java_resource_path, tauri::path::BaseDirectory::Resource)
        .ok()
        .filter(|p| p.exists())
}

fn active_server_jar_path(app: &AppHandle) -> Option<PathBuf> {
    if server_jar_disabled_by_env() {
        return None;
    }

    if let Ok(app_data_dir) = app.path().app_data_dir() {
        let writable_jar = app_data_dir
            .join(SERVER_JAR_DATA_DIR)
            .join(SERVER_JAR_FILE_NAME);
        if writable_jar.exists() {
            return Some(writable_jar);
        }
    }

    app.path()
        .resolve(
            SERVER_JAR_RESOURCE_PATH,
            tauri::path::BaseDirectory::Resource,
        )
        .ok()
        .filter(|p| p.exists())
}

fn writable_server_jar_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let server_bin_dir = app_data_dir.join(SERVER_JAR_DATA_DIR);
    std::fs::create_dir_all(&server_bin_dir).map_err(|e| e.to_string())?;
    Ok(server_bin_dir.join(SERVER_JAR_FILE_NAME))
}

fn writable_server_jar_version_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let server_bin_dir = app_data_dir.join(SERVER_JAR_DATA_DIR);
    std::fs::create_dir_all(&server_bin_dir).map_err(|e| e.to_string())?;
    Ok(server_bin_dir.join(SERVER_JAR_VERSION_FILE_NAME))
}

fn server_jwt_secret_path(app: &AppHandle) -> Result<PathBuf, String> {
    let app_data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&app_data_dir).map_err(|e| e.to_string())?;
    Ok(app_data_dir.join(SERVER_JWT_SECRET_FILE_NAME))
}

fn get_or_create_server_jwt_secret(app: &AppHandle) -> Result<String, String> {
    let secret_path = server_jwt_secret_path(app)?;
    if let Ok(secret) = std::fs::read_to_string(&secret_path) {
        let secret = secret.trim().to_string();
        if secret.len() >= 64 && secret.chars().all(|ch| ch.is_ascii_hexdigit()) {
            return Ok(secret);
        }
    }

    let mut bytes = [0u8; 64];
    getrandom::getrandom(&mut bytes).map_err(|e| e.to_string())?;
    let secret = hex_encode(&bytes);
    std::fs::write(&secret_path, format!("{}\n", secret)).map_err(|e| e.to_string())?;
    Ok(secret)
}

fn current_server_jar_version(app: &AppHandle) -> Option<String> {
    let jar_path = active_server_jar_path(app)?;
    if is_writable_server_jar_path(app, &jar_path) {
        return read_server_jar_release_version(app).or_else(|| read_server_jar_version(&jar_path));
    }

    read_server_jar_version(&jar_path)
}

fn is_writable_server_jar_path(app: &AppHandle, jar_path: &Path) -> bool {
    app.path()
        .app_data_dir()
        .map(|app_data_dir| {
            jar_path
                == app_data_dir
                    .join(SERVER_JAR_DATA_DIR)
                    .join(SERVER_JAR_FILE_NAME)
        })
        .unwrap_or(false)
}

fn read_server_jar_release_version(app: &AppHandle) -> Option<String> {
    let version_path = app
        .path()
        .app_data_dir()
        .ok()?
        .join(SERVER_JAR_DATA_DIR)
        .join(SERVER_JAR_VERSION_FILE_NAME);
    let version = std::fs::read_to_string(version_path)
        .ok()?
        .trim()
        .to_string();
    if version.is_empty() {
        None
    } else {
        Some(version)
    }
}

fn read_java_version(java_path: &PathBuf) -> Option<String> {
    let output = Command::new(java_path).arg("-version").output().ok()?;
    let stderr = String::from_utf8_lossy(&output.stderr);
    stderr.lines().next().and_then(|line| {
        if let Some(start) = line.find('"') {
            if let Some(end) = line[start + 1..].find('"') {
                return Some(line[start + 1..start + 1 + end].to_string());
            }
        }
        None
    })
}

fn read_server_jar_version(jar_path: &PathBuf) -> Option<String> {
    use zip::ZipArchive;

    let file = File::open(jar_path).ok()?;
    let mut archive = ZipArchive::new(file).ok()?;

    if let Ok(manifest) = archive.by_name("META-INF/MANIFEST.MF") {
        let reader = BufReader::new(manifest);
        for line in reader.lines().map_while(Result::ok) {
            if let Some(version) = line.strip_prefix("Implementation-Version:") {
                return Some(version.trim().to_string());
            }
        }
    }

    if let Ok(properties) =
        archive.by_name("META-INF/maven/com.huntly/huntly-server/pom.properties")
    {
        let reader = BufReader::new(properties);
        for line in reader.lines().map_while(Result::ok) {
            if let Some(version) = line.strip_prefix("version=") {
                return Some(version.trim().to_string());
            }
        }
    }

    None
}

#[command]
async fn check_server_update(app: AppHandle) -> Result<ServerUpdateInfo, String> {
    let current_version = current_server_jar_version(&app);
    let release = fetch_latest_server_release().await?;
    let available = current_version
        .as_deref()
        .map(|current| is_version_newer(&release.version, current))
        .unwrap_or(true);

    Ok(ServerUpdateInfo {
        current_version,
        latest_version: Some(release.version),
        latest_tag: Some(release.tag_name),
        available,
        notes: release.notes,
        date: release.published_at,
        asset_name: Some(release.asset.name),
        asset_size: release.asset.size,
        release_url: release.html_url,
    })
}

#[command]
async fn install_server_update(app: AppHandle) -> Result<ServerInfo, String> {
    if server_jar_disabled_by_env() {
        return Err("Server bundle updates are disabled by HUNTLY_NO_SERVER_JAR.".to_string());
    }

    let current_version = current_server_jar_version(&app);
    let release = fetch_latest_server_release().await?;
    let available = current_version
        .as_deref()
        .map(|current| is_version_newer(&release.version, current))
        .unwrap_or(true);

    if !available {
        return Ok(collect_server_info(&app));
    }

    let client = github_client()?;
    let bytes = client
        .get(&release.asset.browser_download_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .bytes()
        .await
        .map_err(|e| e.to_string())?;

    let expected_sha256 = fetch_sha256_checksum(&client, &release.sha256_asset).await?;
    let actual_sha256 = sha256_hex(bytes.as_ref());
    if actual_sha256 != expected_sha256 {
        return Err("Downloaded server JAR checksum does not match the release checksum.".to_string());
    }

    let dest_path = writable_server_jar_path(&app)?;
    let temp_path = dest_path.with_extension("jar.download");
    let backup_path = dest_path.with_extension("jar.bak");
    let version_path = writable_server_jar_version_path(&app)?;

    std::fs::write(&temp_path, bytes.as_ref()).map_err(|e| e.to_string())?;

    let downloaded_version = read_server_jar_version(&temp_path)
        .ok_or_else(|| "Downloaded server JAR does not include version metadata.".to_string())?;
    if normalize_version(&downloaded_version) != normalize_version(&release.version)
        && !is_server_jar_asset_for_version(&release.asset.name, &release.version)
    {
        let _ = std::fs::remove_file(&temp_path);
        return Err(format!(
            "Downloaded server JAR version {} does not match release version {}.",
            downloaded_version, release.version
        ));
    }

    if backup_path.exists() {
        std::fs::remove_file(&backup_path).map_err(|e| e.to_string())?;
    }
    if dest_path.exists() {
        std::fs::rename(&dest_path, &backup_path).map_err(|e| e.to_string())?;
    }

    if let Err(e) = std::fs::rename(&temp_path, &dest_path) {
        if backup_path.exists() {
            let _ = std::fs::rename(&backup_path, &dest_path);
        }
        let _ = std::fs::remove_file(&temp_path);
        return Err(e.to_string());
    }

    if backup_path.exists() {
        let _ = std::fs::remove_file(&backup_path);
    }

    std::fs::write(&version_path, format!("{}\n", release.version)).map_err(|e| e.to_string())?;

    Ok(collect_server_info(&app))
}

#[command]
async fn check_tauri_update(webview: Webview) -> Result<Option<TauriUpdateMetadata>, String> {
    let manifest_url = match fetch_latest_tauri_update_manifest_url().await? {
        Some(manifest_url) => manifest_url,
        None => return Ok(None),
    };

    let endpoint = Url::parse(&manifest_url).map_err(|e| e.to_string())?;
    let updater = webview
        .updater_builder()
        .endpoints(vec![endpoint])
        .map_err(|e| e.to_string())?
        .build()
        .map_err(|e| e.to_string())?;

    let update = match updater.check().await {
        Ok(update) => update,
        Err(tauri_plugin_updater::Error::ReleaseNotFound) => return Ok(None),
        Err(e) => return Err(e.to_string()),
    };

    if let Some(update) = update {
        let current_version = update.current_version.clone();
        let version = update.version.clone();
        let date = update
            .raw_json
            .get("pub_date")
            .and_then(|value| value.as_str())
            .map(ToString::to_string);
        let body = update.body.clone();
        let raw_json = update.raw_json.clone();
        let rid = webview.resources_table().add(update);

        Ok(Some(TauriUpdateMetadata {
            rid,
            current_version,
            version,
            date,
            body,
            raw_json,
        }))
    } else {
        Ok(None)
    }
}

async fn fetch_latest_tauri_update_manifest_url() -> Result<Option<String>, String> {
    let releases = fetch_github_releases().await?;
    Ok(releases.into_iter().find_map(tauri_update_manifest_url))
}

fn tauri_update_manifest_url(release: GithubRelease) -> Option<String> {
    if release.draft || release.prerelease || tauri_release_version(&release.tag_name).is_none() {
        return None;
    }

    release
        .assets
        .into_iter()
        .find(|asset| asset.name == TAURI_UPDATE_MANIFEST_FILE_NAME)
        .map(|asset| asset.browser_download_url)
}

fn tauri_release_version(tag_name: &str) -> Option<String> {
    let version = tag_name.strip_prefix(TAURI_RELEASE_TAG_PREFIX)?;
    let version_parts: Vec<&str> = version.split('.').collect();
    if version_parts.len() < 3
        || !version_parts.iter().take(3).all(|part| {
            part.chars()
                .next()
                .map(|ch| ch.is_ascii_digit())
                .unwrap_or(false)
        })
    {
        return None;
    }
    Some(version.to_string())
}

async fn fetch_latest_server_release() -> Result<ServerRelease, String> {
    let releases = fetch_github_releases().await?;

    releases
        .into_iter()
        .find_map(main_server_release)
        .ok_or_else(|| "No main Huntly release with a server JAR asset was found.".to_string())
}

async fn fetch_github_releases() -> Result<Vec<GithubRelease>, String> {
    let client = github_client()?;
    client
        .get(GITHUB_RELEASES_API)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())
}

fn github_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .user_agent(GITHUB_USER_AGENT)
        .build()
        .map_err(|e| e.to_string())
}

fn main_server_release(release: GithubRelease) -> Option<ServerRelease> {
    if release.draft || release.prerelease {
        return None;
    }

    let version = main_release_version(&release.tag_name)?;
    let asset = release
        .assets
        .iter()
        .find(|asset| is_server_jar_asset(&asset.name, &version))?
        .clone();
    let sha256_asset = release
        .assets
        .iter()
        .find(|candidate| is_server_jar_sha256_asset(&candidate.name, &asset.name))?
        .clone();

    Some(ServerRelease {
        version,
        tag_name: release.tag_name,
        notes: release.body,
        published_at: release.published_at,
        html_url: release.html_url,
        asset,
        sha256_asset,
    })
}

async fn fetch_sha256_checksum(
    client: &reqwest::Client,
    asset: &GithubReleaseAsset,
) -> Result<String, String> {
    let checksum = client
        .get(&asset.browser_download_url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .error_for_status()
        .map_err(|e| e.to_string())?
        .text()
        .await
        .map_err(|e| e.to_string())?;

    let digest = checksum
        .split_whitespace()
        .next()
        .ok_or_else(|| "Server JAR checksum file is empty.".to_string())?
        .trim()
        .to_ascii_lowercase();

    if digest.len() != 64 || !digest.chars().all(|ch| ch.is_ascii_hexdigit()) {
        return Err("Server JAR checksum file does not contain a valid SHA-256 digest.".to_string());
    }

    Ok(digest)
}

fn main_release_version(tag_name: &str) -> Option<String> {
    if tag_name.contains('/') {
        return None;
    }
    let version = tag_name.strip_prefix('v')?;
    let version_parts: Vec<&str> = version.split('.').collect();
    if version_parts.len() < 3
        || !version_parts.iter().take(3).all(|part| {
            part.chars()
                .next()
                .map(|ch| ch.is_ascii_digit())
                .unwrap_or(false)
        })
    {
        return None;
    }
    Some(version.to_string())
}

fn is_server_jar_asset(asset_name: &str, version: &str) -> bool {
    asset_name == SERVER_JAR_FILE_NAME || is_server_jar_asset_for_version(asset_name, version)
}

fn is_server_jar_asset_for_version(asset_name: &str, version: &str) -> bool {
    asset_name == format!("huntly-server-{}.jar", normalize_version(version))
}

fn is_server_jar_sha256_asset(asset_name: &str, jar_asset_name: &str) -> bool {
    asset_name == format!("{}.sha256", jar_asset_name)
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    hex_encode(&digest)
}

fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut encoded = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        encoded.push(HEX[(byte >> 4) as usize] as char);
        encoded.push(HEX[(byte & 0x0f) as usize] as char);
    }
    encoded
}

fn normalize_version(version: &str) -> String {
    version.trim().trim_start_matches('v').to_string()
}

fn is_version_newer(latest: &str, current: &str) -> bool {
    let latest_parts = version_numbers(latest);
    let current_parts = version_numbers(current);
    let max_len = latest_parts.len().max(current_parts.len()).max(3);

    for index in 0..max_len {
        let latest_part = *latest_parts.get(index).unwrap_or(&0);
        let current_part = *current_parts.get(index).unwrap_or(&0);
        if latest_part > current_part {
            return true;
        }
        if latest_part < current_part {
            return false;
        }
    }

    false
}

fn version_numbers(version: &str) -> Vec<u64> {
    normalize_version(version)
        .split(|ch: char| !ch.is_ascii_digit())
        .filter(|part| !part.is_empty())
        .filter_map(|part| part.parse::<u64>().ok())
        .collect()
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
            let _ = app.set_activation_policy(ActivationPolicy::Regular);
        } else {
            let _ = app.set_activation_policy(ActivationPolicy::Accessory);
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
    let data_dir = get_app_data_dir(app)?;
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .creation_flags(CREATE_NO_WINDOW)
            .arg(&data_dir)
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
    let java_path =
        active_java_path(app).ok_or_else(|| "Embedded Java runtime not found.".to_string())?;
    let file_path = active_server_jar_path(app).ok_or_else(|| {
        "Server bundle not found. This desktop client was built without the Huntly server."
            .to_string()
    })?;

    if server_jar_disabled_by_env() || !file_path.exists() {
        return Err(
            "Server bundle not found. This desktop client was built without the Huntly server."
                .to_string(),
        );
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
    let data_dir = get_app_data_dir(app)?;
    let jwt_secret = get_or_create_server_jwt_secret(app)?;
    println!("data dir:{}", data_dir);
    #[cfg(target_os = "windows")]
    {
        let child = cmd
            .arg("-jar")
            .arg(canonicalize(&file_path))
            .arg(format!("--server.port={}", port))
            .arg(format!("--server.address={}", server_address))
            .arg(format!("--huntly.dataDir={}/", data_dir))
            .arg(format!("--huntly.luceneDir={}/lucene", data_dir))
            .arg(format!("--huntly.jwtSecret={}", jwt_secret))
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
            .arg(format!("--huntly.jwtSecret={}", jwt_secret))
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

fn handle_stop_server(_app: &AppHandle) {
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
        eprintln!("No tracked Huntly server process was running.");
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

        tray.on_menu_event(move |app, event| match event.id().as_ref() {
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
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--silently"]),
        ))
        .setup(|app| {
            let settings_path = get_settings_path(&app.handle()).map_err(|e| {
                std::io::Error::new(std::io::ErrorKind::Other, e)
            })?;
            let metadata_settings = std::fs::metadata(&settings_path);
            match metadata_settings {
                Ok(_) => {}
                Err(_) => {
                    let default_settings = get_default_settings();
                    let settings_str = serde_json::to_string(&default_settings)?;
                    std::fs::write(&settings_path, settings_str)?;
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
            check_tauri_update,
            check_server_update,
            install_server_update,
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
