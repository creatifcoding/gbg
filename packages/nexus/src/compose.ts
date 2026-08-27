import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';
import {
  CONFIG_YAML,
  GRAPH_YAML,
  PACKAGE_ROOT,
  ROUTER_JSON,
} from './paths';
import type {
  ComposeResult,
  GraphComposeInput,
  RouterExecutionConfig,
  RouterRuntimeConfig,
} from './types';

function wgcBin(): string {
  const bin = join(PACKAGE_ROOT, 'node_modules', '.bin', 'wgc');
  if (!existsSync(bin)) {
    throw new Error(
      `wgc is not installed at ${bin}. From packages/nexus run: npm install`,
    );
  }
  return bin;
}

export function loadGraphInput(): GraphComposeInput {
  const parsed = load(readFileSync(GRAPH_YAML, 'utf8')) as GraphComposeInput;
  if (parsed.version !== 1 || !Array.isArray(parsed.subgraphs)) {
    throw new Error(
      `graph.yaml must be Cosmo compose input (version: 1, subgraphs[])`,
    );
  }
  return parsed;
}

export function loadRouterRuntimeConfig(): RouterRuntimeConfig {
  const parsed = load(
    readFileSync(CONFIG_YAML, 'utf8'),
  ) as RouterRuntimeConfig;
  if (!parsed.execution_config?.file?.path) {
    throw new Error('config.yaml must set execution_config.file.path');
  }
  if (!parsed.events?.providers?.nats?.length) {
    throw new Error('config.yaml must set events.providers.nats');
  }
  return parsed;
}

export type ComposeOptions = {
  /** Destination for execution config. Defaults to packages/nexus/router.json. */
  out?: string;
};

/**
 * Official local compose path:
 * `wgc router compose -i graph.yaml -o router.json`
 *
 * Does not talk to the Cosmo control plane.
 */
export function composeRouterExecutionConfig(
  options: ComposeOptions = {},
): ComposeResult {
  const out = options.out ?? ROUTER_JSON;
  const result = spawnSync(
    wgcBin(),
    ['router', 'compose', '-i', GRAPH_YAML, '-o', out],
    {
      cwd: PACKAGE_ROOT,
      encoding: 'utf8',
    },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `wgc router compose failed (status ${String(result.status)}):\n${result.stderr}\n${result.stdout}`,
    );
  }

  if (!existsSync(out)) {
    throw new Error(`wgc router compose did not write ${out}`);
  }

  const config = JSON.parse(
    readFileSync(out, 'utf8'),
  ) as RouterExecutionConfig;

  return {
    path: out,
    stdout: `${result.stdout}${result.stderr}`,
    config,
  };
}
