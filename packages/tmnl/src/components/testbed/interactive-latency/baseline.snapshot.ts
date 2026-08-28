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

export interface InteractiveLatencyPhase {
  readonly id: 'baseline' | 'weighted' | 'control';
  readonly label: string;
  readonly runs: readonly InteractiveLatencyRun[];
}

export const OPTIMIZATION_RUN_ID = 'niri-interactive-latency-20260828';
export const AGENTSTORE_CHECKPOINT =
  'performance.optimization.checkpoints/niri-interactive-latency-20260828-cp-5';
export const LATENCY_BUDGET_MS = 16.7;

export const interactiveLatencyPhases = [
  {
    "id": "baseline",
    "label": "PRESSURE BASELINE",
    "runs": [
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
    ]
  },
  {
    "id": "weighted",
    "label": "NIRI WEIGHT 1000",
    "runs": [
      {
        "run": 1,
        "timestamp": "2026-08-28T18:37:26.715Z",
        "p95Ms": 11.425,
        "medianMs": 10.192,
        "directReclaimPages": 0,
        "memoryFullPsiPct": 0.0006,
        "swapInPages": 0,
        "majorFaults": 719,
        "userProcesses": 237,
        "userThreads": 2278,
        "userRssGiB": 16.994,
        "userSwapGiB": 4.145,
        "actionSamplesMs": [
          11.425,
          9.839,
          9.919,
          10.035,
          10.494,
          10.408,
          10.477,
          9.795,
          10.35,
          9.493
        ]
      },
      {
        "run": 2,
        "timestamp": "2026-08-28T18:38:00.518Z",
        "p95Ms": 10.841,
        "medianMs": 10.546,
        "directReclaimPages": 0,
        "memoryFullPsiPct": 0.1815,
        "swapInPages": 1,
        "majorFaults": 606,
        "userProcesses": 237,
        "userThreads": 2278,
        "userRssGiB": 16.642,
        "userSwapGiB": 4.285,
        "actionSamplesMs": [
          10.581,
          10.774,
          10.363,
          10.841,
          10.511,
          9.835,
          10.692,
          10.806,
          9.893,
          9.953
        ]
      },
      {
        "run": 3,
        "timestamp": "2026-08-28T18:38:34.253Z",
        "p95Ms": 10.169,
        "medianMs": 9.989,
        "directReclaimPages": 0,
        "memoryFullPsiPct": 0,
        "swapInPages": 0,
        "majorFaults": 1960,
        "userProcesses": 237,
        "userThreads": 2278,
        "userRssGiB": 16.549,
        "userSwapGiB": 4.296,
        "actionSamplesMs": [
          10.161,
          10.068,
          10.121,
          9.361,
          9.967,
          9.94,
          9.837,
          9.893,
          10.012,
          10.169
        ]
      },
      {
        "run": 4,
        "timestamp": "2026-08-28T18:39:07.838Z",
        "p95Ms": 10.959,
        "medianMs": 10.096,
        "directReclaimPages": 0,
        "memoryFullPsiPct": 0.0002,
        "swapInPages": 0,
        "majorFaults": 159,
        "userProcesses": 237,
        "userThreads": 2305,
        "userRssGiB": 16.528,
        "userSwapGiB": 4.294,
        "actionSamplesMs": [
          9.614,
          10.05,
          10.959,
          10.013,
          10.601,
          10.338,
          10.799,
          10.142,
          9.677,
          9.725
        ]
      },
      {
        "run": 5,
        "timestamp": "2026-08-28T18:39:41.432Z",
        "p95Ms": 10.859,
        "medianMs": 9.864,
        "directReclaimPages": 0,
        "memoryFullPsiPct": 0,
        "swapInPages": 0,
        "majorFaults": 334,
        "userProcesses": 237,
        "userThreads": 2299,
        "userRssGiB": 16.539,
        "userSwapGiB": 4.293,
        "actionSamplesMs": [
          10.435,
          10.024,
          9.642,
          9.413,
          9.839,
          10.859,
          9.362,
          10.033,
          9.719,
          9.889
        ]
      }
    ]
  },
  {
    "id": "control",
    "label": "MATCHED CONTROL",
    "runs": [
      {
        "run": 1,
        "timestamp": "2026-08-28T18:41:36.379Z",
        "p95Ms": 11.916,
        "medianMs": 10.536,
        "directReclaimPages": 0,
        "memoryFullPsiPct": 0,
        "swapInPages": 0,
        "majorFaults": 234,
        "userProcesses": 238,
        "userThreads": 2312,
        "userRssGiB": 16.708,
        "userSwapGiB": 4.292,
        "actionSamplesMs": [
          10.514,
          9.91,
          11.916,
          11.048,
          10.298,
          11.781,
          10.558,
          10.68,
          10.026,
          10.497
        ]
      },
      {
        "run": 2,
        "timestamp": "2026-08-28T18:42:09.948Z",
        "p95Ms": 10.858,
        "medianMs": 10.115,
        "directReclaimPages": 0,
        "memoryFullPsiPct": 0.0002,
        "swapInPages": 0,
        "majorFaults": 133,
        "userProcesses": 238,
        "userThreads": 2311,
        "userRssGiB": 16.703,
        "userSwapGiB": 4.291,
        "actionSamplesMs": [
          9.792,
          10.858,
          9.885,
          10.46,
          10.578,
          10.761,
          10.218,
          10.013,
          9.585,
          9.669
        ]
      },
      {
        "run": 3,
        "timestamp": "2026-08-28T18:42:43.636Z",
        "p95Ms": 10.881,
        "medianMs": 9.955,
        "directReclaimPages": 0,
        "memoryFullPsiPct": 0,
        "swapInPages": 0,
        "majorFaults": 129,
        "userProcesses": 238,
        "userThreads": 2304,
        "userRssGiB": 16.682,
        "userSwapGiB": 4.291,
        "actionSamplesMs": [
          10.881,
          10.686,
          9.886,
          10.024,
          9.834,
          9.658,
          10.094,
          9.707,
          10.549,
          9.753
        ]
      },
      {
        "run": 4,
        "timestamp": "2026-08-28T18:43:17.292Z",
        "p95Ms": 11.463,
        "medianMs": 10.086,
        "directReclaimPages": 0,
        "memoryFullPsiPct": 0,
        "swapInPages": 0,
        "majorFaults": 811,
        "userProcesses": 239,
        "userThreads": 2279,
        "userRssGiB": 16.741,
        "userSwapGiB": 4.29,
        "actionSamplesMs": [
          9.713,
          9.879,
          10.053,
          9.558,
          10.205,
          9.98,
          10.427,
          10.119,
          11.463,
          10.351
        ]
      },
      {
        "run": 5,
        "timestamp": "2026-08-28T18:43:50.943Z",
        "p95Ms": 12.063,
        "medianMs": 9.991,
        "directReclaimPages": 0,
        "memoryFullPsiPct": 0,
        "swapInPages": 0,
        "majorFaults": 299,
        "userProcesses": 238,
        "userThreads": 2273,
        "userRssGiB": 16.688,
        "userSwapGiB": 4.29,
        "actionSamplesMs": [
          10.181,
          10.079,
          10.283,
          10.172,
          12.063,
          9.874,
          9.897,
          9.566,
          9.716,
          9.903
        ]
      }
    ]
  }
] as const satisfies readonly InteractiveLatencyPhase[];

export const interactiveLatencyRuns = interactiveLatencyPhases[0].runs;

export const interactiveLatencySummary = {
  historicalP95Ms: 14.458,
  currentP95Ms: 11.463,
  currentMedianMs: 10.086,
  currentMaxMs: 12.063,
  historicalDirectReclaimPages: 46031,
  currentDirectReclaimPages: 0,
  userProcesses: 238,
  userThreads: 2304,
  userRssGiB: 16.703,
  userSwapGiB: 4.291,
  weightedImprovementMs: 0.6039999999999992,
  noiseThresholdMs: 2,
  targetReached: true,
} as const;
