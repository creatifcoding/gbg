import * as Schema from 'effect-v4/Schema';

import { SuiPackageErrorKind } from './error-codes';
import { SuiObjectId } from './strings';

export class SuiPackageError extends Schema.TaggedErrorClass<SuiPackageError>('@tmnl/effect-sui/SuiPackageError')('Sui/Package', {
  kind: SuiPackageErrorKind,
  packageId: Schema.optional(SuiObjectId),
  module: Schema.optional(Schema.String),
  typeName: Schema.optional(Schema.String),
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiModuleNotFoundError extends Schema.TaggedErrorClass<SuiModuleNotFoundError>('@tmnl/effect-sui/SuiModuleNotFoundError')('Sui/ModuleNotFound', {
  packageId: SuiObjectId,
  module: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiTypeNotRegisteredError extends Schema.TaggedErrorClass<SuiTypeNotRegisteredError>('@tmnl/effect-sui/SuiTypeNotRegisteredError')('Sui/TypeNotRegistered', {
  packageId: Schema.optional(SuiObjectId),
  module: Schema.optional(Schema.String),
  typeName: Schema.String,
  message: Schema.String,
  cause: Schema.optional(Schema.Unknown),
}) {}
