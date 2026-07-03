import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import { describe, expect, it } from 'vitest';

import { SuiObject, SuiPTB, SuiTx } from '../effectable';
import {
  SuiClientService,
  SuiObjectResolver,
  SuiPtbAnalyzer,
  SuiPtbCompiler,
  SuiTxRunner,
} from '../services';
import {
  fakeClient,
  fakeObjectId,
  fakeTransactionDigest,
  makeFakeClient,
  makeFakeFixtureScope,
  makeRuntimeFixtureScope,
  type SharedRuntimeFixtureClient,
} from './index';

describe('fake Sui runtime helpers', () => {
  it('provides fake object resolution for SuiObject capabilities', async () => {
    const object = new SuiObject({
      id: fakeObjectId,
      refresh: (self) => SuiObjectResolver.use((resolver) => resolver.refresh(self)),
    });

    const client = makeFakeClient({
      objectResolver: {
        refresh: (self) => Effect.succeed({ id: self.id, content: { ok: true } }),
      },
    });

    const snapshot = await client.run(object).finally(() => client.dispose());

    expect(snapshot).toEqual({ id: fakeObjectId, content: { ok: true } });
  });

  it('provides analyzer/compiler contracts for SuiPTB capabilities', async () => {
    const ptb = new SuiPTB({
      label: 'fake.ptb',
      commands: [{ _tag: 'MoveCall', name: 'increment' }],
      requirements: { requiresPayment: true },
      build: (self) =>
        SuiPtbAnalyzer.use((analyzer) =>
          Effect.flatMap(analyzer.analyze(self), (analysis) =>
            SuiPtbCompiler.use((compiler) => compiler.compile({ ptb: self, analysis })),
          ),
        ),
    });

    const client = makeFakeClient();
    const artifact = await client.run(ptb).finally(() => client.dispose());

    expect(artifact.commands).toEqual([{ _tag: 'MoveCall', name: 'increment' }]);
    expect(artifact.requirements).toEqual({ requiresPayment: true });
    expect(artifact.transaction).toEqual({ _tag: 'FakeMystenTransaction', label: 'fake.ptb' });
  });

  it('provides a full SuiTx lifecycle runner for SuiTx capabilities', async () => {
    const ptb = new SuiPTB({
      label: 'fake.lifecycle.ptb',
      commands: [{ _tag: 'MoveCall', name: 'increment' }],
      requirements: { requiresPayment: true, requiresAuth: true },
      build: (self) =>
        SuiPtbAnalyzer.use((analyzer) =>
          Effect.flatMap(analyzer.analyze(self), (analysis) =>
            SuiPtbCompiler.use((compiler) => compiler.compile({ ptb: self, analysis })),
          ),
        ),
    });
    const tx = new SuiTx({
      label: 'fake.tx',
      ptb,
      execute: (self) => SuiTxRunner.use((runner) => runner.run(self)),
    });

    const client = makeFakeClient();
    const result = await client.flow.run(tx).finally(() => client.dispose());

    expect(result.execution).toEqual({ digest: fakeTransactionDigest, raw: { _tag: 'FakeExecution' } });
    expect(result.finality).toEqual({
      digest: fakeTransactionDigest,
      transaction: { _tag: 'FakeExecution' },
      events: [],
    });
  });

  it('exposes a fake Query client over the same runtime', async () => {
    const client = makeFakeClient();

    const resolved = await client.query
      .resolve({ id: fakeObjectId })
      .finally(() => client.dispose());

    expect(resolved).toEqual({ id: fakeObjectId });
  });

  it('creates shared Flow/Query runtime fixtures for localnet-style client sources', async () => {
    const source = {
      core: {
        getObject: async ({ objectId: requestedId }: { objectId: string }) => ({
          object: {
            objectId: requestedId,
            version: '9',
            digest: fakeTransactionDigest,
            type: '0x2::coin::Coin<0x2::sui::SUI>',
            json: { balance: '1' },
          },
        }),
      },
    } as unknown as SharedRuntimeFixtureClient;
    const fixture = makeRuntimeFixtureScope(source);

    expect(fixture.flow.runtime.memoMap).toBe(fixture.memoMap);
    expect(fixture.query.runtime.memoMap).toBe(fixture.memoMap);
    await fixture.dispose();
  });

  it('creates explicit fixture-scoped sibling runtimes with shared memo maps', async () => {
    const scope = makeFakeFixtureScope({ defaults: { client: { transport: 'fixture-default' } } });
    const first = scope.makeClient();
    const second = scope.makeClient({ client: { transport: 'fixture-override' } });

    expect(first.runtime.memoMap).toBe(scope.memoMap);
    expect(second.runtime.memoMap).toBe(scope.memoMap);
    expect(first.runtime.memoMap).toBe(second.runtime.memoMap);
    expect(await first.run(SuiClientService.useSync((service) => service.client))).toEqual({ transport: 'fixture-default' });
    expect(await second.run(SuiClientService.useSync((service) => service.client))).toEqual({ transport: 'fixture-override' });

    await scope.dispose();
    const afterDispose = await first.runExit(SuiClientService.useSync((service) => service.client));
    expect(Exit.isFailure(afterDispose)).toBe(true);
  });

  it('keeps sibling fixture scopes isolated unless a memo map is passed explicitly', async () => {
    const firstScope = makeFakeFixtureScope();
    const secondScope = makeFakeFixtureScope();
    const first = firstScope.makeClient();
    const second = secondScope.makeClient();

    expect(first.runtime.memoMap).toBe(firstScope.memoMap);
    expect(second.runtime.memoMap).toBe(secondScope.memoMap);
    expect(first.runtime.memoMap).not.toBe(second.runtime.memoMap);

    await firstScope.dispose();
    await secondScope.dispose();
  });

  it('allows overriding fake client payloads', async () => {
    const client = makeFakeClient({ client: { transport: 'override' } });
    const result = await client
      .run(SuiClientService.useSync((service) => service.client))
      .finally(() => client.dispose());

    expect(result).toEqual({ transport: 'override' });
    expect(fakeClient.transport).toBe('fake');
  });
});
