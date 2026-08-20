import {
  artifactStatusAdmitted,
  attachmentEligible,
  type EvidenceBasis,
  type EvidenceRecordArtifact,
  type EvidenceRecordAdmission,
  type EvidenceRecordInput,
  type EvidenceSourceClass,
  type LabArtifact,
  type LabEvidence,
  type ValidatedEvidenceRecord,
} from './domain.ts';
import {
  EVIDENCE_SCHEMA_PATH,
  isTrustedEvidenceRuntimeValidator,
  type EvidenceRuntimeValidator,
} from './evidence-validator.ts';

export {
  EVIDENCE_SCHEMA_PATH,
  EVIDENCE_SCHEMA_SHA256,
  loadEvidenceRuntimeValidator,
  type EvidenceRuntimeValidator,
  type EvidenceValidationFailure,
  type EvidenceValidationSuccess,
} from './evidence-validator.ts';

/**
 * Published catalog identifier. Matches `@tmnl/specimendb` `Schema.String.pipe(
 * Schema.brand('SpecimenId'))`. This client never mints one.
 */
export type SpecimenId = string & { readonly __brand: 'SpecimenId' };

export const trustSpecimenId = (id: string): SpecimenId => id as SpecimenId;

/** Local evidence run layout. Attach never copies these into a store. */
export const LOCAL_EVIDENCE_RUN = {
  root: 'evidence/runs',
  layout: [
    'run.json',
    'inputs/',
    'raw/',
    'derived/',
    'report.json',
    'evidence-record.json',
  ],
} as const;

const LOCAL_EVIDENCE_RECORD_REF =
  /^evidence\/runs\/[A-Za-z0-9][A-Za-z0-9._-]*\/[a-fA-F0-9]{7,40}\/[A-Za-z0-9][A-Za-z0-9._-]*\/evidence-record\.json$/;

export const isLocalEvidenceRecordRef = (ref: string): boolean =>
  LOCAL_EVIDENCE_RECORD_REF.test(ref);

const LAB_AS_SPECIMEN_IDS = new Set([
  'biomemetics.mantis',
  'mantis-lab',
  'projects/biomemetics/labs/mantis',
]);

const FORBIDDEN_CALLER_LOCALITY_KEYS = [
  'locality',
  'gps',
  'geo',
  'latitude',
  'longitude',
  'altitudeMeters',
] as const;

const FORBIDDEN_CALLER_TAXON_KEYS = ['taxon'] as const;

const FORBIDDEN_CALLER_PROSE_KEYS = [
  'component',
  'components',
  'analogTarget',
] as const;

export interface ExistingSpecimen {
  readonly id: string;
}

export interface ProjectionProvenance {
  readonly evidenceId: string;
  readonly evidenceRef: string;
  readonly claimRefs: readonly string[];
  readonly sourceClass: 'observed' | 'measured';
  readonly recordedAt: string;
  readonly inputRefs: readonly EvidenceRecordInput[];
  readonly observationSourceRefs: readonly string[];
  readonly artifactRefs: readonly EvidenceRecordArtifact[];
  readonly review: {
    readonly reviewer: string;
    readonly reviewedAt: string;
  };
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
 * Planning envelope. Provenance is intentionally adjacent to, not embedded in,
 * the tentative component fields because current SpecimenDB component schemas
 * do not define a `provenance` property.
 */
export interface ComponentProjection {
  readonly component: SpecimenComponentDraft;
  readonly provenance: ProjectionProvenance;
}

/**
 * Read-only seam for @tmnl/specimendb Get. Intake is not exposed here: this
 * workspace is not a Specimen and this client does not insert one.
 */
export interface SpecimenDbPort {
  readonly get: (specimenId: string) => Promise<ExistingSpecimen>;
}

/**
 * Governed Attach RPC payload. SpecimenId + one reviewed claim-bound component.
 * No locality, GPS, taxon, or caller prose.
 */
export interface AttachPayload {
  readonly specimenId: SpecimenId;
  readonly component: SpecimenComponentDraft;
  readonly provenance: ProjectionProvenance;
}

export interface AttachResult {
  readonly specimenId: SpecimenId;
  readonly evidenceId: string;
  readonly claimRefs: readonly string[];
  readonly localityMutated: false;
  readonly taxonMutated: false;
  readonly storeWrite: false;
  readonly mode: 'stub';
}

/**
 * Published Attach RPC shape (Effect `Rpc.make('Attach', …)` once the catalog
 * package exposes it). This client talks to a stub port only.
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

export interface SpecimenDbAttachPort extends SpecimenDbPort {
  readonly attach: (payload: AttachPayload) => Promise<AttachResult>;
}

export type EvidenceOmissionReason =
  | 'artifact-status-not-admitted'
  | 'contract-invalid'
  | 'evidence-id-mismatch'
  | 'evidence-basis-mismatch'
  | 'source-class-not-admitted'
  | 'result-does-not-support'
  | 'review-not-accepted'
  | 'review-metadata-missing'
  | 'claim-link-missing'
  | 'admission-missing'
  | 'admission-ambiguous'
  | 'evidence-reference-missing';

export interface EvidenceOmission {
  readonly evidenceId: string;
  readonly reasons: readonly EvidenceOmissionReason[];
  readonly validationErrors?: readonly string[];
}

export interface ProjectionResult {
  readonly projections: readonly ComponentProjection[];
  readonly omissions: readonly EvidenceOmission[];
  readonly omittedEvidenceIds: readonly string[];
}

export type AttachmentBlocker =
  | 'specimendb-attach-unavailable'
  | 'no-admissible-evidence';

export interface AttachmentPlan extends ProjectionResult {
  readonly specimenId: string;
  readonly artifactId: string;
  readonly artifactStatus: LabArtifact['status'];
  readonly evidenceSchemaPath: typeof EVIDENCE_SCHEMA_PATH;
  readonly blockers: readonly AttachmentBlocker[];
  readonly executable: false;
  readonly blocker: 'specimendb-attach-unavailable';
}

export type AttachRefusalReason =
  | EvidenceOmissionReason
  | 'invented-locality'
  | 'invented-taxon'
  | 'lab-as-specimen'
  | 'unverified-evidence'
  | 'caller-component-prose'
  | 'evidence-not-local-run'
  | 'no-admissible-evidence'
  | 'source-class-relabeled';

export class AttachRefused extends Error {
  readonly _tag = 'AttachRefused';
  readonly reasons: readonly AttachRefusalReason[];
  readonly evidenceId: string | undefined;

  constructor(reasons: readonly AttachRefusalReason[], evidenceId?: string) {
    super(`AttachRefused: ${reasons.join(',')}`);
    this.name = 'AttachRefused';
    this.reasons = reasons;
    this.evidenceId = evidenceId;
  }
}

export interface GovernedAttachInput {
  readonly specimenId: string;
  readonly artifact: LabArtifact;
}

const sourceBasis: Readonly<Record<EvidenceSourceClass, EvidenceBasis>> = {
  observed: 'observed',
  measured: 'measured',
  calculated: 'calculated',
  simulated: 'simulated',
  'external-source': 'ref',
};

const isNonBlank = (value: string | undefined): value is string =>
  value !== undefined && value.trim() !== '';

const copyInputRef = (input: EvidenceRecordInput): EvidenceRecordInput => ({
  ref: input.ref,
  role: input.role,
  ...(input.sha256 === undefined ? {} : { sha256: input.sha256 }),
});

const copyArtifactRef = (
  artifact: EvidenceRecordArtifact,
): EvidenceRecordArtifact => ({
  ...(artifact.path === undefined ? {} : { path: artifact.path }),
  ...(artifact.uri === undefined ? {} : { uri: artifact.uri }),
  ...(artifact.sha256 === undefined ? {} : { sha256: artifact.sha256 }),
  mediaType: artifact.mediaType,
  ...(artifact.description === undefined
    ? {}
    : { description: artifact.description }),
});

const provenanceFor = (
  evidence: LabEvidence,
  record: ValidatedEvidenceRecord,
): ProjectionProvenance => ({
  evidenceId: record.evidenceId,
  evidenceRef: evidence.recordRef,
  claimRefs: [...record.claimRefs],
  sourceClass: record.sourceClass as 'observed' | 'measured',
  recordedAt: record.recordedAt,
  inputRefs: (record.inputs ?? []).map(copyInputRef),
  observationSourceRefs: (record.observations ?? [])
    .map((observation) => observation.sourceRef)
    .filter(isNonBlank),
  artifactRefs: (record.artifacts ?? []).map(copyArtifactRef),
  review: {
    reviewer: record.review.reviewer as string,
    reviewedAt: record.review.reviewedAt as string,
  },
});

const projectOne = (
  evidence: LabEvidence,
  record: ValidatedEvidenceRecord,
): ComponentProjection | undefined => {
  const provenance = provenanceFor(evidence, record);
  const admissions = (record.admissions ?? []).filter(
    (candidate) => candidate.claimRef === evidence.claimRef,
  );
  if (admissions.length !== 1) return undefined;
  const admission: EvidenceRecordAdmission =
    admissions[0] as EvidenceRecordAdmission;
  switch (admission.kind) {
    case 'observation':
      return {
        component: { _tag: 'Observation', text: admission.text },
        provenance,
      };
    case 'structure':
      return {
        component: { _tag: 'Structure', text: admission.text },
        provenance,
      };
    case 'mechanism':
      return {
        component: { _tag: 'Mechanism', text: admission.text },
        provenance,
      };
    case 'function':
      return {
        component: { _tag: 'Function', text: admission.text },
        provenance,
      };
    case 'analog':
      return admission.target === undefined
        ? undefined
        : {
            component: {
              _tag: 'AnalogLink',
              target: admission.target,
              note: admission.text,
            },
            provenance,
          };
  }
};

const assessEvidence = (
  evidence: LabEvidence,
  validator: EvidenceRuntimeValidator,
):
  | { readonly admitted: true; readonly record: ValidatedEvidenceRecord }
  | { readonly admitted: false; readonly omission: EvidenceOmission } => {
  const validation = validator.validate(evidence.record);
  if (!validation.valid) {
    return {
      admitted: false,
      omission: {
        evidenceId: evidence.id,
        reasons: ['contract-invalid'],
        validationErrors: [...validation.errors],
      },
    };
  }

  const record = validation.value;
  const reasons: EvidenceOmissionReason[] = [];
  if (record.evidenceId !== evidence.id) reasons.push('evidence-id-mismatch');
  if (sourceBasis[record.sourceClass] !== evidence.basis) {
    reasons.push('evidence-basis-mismatch');
  }
  if (
    !attachmentEligible(evidence.basis) ||
    (record.sourceClass !== 'observed' && record.sourceClass !== 'measured')
  ) {
    reasons.push('source-class-not-admitted');
  }
  if (record.result.disposition !== 'supports') {
    reasons.push('result-does-not-support');
  }
  if (record.review.status !== 'accepted') reasons.push('review-not-accepted');
  if (
    !isNonBlank(record.review.reviewer) ||
    !isNonBlank(record.review.reviewedAt)
  ) {
    reasons.push('review-metadata-missing');
  }
  if (
    !isNonBlank(evidence.claimRef) ||
    !record.claimRefs.includes(evidence.claimRef)
  ) {
    reasons.push('claim-link-missing');
  }
  const matchingAdmissions = (record.admissions ?? []).filter(
    (admission) => admission.claimRef === evidence.claimRef,
  );
  if (matchingAdmissions.length === 0) reasons.push('admission-missing');
  if (matchingAdmissions.length > 1) reasons.push('admission-ambiguous');
  if (!isNonBlank(evidence.recordRef)) reasons.push('evidence-reference-missing');

  return reasons.length === 0
    ? { admitted: true, record }
    : {
        admitted: false,
        omission: { evidenceId: evidence.id, reasons },
      };
};

export const projectComponents = (
  artifact: LabArtifact,
  validator: EvidenceRuntimeValidator,
): ProjectionResult => {
  if (!isTrustedEvidenceRuntimeValidator(validator)) {
    throw new TypeError(
      `validator must be created by loadEvidenceRuntimeValidator for ${EVIDENCE_SCHEMA_PATH}`,
    );
  }

  if (!artifactStatusAdmitted(artifact.status)) {
    const omissions = artifact.evidence.map((evidence) => ({
      evidenceId: evidence.id,
      reasons: ['artifact-status-not-admitted'] as const,
    }));
    return {
      projections: [],
      omissions,
      omittedEvidenceIds: omissions.map(({ evidenceId }) => evidenceId),
    };
  }

  const projections: ComponentProjection[] = [];
  const omissions: EvidenceOmission[] = [];
  for (const evidence of artifact.evidence) {
    const assessment = assessEvidence(evidence, validator);
    if (!assessment.admitted) {
      omissions.push(assessment.omission);
      continue;
    }
    const projection = projectOne(evidence, assessment.record);
    if (projection === undefined) {
      omissions.push({
        evidenceId: evidence.id,
        reasons: ['admission-missing'],
      });
    } else {
      projections.push(projection);
    }
  }
  return {
    projections,
    omissions,
    omittedEvidenceIds: omissions.map(({ evidenceId }) => evidenceId),
  };
};

export const planAttachment = async (
  port: SpecimenDbPort,
  specimenId: string,
  artifact: LabArtifact,
  validator: EvidenceRuntimeValidator,
): Promise<AttachmentPlan> => {
  if (specimenId.trim() === '') {
    throw new TypeError('specimenId must be supplied explicitly');
  }
  const specimen = await port.get(specimenId);
  if (specimen.id !== specimenId) {
    throw new Error('SpecimenDB returned a different specimen id');
  }
  const projected = projectComponents(artifact, validator);
  const blockers: AttachmentBlocker[] = ['specimendb-attach-unavailable'];
  if (projected.projections.length === 0) blockers.push('no-admissible-evidence');
  return {
    specimenId,
    artifactId: artifact.id,
    artifactStatus: artifact.status,
    evidenceSchemaPath: EVIDENCE_SCHEMA_PATH,
    ...projected,
    blockers,
    executable: false,
    blocker: 'specimendb-attach-unavailable',
  };
};

const hasOwn = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);

const decodeSpecimenId = (id: string): SpecimenId => {
  if (!isNonBlank(id)) {
    throw new TypeError('specimenId must be supplied explicitly');
  }
  if (LAB_AS_SPECIMEN_IDS.has(id.trim())) {
    throw new AttachRefused(['lab-as-specimen']);
  }
  return trustSpecimenId(id);
};

const refusalFromOmissions = (
  omissions: readonly EvidenceOmission[],
): AttachRefusalReason[] => {
  const reasons: AttachRefusalReason[] = [];
  for (const omission of omissions) {
    for (const reason of omission.reasons) {
      reasons.push(reason);
      if (
        reason === 'review-not-accepted' ||
        reason === 'review-metadata-missing' ||
        reason === 'artifact-status-not-admitted'
      ) {
        reasons.push('unverified-evidence');
      }
      if (reason === 'evidence-basis-mismatch') {
        reasons.push('source-class-relabeled');
      }
    }
  }
  return [...new Set(reasons)];
};

/**
 * Governed attach client. Calls only `port.attach` with a reviewed claim-bound
 * payload. The official stub never writes a store, never inserts a Specimen,
 * and never mutates locality or taxon.
 */
export const attachEvidence = async (
  port: SpecimenDbAttachPort,
  input: GovernedAttachInput,
  validator: EvidenceRuntimeValidator,
): Promise<readonly AttachResult[]> => {
  for (const key of FORBIDDEN_CALLER_LOCALITY_KEYS) {
    if (hasOwn(input, key)) {
      throw new AttachRefused(['invented-locality']);
    }
  }
  for (const key of FORBIDDEN_CALLER_TAXON_KEYS) {
    if (hasOwn(input, key)) {
      throw new AttachRefused(['invented-taxon']);
    }
  }
  for (const key of FORBIDDEN_CALLER_PROSE_KEYS) {
    if (hasOwn(input, key)) {
      throw new AttachRefused(['caller-component-prose']);
    }
  }

  const specimenId = decodeSpecimenId(input.specimenId);
  const specimen = await port.get(specimenId);
  if (specimen.id !== specimenId) {
    throw new Error('SpecimenDB returned a different specimen id');
  }

  const projected = projectComponents(input.artifact, validator);
  if (projected.omissions.length > 0) {
    const reasons = refusalFromOmissions(projected.omissions);
    throw new AttachRefused(
      reasons.length > 0 ? reasons : ['no-admissible-evidence'],
      projected.omissions[0]?.evidenceId,
    );
  }
  if (projected.projections.length === 0) {
    throw new AttachRefused(['no-admissible-evidence']);
  }

  for (const evidence of input.artifact.evidence) {
    if (!isLocalEvidenceRecordRef(evidence.recordRef)) {
      throw new AttachRefused(
        ['evidence-not-local-run'],
        evidence.id,
      );
    }
  }

  const receipts: AttachResult[] = [];
  for (const projection of projected.projections) {
    const payload: AttachPayload = {
      specimenId,
      component: projection.component,
      provenance: projection.provenance,
    };
    const receipt = await port.attach(payload);
    receipts.push({
      specimenId,
      evidenceId: payload.provenance.evidenceId,
      claimRefs: payload.provenance.claimRefs,
      localityMutated: false,
      taxonMutated: false,
      storeWrite: false,
      mode: 'stub',
    });
    void receipt;
  }
  return receipts;
};

export interface StubAttachPort extends SpecimenDbAttachPort {
  readonly calls: readonly AttachPayload[];
}

/**
 * In-memory Attach stub. No PGlite, no file store, no Specimen insert.
 */
export const createStubAttachPort = (
  specimens: readonly ExistingSpecimen[],
): StubAttachPort => {
  const calls: AttachPayload[] = [];
  return {
    get: async (specimenId) => {
      const found = specimens.find((specimen) => specimen.id === specimenId);
      if (found === undefined) {
        throw new Error(`Specimen not found: ${specimenId}`);
      }
      return found;
    },
    attach: async (payload) => {
      calls.push(payload);
      return {
        specimenId: payload.specimenId,
        evidenceId: payload.provenance.evidenceId,
        claimRefs: payload.provenance.claimRefs,
        localityMutated: false,
        taxonMutated: false,
        storeWrite: false,
        mode: 'stub',
      };
    },
    get calls() {
      return calls;
    },
  };
};
