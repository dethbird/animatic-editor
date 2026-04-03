# animatic-editor

Import .fountain.ext scripts into a timeline editor for animatics. Audio and image layers over time.

## Run & Build (development)

Quick steps to run the app locally for development and to test native features like `ffprobe`/`ffmpeg` and the export pipeline.

- Install frontend dependencies (project root):

```bash
npm install
```

- Start the Vite dev server (fast UI iteration):

```bash
npm run dev
```

Visit the URL printed by Vite (usually http://localhost:5173) to verify UI changes quickly.

- Run the full Tauri desktop app (builds Rust + runs the desktop window):

```bash
npm run tauri dev
```

This launches the desktop app which exercises the Rust commands (`probe_media`, `download_asset`, `start_export`, etc.).

## Build a production desktop bundle

```bash
npm run tauri build
```

## Useful checks

- Typecheck the frontend:

```bash
npx tsc --noEmit
```

- Check the Rust side (no run):

```bash
cd src-tauri && cargo check
```

## Troubleshooting

- Linux dependencies for Tauri (Debian/Ubuntu example):

```bash
sudo apt-get install libwebkit2gtk-4.1-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev build-essential
```

- ffmpeg / ffprobe are required for media probing and export. Install on Debian/Ubuntu:

```bash
sudo apt-get install ffmpeg
```

## Quick manual export test

1. Launch the app (`npm run tauri dev`).
2. Create or open a project and add/import at least one image and one audio asset.
3. Place clips on the timeline, then click `Export MP4` in the toolbar and choose a save location.
4. The app emits progress via the top toolbar; inspect the generated MP4 with VLC or mpv.

If you want, I can run the dev server or a build for you now.