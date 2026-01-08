use crate::sync::*;
use chrono::Utc;
use reqwest::header::{HeaderMap, HeaderValue};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{command, AppHandle};

/// Create HTTP client with proxy bypass for localhost connections and appropriate timeouts
fn create_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .no_proxy() // Don't use system proxy
        .timeout(Duration::from_secs(300)) // 5 minute total timeout for large exports
        .connect_timeout(Duration::from_secs(30)) // 30 second connection timeout
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))
}

/// 同步分类枚举
#[derive(Debug, Clone, Copy)]
pub enum SyncCategory {
    Saved,
    Twitter,
    Github,
    Feeds,
    RecentlyRead,
    Highlights,
}

impl SyncCategory {
    pub fn api_path(&self) -> &'static str {
        match self {
            SyncCategory::Saved => "/api/sync/saved",
            SyncCategory::Twitter => "/api/sync/x",
            SyncCategory::Github => "/api/sync/github",
            SyncCategory::Feeds => "/api/sync/feeds",
            SyncCategory::RecentlyRead => "/api/sync/recently-read",
            SyncCategory::Highlights => "/api/sync/highlights",
        }
    }

    pub fn folder_name(&self) -> &'static str {
        match self {
            SyncCategory::Saved => "Saved",
            SyncCategory::Twitter => "X",
            SyncCategory::Github => "Github",
            SyncCategory::Feeds => "Feeds",
            SyncCategory::RecentlyRead => "RecentlyRead",
            SyncCategory::Highlights => "Highlights",
        }
    }

    pub fn all() -> Vec<SyncCategory> {
        vec![
            SyncCategory::Saved,
            SyncCategory::Twitter,
            SyncCategory::Github,
            SyncCategory::Feeds,
            SyncCategory::RecentlyRead,
            SyncCategory::Highlights,
        ]
    }
}

#[command]
pub async fn fetch_library_pages(
    server_url: String,
    token: String,
    _last_sync_at: Option<String>,
) -> Result<Vec<PageItem>, String> {
    let client = create_http_client()?;
    let list_url = format!("{}/api/page/list", server_url.trim_end_matches('/'));

    let mut headers = HeaderMap::new();
    headers.insert(
        "X-Huntly-Sync-Token",
        HeaderValue::from_str(&token).unwrap(),
    );

    let params = vec![
        ("saveStatus", "SAVED".to_string()),
        ("sort", "SAVED_AT".to_string()),
        ("count", "100".to_string()),
    ];

    let response = client
        .get(&list_url)
        .headers(headers)
        .query(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        let pages: Vec<PageItem> = response.json().await.map_err(|e| e.to_string())?;
        Ok(pages)
    } else {
        Err(format!("Failed to fetch pages: {}", response.status()))
    }
}

#[command]
pub async fn sync_library_to_markdown(
    app: AppHandle,
    server_url: String,
    token: String,
    export_folder: String,
    last_sync_at: Option<String>,
) -> Result<SyncResult, String> {
    let token = resolve_sync_token(&app, &server_url, &token).await?;
    push_log(&app, format!("Sync started ({})", server_url));
    // Update sync state
    {
        let mut state = SYNC_STATE.lock().unwrap();
        state.is_syncing = true;
        state.last_sync_error = None;
        let _ = crate::sync_persistence::save_sync_state(&app, &state.clone());
    }

    // 记录同步开始时间（用于下次增量同步）
    let sync_start_time = chrono::Utc::now().to_rfc3339();

    let result = do_sync(
        &app,
        &server_url,
        &token,
        &export_folder,
        last_sync_at.as_deref(),
    )
    .await;

    // Update sync state and save last_sync_at
    {
        let mut state = SYNC_STATE.lock().unwrap();
        state.is_syncing = false;
        match &result {
            Ok(r) => {
                let msg = if r.is_incremental {
                    format!(
                        "Incremental sync: {} updated, {} skipped",
                        r.synced_count, r.skipped_count
                    )
                } else {
                    format!("Full sync: {} pages synced", r.synced_count)
                };
                state.last_sync_status = Some(msg);
                state.synced_count = r.synced_count;
                state.logs.push(format!(
                    "{} Sync OK: {} updated, {} skipped",
                    now_ts(),
                    r.synced_count,
                    r.skipped_count
                ));
            }
            Err(e) => {
                state.last_sync_error = Some(e.clone());
                state.logs.push(format!("{} Sync ERROR: {}", now_ts(), e));
            }
        }
        trim_logs(&mut state.logs);
        let _ = crate::sync_persistence::save_sync_state(&app, &state.clone());
    }

    // Persist last_sync_at to sync settings file only when no export errors.
    if let Ok(sync_result) = &result {
        if sync_result.errors.is_empty() {
            let _ = save_last_sync_at(&app, &sync_start_time);
        } else {
            push_log(
                &app,
                "Sync completed with errors; last_sync_at not updated".to_string(),
            );
        }
    }

    result
}

fn save_last_sync_at(app: &AppHandle, timestamp: &str) -> Result<(), String> {
    let mut settings = crate::sync_persistence::load_sync_settings(app)?;
    settings.last_sync_at = Some(timestamp.to_string());
    crate::sync_persistence::save_sync_settings(app, &settings)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncResult {
    pub synced_count: u32,
    pub skipped_count: u32,
    pub errors: Vec<String>,
    pub is_incremental: bool,
}

/// 高性能同步逻辑：使用新的分离式 API
/// 1. 先获取各分类的元数据列表（不含 content）
/// 2. 筛选需要更新的项目
/// 3. 批量获取需要更新项目的内容
/// 4. 在客户端进行 HTML 到 Markdown 转换
async fn do_sync(
    app: &AppHandle,
    server_url: &str,
    token: &str,
    export_folder: &str,
    last_sync_at: Option<&str>,
) -> Result<SyncResult, String> {
    let is_incremental = last_sync_at.is_some();
    let mut synced_count = 0u32;
    let mut skipped_count = 0u32;
    let mut errors = Vec::new();

    let _guard = crate::macos_security_scope::begin_export_folder_access(
        app,
        &PathBuf::from(export_folder),
    )
    .map_err(|e| format!("Export folder access error: {e}"))?;

    // 同步每个分类
    for category in SyncCategory::all() {
        let category_result = sync_category(
            app,
            server_url,
            token,
            export_folder,
            category,
            last_sync_at,
        )
        .await;

        match category_result {
            Ok((synced, skipped, mut errs)) => {
                synced_count += synced;
                skipped_count += skipped;
                errors.append(&mut errs);
            }
            Err(e) => {
                errors.push(format!(
                    "Failed to sync {}: {}",
                    category.folder_name(),
                    e
                ));
            }
        }
    }

    Ok(SyncResult {
        synced_count,
        skipped_count,
        errors,
        is_incremental,
    })
}

/// 获取 .huntly 元数据目录路径
fn get_metadata_dir(export_folder: &str) -> PathBuf {
    PathBuf::from(export_folder).join(".huntly")
}

/// 获取分类索引文件路径
fn get_category_index_path(export_folder: &str, category: SyncCategory) -> PathBuf {
    get_metadata_dir(export_folder).join(format!("{}-index.json", category.folder_name().to_lowercase()))
}

/// 获取分类游标文件路径
fn get_category_cursor_path(export_folder: &str, category: SyncCategory) -> PathBuf {
    get_metadata_dir(export_folder).join(format!("{}-cursor.json", category.folder_name().to_lowercase()))
}

/// 同步单个分类
async fn sync_category(
    app: &AppHandle,
    server_url: &str,
    token: &str,
    export_folder: &str,
    category: SyncCategory,
    _last_sync_at: Option<&str>,
) -> Result<(u32, u32, Vec<String>), String> {
    let mut synced_count = 0u32;
    let mut skipped_count = 0u32;
    let mut errors = Vec::new();

    // 创建 .huntly 元数据目录
    let metadata_dir = get_metadata_dir(export_folder);
    if !metadata_dir.exists() {
        fs::create_dir_all(&metadata_dir)
            .map_err(|e| format!("Failed to create .huntly directory: {}", e))?;
    }

    // 创建分类目录
    let category_folder = PathBuf::from(export_folder).join(category.folder_name());
    if !category_folder.exists() {
        fs::create_dir_all(&category_folder)
            .map_err(|e| format!("Failed to create directory: {}", e))?;
    }

    // 读取已有的索引文件（从 .huntly 目录），用于判断文件是否存在
    let existing_index = read_index_file(export_folder, category);

    // 读取上次保存的游标（从 .huntly 目录），实现增量同步
    let saved_cursor = read_cursor_file(export_folder, category);
    let mut cursor_at: Option<String> = saved_cursor.as_ref().and_then(|c| c.last_cursor_at.clone());
    let mut cursor_id: Option<i64> = saved_cursor.as_ref().and_then(|c| c.last_cursor_id);

    // 每次同步只获取一批数据（200条），而不是全部数据
    // 这样可以：
    // 1. 控制内存使用
    // 2. 后台同步时不会阻塞太久
    // 3. 通过游标逐步同步所有数据
    const BATCH_SIZE: usize = 200;

    let response = fetch_category_list(
        server_url,
        token,
        category,
        None, // 不使用 updatedAfter，通过游标实现增量
        cursor_at.as_deref(),
        cursor_id,
    )
    .await?;

    let all_items = response.items;

    if all_items.is_empty() {
        // 没有数据了，重置游标从头开始
        if saved_cursor.is_some() {
            push_log(
                app,
                format!("{}: No more data, resetting cursor", category.folder_name()),
            );
        }
        return Ok((0, 0, errors));
    }

    // 保存本次获取到的最后一个位置作为下次的游标
    let last_cursor_at = response.next_cursor_at;
    let last_cursor_id = response.next_cursor_id;

    if all_items.is_empty() {
        return Ok((0, 0, errors));
    }

    // 根据索引文件检查哪些文件缺失或需要更新
    let missing_or_updated = check_missing_or_updated_items(&category_folder, &all_items, &existing_index);

    push_log(
        app,
        format!(
            "{}: Found {} items, {} need sync",
            category.folder_name(),
            all_items.len(),
            missing_or_updated.len()
        ),
    );

    // 根据分类选择目录策略
    match category {
        SyncCategory::Feeds => {
            // Feeds 使用特殊的目录结构
            let result = sync_feeds_items(
                app,
                server_url,
                token,
                export_folder,
                &category_folder,
                &all_items,
                &missing_or_updated,
            )
            .await;
            match result {
                Ok((s, sk, mut e)) => {
                    synced_count += s;
                    skipped_count += sk;
                    errors.append(&mut e);
                }
                Err(e) => errors.push(e),
            }
        }
        _ => {
            // 其他分类使用标准处理
            let result = sync_standard_items(
                app,
                server_url,
                token,
                &category_folder,
                &all_items,
                &missing_or_updated,
            )
            .await;
            match result {
                Ok((s, sk, mut e)) => {
                    synced_count += s;
                    skipped_count += sk;
                    errors.append(&mut e);
                }
                Err(e) => errors.push(e),
            }
        }
    }

    // 写入目录索引到 .huntly 目录
    write_category_index(export_folder, category, &all_items)?;

    // 写入游标文件到 .huntly 目录（用于下次增量同步）
    if let (Some(at), Some(id)) = (last_cursor_at, last_cursor_id) {
        write_cursor_file(export_folder, category, Some(&at), Some(id))?;
    }

    Ok((synced_count, skipped_count, errors))
}

/// 标准分类项目同步
async fn sync_standard_items(
    _app: &AppHandle,
    server_url: &str,
    token: &str,
    category_folder: &PathBuf,
    items: &[SyncItemMeta],
    needs_sync: &std::collections::HashSet<i64>,
) -> Result<(u32, u32, Vec<String>), String> {
    let mut synced_count = 0u32;
    let mut skipped_count = 0u32;
    let mut errors = Vec::new();

    // 根据 needs_sync 集合筛选需要更新的项目
    let items_to_update: Vec<&SyncItemMeta> = items
        .iter()
        .filter(|item| needs_sync.contains(&item.id))
        .collect();

    skipped_count = (items.len() - items_to_update.len()) as u32;

    if items_to_update.is_empty() {
        return Ok((0, skipped_count, errors));
    }

    // 批量获取内容
    const BATCH_SIZE: usize = 50;
    for chunk in items_to_update.chunks(BATCH_SIZE) {
        let ids: Vec<i64> = chunk.iter().map(|item| item.id).collect();
        let id_to_meta: HashMap<i64, &SyncItemMeta> =
            chunk.iter().map(|item| (item.id, *item)).collect();

        match fetch_content_batch(server_url, token, &ids).await {
            Ok(contents) => {
                for content in contents {
                    if let Some(meta) = id_to_meta.get(&content.id) {
                        match export_item_to_markdown(category_folder, meta, &content) {
                            Ok(_) => synced_count += 1,
                            Err(e) => errors.push(format!(
                                "Failed to export {}: {}",
                                meta.title.as_deref().unwrap_or("unknown"),
                                e
                            )),
                        }
                    }
                }
            }
            Err(e) => {
                errors.push(format!("Failed to fetch content batch: {}", e));
            }
        }
    }

    Ok((synced_count, skipped_count, errors))
}

/// Feeds 分类目录同步（按 connector 创建子目录，索引集中在 .huntly 目录）
async fn sync_feeds_items(
    _app: &AppHandle,
    server_url: &str,
    token: &str,
    export_folder: &str,
    feeds_folder: &PathBuf,
    items: &[SyncItemMeta],
    needs_sync: &std::collections::HashSet<i64>,
) -> Result<(u32, u32, Vec<String>), String> {
    let mut synced_count = 0u32;
    let mut skipped_count = 0u32;
    let mut errors = Vec::new();

    // 按 connectorId 分组（简化结构，只按RSS源分组）
    let mut grouped: HashMap<Option<i32>, Vec<&SyncItemMeta>> = HashMap::new();
    for item in items {
        grouped.entry(item.connector_id).or_default().push(item);
    }

    // 用于Feeds总索引的数据
    let mut feed_list = Vec::new();

    for (connector_id, group_items) in grouped {
        // 创建目录结构：Feeds/{connectorId-connectorName}/
        let connector_name = group_items
            .first()
            .and_then(|i| i.connector_name.as_ref())
            .map(|n| sanitize_dirname(n))
            .unwrap_or_else(|| "unknown".to_string());

        let feed_folder_name = format!("{}-{}", connector_id.unwrap_or(0), connector_name);
        let target_folder = feeds_folder.join(&feed_folder_name);

        if !target_folder.exists() {
            fs::create_dir_all(&target_folder)
                .map_err(|e| format!("Failed to create feed directory: {}", e))?;
        }

        // 添加到总索引
        feed_list.push(serde_json::json!({
            "connectorId": connector_id,
            "connectorName": connector_name,
            "folder": feed_folder_name,
            "itemCount": group_items.len()
        }));

        // 根据 needs_sync 集合筛选需要更新的项目
        let items_to_update: Vec<&&SyncItemMeta> = group_items
            .iter()
            .filter(|item| needs_sync.contains(&item.id))
            .collect();

        skipped_count += (group_items.len() - items_to_update.len()) as u32;

        if items_to_update.is_empty() {
            // 即使没有需要同步的项目，也更新该feed的索引到 .huntly 目录
            write_feed_subfolder_index(
                export_folder,
                connector_id.unwrap_or(0),
                &connector_name,
                &group_items,
            )?;
            continue;
        }

        // 批量获取内容
        const BATCH_SIZE: usize = 50;
        for chunk in items_to_update.chunks(BATCH_SIZE) {
            let ids: Vec<i64> = chunk.iter().map(|item| item.id).collect();
            let id_to_meta: HashMap<i64, &SyncItemMeta> =
                chunk.iter().map(|item| (item.id, **item)).collect();

            match fetch_content_batch(server_url, token, &ids).await {
                Ok(contents) => {
                    for content in contents {
                        if let Some(meta) = id_to_meta.get(&content.id) {
                            match export_item_to_markdown(&target_folder, meta, &content) {
                                Ok(_) => synced_count += 1,
                                Err(e) => errors.push(format!(
                                    "Failed to export {}: {}",
                                    meta.title.as_deref().unwrap_or("unknown"),
                                    e
                                )),
                            }
                        }
                    }
                }
                Err(e) => {
                    errors.push(format!("Failed to fetch content batch: {}", e));
                }
            }
        }

        // 为该feed子目录生成索引到 .huntly 目录
        write_feed_subfolder_index(
            export_folder,
            connector_id.unwrap_or(0),
            &connector_name,
            &group_items,
        )?;
    }

    // 写入Feeds总索引到 .huntly 目录
    write_feeds_master_index(export_folder, &feed_list)?;

    Ok((synced_count, skipped_count, errors))
}

/// 写入Feeds总索引到 .huntly 目录（列出所有RSS源）
fn write_feeds_master_index(
    export_folder: &str,
    feed_list: &[serde_json::Value],
) -> Result<(), String> {
    let index_file = get_metadata_dir(export_folder).join("feeds-index.json");
    let master_index = serde_json::json!({
        "category": "Feeds",
        "syncAt": chrono::Utc::now().to_rfc3339(),
        "totalFeeds": feed_list.len(),
        "feeds": feed_list
    });

    let json_str = serde_json::to_string_pretty(&master_index).map_err(|e| e.to_string())?;
    fs::write(&index_file, json_str).map_err(|e| e.to_string())?;
    Ok(())
}

/// 写入单个Feed子目录的索引到 .huntly 目录
fn write_feed_subfolder_index(
    export_folder: &str,
    connector_id: i32,
    connector_name: &str,
    items: &[&SyncItemMeta],
) -> Result<(), String> {
    let index_file = get_metadata_dir(export_folder).join(format!("feeds-{}-index.json", connector_id));

    // 构建索引项
    let index_items: Vec<IndexItem> = items
        .iter()
        .map(|item| {
            let filename = generate_filename(item);
            let item_type = if item.content_type == Some(1) || item.content_type == Some(3) {
                "x"
            } else {
                "page"
            };

            IndexItem {
                id: item.id,
                filename,
                item_type: item_type.to_string(),
                content_type: item.content_type,
                connector_type: item.connector_type,
                connector_id: item.connector_id,
                folder_id: item.folder_id,
                starred: item.starred,
                read_later: item.read_later,
                saved_at: item.saved_at.clone(),
                updated_at: item.updated_at.clone(),
                created_at: item.created_at.clone(),
                last_read_at: item.last_read_at.clone(),
                archived_at: item.archived_at.clone(),
                highlight_count: item.highlight_count,
            }
        })
        .collect();

    let feed_index = CategoryIndex {
        category: connector_name.to_string(),
        sync_at: chrono::Utc::now().to_rfc3339(),
        total_count: index_items.len(),
        items: index_items,
    };

    let json_str = serde_json::to_string_pretty(&feed_index).map_err(|e| e.to_string())?;
    fs::write(&index_file, json_str).map_err(|e| e.to_string())?;
    Ok(())
}

/// 清理目录名
fn sanitize_dirname(name: &str) -> String {
    sanitize_filename::sanitize_with_options(
        name.trim(),
        sanitize_filename::Options {
            truncate: true,
            windows: true,
            replacement: "_",
        },
    )
}

/// 获取分类列表（元数据）
async fn fetch_category_list(
    server_url: &str,
    token: &str,
    category: SyncCategory,
    updated_after: Option<&str>,
    cursor_at: Option<&str>,
    cursor_id: Option<i64>,
) -> Result<SyncListResponse, String> {
    let client = create_http_client()?;
    let url = format!(
        "{}{}",
        server_url.trim_end_matches('/'),
        category.api_path()
    );

    let mut headers = HeaderMap::new();
    headers.insert(
        "X-Huntly-Sync-Token",
        HeaderValue::from_str(token).unwrap(),
    );

    let mut params: Vec<(&str, String)> = vec![("limit", "100".to_string())];

    if let Some(after) = updated_after {
        // RecentlyRead uses different parameter name than other categories
        let param_name = match category {
            SyncCategory::RecentlyRead => "readAfter",
            _ => "updatedAfter",
        };
        params.push((param_name, after.to_string()));
    }
    if let Some(at) = cursor_at {
        // RecentlyRead uses different cursor parameter name than other categories
        let param_name = match category {
            SyncCategory::RecentlyRead => "cursorReadAt",
            _ => "cursorUpdatedAt",
        };
        params.push((param_name, at.to_string()));
    }
    if let Some(id) = cursor_id {
        params.push(("cursorId", id.to_string()));
    }

    let response = client
        .get(&url)
        .headers(headers)
        .query(&params)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        response.json().await.map_err(|e| e.to_string())
    } else {
        Err(format!(
            "Failed to fetch {} list: {}",
            category.folder_name(),
            response.status()
        ))
    }
}

/// 批量获取内容
async fn fetch_content_batch(
    server_url: &str,
    token: &str,
    ids: &[i64],
) -> Result<Vec<SyncContentResponse>, String> {
    let client = create_http_client()?;
    let url = format!(
        "{}/api/sync/content/batch",
        server_url.trim_end_matches('/')
    );

    let mut headers = HeaderMap::new();
    headers.insert(
        "X-Huntly-Sync-Token",
        HeaderValue::from_str(token).unwrap(),
    );
    headers.insert(
        reqwest::header::CONTENT_TYPE,
        HeaderValue::from_static("application/json"),
    );

    let response = client
        .post(&url)
        .headers(headers)
        .json(ids)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        response.json().await.map_err(|e| e.to_string())
    } else {
        Err(format!(
            "Failed to fetch content batch: {}",
            response.status()
        ))
    }
}

/// 判断是否需要更新项目
fn should_update_item(category_folder: &PathBuf, item: &SyncItemMeta) -> bool {
    let filename = generate_filename(item);
    let file_path = category_folder.join(&filename);

    if !file_path.exists() {
        return true;
    }

    let page_updated_at = match &item.updated_at {
        Some(ts) => ts,
        None => return true,
    };

    let file_metadata = match fs::metadata(&file_path) {
        Ok(m) => m,
        Err(_) => return true,
    };

    let file_modified = match file_metadata.modified() {
        Ok(t) => t,
        Err(_) => return true,
    };

    let page_time = match chrono::DateTime::parse_from_rfc3339(page_updated_at) {
        Ok(dt) => dt.timestamp(),
        Err(_) => return true,
    };

    let file_time = file_modified
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    page_time > file_time
}

/// 导出项目为 Markdown 文件
fn export_item_to_markdown(
    category_folder: &PathBuf,
    meta: &SyncItemMeta,
    content: &SyncContentResponse,
) -> Result<String, String> {
    let filename = generate_filename(meta);
    let file_path = category_folder.join(&filename);

    // HTML 转 Markdown（在客户端进行）
    let markdown_content = convert_to_markdown(meta, content);

    fs::write(&file_path, markdown_content).map_err(|e| e.to_string())?;

    Ok(file_path.to_string_lossy().to_string())
}

/// 将内容转换为 Markdown（使用服务端预转换的markdown）
fn convert_to_markdown(meta: &SyncItemMeta, content: &SyncContentResponse) -> String {
    let mut md = String::new();

    // 添加 frontmatter
    md.push_str("---\n");
    if let Some(title) = &meta.title {
        md.push_str(&format!("title: \"{}\"\n", escape_yaml(title)));
    }
    if let Some(url) = &meta.url {
        md.push_str(&format!("url: \"{}\"\n", url));
    }
    if let Some(author) = &meta.author {
        md.push_str(&format!("author: \"{}\"\n", escape_yaml(author)));
    }
    if let Some(saved_at) = &meta.saved_at {
        md.push_str(&format!("savedAt: \"{}\"\n", saved_at));
    }
    if let Some(updated_at) = &meta.updated_at {
        md.push_str(&format!("updatedAt: \"{}\"\n", updated_at));
    }
    if let Some(connector_name) = &meta.connector_name {
        md.push_str(&format!("source: \"{}\"\n", escape_yaml(connector_name)));
    }
    if let Some(folder_name) = &meta.folder_name {
        md.push_str(&format!("folder: \"{}\"\n", escape_yaml(folder_name)));
    }
    md.push_str("---\n\n");

    // 添加标题
    if let Some(title) = &meta.title {
        md.push_str(&format!("# {}\n\n", title));
    }

    // 使用服务端预转换的 Markdown（已经包含大小限制保护）
    if let Some(markdown_content) = &content.markdown {
        if !markdown_content.is_empty() {
            md.push_str(markdown_content);
        }
    }

    md
}

/// 转义 YAML 特殊字符
fn escape_yaml(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', " ")
        .replace('\r', "")
}

/// 判断内容类型是否为 Twitter/X（contentType 1=TWEET 或 3=QUOTED_TWEET）
fn is_twitter_content(item: &SyncItemMeta) -> bool {
    matches!(item.content_type, Some(1) | Some(3))
}

/// 获取内容类型标识
fn get_type_label(item: &SyncItemMeta) -> &'static str {
    if is_twitter_content(item) {
        "x"
    } else {
        "page"
    }
}

/// 生成文件名：{id}-{类型(x/page)}-{有意义内容}.md
fn generate_filename(item: &SyncItemMeta) -> String {
    let type_label = get_type_label(item);

    // 对于 Twitter，使用前部分字符作为内容
    let content_part = if is_twitter_content(item) {
        // 对于推文，使用 title 的前 50 个字符
        item.title
            .as_ref()
            .map(|t| t.trim())
            .filter(|t| !t.is_empty())
            .map(|t| {
                let chars: Vec<char> = t.chars().take(50).collect();
                chars.into_iter().collect::<String>()
            })
            .unwrap_or_else(|| "tweet".to_string())
    } else {
        // 对于普通页面，使用标题
        item.title
            .as_ref()
            .map(|t| t.trim())
            .filter(|t| !t.is_empty())
            .map(|t| {
                let chars: Vec<char> = t.chars().take(80).collect();
                chars.into_iter().collect::<String>()
            })
            .unwrap_or_else(|| "untitled".to_string())
    };

    let safe_content = sanitize_filename::sanitize_with_options(
        &content_part,
        sanitize_filename::Options {
            truncate: true,
            windows: true,
            replacement: "_",
        },
    );

    format!("{}-{}-{}.md", item.id, type_label, safe_content)
}

/// 写入目录索引文件到 .huntly 目录（精简版，不含描述和内容）
fn write_category_index(
    export_folder: &str,
    category: SyncCategory,
    items: &[SyncItemMeta],
) -> Result<(), String> {
    use crate::sync::{CategoryIndex, IndexItem};
    use std::collections::HashMap;

    // 读取现有索引（从 .huntly 目录）
    let existing_index = read_index_file(export_folder, category);
    let mut items_map: HashMap<i64, IndexItem> = existing_index
        .map(|idx| {
            idx.items
                .into_iter()
                .map(|item| (item.id, item))
                .collect()
        })
        .unwrap_or_default();

    // 更新/添加新项目
    for item in items {
        let index_item = IndexItem {
            id: item.id,
            filename: generate_filename(item),
            item_type: get_type_label(item).to_string(),
            content_type: item.content_type,
            connector_type: item.connector_type,
            connector_id: item.connector_id,
            folder_id: item.folder_id,
            starred: item.starred,
            read_later: item.read_later,
            saved_at: item.saved_at.clone(),
            updated_at: item.updated_at.clone(),
            created_at: item.created_at.clone(),
            last_read_at: item.last_read_at.clone(),
            archived_at: item.archived_at.clone(),
            highlight_count: item.highlight_count,
        };
        items_map.insert(item.id, index_item);
    }

    // 转换回 Vec 并排序（按 ID 降序）
    let mut all_items: Vec<IndexItem> = items_map.into_values().collect();
    all_items.sort_by(|a, b| b.id.cmp(&a.id));

    let index = CategoryIndex {
        category: category.folder_name().to_string(),
        sync_at: Utc::now().to_rfc3339(),
        total_count: all_items.len(),
        items: all_items,
    };

    let index_path = get_category_index_path(export_folder, category);
    let json = serde_json::to_string_pretty(&index).map_err(|e| e.to_string())?;
    fs::write(&index_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

/// 写入游标文件到 .huntly 目录（用于下一次增量获取）
fn write_cursor_file(
    export_folder: &str,
    category: SyncCategory,
    cursor_at: Option<&str>,
    cursor_id: Option<i64>,
) -> Result<(), String> {
    use crate::sync::CursorData;

    let cursor = CursorData {
        last_cursor_at: cursor_at.map(|s| s.to_string()),
        last_cursor_id: cursor_id,
        last_sync_at: Some(Utc::now().to_rfc3339()),
    };

    let cursor_path = get_category_cursor_path(export_folder, category);
    let json = serde_json::to_string_pretty(&cursor).map_err(|e| e.to_string())?;
    fs::write(&cursor_path, json).map_err(|e| e.to_string())?;

    Ok(())
}

/// 读取游标文件
/// 从 .huntly 目录读取游标文件
fn read_cursor_file(export_folder: &str, category: SyncCategory) -> Option<crate::sync::CursorData> {
    let cursor_path = get_category_cursor_path(export_folder, category);
    if !cursor_path.exists() {
        return None;
    }
    let content = fs::read_to_string(&cursor_path).ok()?;
    serde_json::from_str(&content).ok()
}

/// 从 .huntly 目录读取索引文件
fn read_index_file(export_folder: &str, category: SyncCategory) -> Option<crate::sync::CategoryIndex> {
    let index_path = get_category_index_path(export_folder, category);
    if !index_path.exists() {
        return None;
    }
    let content = fs::read_to_string(&index_path).ok()?;
    serde_json::from_str(&content).ok()
}

/// 检查哪些文件缺失或需要更新
/// 返回需要同步的项目 ID 集合
fn check_missing_or_updated_items(
    _category_folder: &PathBuf,
    items: &[SyncItemMeta],
    existing_index: &Option<crate::sync::CategoryIndex>,
) -> HashSet<i64> {
    let mut needs_sync: HashSet<i64> = HashSet::new();

    // 如果没有索引文件，所有项目都需要同步
    let existing_index = match existing_index {
        Some(idx) => idx,
        None => {
            // 没有索引，同步所有项目
            return items.iter().map(|item| item.id).collect();
        }
    };

    // 构建已有索引的 id -> (filename, updated_at) 映射
    let existing_map: HashMap<i64, (&str, Option<&str>)> = existing_index
        .items
        .iter()
        .map(|item| {
            (
                item.id,
                (item.filename.as_str(), item.updated_at.as_deref()),
            )
        })
        .collect();

    for item in items {
        let filename = generate_filename(item);

        // 情况1：不在索引中，需要同步
        if let Some((indexed_filename, indexed_updated_at)) = existing_map.get(&item.id) {
            // 情况2：文件名变了（标题变了）
            if *indexed_filename != filename {
                needs_sync.insert(item.id);
                continue;
            }

            // 情况3：检查更新时间
            if let (Some(new_updated), Some(old_updated)) = (&item.updated_at, indexed_updated_at) {
                if new_updated != *old_updated {
                    needs_sync.insert(item.id);
                    continue;
                }
            }
            // 索引中存在且文件名和更新时间都没变，跳过
        } else {
            // 不在索引中，需要同步
            needs_sync.insert(item.id);
        }
    }

    needs_sync
}

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

lazy_static::lazy_static! {
    static ref BACKGROUND_SYNC_RUNNING: Arc<AtomicBool> = Arc::new(AtomicBool::new(false));
}

const REALTIME_SYNC_INTERVAL_SECONDS: u64 = 60;  // 改为 60 秒，避免频繁同步导致内存暴涨

#[command]
pub async fn start_background_sync(
    app: AppHandle,
    server_url: String,
    token: String,
    export_folder: String,
    _interval_seconds: u64,
    initial_last_sync_at: Option<String>,
) -> Result<(), String> {
    push_log(&app, format!("Starting background sync for {}", server_url));

    let token = match resolve_sync_token(&app, &server_url, &token).await {
        Ok(t) => t,
        Err(e) => {
            let err_msg = format!("Failed to resolve sync token: {}", e);
            push_log(&app, err_msg.clone());
            return Err(err_msg);
        }
    };

    if BACKGROUND_SYNC_RUNNING.load(Ordering::SeqCst) {
        push_log(&app, "Background sync already running, skipping".to_string());
        return Err("Background sync is already running".to_string());
    }

    BACKGROUND_SYNC_RUNNING.store(true, Ordering::SeqCst);

    let running = BACKGROUND_SYNC_RUNNING.clone();
    let app_for_task = app.clone();
    push_log(&app_for_task, format!("Real-time sync enabled ({})", server_url));

    tokio::spawn(async move {
        let mut last_sync_at = initial_last_sync_at;

        while running.load(Ordering::SeqCst) {
            let sync_start = Utc::now().to_rfc3339();

            {
                let mut state = SYNC_STATE.lock().unwrap();
                state.is_syncing = true;
                state.last_sync_error = None;
                state.logs.push(format!("{} Background sync tick", now_ts()));
                trim_logs(&mut state.logs);
                let _ = crate::sync_persistence::save_sync_state(&app_for_task, &state.clone());
            }

            let result = do_sync(
                &app_for_task,
                &server_url,
                &token,
                &export_folder,
                last_sync_at.as_deref(),
            )
            .await;

            // Update sync state
            {
                let mut state = SYNC_STATE.lock().unwrap();
                state.is_syncing = false;
                match &result {
                    Ok(r) => {
                        let msg = if r.is_incremental {
                            format!(
                                "Incremental: {} updated, {} skipped",
                                r.synced_count, r.skipped_count
                            )
                        } else {
                            format!("Full sync: {} pages", r.synced_count)
                        };
                        state.last_sync_status = Some(msg);
                        state.synced_count = r.synced_count;
                        state.last_sync_error = None;
                        state.logs.push(format!(
                            "{} Background OK: {} updated, {} skipped",
                            now_ts(),
                            r.synced_count,
                            r.skipped_count
                        ));
                    }
                    Err(e) => {
                        state.last_sync_error = Some(e.clone());
                        state.logs.push(format!("{} Background ERROR: {}", now_ts(), e));
                    }
                }
                trim_logs(&mut state.logs);
                let _ = crate::sync_persistence::save_sync_state(&app_for_task, &state.clone());
            }

            // 同步成功且无错误时更新 last_sync_at
            if let Ok(sync_result) = &result {
                if sync_result.errors.is_empty() {
                    last_sync_at = Some(sync_start.clone());
                    let _ = save_last_sync_at(&app_for_task, &sync_start);
                } else {
                    push_log(
                        &app_for_task,
                        "Background sync completed with errors; last_sync_at not updated".to_string(),
                    );
                }
            }

            // Real-time sync uses a fixed short interval.
            tokio::time::sleep(tokio::time::Duration::from_secs(
                REALTIME_SYNC_INTERVAL_SECONDS,
            ))
            .await;
        }
    });

    Ok(())
}

fn now_ts() -> String {
    Utc::now().to_rfc3339()
}

fn trim_logs(logs: &mut Vec<String>) {
    const MAX: usize = 200;
    if logs.len() > MAX {
        let drain = logs.len() - MAX;
        logs.drain(0..drain);
    }
}

fn push_log(app: &AppHandle, message: String) {
    let mut state = SYNC_STATE.lock().unwrap();
    state.logs.push(format!("{} {}", now_ts(), message));
    trim_logs(&mut state.logs);
    let _ = crate::sync_persistence::save_sync_state(app, &state.clone());
}

const LOCAL_SYNC_TOKEN_FILENAME: &str = "sync-desktop.token";
const SERVER_SYNC_TOKEN_FILENAME: &str = "sync-server.token";

async fn resolve_sync_token(
    app: &AppHandle,
    server_url: &str,
    token: &str,
) -> Result<String, String> {
    if !token.trim().is_empty() {
        return Ok(token.trim().to_string());
    }
    if is_local_app_server_url(app, server_url) {
        return read_local_sync_token(app, server_url).await;
    }
    // Use file-based token storage (no keychain)
    match crate::sync_commands::get_sync_token(app.clone(), server_url.to_string())? {
        Some(t) if !t.trim().is_empty() => Ok(t.trim().to_string()),
        _ => Err("No sync token found for this server. Please connect the remote account first."
            .to_string()),
    }
}

fn is_local_app_server_url(app: &AppHandle, url: &str) -> bool {
    let trimmed = url.trim().trim_end_matches('/');
    let port = crate::get_settings(app).port;
    trimmed == format!("http://localhost:{}", port) || trimmed == format!("http://127.0.0.1:{}", port)
}

async fn read_local_sync_token(app: &AppHandle, server_url: &str) -> Result<String, String> {
    let data_dir = crate::get_app_data_dir(app);
    let server_path = PathBuf::from(&data_dir).join(SERVER_SYNC_TOKEN_FILENAME);
    let desktop_path = PathBuf::from(&data_dir).join(LOCAL_SYNC_TOKEN_FILENAME);

    ensure_local_server_token(server_url).await?;

    let token = fs::read_to_string(&server_path)
        .map_err(|e| {
            format!(
                "Local server token file not found: {} ({})",
                server_path.to_string_lossy(),
                e
            )
        })?
        .trim()
        .to_string();

    if token.is_empty() {
        return Err(format!(
            "Local server token file is empty: {}",
            server_path.to_string_lossy()
        ));
    }

    if let Some(parent) = desktop_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&desktop_path, &token).map_err(|e| {
        format!(
            "Failed to write desktop sync token file {}: {}",
            desktop_path.to_string_lossy(),
            e
        )
    })?;

    Ok(token)
}

async fn ensure_local_server_token(server_url: &str) -> Result<(), String> {
    let client = create_http_client()?;
    let url = format!("{}/api/sync/token", server_url.trim_end_matches('/'));
    let response = client.get(url).send().await.map_err(|e| e.to_string())?;
    if response.status().is_success() {
        Ok(())
    } else {
        Err(format!(
            "Failed to initialize local sync token: {}",
            response.status()
        ))
    }
}

/// Initialize local server token - called when connecting to local server
/// This ensures the token is available before any sync operations
#[command]
pub async fn init_local_server_token(app: AppHandle, server_url: String) -> Result<bool, String> {
    if !is_local_app_server_url(&app, &server_url) {
        return Ok(false);
    }

    // First, ensure server has created the token
    ensure_local_server_token(&server_url).await?;

    // Then read and cache the token locally
    let data_dir = crate::get_app_data_dir(&app);
    let server_path = PathBuf::from(&data_dir).join(SERVER_SYNC_TOKEN_FILENAME);

    let token = fs::read_to_string(&server_path)
        .map_err(|e| {
            format!(
                "Local server token file not found: {} ({})",
                server_path.to_string_lossy(),
                e
            )
        })?
        .trim()
        .to_string();

    if token.is_empty() {
        return Err(format!(
            "Local server token file is empty: {}",
            server_path.to_string_lossy()
        ));
    }

    // Also save to desktop token file for consistency
    let desktop_path = PathBuf::from(&data_dir).join(LOCAL_SYNC_TOKEN_FILENAME);
    if let Some(parent) = desktop_path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    fs::write(&desktop_path, &token).map_err(|e| {
        format!(
            "Failed to write desktop sync token file {}: {}",
            desktop_path.to_string_lossy(),
            e
        )
    })?;

    Ok(true)
}

#[command]
pub fn stop_background_sync() -> Result<(), String> {
    BACKGROUND_SYNC_RUNNING.store(false, Ordering::SeqCst);
    Ok(())
}

#[command]
pub fn is_background_sync_running() -> bool {
    BACKGROUND_SYNC_RUNNING.load(Ordering::SeqCst)
}
