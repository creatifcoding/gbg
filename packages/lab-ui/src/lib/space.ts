export const space = {
  railWidth: '420px',
  headerHeight: '3rem',
  cardPadding: '0.75rem',
  gap: '0.75rem',
  pillInlinePadding: '0.375rem',
  pillBlockPadding: '0.125rem',
  statusDot: '0.375rem',
  mediaHeight: '10rem',
  gridHeight: '16rem',
  valueMin: '1em',
} as const;

export type SpaceName = keyof typeof space;
