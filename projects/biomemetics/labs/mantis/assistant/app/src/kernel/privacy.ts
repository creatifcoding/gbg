import { FORBIDDEN_LOCALITY_KEYS } from '../contracts/types';

const GPS_IFD_HINT = /GPSLatitude|GPSLongitude|GPSAltitude|GPSDateStamp|GPSInfo/i;
const LATLON_PAIR = /\b(-?\d{1,3}\.\d{4,}),\s*(-?\d{1,3}\.\d{4,})\b/;
const STREET_ADDRESS =
  /\b\d{1,5}\s+[A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+)*\s+(Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr)\b/i;

export interface PrivacyScan {
  readonly clean: boolean;
  readonly findings: readonly string[];
}

export const redactExactLocation = (text: string): string => {
  let next = text.replace(LATLON_PAIR, '[redacted-coordinates]');
  next = next.replace(STREET_ADDRESS, '[redacted-address]');
  next = next.replace(/\bexif[:\s]+[^\n]+/gi, '[redacted-exif]');
  return next;
};

export const scanForExactLocation = (value: unknown, path = '$'): PrivacyScan => {
  const findings: string[] = [];
  walk(value, path, findings);
  return { clean: findings.length === 0, findings };
};

const walk = (value: unknown, path: string, findings: string[]): void => {
  if (typeof value === 'string') {
    if (GPS_IFD_HINT.test(value)) findings.push(`${path}: exif-gps-token`);
    if (LATLON_PAIR.test(value)) findings.push(`${path}: latlon`);
    if (STREET_ADDRESS.test(value)) findings.push(`${path}: street-address`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => walk(item, `${path}[${i}]`, findings));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      if ((FORBIDDEN_LOCALITY_KEYS as readonly string[]).includes(key) && child != null && child !== '') {
        findings.push(`${path}.${key}: forbidden-locality-key`);
      }
      walk(child, `${path}.${key}`, findings);
    }
  }
};

/**
 * Strip JPEG APP1 Exif (including GPS IFD) and PNG eXIf / GPS text chunks.
 * Original bytes are never stored. Events hold the digest of the stripped blob.
 */
export const stripLocationMetadata = (bytes: Uint8Array, mediaType: string): Uint8Array => {
  if (mediaType === 'image/jpeg' || isJpeg(bytes)) return stripJpegExif(bytes);
  if (mediaType === 'image/png' || isPng(bytes)) return stripPngExif(bytes);
  return bytes;
};

const isJpeg = (bytes: Uint8Array): boolean => bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
const isPng = (bytes: Uint8Array): boolean =>
  bytes.length >= 8 &&
  bytes[0] === 0x89 &&
  bytes[1] === 0x50 &&
  bytes[2] === 0x4e &&
  bytes[3] === 0x47;

const stripJpegExif = (bytes: Uint8Array): Uint8Array => {
  if (!isJpeg(bytes)) return bytes;
  const out: number[] = [0xff, 0xd8];
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) {
      out.push(...bytes.subarray(i));
      break;
    }
    const marker = bytes[i + 1];
    if (marker === undefined) break;
    if (marker === 0xda) {
      out.push(...bytes.subarray(i));
      break;
    }
    if (marker === 0xd9) {
      out.push(0xff, 0xd9);
      break;
    }
    if (marker === 0x00 || marker === 0xff) {
      out.push(0xff, marker);
      i += 2;
      continue;
    }
    if (i + 3 >= bytes.length) break;
    const length = (bytes[i + 2]! << 8) + bytes[i + 3]!;
    const end = i + 2 + length;
    const isApp1 = marker === 0xe1;
    const payload = bytes.subarray(i + 4, end);
    const looksExif = isApp1 && asciiStartsWith(payload, 'Exif');
    const looksXmp = isApp1 && asciiIncludes(payload, 'exif:') && GPS_IFD_HINT.test(utf16ish(payload));
    if (!looksExif && !looksXmp) out.push(...bytes.subarray(i, end));
    i = end;
  }
  return Uint8Array.from(out);
};

const asciiStartsWith = (bytes: Uint8Array, text: string): boolean => {
  if (bytes.length < text.length) return false;
  for (let i = 0; i < text.length; i += 1) {
    if (bytes[i] !== text.charCodeAt(i)) return false;
  }
  return true;
};

const asciiIncludes = (bytes: Uint8Array, text: string): boolean => utf16ish(bytes).includes(text);

const utf16ish = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < Math.min(bytes.length, 4096); i += 1) {
    const c = bytes[i]!;
    if (c >= 32 && c < 127) s += String.fromCharCode(c);
  }
  return s;
};

const stripPngExif = (bytes: Uint8Array): Uint8Array => {
  if (!isPng(bytes)) return bytes;
  const out: number[] = [...bytes.subarray(0, 8)];
  let i = 8;
  while (i + 8 <= bytes.length) {
    const length = readU32(bytes, i);
    const type = String.fromCharCode(bytes[i + 4]!, bytes[i + 5]!, bytes[i + 6]!, bytes[i + 7]!);
    const end = i + 12 + length;
    const drop = type === 'eXIf' || type === 'zTXt' || type === 'iTXt' || (type === 'tEXt' && chunkHasGps(bytes.subarray(i + 8, i + 8 + length)));
    if (!drop) out.push(...bytes.subarray(i, end));
    i = end;
    if (type === 'IEND') break;
  }
  return Uint8Array.from(out);
};

const chunkHasGps = (data: Uint8Array): boolean => GPS_IFD_HINT.test(utf16ish(data));

const readU32 = (bytes: Uint8Array, offset: number): number =>
  ((bytes[offset]! << 24) | (bytes[offset + 1]! << 16) | (bytes[offset + 2]! << 8) | bytes[offset + 3]!) >>> 0;
