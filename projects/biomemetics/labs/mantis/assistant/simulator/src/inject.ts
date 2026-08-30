import { contactFor, interlocksFor, transitionById } from './rail.ts';
import {
  CHANNEL,
  EPOCH_MS,
  FailClosedError,
  FRESH_WITHIN_MS,
  type ChannelId,
  type FaultId,
  type HostAction,
  type Instant,
  type Plant,
  type Receipt,
  type ReceiptId,
  type Sample,
} from './types.ts';

const asInstant = (ms: number): Instant => new Date(ms).toISOString() as Instant;

const copySamples = (plant: Plant): Record<string, Sample> => ({ ...plant.samples });
const copyReceipts = (plant: Plant): Record<string, Receipt> => ({ ...plant.receipts });

const requireChannel = (plant: Plant, channel: ChannelId): Sample => {
  const sample = plant.samples[channel];
  if (!sample) {
    throw new FailClosedError(`channel ${channel} is not on this plant`);
  }
  return sample;
};

const overlayReceipt = (plant: Plant, id: string, recordedAt: Instant): Receipt => ({
  id: id as ReceiptId,
  href: `receipts/${id}.json`,
  recordedAt,
  sourceClass: 'simulated',
});

const ageSample = (sample: Sample, observedAt: Instant): Sample => {
  if (sample.kind === 'unavailable') {
    return sample;
  }
  return { ...sample, observedAt };
};

const toFaulted = (sample: Sample, fault: string, observedAt: Instant, receiptId: ReceiptId): Sample => ({
  kind: 'faulted',
  channel: sample.channel,
  unit: sample.kind === 'unavailable' ? '1' : sample.unit,
  fault,
  observedAt,
  receiptId,
  sourceClass: 'simulated',
});

const toUnavailable = (sample: Sample, reason: string, receiptId: ReceiptId): Sample => ({
  kind: 'unavailable',
  channel: sample.channel,
  reason,
  receiptId,
});

const applyPhase = (plant: Plant, phase: Plant['phase']): Plant => ({
  ...plant,
  phase,
  interlocks: interlocksFor(phase),
  contact: contactFor(phase),
});

const applyFault = (plant: Plant, fault: FaultId): Plant => {
  const now = asInstant(plant.clockMs);
  switch (fault) {
    case 'pinch': {
      if (plant.phase !== 'link-trained' && plant.phase !== 'training-window') {
        return applyPhase(plant, 'fault-latched');
      }
      const next = applyPhase(plant, 'pinch-safe');
      const samples = copySamples(next);
      const receipts = copyReceipts(next);
      const rid = 'rec.fault.pinch' as ReceiptId;
      receipts[rid] = overlayReceipt(next, rid, now);
      samples[CHANNEL.branchVoltage] = toFaulted(
        requireChannel(next, CHANNEL.branchVoltage),
        'pinch',
        now,
        rid,
      );
      return { ...next, samples, receipts };
    }
    case 's1-open': {
      const next = applyPhase(plant, plant.phase === 'link-trained' ? 'pinch-safe' : 'fault-latched');
      return next;
    }
    case 's2-open': {
      return applyPhase(plant, 'fault-latched');
    }
    case 'q1-off': {
      if (plant.phase === 'link-trained') {
        return applyPhase(plant, 'fault-latched');
      }
      return applyPhase(plant, plant.phase);
    }
    case 'contact-ambiguous':
    case 'link-loss':
    case 'stuck-switch':
    case 'training-timeout': {
      const next = applyPhase(plant, 'fault-latched');
      const samples = copySamples(next);
      const receipts = copyReceipts(next);
      const rid = `rec.fault.${fault}` as ReceiptId;
      receipts[rid] = overlayReceipt(next, rid, now);
      samples[CHANNEL.branchVoltage] = toFaulted(
        requireChannel(next, CHANNEL.branchVoltage),
        fault,
        now,
        rid,
      );
      return { ...next, samples, receipts };
    }
    default: {
      const _exhaustive: never = fault;
      return _exhaustive;
    }
  }
};

export const inject = (plant: Plant, action: HostAction): Plant => {
  switch (action.type) {
    case 'advance-clock': {
      return { ...plant, clockMs: plant.clockMs + action.byMs };
    }
    case 'stale': {
      const sample = requireChannel(plant, action.channel);
      const agedAt = asInstant(plant.clockMs - plant.freshWithinMs - 1);
      const samples = copySamples(plant);
      samples[action.channel] = ageSample(sample, agedAt);
      return { ...plant, samples };
    }
    case 'unavailable': {
      const sample = requireChannel(plant, action.channel);
      const samples = copySamples(plant);
      const receipts = copyReceipts(plant);
      const rid = `rec.unavailable.${action.channel}` as ReceiptId;
      receipts[rid] = overlayReceipt(plant, rid, asInstant(plant.clockMs));
      samples[action.channel] = toUnavailable(sample, 'injected-unavailable', rid);
      return { ...plant, samples, receipts };
    }
    case 'fault': {
      return applyFault(plant, action.fault);
    }
    case 'step': {
      const row = transitionById(action.transitionId);
      if (row.from !== plant.phase) {
        throw new FailClosedError(`cannot apply ${row.id} from ${plant.phase}`);
      }
      return applyPhase(plant, row.to);
    }
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
};

export const injectStale = (plant: Plant, channel: ChannelId): Plant =>
  inject(plant, { type: 'stale', channel });

export const injectFault = (plant: Plant, fault: FaultId): Plant =>
  inject(plant, { type: 'fault', fault });

export { EPOCH_MS, FRESH_WITHIN_MS };
