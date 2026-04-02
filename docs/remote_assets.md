Yes — **for editing and export, it should cache media locally**.

Not necessarily “download everything forever the moment you import,” but the app should treat remote URLs as **sources**, and a **local cache** as the working media store.

If you do not do that, you’ll run into a bunch of dumb problems:

- playback depends on network
- export can fail halfway through if a URL times out
- remote assets can change or disappear
- rate limits / auth / hotlink blocking can break projects
- timeline scrubbing gets flaky
- offline work becomes impossible

For an editor, that’s bad.

## The right model

Think of each asset as having:

- **source URL**
- **local cached file path**
- **status**: not downloaded / downloading / ready / failed

Something like:

```ts
type Asset = {
  id: string
  type: 'image' | 'audio'
  sourceUrl?: string
  localPath?: string
  name: string
  status: 'remote' | 'fetching' | 'ready' | 'error'
  duration?: number
  width?: number
  height?: number
  sampleRate?: number
  channels?: number
}
```

That gives you the flexibility to:

- import remote Fountain URLs
- fetch on demand
- work locally once fetched
- retry failed assets
- preserve the original source reference

## My recommendation

### For MVP:

**fetch all referenced assets into a project cache when importing Fountain JSON**

That’s the simplest reliable behavior.

Flow:

1. import Fountain JSON
2. detect all unique image/audio URLs
3. download them into a local project cache folder
4. build assets from the local files
5. timeline works from local paths only

That is the least fancy, but the most solid.

## Suggested folder structure

If the project file is:

```txt
my-animatic/
  project.animatic.json
```

Then make a cache like:

```txt
my-animatic/
  project.animatic.json
  media/
    images/
    audio/
```

Or maybe:

```txt
my-animatic/
  cache/
    <hashed files>
```

I’d lean toward:

```txt
project-folder/
  animatic.json
  media/
    sha256-or-slug.ext
```

Simple and portable.

## Why not stream directly from URLs?

Because this is an editor, not a web player.

A web player can get away with remote URLs.
An editor that exports cannot.

When you export, you want this guarantee:

> every asset needed for export exists locally and is stable

Without that, you’ll eventually get broken renders.

## Should it always fetch immediately?

For your use case, probably yes.

You could design this two ways:

### Option A: eager download

- import script
- fetch everything immediately
- mark broken ones
- only then generate timeline

Good:

- predictable
- export-safe
- simple mental model

Bad:

- big imports take longer up front

### Option B: lazy cache

- import script
- fetch only assets needed for current sequence / playback
- fetch others when needed
- block export until all are cached

Good:

- faster initial import

Bad:

- more complicated
- more edge cases
- more status management

For MVP, do **Option A**.

It’s the right tradeoff.

## Important detail: dedupe by URL

If the same URL appears multiple times in the script, do not redownload it repeatedly.

Use a URL-to-asset map.
Even better, hash the URL for the cache filename or key.

Example:

- source URL: `https://example.com/foo/bar.png`
- cached as: `media/4d8e...bar.png`

That avoids collisions and duplicate downloads.

## Even more important: preserve original extension carefully

For ffmpeg and general sanity, it helps if cached files have usable extensions.

So don’t just save everything as opaque blobs unless you have to.

Good pattern:

- inspect URL path / content-type
- generate filename with safe extension
- keep metadata in project JSON

## What if URLs require auth?

That’s where things can get ugly.

If your Fountain URLs are:

- public CDN URLs
- public S3-style links
- stable image/audio URLs

then you’re fine.

If they are:

- signed expiring URLs
- behind auth cookies
- Google Drive share links
- Dropbox preview URLs

then the app may need more logic than you want right now.

For MVP, I would define the contract clearly:

> imported media URLs should be directly downloadable public URLs

That keeps the tool sane.

## Should the project store local paths only?

No — store **both**.

You want:

- original URL, for traceability / re-fetch
- local cached path, for playback/export

Something like:

```ts
type Asset = {
  id: string
  type: 'image' | 'audio'
  sourceUrl: string
  localPath?: string
  contentHash?: string
  fetchedAt?: string
  status: 'fetching' | 'ready' | 'error'
  error?: string
}
```

That lets you:

- re-fetch missing media
- refresh stale cache manually
- relocate project folders more safely

## Should downloaded media live globally or per project?

I’d say:

### MVP: per-project cache

Best because:

- portable
- easy to zip/share
- predictable
- no weird hidden cache dependence

### Later: optional shared cache

Useful if you reuse the same assets across many projects, but that is not where I’d start.

Per-project is cleaner.

## Good import workflow

This is the workflow I’d build:

### Import Fountain JSON

1. parse panel list
2. collect unique URLs
3. create project folder if needed
4. download assets to `media/`
5. probe local media with ffprobe
6. create asset records
7. generate timeline clips
8. show report for any failed downloads

That’s solid.

## UI you’ll want

During import, show a basic status panel:

- total assets
- downloaded
- failed
- skip duplicates
- retry failed

And in the asset bin:

- ready
- missing
- failed

That will save you debugging pain.

## Should you support “relink missing asset”?

Yes, eventually.
Not required for first MVP, but definitely useful.

Because once local files are the real working files, users need a way to recover missing media if folders move.

## Should the app ever re-fetch automatically?

Only carefully.

I would not silently overwrite cached assets just because the URL still exists. That can make projects unstable.

Better:

- import once
- use cached local file
- offer **Refresh from source URL** manually

That way a project stays reproducible.

## My blunt answer

For this app, **remote URLs should be ingested into local project media**.

Use the URL as the import source, not as the live playback/export dependency.

That is the editor-grade answer.

## MVP rule I’d adopt

> On Fountain import, Animatic Editor downloads all unique referenced image/audio URLs into a local `media/` folder and uses those local files for playback and export.

That’s the cleanest version.

If you want, next I can sketch the exact project JSON shape for remote-source assets plus the Rust-side import/download pipeline.