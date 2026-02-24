import { JSONSchema, Schema } from 'effect';

export type JsonObject = Record<string, unknown>;

/**
 * Interop normalization for Elixir validators:
 * Effect may emit `$defs` references; Exonerate/ex_json_schema pipelines in this spike
 * are stabilized around draft-07 `definitions` pointers.
 */
export const normalizeDraft7ForElixir = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(normalizeDraft7ForElixir);
  }

  if (value !== null && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    for (const [key, raw] of Object.entries(input)) {
      if (key === '$defs') {
        output.definitions = normalizeDraft7ForElixir(raw);
        continue;
      }

      if (key === '$ref' && typeof raw === 'string') {
        output.$ref = raw.replace('#/$defs/', '#/definitions/');
        continue;
      }

      output[key] = normalizeDraft7ForElixir(raw);
    }

    return output;
  }

  return value;
};

/**
 * Exonerate compatibility normalization:
 * inline top-level `$ref` targets while keeping nested `definitions` for local refs.
 */
export const inlineRootDefinitionRef = (schema: JsonObject): JsonObject => {
  const rootRef = schema.$ref;
  const definitions = schema.definitions as Record<string, unknown> | undefined;

  if (
    typeof rootRef === 'string' &&
    rootRef.startsWith('#/definitions/') &&
    definitions
  ) {
    const rootKey = rootRef.replace('#/definitions/', '');
    const root = definitions[rootKey];

    if (root && typeof root === 'object') {
      const { $ref: _dropRef, ...rest } = schema;
      return {
        ...rest,
        ...(root as JsonObject),
      };
    }
  }

  return schema;
};

/**
 * JSON Schema contract semantics:
 * metadata fields are annotation keywords (non-assertive by validation semantics).
 */
export const withStableMetadata = (
  schema: JsonObject,
  metadata: { $id: string; title: string; description: string }
): JsonObject => ({
  ...schema,
  $id: metadata.$id,
  title: metadata.title,
  description: metadata.description,
});

/**
 * Effect Schema feature wrapper:
 * Generate JSON Schema draft-07 and apply Elixir-interop normalizations.
 */
export const makeElixirDraft7Schema = <A, I, R>(
  schema: Schema.Schema<A, I, R>,
  metadata: { $id: string; title: string; description: string }
): JsonObject =>
  withStableMetadata(
    inlineRootDefinitionRef(
      normalizeDraft7ForElixir(
        JSONSchema.make(schema, { target: 'jsonSchema7' })
      ) as JsonObject
    ),
    metadata
  );
