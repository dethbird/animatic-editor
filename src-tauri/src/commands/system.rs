use crate::models::media::ToolInfo;
use crate::services::capability;

#[tauri::command]
pub fn check_ffmpeg() -> ToolInfo {
    capability::check_ffmpeg()
}

#[tauri::command]
pub fn check_ffprobe() -> ToolInfo {
    capability::check_ffprobe()
}

/// Read a UTF-8 text file from a path chosen by the user (e.g. via open_file_dialog).
/// No path validation is needed here because the path comes from a system dialog.
#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}
