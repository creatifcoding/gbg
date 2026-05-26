/** Descriptor normalization and package fixtures. */

import { decodeSuiObjectId, SuiModuleDescriptor, SuiPackageDescriptor, type SuiObjectId } from '../schema';
import type { SuiPackageDescriptorInput } from './types';

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

export const normalizeDescriptor = (descriptor: SuiPackageDescriptor | SuiPackageDescriptorInput): SuiPackageDescriptor =>
  descriptor instanceof SuiPackageDescriptor
    ? descriptor
    : new SuiPackageDescriptor({
        packageId: descriptor.packageId,
        modules: descriptor.modules,
        moduleDescriptors: descriptor.moduleDescriptors,
      });
