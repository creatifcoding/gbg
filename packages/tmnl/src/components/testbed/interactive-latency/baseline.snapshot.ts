export interface InteractiveLatencyRun {
  readonly run: number;
  readonly timestamp: string;
  readonly p95Ms: number;
  readonly medianMs: number;
  readonly directReclaimPages: number;
  readonly memoryFullPsiPct: number;
  readonly swapInPages: number;
  readonly majorFaults: number;
  readonly userProcesses: number;
  readonly userThreads: number;
  readonly userRssGiB: number;
  readonly userSwapGiB: number;
  readonly actionSamplesMs: readonly number[];
}

export const OPTIMIZATION_RUN_ID = 'niri-interactive-latency-20260828';
export const AGENTSTORE_CHECKPOINT =
  'performance.optimization.checkpoints/niri-interactive-latency-20260828-cp-1';
export const LATENCY_BUDGET_MS = 16.7;

export const interactiveLatencyRuns = [
  {
    "run": 1,
    "timestamp": "2026-08-28T17:22:20.211Z",
    "p95Ms": 14.458,
    "medianMs": 11.613,
    "directReclaimPages": 73927,
    "memoryFullPsiPct": 0.311,
    "swapInPages": 31,
    "majorFaults": 731,
    "userProcesses": 304,
    "userThreads": 3053,
    "userRssGiB": 20.362,
    "userSwapGiB": 19.608,
    "actionSamplesMs": [
      11.827,
      14.458,
      9.853,
      12.208,
      11.654,
      11.294,
      11.57,
      11.572,
      10.776,
      13.189
    ]
  },
  {
    "run": 2,
    "timestamp": "2026-08-28T17:22:55.555Z",
    "p95Ms": 20.479,
    "medianMs": 12.133,
    "directReclaimPages": 146859,
    "memoryFullPsiPct": 0.7853,
    "swapInPages": 113,
    "majorFaults": 183144,
    "userProcesses": 302,
    "userThreads": 2998,
    "userRssGiB": 19.851,
    "userSwapGiB": 20.058,
    "actionSamplesMs": [
      11.79,
      11.706,
      12.795,
      13.482,
      11.45,
      12.149,
      12.585,
      20.479,
      12.118,
      11.675
    ]
  },
  {
    "run": 3,
    "timestamp": "2026-08-28T17:23:29.718Z",
    "p95Ms": 12.564,
    "medianMs": 12.031,
    "directReclaimPages": 0,
    "memoryFullPsiPct": 0.0004,
    "swapInPages": 39,
    "majorFaults": 708,
    "userProcesses": 302,
    "userThreads": 3029,
    "userRssGiB": 19.674,
    "userSwapGiB": 19.58,
    "actionSamplesMs": [
      12.159,
      11.57,
      11.988,
      12.074,
      12.265,
      12.542,
      11.529,
      11.349,
      12.564,
      11.72
    ]
  },
  {
    "run": 4,
    "timestamp": "2026-08-28T17:38:53.127Z",
    "p95Ms": 30.691,
    "medianMs": 11.986,
    "directReclaimPages": 46031,
    "memoryFullPsiPct": 0.1341,
    "swapInPages": 176,
    "majorFaults": 8317,
    "userProcesses": 307,
    "userThreads": 3058,
    "userRssGiB": 19.775,
    "userSwapGiB": 20.488,
    "actionSamplesMs": [
      11.771,
      11.021,
      12.074,
      11.567,
      12.312,
      11.529,
      12.541,
      30.691,
      11.897,
      12.077
    ]
  },
  {
    "run": 5,
    "timestamp": "2026-08-28T17:39:28.065Z",
    "p95Ms": 12.74,
    "medianMs": 12.161,
    "directReclaimPages": 151,
    "memoryFullPsiPct": 0.0004,
    "swapInPages": 67,
    "majorFaults": 653,
    "userProcesses": 306,
    "userThreads": 3085,
    "userRssGiB": 19.535,
    "userSwapGiB": 20.754,
    "actionSamplesMs": [
      12.47,
      12.225,
      12.098,
      12.74,
      11.65,
      12.283,
      11.876,
      12.043,
      12.282,
      11.334
    ]
  }
] as const satisfies readonly InteractiveLatencyRun[];

export const interactiveLatencySummary = {
  p95Ms: 14.458,
  medianMs: 12.031,
  maxMs: 30.691,
  directReclaimPages: 46031,
  memoryFullPsiPct: 0.1341,
  userProcesses: 304,
  userThreads: 3053,
  userRssGiB: 19.775,
  userSwapGiB: 20.058,
  stabilityRangeMs: 18.127,
} as const;
