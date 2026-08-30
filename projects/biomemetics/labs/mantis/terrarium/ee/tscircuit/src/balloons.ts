export type BalloonId = 'B19' | 'B27' | 'B44' | 'B48' | 'B50';

export type Balloon = {
  readonly id: BalloonId;
  readonly item: string;
  readonly manufacturerPartNumber: '';
  readonly status: 'ref' | 'target' | 'unverified';
};

export const ADMITTED_BALLOON_IDS = ['B19', 'B27', 'B44', 'B48', 'B50'] as const;

export const BALLOONS: readonly Balloon[] = [
  {
    id: 'B19',
    item: 'P01-P08 continuous electrode flex plus V-dock pads',
    manufacturerPartNumber: '',
    status: 'unverified',
  },
  {
    id: 'B27',
    item: '12-position spring contact array',
    manufacturerPartNumber: '',
    status: 'unverified',
  },
  {
    id: 'B44',
    item: 'fused rail power tap',
    manufacturerPartNumber: '',
    status: 'target',
  },
  {
    id: 'B48',
    item: 'local supervisor, normally-open S1 carriage-mate switch, normally-open S2 binder-mate switch, per-carriage Q1 current-limited load switch, discharge, and bus isolation',
    manufacturerPartNumber: '',
    status: 'unverified',
  },
  {
    id: 'B50',
    item: 'separate keyed 12-net carriage-to-binder connector/contact system',
    manufacturerPartNumber: '',
    status: 'unverified',
  },
];

export const B19_PLACEMENT = {
  id: 'B19',
  pads: 'omitted',
  reason: 'V-dock stack-up unverified',
} as const;

export const STUDY_FOOTPRINT = {
  pinHeader: 'pinrow12',
  fuse: '0603',
  switch: 'pinrow2',
  mosfet: 'sot23',
  note: 'study footprint, not a selected series',
} as const;
