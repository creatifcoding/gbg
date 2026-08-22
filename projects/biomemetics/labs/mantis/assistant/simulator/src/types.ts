export type Brand<T, B extends string> = T & { readonly __brand: B };

export type Instant = Brand<string, 'Instant'>;
export type ChannelId = Brand<string, 'ChannelId'>;
export type ReceiptId = Brand<string, 'ReceiptId'>;
export type FixtureId = Brand<string, 'FixtureId'>;
export type TransitionId = Brand<string, 'TransitionId'>;

export const PHASES = [
  'absent',
  'mechanically-seated',
  'power-mated',
  'training-window',
  'link-trained',
  'fault-latched',
  'pinch-safe',
  'lifted',
] as const;

export type Phase = (typeof PHASES)[number];

export type Honesty = 'known' | 'stale' | 'simulated' | 'faulted' | 'unavailable';

export type SourceClass = 'simulated';

export type MateKind = 'open' | 'closed';

export type MateSense =
  | { readonly kind: 'open' }
  | { readonly kind: 'closed' }
  | {
      readonly kind: 'stuck-disagree';
      readonly commanded: MateKind;
      readonly sensed: MateKind;
    };

export type LoadSwitch =
  | { readonly kind: 'off' }
  | { readonly kind: 'current-limited' }
  | { readonly kind: 'on' }
  | { readonly kind: 'discharging'; readonly thresholdStatus: 'unverified' };

export type VideoMuteReason =
  | 'phase-not-link-trained'
  | 's1-open'
  | 's2-open'
  | 'q1-off'
  | 'fault'
  | 'contact-ambiguous'
  | 'pinch'
  | 'link-loss';

export type VideoState =
  | {
      readonly kind: 'unavailable';
      readonly reason: VideoMuteReason;
      readonly stream: 'none';
    }
  | {
      readonly kind: 'available';
      readonly stream: 'none';
      readonly note: 'A4a has no live camera stream';
    };

export type Uncertainty =
  | { readonly kind: 'symmetric'; readonly value: number; readonly unit: string }
  | { readonly kind: 'unverified'; readonly note: string };

export const CALIBRATION_REVISION = 'cal.sim.a4a-unverified' as const;
export type CalibrationRevision = typeof CALIBRATION_REVISION;

export type SampleClaim = 'sensor-fixture' | 'model';

export type Sample =
  | {
      readonly kind: 'unavailable';
      readonly channel: ChannelId;
      readonly reason: string;
      readonly receiptId: ReceiptId;
    }
  | {
      readonly kind: 'faulted';
      readonly channel: ChannelId;
      readonly unit: string;
      readonly fault: string;
      readonly observedAt: Instant;
      readonly receiptId: ReceiptId;
      readonly sourceClass: SourceClass;
    }
  | {
      readonly kind: 'reading';
      readonly channel: ChannelId;
      readonly value: number;
      readonly unit: string;
      readonly uncertainty: Uncertainty;
      readonly calibrationRevision: CalibrationRevision;
      readonly observedAt: Instant;
      readonly sourceClass: SourceClass;
      readonly claim: SampleClaim;
      readonly receiptId: ReceiptId;
    };

export type Interlocks = {
  readonly s1: MateSense;
  readonly s2: MateSense;
  readonly q1: LoadSwitch;
};

export type Receipt = {
  readonly id: ReceiptId;
  readonly href: string;
  readonly recordedAt: Instant;
  readonly sourceClass: SourceClass;
};

export type HostAction =
  | { readonly type: 'stale'; readonly channel: ChannelId }
  | { readonly type: 'unavailable'; readonly channel: ChannelId }
  | { readonly type: 'fault'; readonly fault: FaultId }
  | { readonly type: 'advance-clock'; readonly byMs: number }
  | { readonly type: 'step'; readonly transitionId: TransitionId };

export type FaultId =
  | 'pinch'
  | 's1-open'
  | 's2-open'
  | 'q1-off'
  | 'contact-ambiguous'
  | 'link-loss'
  | 'stuck-switch'
  | 'training-timeout';

export type Plant = {
  readonly fixtureId: FixtureId;
  readonly sourceClass: SourceClass;
  readonly phase: Phase;
  readonly interlocks: Interlocks;
  readonly samples: Readonly<Record<string, Sample>>;
  readonly receipts: Readonly<Record<string, Receipt>>;
  readonly clockMs: number;
  readonly freshWithinMs: number;
  readonly contact: 'seated' | 'settling' | 'ambiguous' | 'clear';
};

export type PaintedChannel = {
  readonly channel: ChannelId;
  readonly paint: Honesty;
  readonly sample: Sample;
  readonly receipt: Receipt;
};

export type PlantView = {
  readonly fixtureId: FixtureId;
  readonly sourceClass: SourceClass;
  readonly banner: 'SIMULATED PLANT';
  readonly phase: Phase;
  readonly interlocks: Interlocks;
  readonly video: VideoState;
  readonly channels: readonly PaintedChannel[];
  readonly clock: Instant;
  readonly receipts: readonly Receipt[];
};

export class FailClosedError extends Error {
  readonly code = 'FAIL_CLOSED' as const;
  constructor(message: string) {
    super(message);
    this.name = 'FailClosedError';
  }
}

export class IllegalPlantError extends Error {
  readonly code = 'ILLEGAL_PLANT' as const;
  constructor(message: string) {
    super(message);
    this.name = 'IllegalPlantError';
  }
}

export const CHANNEL = {
  dryBulb: 'air.dry-bulb' as ChannelId,
  humidity: 'air.relative-humidity' as ChannelId,
  illuminance: 'enclosure.illuminance' as ChannelId,
  branchVoltage: 'rail.local-branch-voltage' as ChannelId,
} as const;

export const FRESH_WITHIN_MS = 30_000;
export const EPOCH_MS = Date.parse('2026-08-22T00:00:00.000Z');
