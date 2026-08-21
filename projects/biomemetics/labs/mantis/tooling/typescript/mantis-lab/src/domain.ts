/** Shared epistemic vocabulary for workspace claims and parameters. */
export type EvidenceBasis =
  | 'observed'
  | 'measured'
  | 'calculated'
  | 'simulated'
  | 'ref'
  | 'target'
  | 'typ'
  | 'unverified';

export type EvidenceKind =
  | 'observation'
  | 'structure'
  | 'mechanism'
  | 'function'
  | 'analog';

/** Artifact review state is deliberately separate from epistemic basis. */
export type ArtifactStatus =
  | 'draft'
  | 'review'
  | 'accepted'
  | 'verified'
  | 'rejected'
  | 'superseded';

export type EvidenceSourceClass =
  | 'observed'
  | 'measured'
  | 'calculated'
  | 'simulated'
  | 'external-source';

export interface EvidenceRecordInput {
  readonly ref: string;
  readonly role: string;
  readonly sha256?: string;
}

export interface EvidenceRecordObservation {
  readonly statement: string;
  readonly status: 'observed' | 'interpreted' | 'unverified';
  readonly sourceRef?: string;
}

export interface EvidenceRecordArtifact {
  readonly path?: string;
  readonly uri?: string;
  /** Required by contracts/evidence.schema.json for both path and uri artifacts. */
  readonly sha256?: string;
  readonly mediaType: string;
  readonly description?: string;
}

export interface EvidenceRecordAdmission {
  readonly claimRef: string;
  readonly kind: EvidenceKind;
  readonly text: string;
  readonly target?: string;
  readonly projectionBinding?: {
    readonly evidenceId: string;
    readonly claimRef: string;
    readonly admissionText: string;
    readonly reviewStatus: 'accepted';
  };
}

/**
 * Fields consumed by the bridge after its package-owned runtime gate validates
 * the complete record against the pinned contracts/evidence.schema.json.
 * This interface is not a replacement schema.
 */
export interface ValidatedEvidenceRecord {
  readonly schemaVersion: '1.0.0';
  readonly kind: 'EvidenceRecord';
  readonly evidenceId: string;
  readonly workspaceRef: 'biomemetics.mantis';
  readonly claimRefs: readonly string[];
  readonly sourceClass: EvidenceSourceClass;
  readonly recordedAt: string;
  readonly producer: Readonly<Record<string, unknown>>;
  readonly environment: Readonly<Record<string, unknown>>;
  readonly method: Readonly<Record<string, unknown>>;
  readonly inputs?: readonly EvidenceRecordInput[];
  readonly observations?: readonly EvidenceRecordObservation[];
  readonly measurements?: readonly Readonly<Record<string, unknown>>[];
  readonly artifacts?: readonly EvidenceRecordArtifact[];
  readonly admissions?: readonly EvidenceRecordAdmission[];
  readonly result: {
    readonly disposition: 'supports' | 'contradicts' | 'inconclusive' | 'not-run';
    readonly summary: string;
    readonly limitations: readonly string[];
  };
  readonly review: {
    readonly status: 'pending' | 'accepted' | 'rejected' | 'superseded';
    readonly reviewer?: string;
    readonly reviewedAt?: string;
    readonly notes?: string;
  };
}

/** Projection intent plus the unknown record that must pass runtime validation. */
export interface LabEvidence {
  readonly id: string;
  readonly basis: EvidenceBasis;
  /** Stable path or URI of the evidence record. */
  readonly recordRef: string;
  /** Claim this projection asserts; it must occur in record.claimRefs. */
  readonly claimRef: string;
  /** Never consumed until the package-owned evidence contract gate accepts it. */
  readonly record: unknown;
}

export interface LabArtifactFile {
  readonly path: string;
  readonly sha256?: string;
  readonly role: 'source' | 'generated' | 'evidence' | 'release';
}

export interface LabArtifact {
  readonly id: string;
  readonly project: string;
  readonly kind: string;
  readonly status: ArtifactStatus;
  readonly files: readonly LabArtifactFile[];
  readonly evidence: readonly LabEvidence[];
}

export const artifactStatusAdmitted = (status: ArtifactStatus): boolean =>
  status === 'accepted' || status === 'verified';

export const attachmentEligible = (basis: EvidenceBasis): boolean =>
  basis === 'observed' || basis === 'measured';
