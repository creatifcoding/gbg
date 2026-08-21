import type {
  CanonicalEvent,
  CareAdvice,
  CareEvent,
  CareSubject,
  Interpretation,
  Observation,
  Reminder,
  TaxonRecord,
} from '../contracts/types';
import { isUnknownSchema } from './log';

export interface ReadModel {
  readonly subjects: readonly CareSubject[];
  readonly observations: readonly Observation[];
  readonly interpretations: readonly Interpretation[];
  readonly careEvents: readonly CareEvent[];
  readonly advice: readonly CareAdvice[];
  readonly reminders: readonly Reminder[];
  readonly retainedUnknown: readonly CanonicalEvent[];
  readonly mediaDigests: readonly string[];
}

const unknownTaxon = (): Extract<TaxonRecord, { status: 'unknown' }> => ({
  status: 'unknown',
  reason: 'photo-does-not-establish-taxon',
});

export const emptyModel = (): ReadModel => ({
  subjects: [],
  observations: [],
  interpretations: [],
  careEvents: [],
  advice: [],
  reminders: [],
  retainedUnknown: [],
  mediaDigests: [],
});

export const foldEvents = (events: readonly CanonicalEvent[]): ReadModel => {
  const superseded = new Set(
    events.filter((e) => e.supersedesEventId).map((e) => e.supersedesEventId as string),
  );
  const subjects = new Map<string, CareSubject>();
  const observations: Observation[] = [];
  const interpretations: Interpretation[] = [];
  const careEvents: CareEvent[] = [];
  const advice: CareAdvice[] = [];
  const reminders = new Map<string, Reminder>();
  const retainedUnknown: CanonicalEvent[] = [];
  const mediaDigests: string[] = [];

  for (const event of events) {
    if (isUnknownSchema(event)) {
      retainedUnknown.push(event);
      continue;
    }
    if (superseded.has(event.eventId)) continue;
    switch (event.type) {
      case 'care.subject.created': {
        const id = String(event.payload.careSubjectId);
        subjects.set(id, {
          schemaVersion: 1,
          kind: 'CareSubject',
          careSubjectId: id,
          catalogSpecimen: false,
          specimenId: null,
          createdAt: event.occurredAt,
          housing: (event.payload.housing as CareSubject['housing']) ?? 'temporary-cup',
          taxon: unknownTaxon(),
          locality: null,
        });
        break;
      }
      case 'media.ingested': {
        const digest = String(event.payload.digest);
        mediaDigests.push(digest);
        break;
      }
      case 'observation.drafted': {
        observations.push({
          schemaVersion: 1,
          kind: 'Observation',
          observationId: String(event.payload.observationId),
          careSubjectId: event.careSubjectId ?? '',
          recordedAt: event.occurredAt,
          ...(typeof event.payload.mediaDigest === 'string'
            ? { mediaDigest: event.payload.mediaDigest }
            : {}),
          statements: (event.payload.statements as Observation['statements']) ?? [],
          taxon: unknownTaxon(),
          locality: null,
        });
        break;
      }
      case 'interpretation.drafted':
      case 'taxon.hypothesis.drafted': {
        interpretations.push({
          schemaVersion: 1,
          kind: 'Interpretation',
          interpretationId: String(event.payload.interpretationId ?? event.eventId),
          observationId: String(event.payload.observationId ?? ''),
          careSubjectId: event.careSubjectId ?? '',
          recordedAt: event.occurredAt,
          statements: (event.payload.statements as Interpretation['statements']) ?? [],
          ...(event.payload.taxonHypothesis
            ? {
                taxonHypothesis: event.payload.taxonHypothesis as Extract<
                  TaxonRecord,
                  { status: 'cited-guess' }
                >,
              }
            : {}),
        });
        break;
      }
      case 'care.event.logged': {
        careEvents.push({
          schemaVersion: 1,
          kind: 'CareEvent',
          careEventId: String(event.payload.careEventId ?? event.eventId),
          careSubjectId: event.careSubjectId ?? '',
          act: event.payload.act as CareEvent['act'],
          confirmed: true,
          occurredAt: event.occurredAt,
          ...(typeof event.payload.note === 'string' ? { note: event.payload.note } : {}),
          ...(typeof event.payload.fromRecommendationId === 'string'
            ? { fromRecommendationId: event.payload.fromRecommendationId }
            : {}),
        });
        break;
      }
      case 'advice.offered': {
        advice.push(event.payload.advice as CareAdvice);
        break;
      }
      case 'reminder.set': {
        const reminderId = String(event.payload.reminderId);
        reminders.set(reminderId, {
          reminderId,
          careSubjectId: event.careSubjectId ?? '',
          dueAt: String(event.payload.dueAt),
          text: String(event.payload.text),
          cancelled: false,
        });
        break;
      }
      case 'reminder.cancelled': {
        const reminderId = String(event.payload.reminderId);
        const current = reminders.get(reminderId);
        if (current) reminders.set(reminderId, { ...current, cancelled: true });
        break;
      }
      case 'note.appended':
      case 'correction.issued':
        break;
      default:
        retainedUnknown.push(event);
    }
  }

  return {
    subjects: [...subjects.values()],
    observations,
    interpretations,
    careEvents,
    advice,
    reminders: [...reminders.values()],
    retainedUnknown,
    mediaDigests,
  };
};

export const subjectNeverSpecimen = (model: ReadModel): boolean =>
  model.subjects.every((s) => s.catalogSpecimen === false && s.specimenId === null);

export const photoNeverWroteLocality = (model: ReadModel): boolean =>
  model.observations.every((o) => o.locality === null) &&
  model.subjects.every((s) => s.locality === null);

export const photoNeverConfirmedTaxon = (model: ReadModel): boolean =>
  model.observations.every((o) => o.taxon.status === 'unknown') &&
  model.subjects.every((s) => s.taxon.status !== 'confirmed') &&
  model.interpretations.every((i) => !i.taxonHypothesis || i.taxonHypothesis.confirmed === false);

export const recommendationIsNotFed = (model: ReadModel): boolean =>
  !model.careEvents.some((e) => e.act === 'eaten' && e.fromRecommendationId && e.confirmed !== true);
