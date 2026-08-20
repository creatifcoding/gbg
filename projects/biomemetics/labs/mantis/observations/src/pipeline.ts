import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { deriveAnalog, type AnalogDraft } from '../../analogs/src/analog.ts';
import { planGovernedProjection } from '../../analogs/src/projection.ts';
import { deriveFunction, deriveMechanism, type FunctionDraft, type MechanismDraft } from '../../mechanisms/src/mechanism.ts';
import { deriveStructure, type StructureDraft } from '../../morphology/src/structure.ts';
import {
  admitObservation,
  isRealMediaFile,
  type MediaAdmission,
} from './observation.ts';
import {
  PipelineRefused,
  type AnalogCatalog,
  type FunctionCatalog,
  type GovernedProjectionPlan,
  type LaneState,
  type MechanismCatalog,
  type Observation,
  type ObservationCatalog,
  type StructureCatalog,
} from './types.ts';
import {
  collectForbiddenReasons,
  isObject,
  refuseLabAsSpecimen,
  validateObservationCatalog,
} from './validate.ts';

export const lanesRootFromUrl = (url: string): string =>
  join(dirname(fileURLToPath(url)), '..', '..');

export const COMMITTED_LANES_ROOT = lanesRootFromUrl(import.meta.url);

const MEDIA_DIR = 'observations/media';

const readJson = (path: string): unknown =>
  JSON.parse(readFileSync(path, 'utf8')) as unknown;

const listMediaFiles = (root: string): string[] => {
  const dir = join(root, MEDIA_DIR);
  return readdirSync(dir)
    .filter(isRealMediaFile)
    .map((name) => join(MEDIA_DIR, name).replaceAll('\\', '/'))
    .sort();
};

const loadCatalog = <T>(path: string, expectedKind: string): T => {
  const value = readJson(path);
  if (!isObject(value) || value.kind !== expectedKind) {
    throw new PipelineRefused(['contract-invalid']);
  }
  if (value.catalogSpecimen !== false) {
    throw new PipelineRefused(['lab-as-specimen']);
  }
  const forbidden = collectForbiddenReasons(value);
  if (forbidden.length > 0) throw new PipelineRefused(forbidden);
  return value as T;
};

export const inspectLanes = (root = COMMITTED_LANES_ROOT): LaneState => {
  const observations = loadCatalog<ObservationCatalog>(
    join(root, 'observations/catalog.json'),
    'ObservationCatalog',
  );
  const catalogGate = validateObservationCatalog(observations);
  if (!catalogGate.valid) {
    throw new PipelineRefused(catalogGate.reasons);
  }
  return {
    observations,
    structures: loadCatalog<StructureCatalog>(
      join(root, 'morphology/catalog.json'),
      'StructureCatalog',
    ),
    mechanisms: loadCatalog<MechanismCatalog>(
      join(root, 'mechanisms/catalog.json'),
      'MechanismCatalog',
    ),
    functions: loadCatalog<FunctionCatalog>(
      join(root, 'mechanisms/functions.json'),
      'FunctionCatalog',
    ),
    analogs: loadCatalog<AnalogCatalog>(
      join(root, 'analogs/catalog.json'),
      'AnalogCatalog',
    ),
    mediaFiles: listMediaFiles(root),
  };
};

export const committedStateIsEmpty = (state: LaneState): boolean =>
  state.mediaFiles.length === 0 &&
  state.observations.records.length === 0 &&
  state.structures.records.length === 0 &&
  state.mechanisms.records.length === 0 &&
  state.functions.records.length === 0 &&
  state.analogs.records.length === 0 &&
  state.observations.taxon.status === 'unknown' &&
  state.observations.taxon.reason === 'no-real-media' &&
  state.observations.catalogSpecimen === false;

export interface TraverseInput {
  readonly media: Omit<MediaAdmission, 'lanesRelativePath' | 'absolutePath'> & {
    readonly absolutePath: string;
    readonly lanesRelativePath: string;
  };
  readonly structure?: StructureDraft;
  readonly mechanism?: MechanismDraft;
  readonly fn?: FunctionDraft;
  readonly analog?: AnalogDraft;
  readonly gitSha: string;
  readonly runId: string;
  readonly specimenId?: string;
  readonly insertSpecimen?: boolean;
  readonly writeStore?: boolean;
  readonly caller?: unknown;
}

export interface TraverseResult {
  readonly observation: Observation;
  readonly structure?: ReturnType<typeof deriveStructure>;
  readonly mechanism?: ReturnType<typeof deriveMechanism>;
  readonly fn?: ReturnType<typeof deriveFunction>;
  readonly analog?: ReturnType<typeof deriveAnalog>;
  readonly projection: GovernedProjectionPlan;
}

export const traverse = (input: TraverseInput): TraverseResult => {
  const reasons = [
    ...collectForbiddenReasons(input),
    ...collectForbiddenReasons(input.caller),
    ...refuseLabAsSpecimen(input.specimenId),
  ];
  if (input.insertSpecimen === true) reasons.push('specimen-insert-forbidden');
  if (input.writeStore === true) reasons.push('store-write-forbidden');
  if (reasons.length > 0) throw new PipelineRefused([...new Set(reasons)]);

  if (input.analog !== undefined && input.fn === undefined) {
    throw new PipelineRefused(['missing-function']);
  }
  if (input.fn !== undefined && input.mechanism === undefined) {
    throw new PipelineRefused(['missing-mechanism']);
  }
  if (input.mechanism !== undefined && input.structure === undefined) {
    throw new PipelineRefused(['missing-structure']);
  }
  if (input.structure !== undefined && input.media === undefined) {
    throw new PipelineRefused(['missing-observation']);
  }

  const observation = admitObservation({
    ...input.media,
    caller: input.caller,
  });

  const structure =
    input.structure === undefined
      ? undefined
      : deriveStructure(observation, input.structure);
  const mechanism =
    input.mechanism === undefined
      ? undefined
      : deriveMechanism(structure, input.mechanism);
  const fn =
    input.fn === undefined ? undefined : deriveFunction(mechanism, input.fn);
  const analog =
    input.analog === undefined ? undefined : deriveAnalog(fn, input.analog);

  const projection = planGovernedProjection({
    observation,
    structure,
    mechanism,
    fn,
    analog,
    gitSha: input.gitSha,
    runId: input.runId,
    specimenId: input.specimenId,
    caller: input.caller,
  });

  if (projection.executable !== false || projection.storeWrite !== false) {
    throw new PipelineRefused(['store-write-forbidden']);
  }
  return { observation, structure, mechanism, fn, analog, projection };
};

const isMain = (): boolean => {
  const entry = process.argv[1];
  if (entry === undefined) return false;
  return fileURLToPath(import.meta.url) === entry;
};

if (isMain()) {
  const state = inspectLanes();
  const empty = committedStateIsEmpty(state);
  process.stdout.write(
    `${JSON.stringify(
      {
        empty,
        taxon: state.observations.taxon,
        mediaFiles: state.mediaFiles,
        observationCount: state.observations.records.length,
        analogCount: state.analogs.records.length,
        catalogSpecimen: state.observations.catalogSpecimen,
        attach: { executable: false, storeWrite: false },
      },
      null,
      2,
    )}\n`,
  );
}
