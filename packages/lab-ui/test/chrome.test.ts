import { describe, expect, it } from 'vitest';
import { chrome, color, typeFace } from '../src/index.ts';

describe('lab-ui tokens', () => {
  it('owns void as black', () => {
    expect(color.void).toBe('#000000');
    expect(chrome.color.void).toBe('#000000');
  });

  it('owns Workbench type', () => {
    expect(typeFace.sans).toBe('Inter, sans-serif');
    expect(typeFace.mono).toBe('IBM Plex Mono, monospace');
    expect(chrome.font.mono).toBe(typeFace.mono);
  });
});
