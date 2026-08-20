# Specimen capture (static)

Field page: take or choose a JPEG on-device, bake GPS + DateTimeOriginal into the file in the browser with vendored ExifTool WASM, then download the stamped JPEG.

This page does not upload the specimen. It only writes EXIF on-device. There is no analytics, no Worker, no R2, no server, and no IP geolocation.

## Cloudflare Drop

This folder is Drop-ready. No build step at Drop time.

1. Zip **the contents of this folder** so `index.html` is at the zip root (or drag this folder onto Drop).
2. Drop it on [https://www.cloudflare.com/drop/](https://www.cloudflare.com/drop/).
3. Drop needs no account to start. It gives a live `workers.dev` URL.
4. **Claim within 60 minutes** or the drop expires.
5. Limits: static assets only, 1000 files, **25 MiB per file**. No Worker, no R2, no Pages Function.

Asset URLs in `index.html` are relative (`./tokens.css`, `./capture.js`, `./vendor/zeroperl.wasm`). Serving this folder as a static site is enough.

## Locality

`navigator.geolocation` with `enableHighAccuracy: true` is the only locality source.

- Acquiring → waiting for a fix
- Fixed → coordinates from the device
- Unknown → permission denied, unavailable, or timeout

Unknown still downloads the JPEG (DateTimeOriginal if the stamp succeeds). GPS tags are omitted. Coordinates are never invented.

## WASM (vendored, no CDN)

Runtime loads `@uswriting/exiftool` and `@6over3/zeroperl-ts` from `vendor/`. There is no jsDelivr / unpkg / CDN fetch.

| File | What |
|---|---|
| `vendor/exiftool.js` | `@uswriting/exiftool` ESM, import rewritten to `./zeroperl.js` |
| `vendor/zeroperl.js` | `@6over3/zeroperl-ts` ESM |
| `vendor/zeroperl.wasm` | Perl WASM (keep under 25 MiB) |

`capture.js` passes a custom `fetch` into `writeMetadata(file, tags, { fetch })` so `./zeroperl.wasm` resolves to `vendor/zeroperl.wasm` instead of the HTML document URL.

Stamp API: `writeMetadata(file, tags)` with the browser `File` from the input — not a pre-converted `ArrayBuffer`. On success the page downloads `result.data` as `specimen-YYYYMMDD-HHmmss.jpg` (local device clock).

### Re-vendor

From this directory:

```bash
chmod +x vendor.sh
./vendor.sh
```

That pulls pinned tarballs from the npm registry (`@uswriting/exiftool@1.0.9`, `@6over3/zeroperl-ts@1.0.10`), copies ESM + WASM into `vendor/`, rewrites the ExifTool import to `./zeroperl.js`, and fails if any file is ≥ 25 MiB.

Override pins with `EXIFTOOL_VERSION` / `ZEROPERL_VERSION` if you must.

## What this page does not do

- Does not invent locality or taxon
- Does not identify the specimen
- Does not talk to PGlite / RPC / `@tmnl/specimendb` intake
