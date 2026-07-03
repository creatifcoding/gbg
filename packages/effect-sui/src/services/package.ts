/** Package registry service contracts. */

import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

import type { SuiObjectId, SuiPackageDescriptor } from '../schema';

export interface SuiPackageRegistryShape {
  readonly register: (descriptor: SuiPackageDescriptor) => Effect.Effect<void, unknown, never>;
  readonly get: (packageId: SuiObjectId) => Effect.Effect<SuiPackageDescriptor, unknown, never>;
}

export class SuiPackageRegistry extends Context.Service<
  SuiPackageRegistry,
  SuiPackageRegistryShape
>()('@tmnl/effect-sui/SuiPackageRegistry') {}
