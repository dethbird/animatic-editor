use crate::models::media::DownloadResult;
use crate::services::path_resolver;
use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use std::path::Path;
use tokio::io::AsyncWriteExt;

const USER_AGENT: &str = concat!("AnimaticEditor/", env!("CARGO_PKG_VERSION"), " (Tauri)");

/// Build a shared reqwest client with a proper User-Agent.
/// CDNs (e.g. Midjourney, Cloudinary) reject requests that arrive without one.
fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .user_agent(USER_AGENT)
        .build()
        .context("building HTTP client")
}

/// Download a remote URL into `<project_dir>/media/`, deduplicating by URL hash.
///
/// If the file was previously downloaded (same URL → same filename), the cached
/// file is returned without a network request.
pub async fn download_url(url: &str, project_dir: &Path) -> Result<DownloadResult> {
    // 1. Hash the URL to derive a stable filename stem
    let url_hash = sha256_hex(url.as_bytes());
    let media_dir = path_resolver::media_dir(project_dir)?;

    // 2. Build a tentative filename: we don't know the extension yet, so we
    //    first check if *any* file matching the hash stem already exists.
    let existing = find_cached_file(&media_dir, &url_hash[..16]);
    if let Some(cached) = existing {
        let local_path = cached.to_string_lossy().into_owned();
        let content_hash = sha256_file(&cached).await?;
        return Ok(DownloadResult {
            local_path,
            content_hash,
            fetched_at: chrono_now(),
        });
    }

    // 3. Fetch the URL
    let response = client()?
        .get(url)
        .send()
        .await
        .with_context(|| format!("downloading {}", url))?;

    if !response.status().is_success() {
        anyhow::bail!("HTTP {} downloading {}", response.status(), url);
    }

    // 4. Determine extension from Content-Type or URL path
    let ext = extension_from_response(&response, url);

    // 5. Hash URL for the stem (first 16 hex chars)
    let stem = &url_hash[..16];
    let filename = format!("{}{}", stem, ext);
    let local_path = media_dir.join(&filename);

    // 6. Stream to disk, accumulating a SHA256 of the content
    let mut hasher = Sha256::new();
    let mut file = tokio::fs::File::create(&local_path)
        .await
        .with_context(|| format!("creating {:?}", local_path))?;

    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.context("reading download stream")?;
        hasher.update(&chunk);
        file.write_all(&chunk)
            .await
            .context("writing chunk to disk")?;
    }
    file.flush().await.context("flushing download")?;

    let content_hash = hex::encode(hasher.finalize());

    Ok(DownloadResult {
        local_path: local_path.to_string_lossy().into_owned(),
        content_hash,
        fetched_at: chrono_now(),
    })
}

// ── helpers ──────────────────────────────────────────────────────────────────

fn sha256_hex(data: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(data);
    hex::encode(h.finalize())
}

async fn sha256_file(path: &Path) -> Result<String> {
    let data = tokio::fs::read(path)
        .await
        .with_context(|| format!("reading {:?} for hash", path))?;
    Ok(sha256_hex(&data))
}

/// Look for a previously cached file whose name starts with `stem`.
fn find_cached_file(media_dir: &Path, stem: &str) -> Option<std::path::PathBuf> {
    std::fs::read_dir(media_dir).ok()?.find_map(|entry| {
        let entry = entry.ok()?;
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if name_str.starts_with(stem) {
            Some(entry.path())
        } else {
            None
        }
    })
}

fn extension_from_response(response: &reqwest::Response, url: &str) -> String {
    // Try Content-Type header first
    if let Some(ct) = response.headers().get(reqwest::header::CONTENT_TYPE) {
        if let Ok(ct_str) = ct.to_str() {
            let ext = match ct_str.split(';').next().unwrap_or("").trim() {
                "image/png"  => ".png",
                "image/jpeg" => ".jpg",
                "image/webp" => ".webp",
                "image/gif"  => ".gif",
                "audio/wav" | "audio/x-wav"  => ".wav",
                "audio/mpeg" | "audio/mp3"   => ".mp3",
                "audio/ogg"  => ".ogg",
                "audio/aac"  => ".aac",
                "audio/flac" => ".flac",
                _ => "",
            };
            if !ext.is_empty() {
                return ext.to_string();
            }
        }
    }

    // Fall back to URL path extension
    url.split('?')
        .next()
        .and_then(|u| u.split('/').last())
        .and_then(|seg| {
            let dot = seg.rfind('.')?;
            Some(seg[dot..].to_lowercase())
        })
        .unwrap_or_default()
}

fn chrono_now() -> String {
    chrono::Utc::now().to_rfc3339()
}
