import { describe, expect, it } from 'vitest';
import {
  VANTA_BORDERS,
  VANTA_COLORS,
  VANTA_TYPOGRAPHY,
  chrome,
  color,
  typeFace,
} from '../src/index.ts';

describe('lab-ui tokens', () => {
  it('paints chrome from VANTA', () => {
    expect(color.void).toBe(VANTA_COLORS.surface.void);
    expect(color.base).toBe(VANTA_COLORS.surface.base);
    expect(color.elevated).toBe(VANTA_COLORS.surface.elevated);
    expect(color.primary).toBe(VANTA_COLORS.text.primary);
    expect(color.emerald).toBe(VANTA_COLORS.accent.emerald);
    expect(chrome.color.void).toBe(VANTA_COLORS.surface.void);
    expect(chrome.radius.frame).toBe(VANTA_BORDERS.radius.none);
  });

  it('has no second hex palette', () => {
    expect(color).not.toHaveProperty('charcoal500');
    expect(color).not.toHaveProperty('textmain');
    expect(color).not.toHaveProperty('emerald500');
    expect(chrome.color).not.toHaveProperty('charcoal600');
  });

  it('maps type faces onto VANTA', () => {
    expect(typeFace.sans).toBe(VANTA_TYPOGRAPHY.family.sans);
    expect(typeFace.mono).toBe(VANTA_TYPOGRAPHY.family.mono);
    expect(chrome.font.mono).toBe(VANTA_TYPOGRAPHY.family.mono);
  });
});
