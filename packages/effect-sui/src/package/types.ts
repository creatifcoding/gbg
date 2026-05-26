/** Package registry descriptor/state contracts. */

import type * as TxHashMap from 'effect-v4/TxHashMap';

import type { SuiPackageDescriptor, SuiObjectId } from '../schema';

export interface SuiPackageDescriptorInput {
  readonly packageId: SuiObjectId;
  readonly modules: ReadonlyArray<string>;
  readonly moduleDescriptors?: SuiPackageDescriptor['moduleDescriptors'];
}

export interface SuiPackageRegistryState {
  readonly descriptors: TxHashMap.TxHashMap<SuiObjectId, SuiPackageDescriptor>;
}
