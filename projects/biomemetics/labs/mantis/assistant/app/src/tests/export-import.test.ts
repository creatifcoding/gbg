import { describe, expect, it } from 'vitest';
import { createCareSubject, ingestMedia, logCareEvent } from '../kernel/actions';
import { buildExport, importExport } from '../kernel/export-import';
import { jpegWithGpsExif } from '../kernel/jpeg-fixture';
import { KeeperLog, MemoryStore } from '../kernel/log';
import { foldEvents } from '../kernel/model';
import { scanForExactLocation } from '../kernel/privacy';

describe('export/import', () => {
  it('round-trips without duplicating events or blobs and stays privacy-clean', async () => {
    const a = new KeeperLog(new MemoryStore());
    const { careSubjectId } = await createCareSubject(a, {
      housing: 'temporary-cup',
      occurredAt: '2026-08-21T04:00:00.000Z',
      idempotencyKey: 's',
    });
    await ingestMedia(a, {
      bytes: jpegWithGpsExif(),
      mediaType: 'image/jpeg',
      careSubjectId,
      idempotencyKey: 'photo:1',
      occurredAt: '2026-08-21T04:01:00.000Z',
      origin: 'capture',
    });
    await logCareEvent(a, {
      careSubjectId,
      act: 'offered',
      occurredAt: '2026-08-21T04:02:00.000Z',
      idempotencyKey: 'offered:1',
    });

    const envelope = await buildExport(a.store, '2026-08-21T04:03:00.000Z');
    expect(envelope.privacyInspect.exactAddress).toBe(false);
    expect(envelope.privacyInspect.exifLocation).toBe(false);
    expect(envelope.privacyInspect.gps).toBe(false);
    expect(scanForExactLocation(envelope.events.map((e) => e.payload)).clean).toBe(true);

    const b = new KeeperLog(new MemoryStore());
    const first = await importExport(b.store, envelope);
    const second = await importExport(b.store, envelope);
    expect(first.eventsAdded).toBeGreaterThan(0);
    expect(first.blobsAdded).toBe(1);
    expect(second.eventsAdded).toBe(0);
    expect(second.blobsAdded).toBe(0);
    expect(second.eventsDuplicate).toBe(first.eventsAdded);
    expect(second.blobsDuplicate).toBe(1);

    const model = foldEvents(await b.events());
    expect(model.subjects).toHaveLength(1);
    expect(model.careEvents).toHaveLength(1);
    expect(model.mediaDigests).toHaveLength(1);
  });
});
