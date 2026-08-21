import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { captureRoot, serveCapture } from '../testbed/serve-capture.ts';

const here = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(here, '..');

const listen = (server: ReturnType<typeof createServer>): Promise<number> =>
  new Promise((resolveListen, reject) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        reject(new Error('expected AddressInfo'));
        return;
      }
      resolveListen((address as AddressInfo).port);
    });
  });

describe('phone capture /capture', () => {
  it('vendors ExifTool WASM under 25 MiB with no CDN at shot time', () => {
    const wasm = join(captureRoot, 'vendor/zeroperl.wasm');
    expect(existsSync(wasm)).toBe(true);
    const bytes = statSync(wasm).size;
    expect(bytes).toBeGreaterThan(1_000_000);
    expect(bytes).toBeLessThan(25 * 1024 * 1024);

    const html = readFileSync(join(captureRoot, 'index.html'), 'utf8');
    expect(html).toContain('./tokens.css');
    expect(html).toContain('./capture.css');
    expect(html).toContain('./capture.js');
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toContain('jsdelivr');
    expect(html).not.toContain('unpkg');
    expect(html).toContain('does not upload');

    const script = readFileSync(join(captureRoot, 'capture.js'), 'utf8');
    expect(script).toContain('./vendor/exiftool.js');
    expect(script).toContain('./vendor/zeroperl.wasm');
    expect(script).toContain("specimen-${stamp}.jpg");
    expect(script).toContain('GPS will not be invented');
    expect(script).not.toContain('jsdelivr');
    expect(script).not.toContain('unpkg');
    expect(script).not.toContain('Intake');
    expect(script).not.toContain('PGlite');
    expect(script).not.toContain('sql-pg');
    expect(script).not.toContain('postgres://');
    expect(script).not.toMatch(/fetch\(\s*['"]https?:\/\//);

    const exiftool = readFileSync(join(captureRoot, 'vendor/exiftool.js'), 'utf8');
    expect(exiftool).toContain('from"./zeroperl.js"');
    expect(exiftool).not.toContain('@6over3/zeroperl-ts');
  });

  it('serves the static capture page at /capture without the SPA', async () => {
    const server = createServer((req, res) => {
      serveCapture(req, res, () => {
        res.statusCode = 599;
        res.end('spa-fallback');
      });
    });
    const port = await listen(server);
    try {
      const redirect = await fetch(`http://127.0.0.1:${port}/capture`, { redirect: 'manual' });
      expect(redirect.status).toBe(302);
      expect(redirect.headers.get('location')).toBe('/capture/');

      const page = await fetch(`http://127.0.0.1:${port}/capture/`);
      expect(page.status).toBe(200);
      expect(page.headers.get('content-type')).toContain('text/html');
      const html = await page.text();
      expect(html).toContain('Specimen capture');
      expect(html).toContain('does not upload');
      expect(html).not.toContain('Initiate_Intake_Protocol');
      expect(html).not.toContain('id="root"');

      const js = await fetch(`http://127.0.0.1:${port}/capture/capture.js`);
      expect(js.status).toBe(200);
      const body = await js.text();
      expect(body).toContain('specimen-${stamp}.jpg');

      const spa = await fetch(`http://127.0.0.1:${port}/intake`);
      expect(spa.status).toBe(599);
      expect(await spa.text()).toBe('spa-fallback');
    } finally {
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close((error) => (error !== undefined && error !== null ? rejectClose(error) : resolveClose()));
      });
    }
  });

  it('testbed Vite serves /capture over HTTPS', () => {
    const vite = readFileSync(join(packageRoot, 'testbed/vite.config.ts'), 'utf8');
    expect(vite).toContain('serveCapture');
    expect(vite).toContain('https');
    expect(vite).toContain('localHttps');
    expect(vite).toContain('sdb-capture');
    expect(vite).not.toContain('jsdelivr');
  });
});
