---
name: catalog-capture
description: Static specimen camera page for Cloudflare Drop. On-device ExifTool WASM, download only. Invoke when changing capture/, Drop deploy, or in-browser EXIF writes.
model_invoked: true
triggers:
  - "capture"
  - "Cloudflare Drop"
  - "getUserMedia"
  - "writeMetadata"
  - "zeroperl"
---

# Catalog capture

A still is tagged on the device, then downloaded. Drop cannot receive uploads. Intake files the JPEG later.

## Canonical sources

- Page: `capture/index.html`, `capture.js`, `capture.css`, `tags.js`
- WASM: `capture/vendor/` (`@uswriting/exiftool` 1.0.9, ExifTool 13.42, `zeroperl.wasm`)
- Vendor script: `scripts/vendor-capture.mjs`
- Docs: `capture/README.md`

## Drop

Static only. Zip `capture/`, drag onto https://www.cloudflare.com/drop/, claim within 60 minutes. No Worker, no R2, no API, no CDN at capture time.

## Rules

- Rear camera via `getUserMedia`. HTTPS comes from Drop.
- Canvas encodes JPEG once. `writeMetadata` writes EXIF onto that JPEG. Do not re-encode after.
- Locality chain: `navigator.geolocation` (`enableHighAccuracy`, `maximumAge: 0`) at shoot, not at arm. WASM writes those numbers. Intake reads `GPSLatitude` / `GPSLongitude` / `GPSAltitude` / `GPSDateTime`.
- Denied geolocation omits GPS tags. Locality is unknown. Do not fake coordinates. Do not use IP geo, Cloudflare country headers, or pixels.
- No analytics, no third-party scripts, no service worker.
- Vanta Black tokens for paint. Load CSS and WASM from this folder only.

## Anti-patterns

```javascript
// BANNED
fetch('https://cdn.example/zeroperl.wasm')
navigator.geolocation.getCurrentPosition(() => {}, () => { coords = { latitude: 0, longitude: 0 } })
fetch('https://ipapi.co/json')
const country = request.headers.get('cf-ipcountry')
```
