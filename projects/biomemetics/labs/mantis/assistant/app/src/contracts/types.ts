/**
 * A1 local fixtures for A0 record types.
 *
 * When `assistant/contracts/**` exists (A0 write-set), `a0.ts` prefers those
 * schemas. This file is the local stand-in so A1 can ship without rewriting
 * A0. Shapes follow assistant/README.md and #50/#51. They are not SpecimenDB
 * types and must never mint a catalog Specimen.
 */

export const ASSISTANT_EVENT_SCHEMA_VERSION = 1 as const;
export const EXPORT_KIND = 'MantisAssistantOfflineExport' as const;
export const WORKSPACE_REF = 'biomemetics.mantis' as const;

export const FORBIDDEN_LOCALITY_KEYS = [
  'locality',
  'gps',
  'geo',
  'latitude',
  'longitude',
  'altitudeMeters',
  'GPSLatitude',
  'GPSLongitude',
  'GPSAltitude',
  'exactAddress',
  'streetAddress',
  'homeAddress',
] as const;

export type EpistemicKind =
  | 'observed'
  | 'interpreted'
  | 'recommended'
  | 'confirmed'
  | 'unknown'
  | 'assistant-memory';

export type CareHousing = 'temporary-cup' | 'temporary-other' | 'established' | 'unknown';

export type FeedingAct = 'offered' | 'eaten' | 'refused' | 'removed';

export type CareAct = FeedingAct | 'misted' | 'cleaned' | 'noted';

export type TaxonRecord =
  | { readonly status: 'unknown'; readonly reason: 'photo-does-not-establish-taxon' | 'no-reviewed-identification' }
  | {
      readonly status: 'cited-guess';
      readonly name: string;
      readonly rank?: string;
      readonly confidence: number;
      readonly citation: string;
      readonly confirmed: false;
    }
  | { readonly status: 'confirmed'; readonly name: string; readonly citation: string };

/** Local care identity. Never a Specimen. Photo does not fill taxon or locality. */
export interface CareSubject {
  readonly schemaVersion: typeof ASSISTANT_EVENT_SCHEMA_VERSION;
  readonly kind: 'CareSubject';
  readonly careSubjectId: string;
  readonly catalogSpecimen: false;
  readonly specimenId: null;
  readonly createdAt: string;
  readonly housing: CareHousing;
  readonly taxon: TaxonRecord;
  readonly locality: null;
}

export interface ObservationStatement {
  readonly text: string;
  readonly status: 'observed' | 'unverified';
  readonly sourceRef?: string;
}

export interface Observation {
  readonly schemaVersion: typeof ASSISTANT_EVENT_SCHEMA_VERSION;
  readonly kind: 'Observation';
  readonly observationId: string;
  readonly careSubjectId: string;
  readonly recordedAt: string;
  readonly mediaDigest?: string;
  readonly statements: readonly ObservationStatement[];
  readonly taxon: Extract<TaxonRecord, { status: 'unknown' }>;
  readonly locality: null;
}

export interface Interpretation {
  readonly schemaVersion: typeof ASSISTANT_EVENT_SCHEMA_VERSION;
  readonly kind: 'Interpretation';
  readonly interpretationId: string;
  readonly observationId: string;
  readonly careSubjectId: string;
  readonly recordedAt: string;
  readonly statements: readonly { readonly text: string; readonly status: 'interpreted' | 'unverified' }[];
  readonly taxonHypothesis?: Extract<TaxonRecord, { status: 'cited-guess' }>;
}

export interface CareEvent {
  readonly schemaVersion: typeof ASSISTANT_EVENT_SCHEMA_VERSION;
  readonly kind: 'CareEvent';
  readonly careEventId: string;
  readonly careSubjectId: string;
  readonly act: CareAct;
  readonly confirmed: true;
  readonly occurredAt: string;
  readonly note?: string;
  readonly fromRecommendationId?: string;
}

export interface CareAdviceSource {
  readonly sourceId: string;
  readonly title: string;
  readonly citation: string;
  readonly applicability: string;
  readonly reviewed: true;
}

export interface CareAdvice {
  readonly schemaVersion: typeof ASSISTANT_EVENT_SCHEMA_VERSION;
  readonly kind: 'CareAdvice';
  readonly adviceId: string;
  readonly careSubjectId: string;
  readonly offeredAt: string;
  readonly doNow: readonly string[];
  readonly warnings: readonly string[];
  readonly numericalClaims: readonly {
    readonly text: string;
    readonly status: 'sourced' | 'withheld';
    readonly sourceId?: string;
    readonly reason?: string;
  }[];
  readonly supplies: readonly string[];
  readonly sources: readonly CareAdviceSource[];
  readonly confidence: 'low' | 'medium' | 'high';
  readonly applicability: string;
  readonly epistemic: 'recommended';
  readonly becomesCareEvent: false;
}

export interface AssistantRun {
  readonly kind: 'AssistantRun';
  readonly runId: string;
  readonly mode: ControllerMode;
  readonly packageVersions: Readonly<Record<string, string>>;
  readonly modelId: string | null;
  readonly workflowVersion: string | null;
  readonly memoryRecordId: string | null;
  readonly mastra: 'empty-well' | 'bound';
}

export type ControllerMode =
  | 'care'
  | 'observe'
  | 'research'
  | 'terrarium-read'
  | 'review'
  | 'service-sim';

export type ProductSurface = 'Today' | 'Observe' | 'Ask' | 'Terrarium' | 'Lab' | 'Service';

export const SURFACE_MODE: Record<ProductSurface, ControllerMode> = {
  Today: 'care',
  Observe: 'observe',
  Ask: 'care',
  Terrarium: 'terrarium-read',
  Lab: 'review',
  Service: 'service-sim',
};

export type EventType =
  | 'care.subject.created'
  | 'media.ingested'
  | 'note.appended'
  | 'observation.drafted'
  | 'interpretation.drafted'
  | 'taxon.hypothesis.drafted'
  | 'care.event.logged'
  | 'reminder.set'
  | 'reminder.cancelled'
  | 'advice.offered'
  | 'correction.issued';

export interface CanonicalEvent {
  readonly schemaVersion: number;
  readonly eventId: string;
  readonly idempotencyKey: string;
  readonly type: EventType;
  readonly occurredAt: string;
  readonly careSubjectId: string | null;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly digest: string;
  readonly supersedesEventId?: string;
}

export interface MediaBlob {
  readonly digest: string;
  readonly mediaType: string;
  readonly byteLength: number;
  readonly exifStripped: true;
  readonly gpsStripped: true;
  readonly localityWritten: false;
  readonly bytes: Uint8Array;
}

export interface Reminder {
  readonly reminderId: string;
  readonly careSubjectId: string;
  readonly dueAt: string;
  readonly text: string;
  readonly cancelled: boolean;
}

export interface PrivacyInspect {
  readonly exactAddress: false;
  readonly exifLocation: false;
  readonly gps: false;
  readonly findings: readonly string[];
}

export interface OfflineExport {
  readonly kind: typeof EXPORT_KIND;
  readonly schemaVersion: typeof ASSISTANT_EVENT_SCHEMA_VERSION;
  readonly exportedAt: string;
  readonly privacyInspect: PrivacyInspect;
  readonly events: readonly CanonicalEvent[];
  readonly blobs: readonly {
    readonly digest: string;
    readonly mediaType: string;
    readonly byteLength: number;
    readonly sha256: string;
    readonly bytesBase64: string;
  }[];
  readonly digest: string;
}

export interface LocationGrant {
  readonly purpose: 'supply-transit';
  readonly precision: 'coarse';
  readonly token: string;
  readonly expiresAt: string;
  readonly persist: false;
  readonly writesLocality: false;
}

export interface AdapterEnvelope<T> {
  readonly timestamp: string;
  readonly freshness: 'current' | 'stale' | 'offline-fixture' | 'unavailable';
  readonly source: string;
  readonly confidence: 'low' | 'medium' | 'high' | 'unknown';
  readonly applicability: string;
  readonly privacyClass: 'no-exact-location' | 'ephemeral-coarse-location';
  readonly timeoutMs: number;
  readonly offline: 'available' | 'unavailable';
  readonly assayed: boolean;
  readonly value: T | null;
}
