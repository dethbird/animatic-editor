use crate::services::ffmpeg;
use std::path::Path;
use tauri::Emitter;

/// Runs the full staged export pipeline, emitting `export-progress` events
/// to the frontend as each step completes.
///
/// Returns `Ok(())` on success or an error string on failure.
#[tauri::command]
pub async fn start_export(
    app: tauri::AppHandle,
    project: serde_json::Value,
    output_path: String,
) -> Result<(), String> {
    let app_clone = app.clone();

    let on_progress = move |progress: u32, stage: String| {
        let _ = app_clone.emit(
            "export-progress",
            serde_json::json!({ "progress": progress, "stage": stage }),
        );
    };

    ffmpeg::export_project(&project, Path::new(&output_path), on_progress)
        .await
        .map_err(|e| e.to_string())
}
