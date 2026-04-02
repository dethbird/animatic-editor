use serde::{Deserialize, Serialize};

/// Returned by `probe_media` — ffprobe-derived media metadata.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    pub kind: String,              // "image" | "audio"
    pub duration: Option<f64>,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub sample_rate: Option<u32>,
    pub channels: Option<u32>,
}

/// Returned by `download_asset` after a successful remote fetch.
#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    pub local_path: String,
    pub content_hash: String,
    pub fetched_at: String,   // ISO 8601
}

/// Version info returned by capability checks.
#[derive(Debug, Serialize, Deserialize)]
pub struct ToolInfo {
    pub available: bool,
    pub version: String,
}
