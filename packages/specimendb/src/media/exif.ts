/**
 * EXIF extraction — JPEG APP1 and HEIC/ISO-BMFF Exif items.
 *
 * Output is an exiftool-style flat tag bag. GPS is parsed when present;
 * absence means no locality, never a fabricated place.
 *
 * @module @tmnl/specimendb/media/exif
 */

export type ExifTags = Record<string, unknown>;

export type MediaKind = 'jpeg' | 'heic' | 'other';

const ASCII_EXIF = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00] as const; // Exif\0\0

const IFD_TYPE_SIZE: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  7: 1,
  9: 4,
  10: 8,
};

const TAG_NAMES: Record<number, string> = {
  0x010f: 'Make',
  0x0110: 'Model',
  0x0112: 'Orientation',
  0x0132: 'DateTime',
  0x829a: 'ExposureTime',
  0x829d: 'FNumber',
  0x8769: 'ExifIFDPointer',
  0x8825: 'GPSInfoIFDPointer',
  0x9003: 'DateTimeOriginal',
  0x9004: 'DateTimeDigitized',
  0xa002: 'ExifImageWidth',
  0xa003: 'ExifImageHeight',
  0x0001: 'GPSLatitudeRef',
  0x0002: 'GPSLatitude',
  0x0003: 'GPSLongitudeRef',
  0x0004: 'GPSLongitude',
  0x0005: 'GPSAltitudeRef',
  0x0006: 'GPSAltitude',
};

const readU16 = (view: DataView, offset: number, le: boolean): number =>
  view.getUint16(offset, le);

const readU32 = (view: DataView, offset: number, le: boolean): number =>
  view.getUint32(offset, le);

const findBytes = (bytes: Uint8Array, needle: readonly number[], from = 0): number => {
  outer: for (let i = from; i <= bytes.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (bytes[i + j] !== needle[j]) continue outer;
    }
    return i;
  }
  return -1;
};

const decodeAscii = (bytes: Uint8Array): string => {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return new TextDecoder('latin1').decode(bytes.subarray(0, end));
};

const readValue = (
  view: DataView,
  tiffStart: number,
  le: boolean,
  type: number,
  count: number,
  valueOffset: number,
): unknown => {
  const unit = IFD_TYPE_SIZE[type] ?? 1;
  const size = unit * count;
  const dataOffset = size <= 4 ? valueOffset : tiffStart + readU32(view, valueOffset, le);
  if (dataOffset < 0 || dataOffset + size > view.byteLength) return undefined;

  if (type === 2) {
    return decodeAscii(new Uint8Array(view.buffer, view.byteOffset + dataOffset, count));
  }
  if (type === 3 && count === 1) return readU16(view, dataOffset, le);
  if (type === 4 && count === 1) return readU32(view, dataOffset, le);
  if (type === 5) {
    const rationals: Array<{ num: number; den: number }> = [];
    for (let i = 0; i < count; i++) {
      const off = dataOffset + i * 8;
      rationals.push({
        num: readU32(view, off, le),
        den: readU32(view, off + 4, le),
      });
    }
    return rationals;
  }
  if (type === 1 && count === 1) return view.getUint8(dataOffset);
  if (type === 7) {
    return Array.from(new Uint8Array(view.buffer, view.byteOffset + dataOffset, Math.min(count, 64)));
  }
  return undefined;
};

const walkIfd = (
  view: DataView,
  tiffStart: number,
  le: boolean,
  ifdOffset: number,
  tags: ExifTags,
  gpsNames: boolean,
): { gpsOffset?: number; exifOffset?: number } => {
  const start = tiffStart + ifdOffset;
  if (start + 2 > view.byteLength) return {};
  const count = readU16(view, start, le);
  let gpsOffset: number | undefined;
  let exifOffset: number | undefined;

  for (let i = 0; i < count; i++) {
    const entry = start + 2 + i * 12;
    if (entry + 12 > view.byteLength) break;
    const tag = readU16(view, entry, le);
    const type = readU16(view, entry + 2, le);
    const num = readU32(view, entry + 4, le);
    const value = readValue(view, tiffStart, le, type, num, entry + 8);

    if (!gpsNames && tag === 0x8825 && typeof value === 'number') {
      gpsOffset = value;
      continue;
    }
    if (!gpsNames && tag === 0x8769 && typeof value === 'number') {
      exifOffset = value;
      continue;
    }

    const name = TAG_NAMES[tag] ?? `Tag_0x${tag.toString(16).padStart(4, '0')}`;
    if (value !== undefined) tags[name] = value;
  }

  return { gpsOffset, exifOffset };
};

const parseTiff = (bytes: Uint8Array, tiffStart: number): ExifTags => {
  if (tiffStart + 8 > bytes.length) return {};
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const b0 = view.getUint8(tiffStart);
  const b1 = view.getUint8(tiffStart + 1);
  const le = b0 === 0x49 && b1 === 0x49;
  const be = b0 === 0x4d && b1 === 0x4d;
  if (!le && !be) return {};
  if (readU16(view, tiffStart + 2, le) !== 42) return {};
  const ifd0 = readU32(view, tiffStart + 4, le);
  const tags: ExifTags = {};
  const { gpsOffset, exifOffset } = walkIfd(view, tiffStart, le, ifd0, tags, false);
  if (exifOffset !== undefined) walkIfd(view, tiffStart, le, exifOffset, tags, false);
  if (gpsOffset !== undefined) walkIfd(view, tiffStart, le, gpsOffset, tags, true);
  return tags;
};

const parseJpegExif = (bytes: Uint8Array): ExifTags => {
  let i = 2;
  while (i + 4 < bytes.length) {
    if (bytes[i] !== 0xff) break;
    const marker = bytes[i + 1]!;
    if (marker === 0xda || marker === 0xd9) break;
    const size = (bytes[i + 2]! << 8) | bytes[i + 3]!;
    if (marker === 0xe1 && size >= 8) {
      const payload = bytes.subarray(i + 4, i + 2 + size);
      if (
        payload.length >= 6 &&
        payload[0] === ASCII_EXIF[0] &&
        payload[1] === ASCII_EXIF[1] &&
        payload[2] === ASCII_EXIF[2] &&
        payload[3] === ASCII_EXIF[3]
      ) {
        return parseTiff(bytes, i + 4 + 6);
      }
    }
    i += 2 + size;
  }
  return {};
};

const parseHeicExif = (bytes: Uint8Array): ExifTags => {
  const idx = findBytes(bytes, ASCII_EXIF);
  if (idx < 0) return {};
  return parseTiff(bytes, idx + 6);
};

export const detectMediaKind = (bytes: Uint8Array, filename: string, mediaType?: string): MediaKind => {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'jpeg';
  }
  if (bytes.length >= 12) {
    const brand = new TextDecoder('latin1').decode(bytes.subarray(4, 8));
    if (brand === 'ftyp') {
      const major = new TextDecoder('latin1').decode(bytes.subarray(8, 12)).toLowerCase();
      const compat = new TextDecoder('latin1').decode(bytes.subarray(16, Math.min(bytes.length, 32))).toLowerCase();
      const blob = major + compat;
      if (
        blob.includes('heic') ||
        blob.includes('heif') ||
        blob.includes('mif1') ||
        blob.includes('msf1') ||
        blob.includes('heix')
      ) {
        return 'heic';
      }
    }
  }
  const lower = filename.toLowerCase();
  if (lower.endsWith('.heic') || lower.endsWith('.heif') || mediaType === 'image/heic' || mediaType === 'image/heif') {
    return 'heic';
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg') || mediaType === 'image/jpeg') {
    return 'jpeg';
  }
  return 'other';
};

export const extractExifTags = (bytes: Uint8Array, kind: MediaKind): ExifTags => {
  if (kind === 'jpeg') return parseJpegExif(bytes);
  if (kind === 'heic') return parseHeicExif(bytes);
  const idx = findBytes(bytes, ASCII_EXIF);
  if (idx >= 0) return parseTiff(bytes, idx + 6);
  return {};
};

const rationalToNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (Array.isArray(value) && value.length > 0) {
    const parts = value.map((part) => {
      if (typeof part === 'number') return part;
      if (part && typeof part === 'object' && 'num' in part && 'den' in part) {
        const den = Number((part as { den: number }).den);
        if (den === 0) return undefined;
        return Number((part as { num: number }).num) / den;
      }
      return undefined;
    });
    if (parts.every((p) => p === undefined)) return undefined;
    const [deg = 0, min = 0, sec = 0] = parts.map((p) => p ?? 0);
    return deg + min / 60 + sec / 3600;
  }
  return undefined;
};

const applyHemisphere = (value: number, ref: unknown, negative: string): number => {
  if (typeof ref === 'string' && ref.toUpperCase().startsWith(negative)) return -Math.abs(value);
  return value;
};

export type GpsFix = {
  readonly latitude: number;
  readonly longitude: number;
  readonly altitudeMeters?: number;
};

/**
 * Pull GPS from EXIF tags. Returns undefined when coordinates are absent
 * or unparseable. Does not guess.
 */
export const gpsFromExif = (tags: ExifTags): GpsFix | undefined => {
  const lat = rationalToNumber(tags['GPSLatitude']);
  const lon = rationalToNumber(tags['GPSLongitude']);
  if (lat === undefined || lon === undefined) return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined;
  const latitude = applyHemisphere(lat, tags['GPSLatitudeRef'], 'S');
  const longitude = applyHemisphere(lon, tags['GPSLongitudeRef'], 'W');
  const altitude = rationalToNumber(tags['GPSAltitude']);
  return {
    latitude,
    longitude,
    ...(altitude !== undefined
      ? {
          altitudeMeters:
            typeof tags['GPSAltitudeRef'] === 'number' && tags['GPSAltitudeRef'] === 1
              ? -Math.abs(altitude)
              : altitude,
        }
      : {}),
  };
};

export const toExiftoolSidecar = (sourceFile: string, tags: ExifTags): Record<string, unknown> => ({
  SourceFile: sourceFile,
  ...tags,
});
