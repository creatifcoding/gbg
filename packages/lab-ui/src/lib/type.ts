export const typeFace = {
  sans: 'Inter, sans-serif',
  mono: 'IBM Plex Mono, monospace',
} as const;

export const typeSize = {
  micro: '9px',
  label: '10px',
  kicker: '11px',
  body: '12px',
  copy: '14px',
} as const;

export const typeTrack = {
  kicker: '0.2em',
  wider: '0.05em',
  widest: '0.1em',
  tight: '-0.025em',
} as const;

export const typeWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
} as const;

export type TypeSize = keyof typeof typeSize;
