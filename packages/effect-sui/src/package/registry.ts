import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Option from 'effect-v4/Option';
import * as TxHashMap from 'effect-v4/TxHashMap';

import { SuiInvariantViolation, SuiPackageDescriptor, type SuiObjectId } from '../schema';
import { SuiPackageRegistry, type SuiPackageRegistryShape } from '../services';
import { normalizeDescriptor } from './descriptor';
import type { SuiPackageRegistryState } from './types';

export const makeRegistryState = (initial: ReadonlyArray<SuiPackageDescriptor> = []): Effect.Effect<SuiPackageRegistryState> => Effect.gen(function* () {
  const descriptors = yield* TxHashMap.empty<SuiObjectId, SuiPackageDescriptor>();
  for (const descriptor of initial) yield* TxHashMap.set(descriptors, descriptor.packageId, descriptor);
  return { descriptors };
});

export const makeRegistryService = (state: SuiPackageRegistryState): SuiPackageRegistryShape => ({
  register: (descriptor) => TxHashMap.set(state.descriptors, descriptor.packageId, normalizeDescriptor(descriptor)).pipe(
    Effect.withSpan('@tmnl/effect-sui/SuiPackageRegistry.register', {
      attributes: { packageId: descriptor.packageId, moduleCount: descriptor.modules.length },
    }),
  ),
  get: (packageId) => TxHashMap.get(state.descriptors, packageId).pipe(
    Effect.flatMap((descriptor) => Option.isSome(descriptor)
      ? Effect.succeed(descriptor.value)
      : Effect.fail(new SuiInvariantViolation({
          invariant: 'SuiPackageRegistry.get',
          message: `Package ${packageId} is not registered`,
          context: packageId,
        }))),
    Effect.withSpan('@tmnl/effect-sui/SuiPackageRegistry.get', { attributes: { packageId } }),
  ),
});

export const makeRegistryLayer = (initial: ReadonlyArray<SuiPackageDescriptor> = []): Layer.Layer<SuiPackageRegistry, never, never> =>
  Layer.effect(SuiPackageRegistry)(Effect.map(makeRegistryState(initial), makeRegistryService));

export const SuiPackageRegistryLive = makeRegistryLayer();
