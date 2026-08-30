import type { CareAct, CareHousing, MediaBlob } from '../contracts/types';
import { randomId, sha256Bytes } from './crypto';
import type { KeeperLog } from './log';
import { redactExactLocation, stripLocationMetadata } from './privacy';

export interface IngestMediaInput {
  readonly bytes: Uint8Array;
  readonly mediaType: string;
  readonly careSubjectId: string;
  readonly idempotencyKey: string;
  readonly occurredAt: string;
  readonly origin: 'capture' | 'import';
}

export const ingestMedia = async (
  log: KeeperLog,
  input: IngestMediaInput,
): Promise<{ blob: MediaBlob; duplicate: boolean }> => {
  const stripped = stripLocationMetadata(input.bytes, input.mediaType);
  const digest = await sha256Bytes(stripped);
  const blob: MediaBlob = {
    digest,
    mediaType: input.mediaType,
    byteLength: stripped.byteLength,
    exifStripped: true,
    gpsStripped: true,
    localityWritten: false,
    bytes: stripped,
  };
  const stored = await log.putBlob(blob);
  const { duplicate } = await log.append({
    type: 'media.ingested',
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.occurredAt,
    careSubjectId: input.careSubjectId,
    payload: {
      digest: stored.digest,
      mediaType: stored.mediaType,
      byteLength: stored.byteLength,
      origin: input.origin,
      exifStripped: true,
      gpsStripped: true,
      localityWritten: false,
      taxonEstablished: false,
    },
  });
  return { blob: stored, duplicate };
};

export const createCareSubject = async (
  log: KeeperLog,
  input: {
    readonly housing: CareHousing;
    readonly occurredAt: string;
    readonly idempotencyKey: string;
  },
) => {
  const careSubjectId = randomId('care');
  const { event, duplicate } = await log.append({
    type: 'care.subject.created',
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.occurredAt,
    careSubjectId,
    payload: {
      careSubjectId,
      catalogSpecimen: false,
      specimenId: null,
      housing: input.housing,
      taxon: { status: 'unknown', reason: 'photo-does-not-establish-taxon' },
      locality: null,
    },
  });
  return { careSubjectId: event.careSubjectId ?? careSubjectId, duplicate, event };
};

export const draftObservation = async (
  log: KeeperLog,
  input: {
    readonly careSubjectId: string;
    readonly statements: readonly { text: string; status: 'observed' | 'unverified'; sourceRef?: string }[];
    readonly mediaDigest?: string;
    readonly note?: string;
    readonly occurredAt: string;
    readonly idempotencyKey: string;
  },
) => {
  const observationId = randomId('obs');
  const statements = input.statements.map((s) => ({
    ...s,
    text: redactExactLocation(s.text),
  }));
  const { event, duplicate } = await log.append({
    type: 'observation.drafted',
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.occurredAt,
    careSubjectId: input.careSubjectId,
    payload: {
      observationId,
      statements,
      taxon: { status: 'unknown', reason: 'photo-does-not-establish-taxon' },
      locality: null,
      ...(input.mediaDigest ? { mediaDigest: input.mediaDigest } : {}),
      ...(input.note ? { note: redactExactLocation(input.note) } : {}),
    },
  });
  return { observationId: String(event.payload.observationId ?? observationId), duplicate, event };
};

export const draftInterpretation = async (
  log: KeeperLog,
  input: {
    readonly careSubjectId: string;
    readonly observationId: string;
    readonly statements: readonly { text: string; status: 'interpreted' | 'unverified' }[];
    readonly taxonHypothesis?: {
      status: 'cited-guess';
      name: string;
      rank?: string;
      confidence: number;
      citation: string;
      confirmed: false;
    };
    readonly occurredAt: string;
    readonly idempotencyKey: string;
  },
) => {
  const interpretationId = randomId('int');
  return log.append({
    type: 'interpretation.drafted',
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.occurredAt,
    careSubjectId: input.careSubjectId,
    payload: {
      interpretationId,
      observationId: input.observationId,
      statements: input.statements.map((s) => ({ ...s, text: redactExactLocation(s.text) })),
      ...(input.taxonHypothesis ? { taxonHypothesis: { ...input.taxonHypothesis, confirmed: false } } : {}),
    },
  });
};

export const logCareEvent = async (
  log: KeeperLog,
  input: {
    readonly careSubjectId: string;
    readonly act: CareAct;
    readonly occurredAt: string;
    readonly idempotencyKey: string;
    readonly note?: string;
    readonly fromRecommendationId?: string;
  },
) => {
  const careEventId = randomId('feed');
  return log.append({
    type: 'care.event.logged',
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.occurredAt,
    careSubjectId: input.careSubjectId,
    payload: {
      careEventId,
      act: input.act,
      confirmed: true,
      ...(input.note ? { note: redactExactLocation(input.note) } : {}),
      ...(input.fromRecommendationId ? { fromRecommendationId: input.fromRecommendationId } : {}),
    },
  });
};

export const setReminder = async (
  log: KeeperLog,
  input: {
    readonly careSubjectId: string;
    readonly dueAt: string;
    readonly text: string;
    readonly occurredAt: string;
    readonly idempotencyKey: string;
  },
) => {
  const reminderId = randomId('rem');
  return log.append({
    type: 'reminder.set',
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.occurredAt,
    careSubjectId: input.careSubjectId,
    payload: {
      reminderId,
      dueAt: input.dueAt,
      text: redactExactLocation(input.text),
    },
  });
};

export const offerAdvice = async (
  log: KeeperLog,
  input: {
    readonly careSubjectId: string;
    readonly occurredAt: string;
    readonly idempotencyKey: string;
    readonly advice: Record<string, unknown>;
  },
) =>
  log.append({
    type: 'advice.offered',
    idempotencyKey: input.idempotencyKey,
    occurredAt: input.occurredAt,
    careSubjectId: input.careSubjectId,
    payload: { advice: input.advice, becomesCareEvent: false },
  });
