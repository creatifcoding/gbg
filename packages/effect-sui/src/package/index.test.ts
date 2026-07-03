import * as Effect from 'effect/Effect';
import { describe, expect, it } from 'vitest';

import { SuiObject, SuiPTB, SuiTx } from '../effectable';
import { decodeSuiAddress, decodeSuiObjectId, decodeSuiTransactionDigest, OfflineAuthPolicy, SuiInvariantViolation, SuiPackageDescriptor } from '../schema';
import { SuiTxRunner, type SuiTxLifecycleResult } from '../services';
import {
  counterFixtureDescriptor,
  fromDescriptor,
  get,
  getDescriptor,
  makeRegistryLayer,
  module,
  object,
  ptb,
  publishMovePackage,
  publishRequestFromCompiled,
  makePublishPtb,
  register,
  tx,
} from './index';

const packageId = decodeSuiObjectId('0x42');

describe('SuiPackage registry and factories', () => {
  it('constructs Schema-backed package descriptors for the counter fixture', () => {
    const descriptor = counterFixtureDescriptor(packageId);

    expect(descriptor).toBeInstanceOf(SuiPackageDescriptor);
    expect(descriptor._tag).toBe('SuiPackageDescriptor');
    expect(descriptor.packageId).toBe(packageId);
    expect(descriptor.modules).toEqual(['counter']);
    expect(descriptor.moduleDescriptors?.[0]?.functions).toEqual(['increment', 'value']);
  });

  it('registers and loads package descriptors through the registry service', async () => {
    const descriptor = counterFixtureDescriptor(packageId);

    const loaded = await Effect.runPromise(
      Effect.gen(function* () {
        yield* register(descriptor);
        return yield* getDescriptor(packageId);
      }).pipe(Effect.provide(makeRegistryLayer())),
    );

    expect(loaded.packageId).toBe(packageId);
    expect(loaded.modules).toEqual(['counter']);
  });

  it('returns SuiPackage facades that load from the registry', async () => {
    const descriptor = counterFixtureDescriptor(packageId);

    const pkg = await Effect.runPromise(
      Effect.gen(function* () {
        yield* register(descriptor);
        return yield* get(packageId);
      }).pipe(Effect.provide(makeRegistryLayer())),
    );

    expect(pkg.kind).toBe('SuiPackage');
    expect(pkg.packageId).toBe(packageId);

    const loaded = await Effect.runPromise(pkg.pipe(Effect.provide(makeRegistryLayer([descriptor]))));
    expect(loaded.packageId).toBe(packageId);
  });

  it('creates typed SuiModule factories for objects, PTBs, and transactions', async () => {
    const pkg = fromDescriptor(counterFixtureDescriptor(packageId));
    const mod = await Effect.runPromise(module(pkg, 'counter'));

    const counterObject = object(mod, {
      id: decodeSuiObjectId('0x7'),
      type: `${packageId}::counter::Counter` as never,
      refresh: () => Effect.succeed({ id: decodeSuiObjectId('0x7'), content: { value: '0' } }),
    });
    const call = ptb(mod, {
      label: 'increment',
      commands: [{ _tag: 'MoveCall', name: 'increment' }],
      build: (self) => Effect.succeed({ inputs: self.inputs, commands: self.commands, requirements: {} }),
    });
    const lifecycle = tx(mod, {
      label: 'increment.tx',
      ptb: call,
      execute: () => Effect.succeed('ok'),
    });

    expect(counterObject).toBeInstanceOf(SuiObject);
    expect(counterObject.label).toContain('counter::object');
    expect(call).toBeInstanceOf(SuiPTB);
    expect(call.label).toContain('counter::increment');
    expect(lifecycle).toBeInstanceOf(SuiTx);
    expect(lifecycle.label).toContain('counter::increment.tx');
  });

  it('builds package publish requests and PTBs from compiled Move bytecode', () => {
    const sender = decodeSuiAddress('0x8');
    const request = publishRequestFromCompiled({
      name: 'counter',
      sender,
      modules: ['AQID'],
      dependencies: ['0x1', '0x2'],
      moduleNames: ['counter'],
    });
    const ptb = makePublishPtb(request);

    expect([...request.modules[0]]).toEqual([1, 2, 3]);
    expect(request.dependencies.map(String)).toEqual([
      '0x0000000000000000000000000000000000000000000000000000000000000001',
      '0x0000000000000000000000000000000000000000000000000000000000000002',
    ]);
    expect(ptb.commands.map((command) => command._tag)).toEqual(['Publish', 'TransferObjects']);
  });

  it('extracts publish results and registers descriptors through the package registry', async () => {
    const sender = decodeSuiAddress('0x8');
    const publishedPackageId = decodeSuiObjectId('0x42');
    const upgradeCapId = decodeSuiObjectId('0x99');
    const digest = decodeSuiTransactionDigest('11111111111111111111111111111112');
    const request = publishRequestFromCompiled({
      name: 'counter',
      sender,
      modules: ['AQID'],
      dependencies: ['0x1', '0x2'],
      moduleNames: ['counter'],
    });
    const lifecycle = {
      execution: { digest, raw: {} },
      finality: {
        digest,
        transaction: {},
        effects: {
          changedObjects: [
            { objectId: publishedPackageId, outputState: 'PackageWrite', idOperation: 'Created' },
            { objectId: upgradeCapId, outputState: 'ObjectWrite', idOperation: 'Created' },
          ],
        },
        objectTypes: { [upgradeCapId]: '0x2::package::UpgradeCap' },
      },
    } as unknown as SuiTxLifecycleResult;

    const output = await Effect.runPromise(
      Effect.gen(function* () {
        const published = yield* publishMovePackage({
          request,
          authPolicy: new OfflineAuthPolicy({ sender }),
        });
        const descriptor = yield* getDescriptor(published.packageId);
        return { published, descriptor };
      }).pipe(
        Effect.provideService(SuiTxRunner, { run: () => Effect.succeed(lifecycle) }),
        Effect.provide(makeRegistryLayer()),
      ),
    );

    expect(output.published.packageId).toBe(publishedPackageId);
    expect(output.published.upgradeCapId).toBe(upgradeCapId);
    expect(output.descriptor.modules).toEqual(['counter']);
  });

  it('rejects modules not declared by the descriptor', async () => {
    const pkg = fromDescriptor(counterFixtureDescriptor(packageId));
    const error = await Effect.runPromise(Effect.flip(module(pkg, 'missing')));

    expect(error).toBeInstanceOf(SuiInvariantViolation);
    expect(error.message).toContain('Module missing is not declared');
  });
});
