import {
  IllegalPlantError,
  type Instant,
  type Interlocks,
  type LoadSwitch,
  type MateSense,
  type Phase,
  type TransitionId,
  type VideoMuteReason,
  type VideoState,
} from './types.ts';

export const TRANSITIONS = [
  {
    id: 't01-seat' as TransitionId,
    from: 'absent' as const,
    to: 'mechanically-seated' as const,
  },
  {
    id: 't02-mate' as TransitionId,
    from: 'mechanically-seated' as const,
    to: 'power-mated' as const,
  },
  {
    id: 't03-train' as TransitionId,
    from: 'power-mated' as const,
    to: 'training-window' as const,
  },
  {
    id: 't04-admit' as TransitionId,
    from: 'training-window' as const,
    to: 'link-trained' as const,
  },
  {
    id: 't05-training-fault' as TransitionId,
    from: 'training-window' as const,
    to: 'fault-latched' as const,
  },
  {
    id: 't06-active-fault' as TransitionId,
    from: 'link-trained' as const,
    to: 'fault-latched' as const,
  },
  {
    id: 't07-pinch-safe' as TransitionId,
    from: 'link-trained' as const,
    to: 'pinch-safe' as const,
  },
  {
    id: 't08-lift' as TransitionId,
    from: 'pinch-safe' as const,
    to: 'lifted' as const,
  },
  {
    id: 't09-indexed-release' as TransitionId,
    from: 'lifted' as const,
    to: 'mechanically-seated' as const,
  },
  {
    id: 't10-interrupted-pinch' as TransitionId,
    from: 'pinch-safe' as const,
    to: 'mechanically-seated' as const,
  },
  {
    id: 't11-fault-detach' as TransitionId,
    from: 'fault-latched' as const,
    to: 'absent' as const,
  },
] as const;

export type Transition = (typeof TRANSITIONS)[number];

export const transitionById = (id: TransitionId): Transition => {
  const found = TRANSITIONS.find((row) => row.id === id);
  if (!found) {
    throw new IllegalPlantError(`unknown transition ${id}`);
  }
  return found;
};

export const mateOpen = { kind: 'open' } as const satisfies MateSense;
export const mateClosed = { kind: 'closed' } as const satisfies MateSense;
export const q1Off = { kind: 'off' } as const satisfies LoadSwitch;
export const q1Limited = { kind: 'current-limited' } as const satisfies LoadSwitch;
export const q1On = { kind: 'on' } as const satisfies LoadSwitch;
export const q1Discharging = {
  kind: 'discharging',
  thresholdStatus: 'unverified',
} as const satisfies LoadSwitch;

export const interlocksFor = (phase: Phase): Interlocks => {
  switch (phase) {
    case 'absent':
      return { s1: mateOpen, s2: mateOpen, q1: q1Off };
    case 'mechanically-seated':
      return { s1: mateOpen, s2: mateOpen, q1: q1Off };
    case 'power-mated':
      return { s1: mateClosed, s2: mateClosed, q1: q1Off };
    case 'training-window':
      return { s1: mateClosed, s2: mateClosed, q1: q1Limited };
    case 'link-trained':
      return { s1: mateClosed, s2: mateClosed, q1: q1On };
    case 'fault-latched':
      return { s1: mateClosed, s2: mateClosed, q1: q1Off };
    case 'pinch-safe':
      return { s1: mateOpen, s2: mateClosed, q1: q1Discharging };
    case 'lifted':
      return { s1: mateOpen, s2: mateClosed, q1: q1Off };
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
};

export const contactFor = (
  phase: Phase,
): 'seated' | 'settling' | 'ambiguous' | 'clear' => {
  switch (phase) {
    case 'absent':
      return 'clear';
    case 'mechanically-seated':
      return 'settling';
    case 'power-mated':
    case 'training-window':
    case 'link-trained':
      return 'seated';
    case 'fault-latched':
      return 'ambiguous';
    case 'pinch-safe':
      return 'seated';
    case 'lifted':
      return 'clear';
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
};

const isOpen = (mate: MateSense): boolean => mate.kind === 'open';
const isClosed = (mate: MateSense): boolean => mate.kind === 'closed';
const q1Energized = (q1: LoadSwitch): boolean =>
  q1.kind === 'on' || q1.kind === 'current-limited';

export const videoMuteReason = (input: {
  readonly phase: Phase;
  readonly interlocks: Interlocks;
  readonly contact: 'seated' | 'settling' | 'ambiguous' | 'clear';
}): VideoMuteReason | null => {
  const { phase, interlocks, contact } = input;
  if (interlocks.s1.kind === 'stuck-disagree' || interlocks.s2.kind === 'stuck-disagree') {
    return 'fault';
  }
  if (phase === 'fault-latched') return 'fault';
  if (phase === 'pinch-safe') return 'pinch';
  if (contact === 'ambiguous') return 'contact-ambiguous';
  if (isOpen(interlocks.s1) && phase !== 'absent') return 's1-open';
  if (isOpen(interlocks.s2)) return 's2-open';
  if (!q1Energized(interlocks.q1) && phase === 'link-trained') return 'q1-off';
  if (phase !== 'link-trained') return 'phase-not-link-trained';
  if (!isClosed(interlocks.s1)) return 's1-open';
  if (!isClosed(interlocks.s2)) return 's2-open';
  if (interlocks.q1.kind !== 'on') return 'q1-off';
  if (contact !== 'seated') return 'contact-ambiguous';
  return null;
};

export const deriveVideo = (input: {
  readonly phase: Phase;
  readonly interlocks: Interlocks;
  readonly contact: 'seated' | 'settling' | 'ambiguous' | 'clear';
}): VideoState => {
  const reason = videoMuteReason(input);
  if (reason) {
    return { kind: 'unavailable', reason, stream: 'none' };
  }
  return {
    kind: 'available',
    stream: 'none',
    note: 'A4a has no live camera stream',
  };
};

export const assertLegal = (input: {
  readonly phase: Phase;
  readonly interlocks: Interlocks;
  readonly contact: 'seated' | 'settling' | 'ambiguous' | 'clear';
}): void => {
  const video = deriveVideo(input);
  if (input.phase === 'link-trained' && video.kind !== 'available') {
    throw new IllegalPlantError(
      `link-trained cannot keep video muted (${video.kind === 'unavailable' ? video.reason : 'available'})`,
    );
  }
  if (input.phase !== 'link-trained' && video.kind === 'available') {
    throw new IllegalPlantError(`${input.phase} cannot admit video`);
  }
  if (q1Energized(input.interlocks.q1) && (isOpen(input.interlocks.s1) || isOpen(input.interlocks.s2))) {
    throw new IllegalPlantError('Q1 cannot energize while S1 or S2 is open');
  }
  if (input.phase === 'lifted' && q1Energized(input.interlocks.q1)) {
    throw new IllegalPlantError('lifted carriage cannot keep Q1 on');
  }
};

export const instantFromMs = (ms: number): Instant =>
  new Date(ms).toISOString() as Instant;
