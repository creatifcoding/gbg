import { writeMetadata } from "./vendor/exiftool.js";

const WASM_URL = new URL("./vendor/zeroperl.wasm", import.meta.url);

const GEO_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 20000,
  maximumAge: 0,
};

/** @typedef {{ latitude: number, longitude: number, altitude: number | null }} Fix */

/** @type {Fix | null} */
let geoFix = null;
/** @type {'acquiring' | 'fixed' | 'unknown'} */
let locality = "acquiring";
/** @type {File | null} */
let chosenFile = null;
/** @type {string | null} */
let previewUrl = null;
let stamping = false;

const els = {
  localityState: document.getElementById("locality-state"),
  localityDetail: document.getElementById("locality-detail"),
  fileInput: document.getElementById("file-input"),
  fileName: document.getElementById("file-name"),
  preview: document.getElementById("preview"),
  stamp: document.getElementById("stamp"),
  workState: document.getElementById("work-state"),
  workDetail: document.getElementById("work-detail"),
};

/**
 * Point zeroperl at the vendored wasm. Default fetch("./zeroperl.wasm")
 * would resolve against the HTML page, not vendor/.
 * @type {typeof fetch}
 */
const vendorFetch = (input, init) => {
  const href =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input instanceof Request
          ? input.url
          : String(input);
  if (href === "./zeroperl.wasm" || href.endsWith("zeroperl.wasm")) {
    return fetch(WASM_URL, init);
  }
  return fetch(input, init);
};

const pad = (n) => String(n).padStart(2, "0");

/** EXIF DateTimeOriginal — local device time. */
const formatExifDateTime = (date) =>
  `${date.getFullYear()}:${pad(date.getMonth() + 1)}:${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

/** GPSDateStamp is UTC YYYY:MM:DD. */
const formatGpsDateStamp = (date) =>
  `${date.getUTCFullYear()}:${pad(date.getUTCMonth() + 1)}:${pad(date.getUTCDate())}`;

/** GPSTimeStamp is UTC HH:MM:SS. */
const formatGpsTimeStamp = (date) =>
  `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;

const formatCoord = (value) => value.toFixed(6);

const setLocality = (next, detail) => {
  locality = next;
  els.localityState.textContent =
    next === "acquiring" ? "acquiring" : next === "fixed" ? "fixed" : "unknown";
  els.localityState.className = `status-line status-${next}`;
  els.localityDetail.textContent = detail;
};

const setWork = (kind, line, detail) => {
  els.workState.textContent = line;
  els.workState.className = `status-line status-${kind}`;
  els.workDetail.textContent = detail;
};

const clearPreview = () => {
  if (previewUrl) {
    URL.revokeObjectURL(previewUrl);
    previewUrl = null;
  }
  els.preview.removeAttribute("src");
  els.preview.classList.remove("is-on");
};

const syncStampEnabled = () => {
  els.stamp.disabled = !chosenFile || stamping;
};

const onGeoSuccess = (position) => {
  const { latitude, longitude, altitude } = position.coords;
  geoFix = {
    latitude,
    longitude,
    altitude: typeof altitude === "number" && Number.isFinite(altitude) ? altitude : null,
  };
  const alt =
    geoFix.altitude === null ? "altitude unknown" : `alt ${geoFix.altitude.toFixed(1)} m`;
  setLocality(
    "fixed",
    `${formatCoord(latitude)}, ${formatCoord(longitude)} · ${alt} · navigator.geolocation`,
  );
};

const onGeoError = (error) => {
  geoFix = null;
  const reason =
    error?.code === 1
      ? "permission denied"
      : error?.code === 3
        ? "timeout"
        : error?.code === 2
          ? "position unavailable"
          : "geolocation unavailable";
  setLocality("unknown", `${reason} · GPS will not be invented`);
};

const requestGeo = () => {
  if (!("geolocation" in navigator)) {
    onGeoError({ code: 2 });
    return;
  }
  setLocality("acquiring", "enableHighAccuracy · waiting for a fix");
  navigator.geolocation.getCurrentPosition(onGeoSuccess, onGeoError, GEO_OPTIONS);
  navigator.geolocation.watchPosition(onGeoSuccess, onGeoError, GEO_OPTIONS);
};

const onFile = () => {
  const file = els.fileInput.files?.[0] ?? null;
  chosenFile = file;
  clearPreview();
  if (!file) {
    els.fileName.textContent = "No file chosen";
    syncStampEnabled();
    return;
  }
  els.fileName.textContent = `${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KiB`;
  if (file.type.startsWith("image/")) {
    previewUrl = URL.createObjectURL(file);
    els.preview.src = previewUrl;
    els.preview.classList.add("is-on");
  }
  setWork("acquiring", "ready", "Stamp writes EXIF on this device, then downloads the JPEG.");
  syncStampEnabled();
};

const stampedName = (file) => {
  const base = file.name.replace(/\.[^/.]+$/, "");
  const safe = base.length > 0 ? base : "specimen";
  return `${safe}-stamped.jpg`;
};

/**
 * Build ExifTool tags. GPS fields are omitted when locality is unknown.
 * @param {Date} now
 */
const buildTags = (now) => {
  /** @type {Record<string, string | number>} */
  const tags = {
    DateTimeOriginal: formatExifDateTime(now),
  };
  if (!geoFix) return tags;
  const lat = geoFix.latitude;
  const lon = geoFix.longitude;
  tags.GPSLatitude = Math.abs(lat);
  tags.GPSLatitudeRef = lat >= 0 ? "N" : "S";
  tags.GPSLongitude = Math.abs(lon);
  tags.GPSLongitudeRef = lon >= 0 ? "E" : "W";
  if (geoFix.altitude !== null) {
    tags.GPSAltitude = Math.abs(geoFix.altitude);
    tags.GPSAltitudeRef = geoFix.altitude >= 0 ? 0 : 1;
  }
  tags.GPSDateStamp = formatGpsDateStamp(now);
  tags.GPSTimeStamp = formatGpsTimeStamp(now);
  return tags;
};

const downloadJpeg = (data, name) => {
  const blob = new Blob([data], { type: "image/jpeg" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const stamp = async () => {
  if (!chosenFile || stamping) return;
  stamping = true;
  syncStampEnabled();
  setWork("acquiring", "stamping", "ExifTool WASM is writing metadata in the browser.");
  try {
    const tags = buildTags(new Date());
    const result = await writeMetadata(chosenFile, tags, { fetch: vendorFetch });
    if (!result.success || !result.data) {
      setWork("error", "stamp failed", result.error ?? "writeMetadata returned no data");
      return;
    }
    downloadJpeg(result.data, stampedName(chosenFile));
    const gpsNote =
      geoFix === null
        ? "locality unknown — DateTimeOriginal only, no GPS tags"
        : "GPS + DateTimeOriginal written";
    setWork("success", "downloaded", gpsNote);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setWork("error", "stamp failed", message);
  } finally {
    stamping = false;
    syncStampEnabled();
  }
};

els.fileInput.addEventListener("change", onFile);
els.stamp.addEventListener("click", () => {
  void stamp();
});

syncStampEnabled();
requestGeo();
