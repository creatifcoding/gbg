/**
 * JPEG / HEIC test bytes. No GPS unless explicitly requested.
 */

const u16be = (n: number): Uint8Array => new Uint8Array([(n >> 8) & 0xff, n & 0xff]);

const concat = (...parts: Array<Uint8Array | number[]>): Uint8Array => {
  const arrays = parts.map((p) => (p instanceof Uint8Array ? p : new Uint8Array(p)));
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let o = 0;
  for (const a of arrays) {
    out.set(a, o);
    o += a.length;
  }
  return out;
};

const writeU16 = (buf: Uint8Array, offset: number, value: number, le: boolean) => {
  if (le) {
    buf[offset] = value & 0xff;
    buf[offset + 1] = (value >> 8) & 0xff;
  } else {
    buf[offset] = (value >> 8) & 0xff;
    buf[offset + 1] = value & 0xff;
  }
};

const writeU32 = (buf: Uint8Array, offset: number, value: number, le: boolean) => {
  if (le) {
    buf[offset] = value & 0xff;
    buf[offset + 1] = (value >> 8) & 0xff;
    buf[offset + 2] = (value >> 16) & 0xff;
    buf[offset + 3] = (value >> 24) & 0xff;
  } else {
    buf[offset] = (value >> 24) & 0xff;
    buf[offset + 1] = (value >> 16) & 0xff;
    buf[offset + 2] = (value >> 8) & 0xff;
    buf[offset + 3] = value & 0xff;
  }
};

/** Minimal SOI + JFIF APP0 + EOI. No EXIF, no GPS. */
export const jpegWithoutGps = (): Uint8Array =>
  new Uint8Array([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);

/**
 * Minimal ISO-BMFF `ftyp` with `heic` brand. No `Exif` box, no GPS.
 * Enough for intake to classify as HEIC and file as raw.
 */
export const heicWithoutGps = (): Uint8Array => {
  const box = new Uint8Array(24);
  writeU32(box, 0, 24, false);
  box.set([0x66, 0x74, 0x79, 0x70], 4); // ftyp
  box.set([0x68, 0x65, 0x69, 0x63], 8); // heic
  writeU32(box, 12, 0, false);
  box.set([0x6d, 0x69, 0x66, 0x31], 16); // mif1
  box.set([0x68, 0x65, 0x69, 0x63], 20); // heic
  return box;
};

const ifdEntry = (
  buf: Uint8Array,
  offset: number,
  tag: number,
  type: number,
  count: number,
  valueOrOffset: number,
  le: boolean,
) => {
  writeU16(buf, offset, tag, le);
  writeU16(buf, offset + 2, type, le);
  writeU32(buf, offset + 4, count, le);
  writeU32(buf, offset + 8, valueOrOffset, le);
};

const asciiInline = (text: string): number => {
  const bytes = [text.charCodeAt(0) & 0xff, 0, 0, 0];
  return bytes[0]! | (bytes[1]! << 8) | (bytes[2]! << 16) | (bytes[3]! << 24);
};

const writeRational = (buf: Uint8Array, offset: number, num: number, den: number, le: boolean) => {
  writeU32(buf, offset, num, le);
  writeU32(buf, offset + 4, den, le);
};

/**
 * JPEG with EXIF Make/Model/DateTimeOriginal and GPS 37°N, 122°W.
 */
export const jpegWithGps = (): Uint8Array => {
  const le = true;
  const tiff = new Uint8Array(200);
  tiff[0] = 0x49;
  tiff[1] = 0x49;
  writeU16(tiff, 2, 42, le);
  writeU32(tiff, 4, 8, le);

  // IFD0 at 8: Make, Model, GPSInfo
  writeU16(tiff, 8, 3, le);
  ifdEntry(tiff, 10, 0x010f, 2, 6, 104, le); // Make -> "Apple\0"
  ifdEntry(tiff, 22, 0x0110, 2, 7, 110, le); // Model -> "iPhone\0"
  ifdEntry(tiff, 34, 0x8825, 4, 1, 50, le); // GPS IFD at 50
  writeU32(tiff, 46, 0, le);

  // GPS IFD at 50
  writeU16(tiff, 50, 4, le);
  ifdEntry(tiff, 52, 0x0001, 2, 2, asciiInline('N'), le);
  ifdEntry(tiff, 64, 0x0002, 5, 3, 118, le);
  ifdEntry(tiff, 76, 0x0003, 2, 2, asciiInline('W'), le);
  ifdEntry(tiff, 88, 0x0004, 5, 3, 142, le);
  writeU32(tiff, 100, 0, le);

  tiff.set(new TextEncoder().encode('Apple\0'), 104);
  tiff.set(new TextEncoder().encode('iPhone\0'), 110);

  writeRational(tiff, 118, 37, 1, le);
  writeRational(tiff, 126, 0, 1, le);
  writeRational(tiff, 134, 0, 1, le);
  writeRational(tiff, 142, 122, 1, le);
  writeRational(tiff, 150, 0, 1, le);
  writeRational(tiff, 158, 0, 1, le);

  const used = 166;
  const tiffUsed = tiff.subarray(0, used);
  const exifHeader = new TextEncoder().encode('Exif\0\0');
  const app1Len = 2 + exifHeader.length + tiffUsed.length;
  return concat(
    [0xff, 0xd8],
    [0xff, 0xe1],
    u16be(app1Len),
    exifHeader,
    tiffUsed,
    [0xff, 0xd9],
  );
};
