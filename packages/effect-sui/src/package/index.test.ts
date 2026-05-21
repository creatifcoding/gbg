import * as Effect from 'effect-v4/Effect';
import { describe, expect, it } from 'vitest';

import { SuiObject, SuiPTB, SuiTx } from '../effectable';
import { decodeSuiObjectId, SuiInvariantViolation, SuiPackageDescriptor } from '../schema';
import {
  counterFixtureDescriptor,
  fromDescriptor,
  get,
  getDescriptor,
  makeRegistryLayer,
  module,
  object,
  ptb,
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

  it('rejects modules not declared by the descriptor', async () => {
    const pkg = fromDescriptor(counterFixtureDescriptor(packageId));
    const error = await Effect.runPromise(Effect.flip(module(pkg, 'missing')));

    expect(error).toBeInstanceOf(SuiInvariantViolation);
    expect(error.message).toContain('Module missing is not declared');
  });
});
