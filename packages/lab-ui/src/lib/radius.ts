export const radius = {
  frame: 0,
  statusDot: '9999px',
} as const;

export type RadiusName = keyof typeof radius;
