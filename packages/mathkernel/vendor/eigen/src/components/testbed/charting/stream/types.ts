export type StreamApplyMode = 'idle' | 'batch' | 'point' | 'effect';

export type StreamStats = {
  batches: number;
  pointsApplied: number;
  lastFlushMs: number;
  mode: StreamApplyMode;
};

export const emptyStreamStats = (): StreamStats => ({
  batches: 0,
  pointsApplied: 0,
  lastFlushMs: 0,
  mode: 'idle',
});
