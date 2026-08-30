export const jpegWithGpsExif = (): Uint8Array => {
  const payload = Array.from('Exif\0\0GPSLatitude\0GPSLongitude', (c) => c.charCodeAt(0));
  const length = payload.length + 2;
  return Uint8Array.from([
    0xff,
    0xd8,
    0xff,
    0xe1,
    (length >> 8) & 0xff,
    length & 0xff,
    ...payload,
    0xff,
    0xd9,
  ]);
};

export const jpegPlain = (): Uint8Array => Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
