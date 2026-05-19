import { describe, expect, inject, it } from 'vitest';

import type { EffectSuiLocalnetContext } from './utils/globalSetup';

const localnet = inject('effectSuiLocalnet') as EffectSuiLocalnetContext;
const describeLocalnet = localnet.enabled ? describe : describe.skip;

describeLocalnet('@tmnl/effect-sui localnet harness', () => {
  it('provides isolated localnet endpoints', () => {
    expect(localnet.fullnodeUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(localnet.faucetUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(localnet.graphqlUrl).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/graphql$/);
    expect(localnet.suiToolsTag).toMatch(/^[a-f0-9]{40}(-arm64)?$/);
  });

  it('queries JSON-RPC and GraphQL reference gas price', async () => {
    const [jsonRpcPrice, graphqlPrice] = await Promise.all([
      eventually(() => getJsonRpcReferenceGasPrice(localnet.fullnodeUrl)),
      eventually(() => getGraphqlReferenceGasPrice(localnet.graphqlUrl)),
    ]);

    expect(jsonRpcPrice).toMatch(/^\d+$/);
    expect(graphqlPrice).toBe(jsonRpcPrice);
  });

  it('queries gRPC through Mysten SDK when installed', async () => {
    const grpcPrice = await getOptionalGrpcReferenceGasPrice(localnet.fullnodeUrl);
    if (grpcPrice == null) {
      console.warn('[effect-sui:e2e] @mysten/sui/grpc is not installed; skipping SDK gRPC smoke');
      return;
    }

    const jsonRpcPrice = await eventually(() => getJsonRpcReferenceGasPrice(localnet.fullnodeUrl));
    expect(grpcPrice).toBe(jsonRpcPrice);
  });
});

describe.skipIf(localnet.enabled)('@tmnl/effect-sui localnet harness', () => {
  it('is skipped by EFFECT_SUI_E2E_MODE=skip', () => {
    expect(localnet.mode).toBe('skip');
  });
});

async function getJsonRpcReferenceGasPrice(fullnodeUrl: string): Promise<string> {
  const response = await fetch(fullnodeUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'suix_getReferenceGasPrice',
      params: [],
    }),
  });

  if (!response.ok) {
    throw new Error(`JSON-RPC reference gas request failed: ${response.status}`);
  }

  const body = (await response.json()) as { result?: string | number; error?: unknown };
  if (body.error || body.result == null) {
    throw new Error(`JSON-RPC reference gas request errored: ${JSON.stringify(body.error)}`);
  }

  return String(body.result);
}

async function getGraphqlReferenceGasPrice(graphqlUrl: string): Promise<string> {
  const response = await fetch(graphqlUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      query: `query EffectSuiReferenceGasPrice { epoch { referenceGasPrice } }`,
    }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL reference gas request failed: ${response.status}`);
  }

  const body = (await response.json()) as {
    data?: { epoch?: { referenceGasPrice?: string | number } };
    errors?: unknown;
  };

  if (body.errors || body.data?.epoch?.referenceGasPrice == null) {
    throw new Error(`GraphQL reference gas request errored: ${JSON.stringify(body.errors)}`);
  }

  return String(body.data.epoch.referenceGasPrice);
}

async function getOptionalGrpcReferenceGasPrice(fullnodeUrl: string): Promise<string | undefined> {
  try {
    const { SuiGrpcClient } = await import('@mysten/sui/grpc');
    const client = new SuiGrpcClient({ network: 'localnet', baseUrl: fullnodeUrl });
    const response = await eventually(() => client.core.getReferenceGasPrice());
    return response.referenceGasPrice;
  } catch (error) {
    if (isModuleResolutionError(error)) return undefined;
    throw error;
  }
}

function isModuleResolutionError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message.includes('Cannot find package') ||
      error.message.includes('Cannot find module') ||
      error.message.includes('ERR_MODULE_NOT_FOUND'))
  );
}

async function eventually<T>(effect: () => Promise<T>, timeoutMs = 120_000): Promise<T> {
  const started = Date.now();
  let lastError: unknown;

  while (Date.now() - started < timeoutMs) {
    try {
      return await effect();
    } catch (error) {
      lastError = error;
      await delay(1_000);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function delay(ms: number) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
