use crate::models::media::ToolInfo;
use std::process::Command;

fn try_version(program: &str, args: &[&str]) -> ToolInfo {
    match Command::new(program).args(args).output() {
        Ok(out) if out.status.success() => {
            let raw = String::from_utf8_lossy(&out.stdout);
            let version = raw.lines().next().unwrap_or("").to_string();
            ToolInfo { available: true, version }
        }
        _ => ToolInfo {
            available: false,
            version: String::new(),
        },
    }
}

pub fn check_ffmpeg() -> ToolInfo {
    try_version("ffmpeg", &["-version"])
}

pub fn check_ffprobe() -> ToolInfo {
    try_version("ffprobe", &["-version"])
}
