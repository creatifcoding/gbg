import { describe, expect, it } from 'vitest';
import { createCareSubject, logCareEvent } from '../kernel/actions';
import { KeeperLog, MemoryStore } from '../kernel/log';
import { foldEvents } from '../kernel/model';

describe('schema migration', () => {
  it('retains unknown future schema versions without applying them', async () => {
    const store = new MemoryStore();
    const log = new KeeperLog(store);
    const { careSubjectId } = await createCareSubject(log, {
      housing: 'temporary-cup',
      occurredAt: '2026-08-21T04:00:00.000Z',
      idempotencyKey: 's',
    });
    await store.append({
      schemaVersion: 99,
      eventId: 'evt_future',
      idempotencyKey: 'future:1',
      type: 'care.event.logged',
      occurredAt: '2026-08-21T05:00:00.000Z',
      careSubjectId,
      payload: { act: 'eaten', careEventId: 'should-not-apply' },
      digest: 'deadbeef',
    });
    const model = foldEvents(await log.events());
    expect(model.retainedUnknown.some((e) => e.schemaVersion === 99)).toBe(true);
    expect(model.careEvents).toHaveLength(0);
  });

  it('applies current schema events after retained unknown ones', async () => {
    const store = new MemoryStore();
    const log = new KeeperLog(store);
    const { careSubjectId } = await createCareSubject(log, {
      housing: 'temporary-cup',
      occurredAt: '2026-08-21T04:00:00.000Z',
      idempotencyKey: 's',
    });
    await store.append({
      schemaVersion: 2,
      eventId: 'evt_future',
      idempotencyKey: 'future:1',
      type: 'care.event.logged',
      occurredAt: '2026-08-21T05:00:00.000Z',
      careSubjectId,
      payload: { act: 'eaten' },
      digest: 'deadbeef',
    });
    await logCareEvent(log, {
      careSubjectId,
      act: 'offered',
      occurredAt: '2026-08-21T06:00:00.000Z',
      idempotencyKey: 'offered:1',
    });
    const model = foldEvents(await log.events());
    expect(model.careEvents.map((e) => e.act)).toEqual(['offered']);
  });
});
