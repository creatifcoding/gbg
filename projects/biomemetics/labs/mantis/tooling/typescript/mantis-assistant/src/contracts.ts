import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Ajv2020 } from 'ajv/dist/2020.js';
import * as ajvFormats from 'ajv-formats';

import { assistantRoot, contractRegistryPath, labRoot } from './paths.ts';

export interface ContractRegistry {
  readonly kind: 'AssistantContractRegistry';
  readonly schemas: ReadonlyArray<{
    readonly kind: string;
    readonly id: string;
    readonly path: string;
  }>;
}

export interface CorpusCatalog {
  readonly kind: 'Draft202012Corpus';
  readonly cases: ReadonlyArray<{
    readonly id: string;
    readonly instance: string;
    readonly schema: string;
    readonly expect: 'pass' | 'fail';
  }>;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

const resolveCallable = (mod: unknown): ((instance: Ajv2020) => unknown) => {
  if (typeof mod === 'function') return mod as (instance: Ajv2020) => unknown;
  if (mod && typeof mod === 'object' && 'default' in mod) {
    return resolveCallable((mod as { default: unknown }).default);
  }
  throw new Error('ajv-formats did not export a plugin function');
};

const addFormats = resolveCallable(ajvFormats);

const ajv = new Ajv2020({
  allErrors: true,
  strict: false,
  validateFormats: true,
});
addFormats(ajv);

type CompiledSchema = ((data: unknown) => boolean) & {
  errors?: Array<{ instancePath: string; message?: string }> | null;
};

const schemaCache = new Map<string, CompiledSchema>();

export const loadRegistry = (): ContractRegistry =>
  JSON.parse(readFileSync(contractRegistryPath, 'utf8')) as ContractRegistry;

export const loadCorpus = (): CorpusCatalog =>
  JSON.parse(
    readFileSync(path.join(assistantRoot, 'fixtures/corpus/catalog.json'), 'utf8'),
  ) as CorpusCatalog;

export const sha256File = (absolute: string): string =>
  createHash('sha256').update(readFileSync(absolute)).digest('hex');

const toLabPath = (relative: string): string => {
  if (path.isAbsolute(relative)) return relative;
  const stripped = relative.replace(/^(?:projects\/biomemetics\/labs\/mantis\/)+/, '');
  return path.join(labRoot, stripped);
};

export const compileSchema = (schemaRelative: string) => {
  const cached = schemaCache.get(schemaRelative);
  if (cached) return cached;
  const schema = JSON.parse(readFileSync(toLabPath(schemaRelative), 'utf8')) as object;
  const compiled = ajv.compile(schema) as CompiledSchema;
  schemaCache.set(schemaRelative, compiled);
  return compiled;
};

export const validateInstance = (
  schemaRelative: string,
  instance: unknown,
): ValidationResult => {
  const validate = compileSchema(schemaRelative);
  const valid = validate(instance) === true;
  const errors = (validate.errors ?? []).map((error) =>
    `${error.instancePath || '/'} ${error.message ?? 'invalid'}`,
  );
  return { valid, errors };
};

export const loadLabJson = (relative: string): unknown =>
  JSON.parse(readFileSync(toLabPath(relative), 'utf8'));
