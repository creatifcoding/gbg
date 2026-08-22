import { FRESH_WITHIN_MS, type Honesty, type Instant, type Sample } from './types.ts';

const ageMs = (observedAt: Instant, now: Instant): number =>
  Date.parse(now) - Date.parse(observedAt);

export const paintSample = (
  sample: Sample,
  now: Instant,
  freshWithinMs = FRESH_WITHIN_MS,
): Honesty => {
  switch (sample.kind) {
    case 'unavailable':
      return 'unavailable';
    case 'faulted':
      return 'faulted';
    case 'reading': {
      if (sample.claim === 'model') return 'simulated';
      if (ageMs(sample.observedAt, now) > freshWithinMs) return 'stale';
      return 'known';
    }
    default: {
      const _exhaustive: never = sample;
      return _exhaustive;
    }
  }
};
