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
 * Read-only seam for @tmnl/specimendb. The current package provides
 * get/list/intake but no governed append-components API, so no write method is
 * representable here.
 */
export interface SpecimenDbPort {
  readonly get: (specimenId: string) => Promise<ExistingSpecimen>;
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
