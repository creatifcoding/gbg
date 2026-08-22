export const color = {
  void: '#000000',
  charcoal500: '#0a0a0a',
  charcoal600: '#050505',
  charcoal200: '#222222',
  charcoal300: '#1a1a1a',
  textmain: '#d4d4d4',
  textmuted: '#8a8a8a',
  textdim: '#555555',
  emerald500: '#10b981',
  amber500: '#f59e0b',
  cyan500: '#06b6d4',
  rose500: '#f43f5e',
} as const;

export type ColorName = keyof typeof color;
