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
