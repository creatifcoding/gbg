/** Sui package and module descriptor schemas. */

import * as Schema from 'effect-v4/Schema';

import { SuiObjectId } from './strings';

const moveIdentifierString = Schema.String.check(Schema.isPattern(/^[a-zA-Z][a-zA-Z0-9_]*$/));

export class SuiModuleDescriptor extends Schema.TaggedClass<SuiModuleDescriptor>()('SuiModuleDescriptor', {
  name: moveIdentifierString,
  functions: Schema.optional(Schema.Array(moveIdentifierString)),
  structs: Schema.optional(Schema.Array(moveIdentifierString)),
}) {}

export class SuiPackageDescriptor extends Schema.TaggedClass<SuiPackageDescriptor>()('SuiPackageDescriptor', {
  packageId: SuiObjectId,
  modules: Schema.Array(moveIdentifierString),
  moduleDescriptors: Schema.optional(Schema.Array(SuiModuleDescriptor)),
}) {}
