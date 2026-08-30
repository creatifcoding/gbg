import { identity } from 'effect/Function';

/** Loads the pinned Effect package so the A0 lock is exercised in CI. */
export const effectPin = identity(true);
