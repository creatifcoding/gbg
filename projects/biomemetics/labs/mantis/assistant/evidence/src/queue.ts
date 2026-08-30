import { createHash } from 'node:crypto';

import type { AdversarialReviewer, Curator, GovernedReviewer } from './actors.ts';
import { parseIntake, type IntakeRefusal } from './intake.ts';
import {
  acceptPending,
  flagPending,
  isTransitionRefusal,
  rejectPending,
  retainPendingInconclusive,
  submitValidated,
  validateDraft,
  type AcceptedPacket,
  type Clock,
  type DraftPacket,
  type EvidencePacket,
  type PacketId,
  type PendingReviewPacket,
  type QueueId,
  type RejectedPacket,
  type RetainedInconclusivePacket,
  type TransitionRefusal,
  type ValidatedPacket,
} from './packet.ts';
import {
  isTrustedEvidenceSchemaGate,
  loadEvidenceSchemaGate,
  type EvidenceSchemaGate,
} from './schema-gate.ts';

export type PreviewRefusalReason =
  | 'packet-not-found'
  | 'packet-not-accepted'
  | 'packet-rejected'
  | 'packet-retained-inconclusive'
  | 'packet-pending-review'
  | 'packet-draft'
  | 'packet-validated-only'
  | 'claim-unbound'
  | 'digest-missing'
  | 'admission-text-missing'
  | 'source-class-not-projectable'
  | 'result-does-not-support'
  | 'invented-target'
  | 'lab-as-specimen'
  | 'invented-locality'
  | 'invented-taxon'
  | 'caller-component-prose';

export type PreviewRefusal = {
  readonly ok: false;
  readonly reasons: readonly PreviewRefusalReason[];
};

export type EvidenceQueue = {
  readonly queueId: QueueId;
  readonly enqueueDraft: (
    actor: Curator,
    input: unknown,
  ) => { readonly ok: true; readonly packet: DraftPacket } | IntakeRefusal | TransitionRefusal;
  readonly validate: (
    packetId: PacketId,
  ) => { readonly ok: true; readonly packet: ValidatedPacket } | TransitionRefusal;
  readonly submit: (
    packetId: PacketId,
    actor: Curator,
  ) => { readonly ok: true; readonly packet: PendingReviewPacket } | TransitionRefusal;
  readonly flagDefect: (
    packetId: PacketId,
    actor: AdversarialReviewer,
    notes: string,
  ) => { readonly ok: true; readonly packet: PendingReviewPacket } | TransitionRefusal;
  readonly accept: (
    packetId: PacketId,
    actor: GovernedReviewer,
  ) => { readonly ok: true; readonly packet: AcceptedPacket } | TransitionRefusal;
  readonly reject: (
    packetId: PacketId,
    actor: GovernedReviewer,
  ) => { readonly ok: true; readonly packet: RejectedPacket } | TransitionRefusal;
  readonly retainInconclusive: (
    packetId: PacketId,
    actor: GovernedReviewer,
  ) =>
    | { readonly ok: true; readonly packet: RetainedInconclusivePacket }
    | TransitionRefusal;
  readonly get: (packetId: PacketId) => EvidencePacket | undefined;
  readonly requireAccepted: (
    packetId: PacketId,
  ) => { readonly ok: true; readonly packet: AcceptedPacket } | PreviewRefusal;
  readonly list: (state?: EvidencePacket['state']) => readonly EvidencePacket[];
};

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const EVIDENCE_ID = /^[a-z][a-z0-9.-]*$/;

const asPacketId = (evidenceId: string): PacketId => evidenceId as PacketId;

const asQueueId = (queueId: string): QueueId => {
  if (queueId.trim() === '') {
    throw new TypeError('queue id is blank');
  }
  return queueId as QueueId;
};

const digestOf = (record: unknown): string =>
  createHash('sha256').update(JSON.stringify(record)).digest('hex');

const stripSelfAdmission = (record: unknown): unknown => {
  if (!isObject(record)) return record;
  const clone: JsonObject = { ...record, review: { status: 'pending' } };
  if (!Array.isArray(record.admissions)) return clone;
  clone.admissions = record.admissions.map((admission) => {
    if (!isObject(admission)) return admission;
    const { projectionBinding: _binding, ...rest } = admission;
    return rest;
  });
  return clone;
};

const evidenceIdOf = (record: unknown): string | undefined => {
  if (!isObject(record) || typeof record.evidenceId !== 'string') return undefined;
  if (!EVIDENCE_ID.test(record.evidenceId)) return undefined;
  return record.evidenceId;
};

const missing = (packetId: PacketId): TransitionRefusal => ({
  ok: false,
  packetId,
  reasons: ['wrong-state'],
});

const isoClock: Clock = { now: () => new Date().toISOString() };

export function createEvidenceQueue(options: {
  readonly queueId: string;
  readonly gate?: EvidenceSchemaGate;
  readonly clock?: Clock;
}): EvidenceQueue {
  const queueId = asQueueId(options.queueId);
  const gate = options.gate ?? loadEvidenceSchemaGate();
  if (!isTrustedEvidenceSchemaGate(gate)) {
    throw new TypeError('evidence schema gate is not trusted');
  }
  const clock = options.clock ?? isoClock;
  const packets = new Map<string, EvidencePacket>();
  const intakeDigests = new Map<string, string>();

  const put = (packet: EvidencePacket): void => {
    packets.set(packet.packetId, packet);
  };

  return {
    queueId,
    enqueueDraft: (actor, input) => {
      const parsed = parseIntake(input);
      if (parsed.ok === false) return parsed;
      const record = stripSelfAdmission(parsed.record);
      const evidenceId = evidenceIdOf(record);
      if (evidenceId === undefined) {
        return { ok: false, reasons: ['evidence-id-missing'] };
      }
      const packetId = asPacketId(evidenceId);
      const digest = digestOf(record);
      const existing = packets.get(packetId);
      if (existing !== undefined) {
        if (intakeDigests.get(packetId) === digest) {
          return existing.state === 'draft'
            ? { ok: true, packet: existing }
            : { ok: false, packetId, reasons: ['wrong-state'] };
        }
        return { ok: false, packetId, reasons: ['record-digest-conflict'] };
      }
      const packet: DraftPacket = {
        packetId,
        evidenceId,
        origin: parsed.origin,
        author: actor,
        state: 'draft',
        record,
      };
      intakeDigests.set(packetId, digest);
      put(packet);
      return { ok: true, packet };
    },
    validate: (packetId) => {
      const packet = packets.get(packetId);
      if (packet === undefined) return missing(packetId);
      if (packet.state === 'validated') return { ok: true, packet };
      if (packet.state !== 'draft') {
        return { ok: false, packetId, reasons: ['wrong-state'] };
      }
      const next = validateDraft(packet, gate);
      if (isTransitionRefusal(next)) return next;
      put(next);
      return { ok: true, packet: next };
    },
    submit: (packetId, actor) => {
      const packet = packets.get(packetId);
      if (packet === undefined) return missing(packetId);
      if (packet.state === 'pending-review') return { ok: true, packet };
      if (packet.state !== 'validated') {
        return { ok: false, packetId, reasons: ['wrong-state'] };
      }
      const next = submitValidated(packet, actor);
      if (isTransitionRefusal(next)) return next;
      put(next);
      return { ok: true, packet: next };
    },
    flagDefect: (packetId, actor, notes) => {
      const packet = packets.get(packetId);
      if (packet === undefined) return missing(packetId);
      if (packet.state !== 'pending-review') {
        return { ok: false, packetId, reasons: ['wrong-state'] };
      }
      const next = flagPending(packet, actor, notes);
      if (isTransitionRefusal(next)) return next;
      put(next);
      return { ok: true, packet: next };
    },
    accept: (packetId, actor) => {
      const packet = packets.get(packetId);
      if (packet === undefined) return missing(packetId);
      if (packet.state === 'accepted') {
        if (packet.reviewer.actorId === actor.actorId) {
          return { ok: true, packet };
        }
        return { ok: false, packetId, reasons: ['wrong-state'] };
      }
      if (packet.state !== 'pending-review') {
        return { ok: false, packetId, reasons: ['wrong-state'] };
      }
      const next = acceptPending(packet, actor, clock);
      if (isTransitionRefusal(next)) return next;
      put(next);
      return { ok: true, packet: next };
    },
    reject: (packetId, actor) => {
      const packet = packets.get(packetId);
      if (packet === undefined) return missing(packetId);
      if (packet.state === 'rejected') {
        if (packet.reviewer.actorId === actor.actorId) {
          return { ok: true, packet };
        }
        return { ok: false, packetId, reasons: ['wrong-state'] };
      }
      if (packet.state !== 'pending-review') {
        return { ok: false, packetId, reasons: ['wrong-state'] };
      }
      const next = rejectPending(packet, actor, clock);
      if (isTransitionRefusal(next)) return next;
      put(next);
      return { ok: true, packet: next };
    },
    retainInconclusive: (packetId, actor) => {
      const packet = packets.get(packetId);
      if (packet === undefined) return missing(packetId);
      if (packet.state === 'retained-inconclusive') {
        if (packet.reviewer.actorId === actor.actorId) {
          return { ok: true, packet };
        }
        return { ok: false, packetId, reasons: ['wrong-state'] };
      }
      if (packet.state !== 'pending-review') {
        return { ok: false, packetId, reasons: ['wrong-state'] };
      }
      const next = retainPendingInconclusive(packet, actor);
      if (isTransitionRefusal(next)) return next;
      put(next);
      return { ok: true, packet: next };
    },
    get: (packetId) => packets.get(packetId),
    requireAccepted: (packetId) => {
      const packet = packets.get(packetId);
      if (packet === undefined) {
        return { ok: false, reasons: ['packet-not-found'] };
      }
      switch (packet.state) {
        case 'accepted':
          return { ok: true, packet };
        case 'draft':
          return { ok: false, reasons: ['packet-draft'] };
        case 'validated':
          return { ok: false, reasons: ['packet-validated-only'] };
        case 'pending-review':
          return { ok: false, reasons: ['packet-pending-review'] };
        case 'rejected':
          return { ok: false, reasons: ['packet-rejected'] };
        case 'retained-inconclusive':
          return { ok: false, reasons: ['packet-retained-inconclusive'] };
        default: {
          const _exhaustive: never = packet;
          return _exhaustive;
        }
      }
    },
    list: (state) => {
      const all = [...packets.values()];
      return state === undefined ? all : all.filter((packet) => packet.state === state);
    },
  };
}

export type { EvidencePacket, PacketId, QueueId } from './packet.ts';
