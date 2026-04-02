use crate::models::media::MediaInfo;
use anyhow::{bail, Context, Result};
use tokio::process::Command;

/// Runs `ffprobe` on the given path and returns structured media info.
pub async fn probe(path: &str) -> Result<MediaInfo> {
    let output = Command::new("ffprobe")
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            path,
        ])
        .output()
        .await
        .context("running ffprobe (is it installed?)")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        bail!("ffprobe failed: {}", stderr);
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)
        .context("parsing ffprobe output")?;

    parse_ffprobe_output(&json)
}

fn parse_ffprobe_output(json: &serde_json::Value) -> Result<MediaInfo> {
    let streams = json["streams"].as_array().cloned().unwrap_or_default();

    // Determine kind by looking for a video stream with a known image codec
    // OR an audio-only stream.
    let video_stream = streams.iter().find(|s| s["codec_type"] == "video");
    let audio_stream = streams.iter().find(|s| s["codec_type"] == "audio");

    // If there's a video stream, check if it's really a still image codec.
    // Common still-image ffprobe codec names: png, mjpeg, webp, gif, bmp, tiff
    let still_image_codecs = ["png", "mjpeg", "webp", "gif", "bmp", "tiff"];
    let is_image = video_stream
        .and_then(|v| v["codec_name"].as_str())
        .map(|c| still_image_codecs.contains(&c))
        .unwrap_or(false);

    if is_image {
        let stream = video_stream.unwrap();
        Ok(MediaInfo {
            kind: "image".into(),
            duration: stream["duration"]
                .as_str()
                .and_then(|d| d.parse().ok())
                .or_else(|| json["format"]["duration"].as_str().and_then(|d| d.parse().ok())),
            width: stream["width"].as_u64().map(|v| v as u32),
            height: stream["height"].as_u64().map(|v| v as u32),
            sample_rate: None,
            channels: None,
        })
    } else if let Some(stream) = audio_stream {
        let duration = stream["duration"]
            .as_str()
            .and_then(|d| d.parse().ok())
            .or_else(|| json["format"]["duration"].as_str().and_then(|d| d.parse().ok()));
        Ok(MediaInfo {
            kind: "audio".into(),
            duration,
            width: None,
            height: None,
            sample_rate: stream["sample_rate"]
                .as_str()
                .and_then(|s| s.parse().ok()),
            channels: stream["channels"].as_u64().map(|v| v as u32),
        })
    } else {
        bail!("unrecognised media: no video or audio stream found")
    }
}
