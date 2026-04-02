use crate::models::media::{DownloadResult, MediaInfo};
use crate::services::{downloader, ffprobe};
use std::path::Path;

// ── probe_media ───────────────────────────────────────────────────────────────

/// Run ffprobe on a local file and return metadata.
#[tauri::command]
pub async fn probe_media(path: String) -> Result<MediaInfo, String> {
    ffprobe::probe(&path).await.map_err(|e| e.to_string())
}

// ── download_asset ────────────────────────────────────────────────────────────

/// Download a remote URL into the project's `media/` folder.
/// If the file was previously downloaded (dedup by URL hash), returns cached info.
#[tauri::command]
pub async fn download_asset(url: String, project_dir: String) -> Result<DownloadResult, String> {
    downloader::download_url(&url, Path::new(&project_dir))
        .await
        .map_err(|e| e.to_string())
}
