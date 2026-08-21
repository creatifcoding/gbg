/**
 * Serve the static capture/ folder at /capture before the Vite SPA fallback.
 * Capture does not talk to Postgres, RPC, or Intake.
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const captureRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../capture');

const MIME: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
};

const isInsideCapture = (abs: string): boolean => {
  const rel = path.relative(captureRoot, abs);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
};

export const serveCapture = (
  req: IncomingMessage,
  res: ServerResponse,
  next: () => void,
): void => {
  const raw = (req.url ?? '').split('?')[0] ?? '';
  if (raw === '/capture') {
    res.statusCode = 302;
    res.setHeader('Location', '/capture/');
    res.end();
    return;
  }
  if (!raw.startsWith('/capture/')) {
    next();
    return;
  }

  let rel: string;
  try {
    rel = decodeURIComponent(raw.slice('/capture/'.length));
  } catch {
    res.statusCode = 400;
    res.end();
    return;
  }
  if (rel.includes('\0') || rel.split(/[/\\]/).includes('..')) {
    res.statusCode = 400;
    res.end();
    return;
  }

  const file = rel === '' || rel.endsWith('/') ? path.join(rel, 'index.html') : rel;
  const abs = path.resolve(captureRoot, file);
  if (!isInsideCapture(abs)) {
    res.statusCode = 403;
    res.end();
    return;
  }
  if (!existsSync(abs) || statSync(abs).isDirectory()) {
    res.statusCode = 404;
    res.end('not found');
    return;
  }

  const ext = path.extname(abs).toLowerCase();
  res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream');
  createReadStream(abs).pipe(res);
};
