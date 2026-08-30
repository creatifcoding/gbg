import type { MediaBlob, OfflineExport, PrivacyInspect } from '../contracts/types';
import { ASSISTANT_EVENT_SCHEMA_VERSION, EXPORT_KIND } from '../contracts/types';
import { base64ToBytes, bytesToBase64, sha256Bytes, sha256Json } from './crypto';
import type { EventStore } from './log';
import { digestMatches } from './log';
import { scanForExactLocation } from './privacy';

const privacyOk = (findings: readonly string[]): PrivacyInspect => {
  if (findings.length > 0) {
    throw new Error(`privacy inspect failed: ${findings.join('; ')}`);
  }
  return { exactAddress: false, exifLocation: false, gps: false, findings: [] };
};

export const buildExport = async (
  store: EventStore,
  now: string,
): Promise<OfflineExport> => {
  const events = await store.list();
  const blobs = await store.listBlobs();
  const inspectSource = {
    events: events.map(({ payload, type, careSubjectId }) => ({ payload, type, careSubjectId })),
    blobAscii: blobs.map((b) => asciiPreview(b.bytes)),
  };
  const scan = scanForExactLocation(inspectSource);
  const privacyInspect = privacyOk(scan.findings);

  const blobRecords = await Promise.all(
    blobs.map(async (blob) => {
      const sha256 = await sha256Bytes(blob.bytes);
      if (sha256 !== blob.digest) {
        throw new Error(`blob digest mismatch for ${blob.digest}`);
      }
      return {
        digest: blob.digest,
        mediaType: blob.mediaType,
        byteLength: blob.byteLength,
        sha256,
        bytesBase64: bytesToBase64(blob.bytes),
      };
    }),
  );

  const digest = await sha256Json({
    events: events.map((e) => e.digest),
    blobs: blobRecords.map((b) => b.digest),
  });

  return {
    kind: EXPORT_KIND,
    schemaVersion: ASSISTANT_EVENT_SCHEMA_VERSION,
    exportedAt: now,
    privacyInspect,
    events,
    blobs: blobRecords,
    digest,
  };
};

export interface ImportResult {
  readonly eventsAdded: number;
  readonly eventsDuplicate: number;
  readonly blobsAdded: number;
  readonly blobsDuplicate: number;
}

export const importExport = async (
  store: EventStore,
  envelope: OfflineExport,
): Promise<ImportResult> => {
  if (envelope.kind !== EXPORT_KIND) throw new Error('unknown export kind');
  const expected = await sha256Json({
    events: envelope.events.map((e) => e.digest),
    blobs: envelope.blobs.map((b) => b.digest),
  });
  if (expected !== envelope.digest) throw new Error('export digest mismatch');

  const scan = scanForExactLocation({
    events: envelope.events.map(({ payload, type }) => ({ payload, type })),
  });
  privacyOk(scan.findings);

  let eventsAdded = 0;
  let eventsDuplicate = 0;
  for (const event of envelope.events) {
    if (!(await digestMatches(event))) throw new Error(`event digest mismatch ${event.eventId}`);
    const byKey = await store.getByIdempotency(event.idempotencyKey);
    const byId = await store.getById(event.eventId);
    if (byKey || byId) {
      eventsDuplicate += 1;
      continue;
    }
    await store.append(event);
    eventsAdded += 1;
  }

  let blobsAdded = 0;
  let blobsDuplicate = 0;
  for (const record of envelope.blobs) {
    const bytes = base64ToBytes(record.bytesBase64);
    const sha256 = await sha256Bytes(bytes);
    if (sha256 !== record.digest || sha256 !== record.sha256) {
      throw new Error(`blob sha256 mismatch ${record.digest}`);
    }
    const existing = await store.getBlob(record.digest);
    if (existing) {
      blobsDuplicate += 1;
      continue;
    }
    const blob: MediaBlob = {
      digest: record.digest,
      mediaType: record.mediaType,
      byteLength: record.byteLength,
      exifStripped: true,
      gpsStripped: true,
      localityWritten: false,
      bytes,
    };
    await store.putBlob(blob);
    blobsAdded += 1;
  }

  return { eventsAdded, eventsDuplicate, blobsAdded, blobsDuplicate };
};

export const serializeExport = (envelope: OfflineExport): string => JSON.stringify(envelope, null, 2);

export const parseExport = (text: string): OfflineExport => {
  const parsed = JSON.parse(text) as OfflineExport;
  if (parsed.kind !== EXPORT_KIND) throw new Error('not a keeper export');
  return parsed;
};

const asciiPreview = (bytes: Uint8Array): string => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) {
    const c = bytes[i]!;
    if (c >= 32 && c < 127) s += String.fromCharCode(c);
  }
  return s;
};
