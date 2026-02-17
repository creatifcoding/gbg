import { describe, expect, it } from 'vitest';

import {
  generateVisualStyleCSSProperties,
  generateVisualStyleCSSString,
  getMarkTextColor,
  parseVisualStyle,
} from '../visual-style-generator';

describe('visual-style-generator', () => {
  it('parses visual style from JSON string', () => {
    const parsed = parseVisualStyle(
      JSON.stringify({
        type: 'highlight',
        color: 'accent.cyan',
        effect: 'none',
        animated: false,
      })
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.color).toBe('accent.cyan');
    expect(parsed?.type).toBe('highlight');
  });

  it('parses visual style from object payload', () => {
    const parsed = parseVisualStyle({
      type: 'pill',
      color: 'accent.purple',
      effect: 'glow',
      animated: true,
    });

    expect(parsed).not.toBeNull();
    expect(parsed?.type).toBe('pill');
    expect(parsed?.color).toBe('accent.purple');
    expect(parsed?.effect).toBe('glow');
    expect(parsed?.animated).toBe(true);
  });

  it('uses token color fallback for non-yellow highlight colors', () => {
    const css = generateVisualStyleCSSString({
      type: 'highlight',
      color: 'accent.cyan',
      effect: 'none',
      animated: false,
    });

    expect(css).toContain('background-color: var(--tmnl-accent-cyan, #00d4aa)');
    expect(css).toContain('--mark-color: var(--tmnl-accent-cyan, #00d4aa)');
  });

  it('assigns contrast text color for filled marks', () => {
    const highlightProps = generateVisualStyleCSSProperties({
      type: 'highlight',
      color: 'accent.yellow',
      effect: 'none',
      animated: false,
    });

    const pillProps = generateVisualStyleCSSProperties({
      type: 'pill',
      color: 'accent.purple',
      effect: 'none',
      animated: false,
    });

    expect(highlightProps.color).toBe('var(--tmnl-surface-0, #0d0d14)');
    expect(pillProps.color).toBe('var(--tmnl-text-primary, #f0f0f0)');
  });

  it('computes readable text color by token luminance', () => {
    expect(getMarkTextColor('accent.yellow')).toBe('var(--tmnl-surface-0, #0d0d14)');
    expect(getMarkTextColor('accent.purple')).toBe('var(--tmnl-text-primary, #f0f0f0)');
  });
});
