use crate::services::project_io;
use std::path::Path;
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

// ── new_project ──────────────────────────────────────────────────────────────

/// Creates a blank project JSON structure and returns it to the frontend.
/// The frontend carries the canonical project definition; Rust mirrors only
/// enough to seed a valid empty project.
#[tauri::command]
pub fn new_project(name: String) -> serde_json::Value {
    let now = chrono::Utc::now().to_rfc3339();
    let project_id = Uuid::new_v4().to_string();
    let sequence_id = Uuid::new_v4().to_string();

    serde_json::json!({
        "version": 1,
        "id": project_id,
        "name": name,
        "createdAt": now,
        "updatedAt": now,
        "assets": [],
        "sequences": [{
            "id": sequence_id,
            "name": "Main",
            "duration": 0,
            "tracks": [
                { "id": "v1", "name": "Main Images", "kind": "video", "muted": false, "locked": false, "clips": [] },
                { "id": "v2", "name": "Inserts",     "kind": "video", "muted": false, "locked": false, "clips": [] },
                { "id": "a1", "name": "Dialogue",    "kind": "audio", "muted": false, "locked": false, "clips": [] },
                { "id": "a2", "name": "Music",       "kind": "audio", "muted": false, "locked": false, "clips": [] }
            ],
            "markers": []
        }],
        "activeSequenceId": sequence_id,
        "exportSettings": {
            "width": 1920,
            "height": 1080,
            "fps": 24,
            "videoCodec": "h264",
            "audioCodec": "aac"
        }
    })
}

// ── save_project ─────────────────────────────────────────────────────────────

#[tauri::command]
pub fn save_project(project: serde_json::Value, path: String) -> Result<(), String> {
    project_io::write_project(Path::new(&path), &project).map_err(|e| e.to_string())
}

// ── open_project ─────────────────────────────────────────────────────────────

#[tauri::command]
pub fn open_project(path: String) -> Result<serde_json::Value, String> {
    project_io::read_project(Path::new(&path)).map_err(|e| e.to_string())
}

// ── open_file_dialog ─────────────────────────────────────────────────────────

/// Opens a native file-picker dialog.
/// Uses the async callback API + oneshot channel to avoid deadlocking on Linux,
/// where GTK dialogs must run on the main thread but blocking_pick_file() can
/// deadlock when Tauri also runs sync commands on the main thread.
#[tauri::command]
pub async fn open_file_dialog(
    app: tauri::AppHandle,
    filters: Vec<DialogFilter>,
) -> Option<String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    let mut builder = app.dialog().file();
    for f in &filters {
        builder = builder.add_filter(
            &f.name,
            &f.extensions.iter().map(|s| s.as_str()).collect::<Vec<_>>(),
        );
    }
    builder.pick_file(move |path| {
        let _ = tx.send(path.map(|p| p.to_string()));
    });
    rx.await.unwrap_or(None)
}

// ── save_file_dialog ─────────────────────────────────────────────────────────

#[tauri::command]
pub async fn save_file_dialog(
    app: tauri::AppHandle,
    default_name: String,
) -> Option<String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_file_name(&default_name)
        .save_file(move |path| {
            let _ = tx.send(path.map(|p| p.to_string()));
        });
    rx.await.unwrap_or(None)
}

// ── helper types ─────────────────────────────────────────────────────────────

#[derive(serde::Deserialize)]
pub struct DialogFilter {
    pub name: String,
    pub extensions: Vec<String>,
}
