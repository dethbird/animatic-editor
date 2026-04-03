/// ffmpeg.rs — staged export pipeline for the animatic editor.
///
/// Pipeline:
///  1. Render each image clip → short libx264 segment (gaps → black)
///  2. Concat all video segments via the concat demuxer
///  3. Build a mixed audio track with filter_complex (adelay + amix)
///  4. Mux video + audio → final MP4
///
/// The caller provides an `on_progress(0‥100, stage_label)` callback which
/// is invoked at each major step so that Tauri events can be emitted.
use anyhow::{bail, Context, Result};
use serde_json::Value;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use tokio::fs;
use tokio::process::Command;
use uuid::Uuid;

// ─────────────────────────────────────────────────────────────────────────────
// Public entry point
// ─────────────────────────────────────────────────────────────────────────────

pub async fn export_project(
    project: &Value,
    output_path: &Path,
    on_progress: impl Fn(u32, String),
) -> Result<()> {
    // ── Parse project ─────────────────────────────────────────────────────
    let active_seq_id = project["activeSequenceId"]
        .as_str()
        .context("missing activeSequenceId")?;

    let sequence = project["sequences"]
        .as_array()
        .context("missing sequences")?
        .iter()
        .find(|s| s["id"].as_str() == Some(active_seq_id))
        .context("active sequence not found")?;

    let settings = &project["exportSettings"];
    let width   = settings["width"].as_u64().unwrap_or(1920) as u32;
    let height  = settings["height"].as_u64().unwrap_or(1080) as u32;
    let fps     = settings["fps"].as_u64().unwrap_or(24) as u32;
    let seq_dur = sequence["duration"].as_f64().unwrap_or(0.0);

    if seq_dur <= 0.0 {
        bail!("Sequence duration is zero — add clips to the timeline before exporting");
    }

    // ── Asset id → local path (ready assets only) ─────────────────────────
    let empty_vec = vec![];
    let assets: HashMap<String, String> = project["assets"]
        .as_array()
        .unwrap_or(&empty_vec)
        .iter()
        .filter_map(|a| {
            if a["status"].as_str() != Some("ready") {
                return None;
            }
            let id   = a["id"].as_str()?.to_string();
            let path = a["localPath"].as_str()?.to_string();
            Some((id, path))
        })
        .collect();

    // ── Temp working directory ─────────────────────────────────────────────
    let temp_dir = output_path
        .parent()
        .unwrap_or(Path::new("."))
        .join(format!("animatic_tmp_{}", Uuid::new_v4()));
    fs::create_dir_all(&temp_dir).await?;

    let result =
        pipeline(sequence, output_path, &temp_dir, &assets, width, height, fps, seq_dur, on_progress)
            .await;

    let _ = fs::remove_dir_all(&temp_dir).await; // best-effort cleanup
    result
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline
// ─────────────────────────────────────────────────────────────────────────────

async fn pipeline(
    sequence:    &Value,
    output_path: &Path,
    temp_dir:    &Path,
    assets:      &HashMap<String, String>,
    width:       u32,
    height:      u32,
    fps:         u32,
    seq_dur:     f64,
    on_progress: impl Fn(u32, String),
) -> Result<()> {
    let tracks = sequence["tracks"].as_array().context("no tracks in sequence")?;

    // ── Collect video clips (highest-priority non-muted video track) ──────
    let mut video_clips: Vec<Value> = vec![];
    for track in tracks.iter() {
        if track["kind"] != "video" || track["muted"] == true {
            continue;
        }
        if let Some(clips) = track["clips"].as_array() {
            if !clips.is_empty() {
                video_clips = clips.clone();
                break;
            }
        }
    }
    video_clips.sort_by(|a, b| {
        let ta = a["start"].as_f64().unwrap_or(0.0);
        let tb = b["start"].as_f64().unwrap_or(0.0);
        ta.partial_cmp(&tb).unwrap_or(std::cmp::Ordering::Equal)
    });

    // ── Collect audio clips (all non-muted audio tracks) ─────────────────
    let audio_clips: Vec<Value> = tracks
        .iter()
        .filter(|t| t["kind"] == "audio" && t["muted"] != true)
        .flat_map(|t| t["clips"].as_array().cloned().unwrap_or_default())
        .collect();

    // ── Step 1: Render video segments ──────────────────────────────────────
    on_progress(0, "Rendering video segments…".into());

    let total_clips = video_clips.len().max(1) as u32;
    let mut segments: Vec<PathBuf> = vec![];
    let mut cursor = 0.0_f64;

    for (i, clip) in video_clips.iter().enumerate() {
        let clip_start = clip["start"].as_f64().unwrap_or(0.0);
        let clip_dur   = clip["duration"].as_f64().unwrap_or(0.0);

        // Black gap before this clip
        if clip_start > cursor + 0.001 {
            let gap_path = temp_dir.join(format!("gap_{}.mp4", i));
            render_black(&gap_path, width, height, fps, clip_start - cursor)
                .await
                .with_context(|| format!("rendering black gap before clip {}", i))?;
            segments.push(gap_path);
        }

        if clip_dur > 0.001 {
            let local_path = clip["assetId"]
                .as_str()
                .and_then(|id| assets.get(id))
                .cloned();

            let seg_path = temp_dir.join(format!("seg_{}.mp4", i));
            match local_path {
                Some(img) => render_image(&seg_path, &img, width, height, fps, clip_dur)
                    .await
                    .with_context(|| format!("rendering image clip {}", i))?,
                None => render_black(&seg_path, width, height, fps, clip_dur)
                    .await
                    .with_context(|| format!("rendering black (missing asset) for clip {}", i))?,
            }
            segments.push(seg_path);
            cursor = clip_start + clip_dur;
        }

        let pct = 5 + (i as u32 * 40 / total_clips);
        on_progress(pct, format!("Rendering segment {} / {}…", i + 1, total_clips));
    }

    // Trailing gap
    if cursor < seq_dur - 0.001 {
        let p = temp_dir.join("gap_end.mp4");
        render_black(&p, width, height, fps, seq_dur - cursor).await?;
        segments.push(p);
    }

    // Full-black fallback when nothing is on the video track
    if segments.is_empty() {
        let p = temp_dir.join("all_black.mp4");
        render_black(&p, width, height, fps, seq_dur).await?;
        segments.push(p);
    }

    // ── Step 2: Concatenate video segments ─────────────────────────────────
    on_progress(50, "Concatenating video segments…".into());

    let concat_txt = temp_dir.join("concat.txt");
    let concat_lines: Vec<String> = segments
        .iter()
        .map(|p| format!("file '{}'", p.display()))
        .collect();
    fs::write(&concat_txt, concat_lines.join("\n")).await?;

    let video_raw = temp_dir.join("video_raw.mp4");
    {
        let concat_arg = concat_txt.to_str().unwrap();
        let video_arg  = video_raw.to_str().unwrap();
        run_ffmpeg(&[
            "-f", "concat", "-safe", "0",
            "-i", concat_arg,
            "-c", "copy",
            "-y", video_arg,
        ])
        .await
        .context("concatenating video segments")?;
    }

    // ── Step 3: Mix audio ──────────────────────────────────────────────────
    on_progress(65, "Mixing audio…".into());

    let audio_mix = temp_dir.join("audio_mix.wav");
    let have_audio = mix_audio(&audio_mix, &audio_clips, assets, seq_dur)
        .await
        .context("mixing audio")?;

    // ── Step 4: Mux final output ───────────────────────────────────────────
    on_progress(85, "Muxing final output…".into());

    let out_arg = output_path.to_str().unwrap();
    let video_arg = video_raw.to_str().unwrap();

    if have_audio {
        let audio_arg = audio_mix.to_str().unwrap();
        run_ffmpeg(&[
            "-i", video_arg,
            "-i", audio_arg,
            "-c:v", "copy",
            "-c:a", "aac", "-b:a", "192k",
            "-shortest",
            "-y", out_arg,
        ])
        .await
        .context("muxing final output")?;
    } else {
        run_ffmpeg(&[
            "-i", video_arg,
            "-c:v", "copy",
            "-an",
            "-y", out_arg,
        ])
        .await
        .context("copying video-only output")?;
    }

    on_progress(100, "Done!".into());
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Audio mixing
// ─────────────────────────────────────────────────────────────────────────────

/// Builds the audio mix using filter_complex (atrim + adelay + amix).
/// Returns `true` if at least one valid audio clip was processed.
async fn mix_audio(
    output:     &Path,
    clips:      &[Value],
    assets:     &HashMap<String, String>,
    seq_dur:    f64,
) -> Result<bool> {
    let mut input_paths: Vec<String> = vec![];
    let mut filter_chains: Vec<String> = vec![];
    let mut labels: Vec<String>        = vec![];
    let mut idx = 0usize;

    for clip in clips {
        if clip["type"].as_str() != Some("audio") {
            continue;
        }
        let asset_id = match clip["assetId"].as_str() {
            Some(id) => id,
            None     => continue,
        };
        let local = match assets.get(asset_id) {
            Some(p) => p.clone(),
            None    => continue,
        };

        let start    = clip["start"].as_f64().unwrap_or(0.0);
        let in_pt    = clip["inPoint"].as_f64().unwrap_or(0.0);
        let dur      = clip["duration"].as_f64().unwrap_or(0.0);
        let vol      = clip["volume"].as_f64().unwrap_or(1.0).clamp(0.0, 10.0);
        let delay_ms = (start * 1000.0) as u64;
        let label    = format!("aud{}", idx);

        input_paths.push(local);
        filter_chains.push(format!(
            "[{}:a]atrim=start={:.4}:duration={:.4},adelay={}|{},volume={:.4}[{}]",
            idx, in_pt, dur, delay_ms, delay_ms, vol, label,
        ));
        labels.push(format!("[{}]", label));
        idx += 1;
    }

    if idx == 0 {
        return Ok(false);
    }

    // Build filter_complex string
    let (filter, map_label) = if idx == 1 {
        (filter_chains[0].clone(), labels[0].clone())
    } else {
        let chains = filter_chains.join(";");
        let inputs = labels.join("");
        let f = format!(
            "{};{}amix=inputs={}:duration=longest:normalize=0[amixout]",
            chains, inputs, idx,
        );
        (f, "[amixout]".to_string())
    };

    let dur_str = format!("{:.4}", seq_dur);

    let mut cmd = Command::new("ffmpeg");
    for path in &input_paths {
        cmd.arg("-i").arg(path);
    }
    cmd.args([
        "-filter_complex", &filter,
        "-map", &map_label,
        "-t", &dur_str,
        "-ar", "48000",
        "-ac", "2",
        "-y",
        output.to_str().unwrap(),
    ]);

    let out = cmd.output().await.context("running ffmpeg (audio mix)")?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        bail!("ffmpeg audio mix failed:\n{}", stderr);
    }

    Ok(true)
}

// ─────────────────────────────────────────────────────────────────────────────
// Low-level helpers
// ─────────────────────────────────────────────────────────────────────────────

/// Render a still image as a short libx264 video segment.
async fn render_image(
    output: &Path,
    image:  &str,
    w: u32, h: u32, fps: u32,
    dur: f64,
) -> Result<()> {
    let fps_s  = fps.to_string();
    let vf     = format!(
        "scale={w}:{h}:force_original_aspect_ratio=decrease,\
         pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1",
    );
    let dur_s  = format!("{:.6}", dur);
    let out_s  = output.to_str().unwrap();

    run_ffmpeg(&[
        "-loop", "1",
        "-framerate", &fps_s,
        "-i", image,
        "-vf", &vf,
        "-t", &dur_s,
        "-pix_fmt", "yuv420p",
        "-c:v", "libx264",
        "-preset", "fast",
        "-tune", "stillimage",
        "-y", out_s,
    ])
    .await
}

/// Render a solid-black video segment (for gaps / missing assets).
async fn render_black(
    output: &Path,
    w: u32, h: u32, fps: u32,
    dur: f64,
) -> Result<()> {
    let lavfi = format!("color=c=black:size={}x{}:rate={}", w, h, fps);
    let dur_s = format!("{:.6}", dur);
    let out_s = output.to_str().unwrap();

    run_ffmpeg(&[
        "-f", "lavfi", "-i", &lavfi,
        "-t", &dur_s,
        "-pix_fmt", "yuv420p",
        "-c:v", "libx264",
        "-preset", "fast",
        "-y", out_s,
    ])
    .await
}

/// Run ffmpeg with the given argument list, returning an error if it fails.
async fn run_ffmpeg(args: &[&str]) -> Result<()> {
    let out = Command::new("ffmpeg")
        .args(args)
        .output()
        .await
        .context("running ffmpeg (is ffmpeg installed?)")?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        bail!("ffmpeg error:\n{}", stderr);
    }

    Ok(())
}
