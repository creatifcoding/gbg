# Specimen capture (Cloudflare Drop)

Static page. Rear camera. ExifTool WASM writes GPS and DateTimeOriginal into the JPEG on the device. Nothing is uploaded. Drop cannot receive uploads anyway.

## What Drop is

[Cloudflare Drop](https://www.cloudflare.com/drop/) takes a static folder or zip and serves it on a `workers.dev` URL. HTTPS comes with that. The URL lasts 60 minutes unless you claim it. Static only: HTML, CSS, JS, images, fonts, WASM. No Worker, no R2, no API.

After load, this page talks to the camera. Location is taken from `navigator.geolocation` at shoot, not from IP, Cloudflare country headers, or the pixels. Then it fetches its own `vendor/zeroperl.wasm`. It does not call a CDN. It does not phone home.

## Zip and drop

From this package:

```bash
cd packages/catalog
bun run capture:vendor   # refresh WASM from node_modules if needed
bun run capture:zip      # writes catalog-capture.zip
```

Or zip by hand:

```bash
cd packages/catalog/capture
zip -r ../catalog-capture.zip .
```

Then open https://www.cloudflare.com/drop/, drag the zip or the `capture/` folder, and claim the URL within 60 minutes if you want to keep it.

Local check (secure context on localhost):

```bash
cd packages/catalog/capture
python3 -m http.server 8765
# http://127.0.0.1:8765
```

## Behavior

Source of truth for `Specimen.locality` on capture:

1. `navigator.geolocation` with `enableHighAccuracy` at shot time. Arm camera does not take a fix.
2. Canvas encodes JPEG once. `@uswriting/exiftool` (`writeMetadata`) writes those numbers into `GPSLatitude`, `GPSLongitude`, `GPSLatitudeRef`, `GPSLongitudeRef`, `DateTimeOriginal`, and `GPSDateTime`. The JPEG is not re-encoded after that write.
3. Intake later reads those EXIF GPS tags. Generic `{ latitude, longitude }` dumps are not locality.

Download the tagged file. The page never uploads it. If geolocation is denied or missing, GPS tags are omitted and locality is unknown. No fake coordinates. No IP geo. No `cf-ipcountry`. No pixel guess.

No analytics, no third-party scripts, no service worker.

Intake still owns filing. Drop this JPEG into the catalog intake screen. Locality is those GPS tags, or unknown.

## Vendor

`capture/vendor/` holds ExifTool 13.42 via zeroperl (`@uswriting/exiftool`, Apache-2.0) and `zeroperl.wasm`. Do not replace those fetches with a CDN URL.
