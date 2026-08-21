import { describe, expect, it } from 'vitest';
import { jpegWithGpsExif, jpegPlain } from '../kernel/jpeg-fixture';
import { scanForExactLocation, stripLocationMetadata, redactExactLocation } from '../kernel/privacy';

describe('privacy', () => {
  it('strips JPEG APP1 Exif GPS before memory/export', () => {
    const stripped = stripLocationMetadata(jpegWithGpsExif(), 'image/jpeg');
    const ascii = String.fromCharCode(...stripped);
    expect(ascii).not.toContain('GPSLatitude');
    expect(ascii).not.toContain('GPSLongitude');
    expect(ascii.startsWith('\u00ff\u00d8') || stripped[0] === 0xff).toBe(true);
  });

  it('does not invent GPS when the photo had none', () => {
    const stripped = stripLocationMetadata(jpegPlain(), 'image/jpeg');
    expect(scanForExactLocation(String.fromCharCode(...stripped)).clean).toBe(true);
  });

  it('redacts street addresses and coordinate pairs from notes', () => {
    const redacted = redactExactLocation('Left at 123 Maple Street near 37.7749, -122.4194');
    expect(redacted).not.toMatch(/Maple Street/);
    expect(redacted).not.toMatch(/37\.7749/);
    expect(scanForExactLocation(redacted).clean).toBe(true);
  });

  it('flags forbidden locality keys', () => {
    const scan = scanForExactLocation({ locality: 'home', gps: { lat: 1 } });
    expect(scan.clean).toBe(false);
    expect(scan.findings.some((f) => f.includes('forbidden-locality-key'))).toBe(true);
  });
});
