import { contactFor, interlocksFor } from './rail.ts';
import {
  CALIBRATION_REVISION,
  EPOCH_MS,
  FRESH_WITHIN_MS,
  type ChannelId,
  type FixtureId,
  type Instant,
  type Phase,
  type Plant,
  type Receipt,
  type ReceiptId,
  type Sample,
} from './types.ts';

export type FixtureSample =
  | {
      readonly kind: 'unavailable';
      readonly channel: string;
      readonly reason: string;
      readonly receiptId: string;
    }
  | {
      readonly kind: 'faulted';
      readonly channel: string;
      readonly unit: string;
      readonly fault: string;
      readonly observedAt: string;
      readonly receiptId: string;
    }
  | {
      readonly kind: 'reading';
      readonly channel: string;
      readonly value: number;
      readonly unit: string;
      readonly uncertainty: Sample extends { kind: 'reading' } ? Sample['uncertainty'] : never;
      readonly observedAt: string;
      readonly claim: 'sensor-fixture' | 'model';
      readonly receiptId: string;
    };

export type FixtureFile = {
  readonly id: string;
  readonly phase: Phase;
  readonly clockMs?: number;
  readonly samples: readonly FixtureSample[];
};

export const asChannel = (value: string): ChannelId => value as ChannelId;
export const asReceiptId = (value: string): ReceiptId => value as ReceiptId;
export const asInstant = (value: string): Instant => value as Instant;

export const parseSample = (raw: FixtureSample): Sample => {
  switch (raw.kind) {
    case 'unavailable':
      return {
        kind: 'unavailable',
        channel: asChannel(raw.channel),
        reason: raw.reason,
        receiptId: asReceiptId(raw.receiptId),
      };
    case 'faulted':
      return {
        kind: 'faulted',
        channel: asChannel(raw.channel),
        unit: raw.unit,
        fault: raw.fault,
        observedAt: asInstant(raw.observedAt),
        receiptId: asReceiptId(raw.receiptId),
        sourceClass: 'simulated',
      };
    case 'reading':
      return {
        kind: 'reading',
        channel: asChannel(raw.channel),
        value: raw.value,
        unit: raw.unit,
        uncertainty: raw.uncertainty,
        calibrationRevision: CALIBRATION_REVISION,
        observedAt: asInstant(raw.observedAt),
        sourceClass: 'simulated',
        claim: raw.claim,
        receiptId: asReceiptId(raw.receiptId),
      };
    default: {
      const _exhaustive: never = raw;
      return _exhaustive;
    }
  }
};

export const receiptFromJson = (raw: {
  readonly id: string;
  readonly href: string;
  readonly recordedAt: string;
  readonly sourceClass: 'simulated';
}): Receipt => ({
  id: asReceiptId(raw.id),
  href: raw.href,
  recordedAt: asInstant(raw.recordedAt),
  sourceClass: 'simulated',
});

export const assemblePlant = (
  file: FixtureFile,
  receipts: Readonly<Record<string, Receipt>>,
  clockMs = EPOCH_MS,
): Plant => {
  const samples: Record<string, Sample> = {};
  const used: Record<string, Receipt> = {};
  for (const row of file.samples) {
    const sample = parseSample(row);
    samples[sample.channel] = sample;
    const receipt = receipts[sample.receiptId];
    if (!receipt) {
      throw new Error(`missing receipt ${sample.receiptId}`);
    }
    used[sample.receiptId] = receipt;
  }
  return {
    fixtureId: file.id as FixtureId,
    sourceClass: 'simulated',
    phase: file.phase,
    interlocks: interlocksFor(file.phase),
    samples,
    receipts: used,
    clockMs: file.clockMs ?? clockMs,
    freshWithinMs: FRESH_WITHIN_MS,
    contact: contactFor(file.phase),
  };
};
