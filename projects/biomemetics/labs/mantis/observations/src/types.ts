/** Lane records for observation → structure → mechanism → function → analog. */

export const WORKSPACE_REF = 'biomemetics.mantis' as const;
export const SCHEMA_VERSION = '1.0.0' as const;

export const LAB_AS_SPECIMEN_IDS = Object.freeze([
  'biomemetics.mantis',
  'mantis-lab',
  'projects/biomemetics/labs/mantis',
]);

export const FORBIDDEN_LOCALITY_KEYS = Object.freeze([
  'locality',
  'gps',
  'geo',
  'latitude',
  'longitude',
  'altitudeMeters',
]);

export const FORBIDDEN_CALLER_PROSE_KEYS = Object.freeze([
  'component',
  'components',
  'analogTarget',
]);

export const LOCAL_EVIDENCE_RUN = Object.freeze({
  workstream: 'mantis-04-observation-pipeline',
  root: 'evidence/runs',
  layout: [
    'run.json',
    'inputs/',
    'raw/',
    'derived/',
    'report.json',
    'evidence-record.json',
  ],
});

export const LOCAL_EVIDENCE_RECORD_REF =
  /^evidence\/runs\/[A-Za-z0-9][A-Za-z0-9._-]*\/[a-fA-F0-9]{7,40}\/[A-Za-z0-9][A-Za-z0-9._-]*\/evidence-record\.json$/;

export type RefusalReason =
  | 'no-real-media'
  | 'invented-locality'
  | 'invented-taxon'
  | 'lab-as-specimen'
  | 'missing-digest'
  | 'missing-license'
  | 'missing-consent'
  | 'unobserved-statement'
  | 'missing-observation'
  | 'missing-structure'
  | 'missing-mechanism'
  | 'missing-function'
  | 'engineering-as-biology'
  | 'source-class-relabeled'
  | 'unverified-evidence'
  | 'simulated-as-measured'
  | 'caller-component-prose'
  | 'specimen-insert-forbidden'
  | 'store-write-forbidden'
  | 'contract-invalid'
  | 'measurement-incomplete'
  | 'evidence-not-local-run';

export class PipelineRefused extends Error {
  readonly _tag = 'PipelineRefused';
  readonly reasons: readonly RefusalReason[];

  constructor(reasons: readonly RefusalReason[]) {
    super(`PipelineRefused: ${reasons.join(',')}`);
    this.name = 'PipelineRefused';
    this.reasons = reasons;
  }
}

export type ReviewStatus = 'pending' | 'accepted' | 'rejected' | 'superseded';

export interface Review {
  readonly status: ReviewStatus;
  readonly reviewer?: string;
  readonly reviewedAt?: string;
  readonly notes?: string;
}

export type Taxon =
  | {
      readonly status: 'unknown';
      readonly reason: 'no-real-media' | 'media-without-citation';
    }
  | {
      readonly status: 'cited-guess';
      readonly name: string;
      readonly confidence: number;
      readonly citation: string;
      readonly rank?: string;
    };

export interface MediaProvenance {
  readonly path: string;
  readonly sha256: string;
  readonly mediaType: string;
  readonly license: string;
  readonly consent: string;
}

export interface ObservationStatement {
  readonly text: string;
  readonly status: 'observed' | 'interpreted' | 'unverified';
  readonly sourceRef?: string;
}

export interface Measurement {
  readonly parameterRef: string;
  readonly value: number;
  readonly unit: string;
  readonly uncertainty: number;
  readonly method: string;
  readonly scaleEvidence: string;
  readonly sampleCount?: number;
}

export interface Observation {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly kind: 'Observation';
  readonly observationId: string;
  readonly workspaceRef: typeof WORKSPACE_REF;
  readonly recordedAt: string;
  readonly media: MediaProvenance;
  readonly statements: readonly ObservationStatement[];
  readonly measurements?: readonly Measurement[];
  readonly taxon: Taxon;
  readonly review: Review;
}

export type StructureBasis =
  | 'observed'
  | 'measured'
  | 'calculated'
  | 'simulated'
  | 'ref'
  | 'target'
  | 'typ'
  | 'unverified';

export interface Structure {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly kind: 'Structure';
  readonly structureId: string;
  readonly observationRef: string;
  readonly workspaceRef: typeof WORKSPACE_REF;
  readonly basis: StructureBasis;
  readonly description: string;
  readonly review: Review;
}

export interface MechanismMembers {
  readonly moving: readonly string[];
  readonly grounded: readonly string[];
}

export interface Mechanism {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly kind: 'Mechanism';
  readonly mechanismId: string;
  readonly structureRef: string;
  readonly workspaceRef: typeof WORKSPACE_REF;
  readonly hypothesis: string;
  readonly falsifier: string;
  readonly status: 'interpreted' | 'unverified';
  readonly states: readonly string[];
  readonly members: MechanismMembers;
  readonly failureModes: readonly string[];
  readonly verificationPlan: string;
  readonly review: Review;
}

export interface BiologicalFunction {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly kind: 'Function';
  readonly functionId: string;
  readonly mechanismRef: string;
  readonly workspaceRef: typeof WORKSPACE_REF;
  readonly statement: string;
  readonly status: 'interpreted' | 'unverified';
  readonly limits: readonly string[];
  readonly review: Review;
}

export interface AnalogLink {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly kind: 'AnalogLink';
  readonly analogId: string;
  readonly functionRef: string;
  readonly workspaceRef: typeof WORKSPACE_REF;
  readonly target: string;
  readonly direction: 'biology-to-engineering';
  readonly equivalent: false;
  readonly limit: string;
  readonly nonEquivalence: string;
  readonly note?: string;
  readonly review: Review;
}

export interface ObservationCatalog {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly kind: 'ObservationCatalog';
  readonly workspaceRef: typeof WORKSPACE_REF;
  readonly catalogSpecimen: false;
  readonly taxon: Taxon;
  readonly records: readonly Observation[];
}

export interface StructureCatalog {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly kind: 'StructureCatalog';
  readonly workspaceRef: typeof WORKSPACE_REF;
  readonly catalogSpecimen: false;
  readonly records: readonly Structure[];
}

export interface MechanismCatalog {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly kind: 'MechanismCatalog';
  readonly workspaceRef: typeof WORKSPACE_REF;
  readonly catalogSpecimen: false;
  readonly records: readonly Mechanism[];
}

export interface FunctionCatalog {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly kind: 'FunctionCatalog';
  readonly workspaceRef: typeof WORKSPACE_REF;
  readonly catalogSpecimen: false;
  readonly records: readonly BiologicalFunction[];
}

export interface AnalogCatalog {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly kind: 'AnalogCatalog';
  readonly workspaceRef: typeof WORKSPACE_REF;
  readonly catalogSpecimen: false;
  readonly records: readonly AnalogLink[];
}

export interface LaneState {
  readonly observations: ObservationCatalog;
  readonly structures: StructureCatalog;
  readonly mechanisms: MechanismCatalog;
  readonly functions: FunctionCatalog;
  readonly analogs: AnalogCatalog;
  readonly mediaFiles: readonly string[];
}

export type SpecimenComponentDraft =
  | { readonly _tag: 'Observation'; readonly text: string }
  | { readonly _tag: 'Structure'; readonly text: string }
  | { readonly _tag: 'Mechanism'; readonly text: string }
  | { readonly _tag: 'Function'; readonly text: string }
  | {
      readonly _tag: 'AnalogLink';
      readonly target: string;
      readonly note?: string;
    };

/**
 * Read-only mirror of the #16 Attach RPC shape (PR 33). This pipeline never
 * calls a store and never inserts a Specimen.
 */
export const AttachRpcContract = {
  name: 'Attach',
  payload: {
    specimenId: 'SpecimenId',
    component: 'governed-admission',
    provenance: 'ProjectionProvenance',
  },
  success: {
    localityMutated: false,
    taxonMutated: false,
    storeWrite: false,
    mode: 'stub',
  },
  error: 'AttachRefused',
} as const;

export interface ProjectionProvenance {
  readonly evidenceId: string;
  readonly evidenceRef: string;
  readonly claimRefs: readonly string[];
  readonly sourceClass: 'observed' | 'measured';
  readonly recordedAt: string;
  readonly inputRefs: readonly { readonly ref: string; readonly role: string; readonly sha256?: string }[];
  readonly observationSourceRefs: readonly string[];
  readonly artifactRefs: readonly {
    readonly path?: string;
    readonly mediaType: string;
    readonly sha256?: string;
  }[];
  readonly review: {
    readonly reviewer: string;
    readonly reviewedAt: string;
  };
}

export interface ComponentProjection {
  readonly component: SpecimenComponentDraft;
  readonly provenance: ProjectionProvenance;
}

export interface GovernedProjectionPlan {
  readonly projections: readonly ComponentProjection[];
  readonly executable: false;
  readonly storeWrite: false;
  readonly localityMutated: false;
  readonly taxonMutated: false;
  readonly blocker: 'specimendb-attach-unavailable';
  readonly blockers: readonly (
    | 'specimendb-attach-unavailable'
    | 'no-admissible-evidence'
  )[];
  readonly evidenceRef: string;
}

export const localEvidenceRef = (gitSha: string, runId: string): string =>
  `${LOCAL_EVIDENCE_RUN.root}/${LOCAL_EVIDENCE_RUN.workstream}/${gitSha}/${runId}/evidence-record.json`;
