import { describe, expect, it } from 'vitest';
import { lookupCareAdvice, lookupSupplyTransit } from '../adapters/care';
import { a0Bridge, assertNoDeviceCommand } from '../contracts/a0';
import { jpegWithGpsExif } from '../kernel/jpeg-fixture';
import { KeeperLog, MemoryStore } from '../kernel/log';
import { createCareSubject, draftObservation, ingestMedia } from '../kernel/actions';
import { foldEvents, photoNeverConfirmedTaxon, photoNeverWroteLocality } from '../kernel/model';
import scenario from '../../../fixtures/golden-care/scenario.json' with { type: 'json' };

describe('golden-care ambiguous photo', () => {
  it('never confirms taxon or locality from the fixture photo', async () => {
    const log = new KeeperLog(new MemoryStore());
    const { careSubjectId } = await createCareSubject(log, {
      housing: 'temporary-cup',
      occurredAt: '2026-08-21T04:00:00.000Z',
      idempotencyKey: 'golden:subject',
    });
    const { blob } = await ingestMedia(log, {
      bytes: jpegWithGpsExif(),
      mediaType: 'image/jpeg',
      careSubjectId,
      idempotencyKey: 'golden:photo',
      occurredAt: '2026-08-21T04:01:00.000Z',
      origin: 'capture',
    });
    await draftObservation(log, {
      careSubjectId,
      mediaDigest: blob.digest,
      statements: scenario.photo.visibleFacts.map((text) => ({ text, status: 'observed' as const })),
      occurredAt: '2026-08-21T04:02:00.000Z',
      idempotencyKey: 'golden:obs',
    });
    const model = foldEvents(await log.events());
    expect(photoNeverConfirmedTaxon(model)).toBe(true);
    expect(photoNeverWroteLocality(model)).toBe(true);
    expect(scenario.taxon.status).toBe('unknown');
    expect(scenario.locality).toBeNull();
    expect(scenario.catalogSpecimen).toBe(false);
  });

  it('withholds numerical care advice when taxon is unknown', () => {
    const advice = lookupCareAdvice({
      careSubjectId: 'care_x',
      now: '2026-08-21T04:00:00.000Z',
      online: false,
    });
    expect(advice.offline).toBe('available');
    expect(advice.value?.numericalClaims.every((c) => c.status === 'withheld')).toBe(true);
    expect(advice.value?.becomesCareEvent).toBe(false);
  });

  it('distinguishes unavailable current lookup from local guidance when offline', () => {
    const supply = lookupSupplyTransit({
      now: '2026-08-21T04:00:00.000Z',
      grant: null,
      manualPlace: 'fixture-city',
      online: false,
    });
    expect(supply.offline).toBe('unavailable');
    expect(supply.value?.hits).toEqual([]);
    expect(supply.value?.locationMode).toBe('manual');
  });

  it('fail-closes device-command and leaves Mastra empty when A0 is absent', () => {
    expect(() => assertNoDeviceCommand('device-command')).toThrow(/fail-closed/);
    if (a0Bridge.contracts === 'fixture-local') {
      expect(a0Bridge.mastra).toBe('empty');
      expect(a0Bridge.controller).toBe('empty');
    }
  });
});
