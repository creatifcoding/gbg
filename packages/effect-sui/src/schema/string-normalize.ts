import * as Schema from 'effect-v4/Schema';
import * as SchemaGetter from 'effect-v4/SchemaGetter';

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
