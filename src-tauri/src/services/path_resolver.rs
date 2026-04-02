use std::path::{Path, PathBuf};
use anyhow::{Context, Result};

/// Returns the `media/` subdirectory next to the project file,
/// creating it if it does not exist.
pub fn media_dir(project_dir: &Path) -> Result<PathBuf> {
    let dir = project_dir.join("media");
    std::fs::create_dir_all(&dir)
        .with_context(|| format!("creating media dir {:?}", dir))?;
    Ok(dir)
}

/// Given a source URL, derives a stable cache filename.
/// Uses the SHA256 of the URL as a prefix, preserving the original extension.
#[allow(dead_code)]
pub fn cache_filename(url: &str, content_hash: &str) -> String {
    // Best-effort extension extraction from the URL path component
    let ext = url
        .split('?')
        .next()                              // strip query string
        .and_then(|u| u.split('/').last())   // last path segment
        .and_then(|seg| {
            let dot = seg.rfind('.')?;
            Some(&seg[dot..])                // ".png", ".wav", etc.
        })
        .unwrap_or("")
        .to_lowercase();

    // Use first 16 hex chars of content_hash as the filename stem
    let stem = &content_hash[..16.min(content_hash.len())];
    format!("{}{}", stem, ext)
}
