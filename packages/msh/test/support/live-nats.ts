/**
 * Live NATS test harness.
 *
 * Tests opt in with MSH_LIVE_NATS=1 so normal unit runs stay fast/no-daemon.
 * The harness starts a real nats-server with JetStream + WebSocket enabled.
 */

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { describe } from 'vitest';

export interface LiveNatsPorts {
  readonly client: number;
  readonly monitor: number;
  readonly websocket: number;
}

export interface LiveNatsServer {
  readonly ports: LiveNatsPorts;
  readonly servers: string;
  readonly monitorUrl: string;
  readonly configPath: string;
  readonly storeDir: string;
  readonly stop: () => Promise<void>;
}

export interface StartLiveNatsOptions {
  readonly authorization?: string;
  readonly extraConfig?: string;
  readonly startupTimeoutMs?: number;
}

export const liveNatsEnabled = (): boolean =>
  process.env.MSH_LIVE_NATS === '1' || process.env.MSH_LIVE_NATS === 'true' || Boolean(process.env.MSH_LIVE_NATS_URL);

export const liveDescribe = liveNatsEnabled() ? describe : describe.skip;

const findOpenPort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (typeof address === 'object' && address) {
        const port = address.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('failed to allocate port')));
      }
    });
  });

const waitForHealth = async (url: string, proc: ChildProcessWithoutNullStreams, timeoutMs: number): Promise<void> => {
  const started = Date.now();
  let lastError: unknown;
  while (Date.now() - started < timeoutMs) {
    if (proc.exitCode !== null) {
      throw new Error(`nats-server exited before health check succeeded (exit=${proc.exitCode})`);
    }
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`health returned ${response.status}`);
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`nats-server health check timed out: ${String(lastError)}`);
};

const stopProcess = async (proc: ChildProcessWithoutNullStreams): Promise<void> => {
  if (proc.exitCode !== null) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      if (proc.exitCode === null) proc.kill('SIGKILL');
    }, 2_000);
    proc.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    proc.kill('SIGTERM');
  });
};

export const startLiveNats = async (options: StartLiveNatsOptions = {}): Promise<LiveNatsServer> => {
  if (!liveNatsEnabled()) {
    throw new Error('Live NATS tests require MSH_LIVE_NATS=1 or MSH_LIVE_NATS_URL');
  }

  const externalUrl = process.env.MSH_LIVE_NATS_URL;
  if (externalUrl) {
    return {
      ports: { client: 0, monitor: 0, websocket: 0 },
      servers: externalUrl,
      monitorUrl: process.env.MSH_LIVE_NATS_MONITOR_URL ?? '',
      configPath: '<external>',
      storeDir: '<external>',
      stop: async () => undefined,
    };
  }

  const [client, monitor, websocket] = await Promise.all([
    findOpenPort(),
    findOpenPort(),
    findOpenPort(),
  ]);

  const root = await mkdtemp(path.join(tmpdir(), 'tmnl-msh-nats-'));
  const storeDir = path.join(root, 'jetstream');
  const configPath = path.join(root, 'nats-server.conf');
  const serverName = `msh-live-${process.pid}-${Date.now()}`;

  const config = `
server_name: ${serverName}
port: ${client}
http: 127.0.0.1:${monitor}

jetstream {
  store_dir: "${storeDir}"
}

websocket {
  host: 127.0.0.1
  port: ${websocket}
  no_tls: true
  same_origin: false
  compression: false
}

${options.authorization ?? ''}
${options.extraConfig ?? ''}
`;

  await writeFile(configPath, config);

  const bin = process.env.NATS_SERVER_BIN ?? 'nats-server';
  const proc = spawn(bin, ['-c', configPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  let stderr = '';
  proc.stderr.on('data', (chunk) => { stderr += String(chunk); });

  try {
    await waitForHealth(`http://127.0.0.1:${monitor}/healthz`, proc, options.startupTimeoutMs ?? 5_000);
  } catch (err) {
    await stopProcess(proc);
    await rm(root, { recursive: true, force: true });
    throw new Error(`${String(err)}\n${stderr}`);
  }

  return {
    ports: { client, monitor, websocket },
    servers: `ws://127.0.0.1:${websocket}`,
    monitorUrl: `http://127.0.0.1:${monitor}`,
    configPath,
    storeDir,
    stop: async () => {
      await stopProcess(proc);
      await rm(root, { recursive: true, force: true });
    },
  };
};
