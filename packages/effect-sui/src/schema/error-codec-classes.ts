import * as Schema from 'effect-v4/Schema';

export class SuiBcsParseError extends Schema.TaggedErrorClass<SuiBcsParseError>('@tmnl/effect-sui/SuiBcsParseError')('Sui/BcsParse', {
  codec: Schema.String,
  message: Schema.String,
  byteLength: Schema.optional(Schema.Number),
  input: Schema.optional(Schema.Unknown),
  cause: Schema.optional(Schema.Unknown),
}) {}

export class SuiPureEncodeError extends Schema.TaggedErrorClass<SuiPureEncodeError>('@tmnl/effect-sui/SuiPureEncodeError')('Sui/PureEncode', {
  typeTag: Schema.String,
  message: Schema.String,
  value: Schema.optional(Schema.Unknown),
  cause: Schema.optional(Schema.Unknown),
}) {}
