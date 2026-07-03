#!/usr/bin/env bun
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, '..');
const gluePath = resolve(packageRoot, 'dist/mathkernel.js');

const original = readFileSync(gluePath, 'utf8');
const patched = original
  // Emscripten currently emits a bare URL specifier here. Vite/esbuild's
  // import.meta.url plugin treats that as a package name during dep-scan.
  // Relative URL keeps the generated glue browser/bundler-compatible.
  .replaceAll("new URL('mathkernel.wasm', import.meta.url)", "new URL('./mathkernel.wasm', import.meta.url)")
  .replaceAll('new URL("mathkernel.wasm", import.meta.url)', 'new URL("./mathkernel.wasm", import.meta.url)');

if (patched !== original) {
  writeFileSync(gluePath, patched);
  console.log('[mathkernel] patched dist/mathkernel.js wasm URL to be relative');
} else {
  console.log('[mathkernel] wasm URL already relative');
}
