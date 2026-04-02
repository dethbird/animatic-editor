use std::path::Path;
use anyhow::{Context, Result};

/// Write a JSON value to `path`, creating parent directories if needed.
pub fn write_project(path: &Path, json: &serde_json::Value) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("creating directory {:?}", parent))?;
    }
    let content = serde_json::to_string_pretty(json)
        .context("serializing project")?;
    std::fs::write(path, content)
        .with_context(|| format!("writing project to {:?}", path))?;
    Ok(())
}

/// Read and parse a project JSON file from `path`.
pub fn read_project(path: &Path) -> Result<serde_json::Value> {
    let content = std::fs::read_to_string(path)
        .with_context(|| format!("reading project from {:?}", path))?;
    let value: serde_json::Value = serde_json::from_str(&content)
        .context("parsing project JSON")?;
    Ok(value)
}
