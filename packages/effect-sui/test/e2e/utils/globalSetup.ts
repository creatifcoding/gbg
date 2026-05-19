import { execFile } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

import type { TestProject } from 'vitest/node';

const execFileAsync = promisify(execFile);
const thisFile = fileURLToPath(import.meta.url);
const packageRoot = resolve(dirname(thisFile), '../../..');
const dataDir = resolve(packageRoot, 'test/e2e/data');
const moveDir = resolve(packageRoot, 'move');

const DEFAULT_SUI_TOOLS_TAG =
  process.env.SUI_TOOLS_TAG ??
  (process.arch === 'arm64'
    ? '08500756541c6fd66c81a59d1af1d819e997a189-arm64'
    : '08500756541c6fd66c81a59d1af1d819e997a189');

const NETWORK_NAME = 'effect-sui-e2e';
const PG_CONTAINER = 'effect-sui-e2e-postgres';
const LOCALNET_CONTAINER = 'effect-sui-e2e-localnet';

export interface EffectSuiLocalnetContext {
  readonly enabled: boolean;
  readonly mode: 'skip' | 'external' | 'docker-cli' | 'testcontainers';
  readonly fullnodeUrl: string;
  readonly faucetUrl: string;
  readonly graphqlUrl: string;
  readonly suiToolsTag: string;
  readonly localnetContainerId?: string;
  readonly postgresContainerId?: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    effectSuiLocalnet: EffectSuiLocalnetContext;
  }
}

export default async function setup(project: TestProject) {
  const mode = process.env.EFFECT_SUI_E2E_MODE ?? 'docker';

  if (mode === 'skip') {
    provide(project, {
      enabled: false,
      mode: 'skip',
      fullnodeUrl: process.env.SUI_FULLNODE_URL ?? 'http://127.0.0.1:9000',
      faucetUrl: process.env.SUI_FAUCET_URL ?? 'http://127.0.0.1:9123',
      graphqlUrl: process.env.SUI_GRAPHQL_URL ?? 'http://127.0.0.1:9125/graphql',
      suiToolsTag: DEFAULT_SUI_TOOLS_TAG,
    });
    return;
  }

  if (mode === 'external') {
    provide(project, {
      enabled: true,
      mode: 'external',
      fullnodeUrl: requiredEnv('SUI_FULLNODE_URL'),
      faucetUrl: requiredEnv('SUI_FAUCET_URL'),
      graphqlUrl: requiredEnv('SUI_GRAPHQL_URL'),
      suiToolsTag: DEFAULT_SUI_TOOLS_TAG,
    });
    return;
  }

  try {
    return await startWithTestcontainers(project);
  } catch (error) {
    if (!isModuleResolutionError(error)) {
      throw error;
    }
    console.warn('[effect-sui:e2e] testcontainers unavailable; falling back to Docker CLI');
    return await startWithDockerCli(project);
  }
}

function provide(project: TestProject, context: EffectSuiLocalnetContext) {
  project.provide('effectSuiLocalnet', context);
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required when EFFECT_SUI_E2E_MODE=external`);
  }
  return value;
}

function isModuleResolutionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('Cannot find package') ||
      error.message.includes('Cannot find module') ||
      error.message.includes('ERR_MODULE_NOT_FOUND'))
  );
}

async function startWithTestcontainers(project: TestProject) {
  const tc = await import('testcontainers');
  const network = await new tc.Network().start();
  let pg: any;
  let localnet: any;

  try {
    pg = await new tc.GenericContainer('postgres:16')
      .withEnvironment({
        POSTGRES_USER: 'postgres',
        POSTGRES_PASSWORD: 'postgrespw',
        POSTGRES_DB: 'sui_indexer_v2',
      })
      .withCommand(['-c', 'max_connections=500'])
      .withExposedPorts(5432)
      .withNetwork(network)
      .start();

    localnet = await new tc.GenericContainer(`mysten/sui-tools:${DEFAULT_SUI_TOOLS_TAG}`)
      .withCommand([
        'sui',
        'start',
        '--with-faucet=0.0.0.0:9123',
        '--force-regenesis',
        '--with-graphql=0.0.0.0:9125',
        `--with-indexer=postgres://postgres:postgrespw@${pg.getIpAddress(network.getName())}:5432/sui_indexer_v2`,
      ])
      .withCopyDirectoriesToContainer([
        { source: dataDir, target: '/test-data' },
        { source: moveDir, target: '/workspace/move' },
      ])
      .withNetwork(network)
      .withExposedPorts(9000, 9123, 9124, 9125)
      .start();

    const context: EffectSuiLocalnetContext = {
      enabled: true,
      mode: 'testcontainers',
      fullnodeUrl: `http://127.0.0.1:${localnet.getMappedPort(9000)}`,
      faucetUrl: `http://127.0.0.1:${localnet.getMappedPort(9123)}`,
      graphqlUrl: `http://127.0.0.1:${localnet.getMappedPort(9125)}/graphql`,
      suiToolsTag: DEFAULT_SUI_TOOLS_TAG,
      localnetContainerId: localnet.getId(),
      postgresContainerId: pg.getId(),
    };

    await configureContainerClient(tc, localnet.getId());
    await verifyCounterFixtureBuild(tc, localnet.getId());
    provide(project, context);

    return async () => {
      await Promise.allSettled([localnet?.stop(), pg?.stop(), network?.stop()]);
    };
  } catch (error) {
    await Promise.allSettled([localnet?.stop(), pg?.stop(), network?.stop()]);
    throw error;
  }
}

async function configureContainerClient(tc: typeof import('testcontainers'), containerId: string) {
  const runtimeClient = await tc.getContainerRuntimeClient();
  const container = runtimeClient.container.getById(containerId);
  await runtimeClient.container.exec(container, ['mkdir', '-p', '/root/.sui/sui_config']);
  await runtimeClient.container.exec(container, [
    'bash',
    '-lc',
    "echo '[]' > /root/.sui/sui_config/sui.keystore && cp /test-data/localnet-client.yaml /root/.sui/sui_config/client.yaml",
  ]);
}

async function verifyCounterFixtureBuild(tc: typeof import('testcontainers'), containerId: string) {
  const runtimeClient = await tc.getContainerRuntimeClient();
  const container = runtimeClient.container.getById(containerId);
  const result = await runtimeClient.container.exec(container, [
    'sui',
    'move',
    'build',
    '--build-env',
    'testnet',
    '--path',
    '/workspace/move/fixtures/counter',
  ]);

  if (result.exitCode !== 0) {
    throw new Error(`Counter fixture build failed:\n${result.output}`);
  }
}

async function startWithDockerCli(project: TestProject) {
  const fullnodePort = process.env.EFFECT_SUI_FULLNODE_PORT ?? '9000';
  const faucetPort = process.env.EFFECT_SUI_FAUCET_PORT ?? '9123';
  const grpcPort = process.env.EFFECT_SUI_GRPC_PORT ?? '9124';
  const graphqlPort = process.env.EFFECT_SUI_GRAPHQL_PORT ?? '9125';

  await docker(['network', 'inspect', NETWORK_NAME]).catch(() => docker(['network', 'create', NETWORK_NAME]));
  await docker(['rm', '-f', LOCALNET_CONTAINER, PG_CONTAINER]).catch(() => undefined);

  await docker([
    'run',
    '-d',
    '--name',
    PG_CONTAINER,
    '--network',
    NETWORK_NAME,
    '-e',
    'POSTGRES_USER=postgres',
    '-e',
    'POSTGRES_PASSWORD=postgrespw',
    '-e',
    'POSTGRES_DB=sui_indexer_v2',
    'postgres:16',
    '-c',
    'max_connections=500',
  ]);

  await waitForPostgres();

  const localnetContainerId = (
    await docker([
      'run',
      '-d',
      '--name',
      LOCALNET_CONTAINER,
      '--network',
      NETWORK_NAME,
      '-p',
      `${fullnodePort}:9000`,
      '-p',
      `${faucetPort}:9123`,
      '-p',
      `${grpcPort}:9124`,
      '-p',
      `${graphqlPort}:9125`,
      '-v',
      `${dataDir}:/test-data:ro`,
      '-v',
      `${moveDir}:/workspace/move:ro`,
      `mysten/sui-tools:${DEFAULT_SUI_TOOLS_TAG}`,
      'sui',
      'start',
      '--with-faucet=0.0.0.0:9123',
      '--force-regenesis',
      '--with-graphql=0.0.0.0:9125',
      `--with-indexer=postgres://postgres:postgrespw@${PG_CONTAINER}:5432/sui_indexer_v2`,
    ])
  ).stdout.trim();

  await docker(['exec', LOCALNET_CONTAINER, 'mkdir', '-p', '/root/.sui/sui_config']);
  await docker([
    'exec',
    LOCALNET_CONTAINER,
    'bash',
    '-lc',
    "echo '[]' > /root/.sui/sui_config/sui.keystore && cp /test-data/localnet-client.yaml /root/.sui/sui_config/client.yaml",
  ]);
  await docker([
    'exec',
    LOCALNET_CONTAINER,
    'sui',
    'move',
    'build',
    '--build-env',
    'testnet',
    '--path',
    '/workspace/move/fixtures/counter',
  ]);

  const context: EffectSuiLocalnetContext = {
    enabled: true,
    mode: 'docker-cli',
    fullnodeUrl: `http://127.0.0.1:${fullnodePort}`,
    faucetUrl: `http://127.0.0.1:${faucetPort}`,
    graphqlUrl: `http://127.0.0.1:${graphqlPort}/graphql`,
    suiToolsTag: DEFAULT_SUI_TOOLS_TAG,
    localnetContainerId,
    postgresContainerId: PG_CONTAINER,
  };

  provide(project, context);

  return async () => {
    await docker(['rm', '-f', LOCALNET_CONTAINER, PG_CONTAINER]).catch(() => undefined);
    await docker(['network', 'rm', NETWORK_NAME]).catch(() => undefined);
  };
}

async function waitForPostgres() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const result = await docker([
      'exec',
      PG_CONTAINER,
      'pg_isready',
      '-U',
      'postgres',
      '-d',
      'sui_indexer_v2',
    ]).catch(() => null);

    if (result) return;
    await delay(1_000);
  }

  throw new Error('Postgres container did not become ready');
}

async function docker(args: readonly string[]) {
  return await execFileAsync('docker', [...args], {
    maxBuffer: 1024 * 1024 * 16,
  });
}

function delay(ms: number) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
