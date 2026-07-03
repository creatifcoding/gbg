import * as Schema from 'effect/Schema';
import * as SchemaGetter from 'effect/SchemaGetter';

export const normalizeString = (normalize: (value: string) => string) =>
  Schema.decode<Schema.String>({
    decode: SchemaGetter.transform(normalize),
    encode: SchemaGetter.transform(normalize),
  });

export const normalizeStringOrFail = (normalize: (value: string) => string) =>
  Schema.decode<Schema.String>({
    decode: SchemaGetter.transform(normalize),
    encode: SchemaGetter.transform(normalize),
  });
