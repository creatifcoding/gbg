/** SuiPackage registry and typed factory helpers. */

import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
import * as Option from 'effect-v4/Option';
import * as TxHashMap from 'effect-v4/TxHashMap';

import { SuiModule, SuiObject, type SuiObjectOptions, SuiPackage, SuiPTB, type SuiPTBOptions, SuiTx, type SuiTxOptions } from '../effectable';
import {
  decodeSuiObjectId,
  SuiInvariantViolation,
  SuiModuleDescriptor,
  SuiPackageDescriptor,
  type SuiObjectId,
} from '../schema';
import { SuiPackageRegistry, type SuiPackageRegistryShape } from '../services';

export interface SuiPackageDescriptorInput {
  readonly packageId: SuiObjectId;
  readonly modules: ReadonlyArray<string>;
  readonly moduleDescriptors?: SuiPackageDescriptor['moduleDescriptors'];
}

export interface SuiPackageRegistryState {
  readonly descriptors: TxHashMap.TxHashMap<SuiObjectId, SuiPackageDescriptor>;
}

export const makeRegistryState = (
  initial: ReadonlyArray<SuiPackageDescriptor> = [],
): Effect.Effect<SuiPackageRegistryState> => Effect.gen(function* () {
  const descriptors = yield* TxHashMap.empty<SuiObjectId, SuiPackageDescriptor>();
  for (const descriptor of initial) {
    yield* TxHashMap.set(descriptors, descriptor.packageId, descriptor);
  }
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

export const makeRegistryLayer = (
  initial: ReadonlyArray<SuiPackageDescriptor> = [],
): Layer.Layer<SuiPackageRegistry, never, never> => Layer.effect(SuiPackageRegistry)(
  Effect.map(makeRegistryState(initial), makeRegistryService),
);

export const SuiPackageRegistryLive = makeRegistryLayer();

export const register = (
  descriptor: SuiPackageDescriptor | SuiPackageDescriptorInput,
): Effect.Effect<void, unknown, SuiPackageRegistry> =>
  SuiPackageRegistry.use((registry) => registry.register(normalizeDescriptor(descriptor)));

export const getDescriptor = (
  packageId: SuiObjectId,
): Effect.Effect<SuiPackageDescriptor, unknown, SuiPackageRegistry> =>
  SuiPackageRegistry.use((registry) => registry.get(packageId));

export const get = (
  packageId: SuiObjectId,
): Effect.Effect<SuiPackage<unknown, SuiPackageRegistry>, unknown, SuiPackageRegistry> =>
  Effect.map(getDescriptor(packageId), fromDescriptor);

export const make = (descriptor: SuiPackageDescriptor | SuiPackageDescriptorInput): SuiPackage<unknown, SuiPackageRegistry> =>
  fromDescriptor(normalizeDescriptor(descriptor));

export const fromDescriptor = (
  descriptor: SuiPackageDescriptor,
): SuiPackage<unknown, SuiPackageRegistry> => new SuiPackage({
  packageId: descriptor.packageId,
  modules: descriptor.modules,
  moduleDescriptors: descriptor.moduleDescriptors,
  load: () => getDescriptor(descriptor.packageId),
});

export const module = (
  pkg: SuiPackage<unknown, SuiPackageRegistry>,
  name: string,
): Effect.Effect<SuiModule<unknown, SuiPackageRegistry>, SuiInvariantViolation> => pkg.module(name);

export const object = <A, E = never, R = never>(
  mod: SuiModule<unknown, SuiPackageRegistry>,
  options: Omit<SuiObjectOptions<A, E, R>, 'label'> & { readonly label?: string },
): SuiObject<A, E, R> => mod.object(options);

export const ptb = <TransactionLike = unknown, E = never, R = never>(
  mod: SuiModule<unknown, SuiPackageRegistry>,
  options: Omit<SuiPTBOptions<TransactionLike, E, R>, 'label'> & { readonly label: string },
): SuiPTB<TransactionLike, E, R> => mod.ptb(options);

export const tx = <A, E = never, R = never>(
  mod: SuiModule<unknown, SuiPackageRegistry>,
  options: SuiTxOptions<A, E, R>,
): SuiTx<A, E, R> => mod.tx(options);

export const counterFixtureDescriptor = (
  packageId: SuiObjectId = decodeSuiObjectId('0x0'),
): SuiPackageDescriptor => new SuiPackageDescriptor({
  packageId,
  modules: ['counter'],
  moduleDescriptors: [new SuiModuleDescriptor({
    name: 'counter',
    functions: ['increment', 'value'],
    structs: ['Counter'],
  })],
});

const normalizeDescriptor = (descriptor: SuiPackageDescriptor | SuiPackageDescriptorInput): SuiPackageDescriptor =>
  descriptor instanceof SuiPackageDescriptor
    ? descriptor
    : new SuiPackageDescriptor({
        packageId: descriptor.packageId,
        modules: descriptor.modules,
        moduleDescriptors: descriptor.moduleDescriptors,
      });
