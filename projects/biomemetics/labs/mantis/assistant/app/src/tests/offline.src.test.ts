import { describe, expect, it } from 'vitest';
import {
  createCareSubject,
  draftObservation,
  ingestMedia,
  logCareEvent,
  offerAdvice,
} from '../kernel/actions';
import { jpegWithGpsExif } from '../kernel/jpeg-fixture';
import { KeeperLog, MemoryStore } from '../kernel/log';
import {
  foldEvents,
  photoNeverConfirmedTaxon,
  photoNeverWroteLocality,
  subjectNeverSpecimen,
} from '../kernel/model';
import { scanForExactLocation } from '../kernel/privacy';

const t0 = '2026-08-21T04:00:00.000Z';

describe('offline kernel', () => {
  it('creates a local CareSubject and never a Specimen', async () => {
    const log = new KeeperLog(new MemoryStore());
    const created = await createCareSubject(log, {
      housing: 'temporary-cup',
      occurredAt: t0,
      idempotencyKey: 'care-subject:primary',
    });
    const again = await createCareSubject(log, {
      housing: 'temporary-cup',
      occurredAt: t0,
      idempotencyKey: 'care-subject:primary',
    });
    expect(again.duplicate).toBe(true);
    expect(again.event.eventId).toBe(created.event.eventId);
    const model = foldEvents(await log.events());
    expect(subjectNeverSpecimen(model)).toBe(true);
    expect(model.subjects[0]?.catalogSpecimen).toBe(false);
    expect(model.subjects[0]?.specimenId).toBeNull();
  });

  it('logs a feeding event offline in well under 15 seconds', async () => {
    const started = Date.now();
    const log = new KeeperLog(new MemoryStore());
    const { careSubjectId } = await createCareSubject(log, {
      housing: 'temporary-cup',
      occurredAt: t0,
      idempotencyKey: 's',
    });
    await logCareEvent(log, {
      careSubjectId,
      act: 'offered',
      occurredAt: t0,
      idempotencyKey: 'feed:offered:1',
    });
    const elapsed = Date.now() - started;
    expect(elapsed).toBeLessThan(15_000);
    const model = foldEvents(await log.events());
    expect(model.careEvents).toHaveLength(1);
    expect(model.careEvents[0]?.act).toBe('offered');
    expect(model.careEvents[0]?.confirmed).toBe(true);
  });

  it('keeps observation distinct from taxon and does not write locality from a GPS photo', async () => {
    const log = new KeeperLog(new MemoryStore());
    const { careSubjectId } = await createCareSubject(log, {
      housing: 'temporary-cup',
      occurredAt: t0,
      idempotencyKey: 's',
    });
    const { blob } = await ingestMedia(log, {
      bytes: jpegWithGpsExif(),
      mediaType: 'image/jpeg',
      careSubjectId,
      idempotencyKey: 'photo:1',
      occurredAt: t0,
      origin: 'capture',
    });
    expect(new TextDecoder().decode(blob.bytes)).not.toContain('GPSLatitude');
    await draftObservation(log, {
      careSubjectId,
      mediaDigest: blob.digest,
      statements: [{ text: 'Raptorial forelegs are visible in a cup.', status: 'observed' }],
      occurredAt: t0,
      idempotencyKey: 'obs:1',
    });
    const model = foldEvents(await log.events());
    expect(photoNeverWroteLocality(model)).toBe(true);
    expect(photoNeverConfirmedTaxon(model)).toBe(true);
    expect(model.observations[0]?.taxon.status).toBe('unknown');
    expect(scanForExactLocation(model).clean).toBe(true);
  });

  it('does not treat a recommendation as eaten', async () => {
    const log = new KeeperLog(new MemoryStore());
    const { careSubjectId } = await createCareSubject(log, {
      housing: 'temporary-cup',
      occurredAt: t0,
      idempotencyKey: 's',
    });
    await offerAdvice(log, {
      careSubjectId,
      occurredAt: t0,
      idempotencyKey: 'adv:1',
      advice: { adviceId: 'adv_1', becomesCareEvent: false, epistemic: 'recommended' },
    });
    const model = foldEvents(await log.events());
    expect(model.careEvents.filter((e) => e.act === 'eaten')).toHaveLength(0);
    expect(model.advice[0]).toMatchObject({ becomesCareEvent: false });
  });

  it('treats corrections as new events and rebuilds after a simulated restart', async () => {
    const store = new MemoryStore();
    const log = new KeeperLog(store);
    const { careSubjectId } = await createCareSubject(log, {
      housing: 'temporary-cup',
      occurredAt: t0,
      idempotencyKey: 's',
    });
    const offered = await logCareEvent(log, {
      careSubjectId,
      act: 'offered',
      occurredAt: t0,
      idempotencyKey: 'offered:1',
    });
    await log.append({
      type: 'correction.issued',
      idempotencyKey: 'corr:1',
      occurredAt: '2026-08-21T04:10:00.000Z',
      careSubjectId,
      payload: { reason: 'logged offered, not eaten' },
      supersedesEventId: offered.event.eventId,
    });
    const snapshot = {
      events: await store.list(),
      blobs: await store.listBlobs(),
    };
    const restarted = new MemoryStore();
    await restarted.replaceAll(snapshot.events, snapshot.blobs);
    const again = await new KeeperLog(restarted).append({
      type: 'care.event.logged',
      idempotencyKey: 'offered:1',
      occurredAt: t0,
      careSubjectId,
      payload: { act: 'offered' },
    });
    expect(again.duplicate).toBe(true);
    const model = foldEvents(await restarted.list());
    expect(model.careEvents).toHaveLength(0);
    expect(model.subjects).toHaveLength(1);
    expect((await restarted.list()).filter((e) => e.type === 'correction.issued')).toHaveLength(1);
  });
});
