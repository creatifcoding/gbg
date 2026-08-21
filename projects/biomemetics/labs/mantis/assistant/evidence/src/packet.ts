import type { AdversarialReviewer, Curator, GovernedReviewer } from './actors.ts';
import type { AdmissibleOrigin } from './intake.ts';
import {
  isTrustedEvidenceSchemaGate,
  type EvidenceAdmission,
  type EvidenceSchemaGate,
  type ValidatedEvidenceRecord,
} from './schema-gate.ts';

export type QueueId = string & { readonly __brand: 'QueueId' };
export type PacketId = string & { readonly __brand: 'PacketId' };

type PacketBase = {
  readonly packetId: PacketId;
  readonly evidenceId: string;
  readonly origin: AdmissibleOrigin;
  readonly author: Curator;
};

export type DefectFlag = {
  readonly flaggedBy: AdversarialReviewer;
  readonly notes: string;
};

export type DraftPacket = PacketBase & {
  readonly state: 'draft';
  readonly record: unknown;
};

export type ValidatedPacket = PacketBase & {
  readonly state: 'validated';
  readonly record: ValidatedEvidenceRecord;
};

export type PendingReviewPacket = PacketBase & {
  readonly state: 'pending-review';
  readonly record: ValidatedEvidenceRecord;
  readonly defects: readonly DefectFlag[];
};

export type AcceptedPacket = PacketBase & {
  readonly state: 'accepted';
  readonly record: ValidatedEvidenceRecord & {
    readonly review: {
      readonly status: 'accepted';
      readonly reviewer: string;
      readonly reviewedAt: string;
    };
  };
  readonly reviewer: GovernedReviewer;
};

export type RejectedPacket = PacketBase & {
  readonly state: 'rejected';
  readonly record: ValidatedEvidenceRecord & {
    readonly review: {
      readonly status: 'rejected';
      readonly reviewer: string;
      readonly reviewedAt: string;
    };
  };
  readonly reviewer: GovernedReviewer;
};

export type RetainedInconclusivePacket = PacketBase & {
  readonly state: 'retained-inconclusive';
  readonly record: ValidatedEvidenceRecord;
  readonly reviewer: GovernedReviewer;
};

export type EvidencePacket =
  | DraftPacket
  | ValidatedPacket
  | PendingReviewPacket
  | AcceptedPacket
  | RejectedPacket
  | RetainedInconclusivePacket;

export type TransitionRefusalReason =
  | 'wrong-state'
  | 'schema-invalid'
  | 'claim-unbound'
  | 'digest-missing'
  | 'self-admission'
  | 'author-cannot-accept'
  | 'adversarial-cannot-accept'
  | 'adversarial-cannot-edit'
  | 'reviewer-is-author'
  | 'curator-cannot-accept'
  | 'disposition-not-supportable'
  | 'source-class-not-projectable'
  | 'admission-missing'
  | 'admission-ambiguous'
  | 'incoming-review-not-pending'
  | 'record-digest-conflict'
  | 'evidence-id-missing';

export type TransitionRefusal = {
  readonly ok: false;
  readonly packetId: PacketId;
  readonly reasons: readonly TransitionRefusalReason[];
};

export type Clock = { readonly now: () => string };

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isTransitionRefusal = (value: unknown): value is TransitionRefusal =>
  isObject(value) &&
  value.ok === false &&
  typeof value.packetId === 'string' &&
  Array.isArray(value.reasons);

const refuse = (
  packetId: PacketId,
  reasons: readonly TransitionRefusalReason[],
): TransitionRefusal => ({ ok: false, packetId, reasons });

const digestMissing = (record: unknown): boolean => {
  if (!isObject(record) || !Array.isArray(record.artifacts)) return false;
  return record.artifacts.some((artifact) => {
    if (!isObject(artifact)) return false;
    const hasLocator =
      typeof artifact.path === 'string' || typeof artifact.uri === 'string';
    return hasLocator && typeof artifact.sha256 !== 'string';
  });
};

const unboundClaims = (record: unknown): boolean => {
  if (!isObject(record)) return false;
  const claimRefs = Array.isArray(record.claimRefs) ? record.claimRefs : [];
  const admissions = Array.isArray(record.admissions) ? record.admissions : [];
  return admissions.some(
    (admission) => isObject(admission) && !claimRefs.includes(admission.claimRef),
  );
};

const incomingReviewBlocks = (record: unknown): TransitionRefusalReason | undefined => {
  if (!isObject(record) || !isObject(record.review)) return undefined;
  if (record.review.status !== 'pending') return 'incoming-review-not-pending';
  const admissions = Array.isArray(record.admissions) ? record.admissions : [];
  const bound = admissions.some(
    (admission) => isObject(admission) && admission.projectionBinding !== undefined,
  );
  if (bound) return 'self-admission';
  return undefined;
};

const projectableSource = (sourceClass: string): boolean =>
  sourceClass === 'observed' || sourceClass === 'measured';

const stampBindings = (
  record: ValidatedEvidenceRecord,
): readonly EvidenceAdmission[] =>
  (record.admissions ?? []).map((admission) => {
    const binding = {
      evidenceId: record.evidenceId,
      claimRef: admission.claimRef,
      admissionText: admission.text,
      reviewStatus: 'accepted' as const,
    };
    return admission.target === undefined
      ? {
          claimRef: admission.claimRef,
          kind: admission.kind,
          text: admission.text,
          projectionBinding: binding,
        }
      : {
          claimRef: admission.claimRef,
          kind: admission.kind,
          text: admission.text,
          target: admission.target,
          projectionBinding: binding,
        };
  });

export function validateDraft(
  packet: DraftPacket,
  gate: EvidenceSchemaGate,
): ValidatedPacket | TransitionRefusal {
  if (!isTrustedEvidenceSchemaGate(gate)) {
    throw new TypeError('evidence schema gate is not trusted');
  }
  const reasons: TransitionRefusalReason[] = [];
  const reviewBlock = incomingReviewBlocks(packet.record);
  if (reviewBlock !== undefined) reasons.push(reviewBlock);
  if (digestMissing(packet.record)) reasons.push('digest-missing');
  if (unboundClaims(packet.record)) reasons.push('claim-unbound');
  const schema = gate.validate(packet.record);
  if (!schema.valid) {
    reasons.push('schema-invalid');
    return refuse(packet.packetId, reasons);
  }
  if (reasons.length > 0) return refuse(packet.packetId, reasons);
  return {
    packetId: packet.packetId,
    evidenceId: packet.evidenceId,
    origin: packet.origin,
    author: packet.author,
    state: 'validated',
    record: schema.value,
  };
}

const actorRole = (actor: { readonly role: string }): string => actor.role;

export function submitValidated(
  packet: ValidatedPacket,
  actor: Curator,
): PendingReviewPacket | TransitionRefusal {
  if (actor.actorId !== packet.author.actorId) {
    return refuse(packet.packetId, ['wrong-state']);
  }
  return {
    packetId: packet.packetId,
    evidenceId: packet.evidenceId,
    origin: packet.origin,
    author: packet.author,
    state: 'pending-review',
    record: packet.record,
    defects: [],
  };
}

export function flagPending(
  packet: PendingReviewPacket,
  actor: AdversarialReviewer,
  notes: string,
): PendingReviewPacket | TransitionRefusal {
  if (actorRole(actor) !== 'adversarial-reviewer') {
    return refuse(packet.packetId, ['adversarial-cannot-edit']);
  }
  return {
    ...packet,
    defects: [...packet.defects, { flaggedBy: actor, notes }],
  };
}

const independence = (
  packet: PendingReviewPacket,
  reviewer: GovernedReviewer,
): TransitionRefusal | undefined => {
  const role = actorRole(reviewer);
  if (role === 'adversarial-reviewer') {
    return refuse(packet.packetId, ['adversarial-cannot-accept']);
  }
  if (role !== 'governed-reviewer') {
    return refuse(packet.packetId, ['curator-cannot-accept']);
  }
  if (reviewer.actorId === packet.author.actorId) {
    return refuse(packet.packetId, ['reviewer-is-author']);
  }
  return undefined;
};

export function acceptPending(
  packet: PendingReviewPacket,
  reviewer: GovernedReviewer,
  clock: Clock,
): AcceptedPacket | TransitionRefusal {
  const blocked = independence(packet, reviewer);
  if (blocked !== undefined) return blocked;
  if (!projectableSource(packet.record.sourceClass)) {
    return refuse(packet.packetId, ['source-class-not-projectable']);
  }
  if (packet.record.result.disposition !== 'supports') {
    return refuse(packet.packetId, ['disposition-not-supportable']);
  }
  const admissions = packet.record.admissions ?? [];
  if (admissions.length === 0) {
    return refuse(packet.packetId, ['admission-missing']);
  }
  const byClaim = new Map<string, number>();
  for (const admission of admissions) {
    byClaim.set(admission.claimRef, (byClaim.get(admission.claimRef) ?? 0) + 1);
  }
  for (const count of byClaim.values()) {
    if (count !== 1) return refuse(packet.packetId, ['admission-ambiguous']);
  }
  const reviewedAt = clock.now();
  return {
    packetId: packet.packetId,
    evidenceId: packet.evidenceId,
    origin: packet.origin,
    author: packet.author,
    state: 'accepted',
    reviewer,
    record: {
      ...packet.record,
      admissions: stampBindings(packet.record),
      review: {
        status: 'accepted',
        reviewer: reviewer.actorId,
        reviewedAt,
      },
    },
  };
}

export function rejectPending(
  packet: PendingReviewPacket,
  reviewer: GovernedReviewer,
  clock: Clock,
): RejectedPacket | TransitionRefusal {
  const blocked = independence(packet, reviewer);
  if (blocked !== undefined) return blocked;
  return {
    packetId: packet.packetId,
    evidenceId: packet.evidenceId,
    origin: packet.origin,
    author: packet.author,
    state: 'rejected',
    reviewer,
    record: {
      ...packet.record,
      review: {
        status: 'rejected',
        reviewer: reviewer.actorId,
        reviewedAt: clock.now(),
      },
    },
  };
}

export function retainPendingInconclusive(
  packet: PendingReviewPacket,
  reviewer: GovernedReviewer,
): RetainedInconclusivePacket | TransitionRefusal {
  const blocked = independence(packet, reviewer);
  if (blocked !== undefined) return blocked;
  if (packet.record.result.disposition !== 'inconclusive') {
    return refuse(packet.packetId, ['disposition-not-supportable']);
  }
  return {
    packetId: packet.packetId,
    evidenceId: packet.evidenceId,
    origin: packet.origin,
    author: packet.author,
    state: 'retained-inconclusive',
    reviewer,
    record: packet.record,
  };
}
