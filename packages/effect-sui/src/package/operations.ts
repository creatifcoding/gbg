/** Effect operations over the SuiPackageRegistry service. */

import * as Effect from 'effect/Effect';

import { SuiPackage } from '../effectable';
import { SuiPackageDescriptor, type SuiObjectId } from '../schema';
import { SuiPackageRegistry } from '../services';
import { normalizeDescriptor } from './descriptor';
import { fromDescriptor } from './factories';
import type { SuiPackageDescriptorInput } from './types';

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
