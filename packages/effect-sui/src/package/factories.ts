import * as Effect from 'effect/Effect';

import { SuiModule, SuiObject, type SuiObjectOptions, SuiPackage, SuiPTB, type SuiPTBOptions, SuiTx, type SuiTxOptions } from '../effectable';
import { SuiInvariantViolation, SuiPackageDescriptor } from '../schema';
import { SuiPackageRegistry } from '../services';
import { normalizeDescriptor } from './descriptor';
import type { SuiPackageDescriptorInput } from './types';

export const make = (descriptor: SuiPackageDescriptor | SuiPackageDescriptorInput): SuiPackage<unknown, SuiPackageRegistry> =>
  fromDescriptor(normalizeDescriptor(descriptor));

export const fromDescriptor = (descriptor: SuiPackageDescriptor): SuiPackage<unknown, SuiPackageRegistry> => new SuiPackage({
  packageId: descriptor.packageId,
  modules: descriptor.modules,
  moduleDescriptors: descriptor.moduleDescriptors,
  load: () => SuiPackageRegistry.use((registry) => registry.get(descriptor.packageId)),
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

export const tx = <A, E = never, R = never>(mod: SuiModule<unknown, SuiPackageRegistry>, options: SuiTxOptions<A, E, R>): SuiTx<A, E, R> =>
  mod.tx(options);
