import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { serveCapture } from './serve-capture.ts';

const certDir = path.resolve(__dirname, '.certs');
const keyPath = path.join(certDir, 'key.pem');
const certPath = path.join(certDir, 'cert.pem');

const localHttps = (): { key: Buffer; cert: Buffer } => {
  if (!existsSync(keyPath) || !existsSync(certPath)) {
    mkdirSync(certDir, { recursive: true });
    execFileSync('openssl', [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-keyout',
      keyPath,
      '-out',
      certPath,
      '-days',
      '365',
      '-nodes',
      '-subj',
      '/CN=localhost',
    ]);
  }
  return {
    key: readFileSync(keyPath),
    cert: readFileSync(certPath),
  };
};

const https = localHttps();

const capturePage = (): Plugin => ({
  name: 'sdb-capture',
  configureServer(server) {
    server.middlewares.use(serveCapture);
  },
  configurePreviewServer(server) {
    server.middlewares.use(serveCapture);
  },
});

export default defineConfig({
  root: __dirname,
  appType: 'spa',
  plugins: [react(), capturePage()],
  resolve: {
    alias: {
      '@tmnl/stx': path.resolve(__dirname, '../../stx/src/index.ts'),
      '@gbg/lab-ui': path.resolve(__dirname, '../../lab-ui/src/index.ts'),
    },
  },
  server: {
    host: true,
    port: 4177,
    strictPort: true,
    https,
  },
  preview: {
    host: true,
    port: 4177,
    strictPort: true,
    https,
  },
  build: {
    outDir: path.resolve(__dirname, '../../tmp/specimendb-testbed'),
    emptyOutDir: true,
  },
});
