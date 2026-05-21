import * as Effect from 'effect-v4/Effect';
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

  it('allows overriding fake client payloads', async () => {
    const client = makeFakeClient({ client: { transport: 'override' } });
    const result = await client
      .run(SuiClientService.useSync((service) => service.client))
      .finally(() => client.dispose());

    expect(result).toEqual({ transport: 'override' });
    expect(fakeClient.transport).toBe('fake');
  });
});
