import * as Effect from 'effect-v4/Effect';
import { describe, expect, inject, it } from 'vitest';

import {
  counterFixtureDescriptor,
  get,
  makeRegistryLayer,
  module as getModule,
  ptb,
  register,
} from '../../src/package';
import { decodeSuiObjectId } from '../../src/schema';
import type { EffectSuiLocalnetContext } from './utils/globalSetup';
import { prepublishMoveFixtures } from './utils/prepublish';

const localnet = inject('effectSuiLocalnet') as EffectSuiLocalnetContext;
const describeLocalnet = localnet.enabled ? describe : describe.skip;

describeLocalnet('@tmnl/effect-sui package registry localnet proof', () => {
  it('registers the counter fixture descriptor after a localnet Move build', async () => {
    if (!localnet.localnetContainerId) {
      expect(localnet.mode).toBe('external');
      return;
    }

    const compiled = await prepublishMoveFixtures({ suiToolsContainerId: localnet.localnetContainerId });
    expect(compiled.counter.modules.length).toBeGreaterThan(0);

    const descriptor = counterFixtureDescriptor(decodeSuiObjectId('0x0'));
    const pkg = await Effect.runPromise(
      Effect.gen(function* () {
        yield* register(descriptor);
        return yield* get(descriptor.packageId);
      }).pipe(Effect.provide(makeRegistryLayer())),
    );
    const counter = await Effect.runPromise(getModule(pkg, 'counter'));
    const increment = ptb(counter, {
      label: 'increment',
      commands: [{ _tag: 'MoveCall', name: 'increment' }],
      build: (self) => Effect.succeed({ inputs: self.inputs, commands: self.commands, requirements: {} }),
    });

    expect(pkg.packageId).toBe(descriptor.packageId);
    expect(counter.label).toContain('counter');
    expect(increment.label).toContain('counter::increment');
  });
});

describe.skipIf(localnet.enabled)('@tmnl/effect-sui package registry localnet proof', () => {
  it('is skipped by EFFECT_SUI_E2E_MODE=skip', () => {
    expect(localnet.mode).toBe('skip');
  });
});
