import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Pill, Socket } from '../src/index.ts';

describe('blank chrome', () => {
  it('draws a socket with no value', () => {
    const { container } = render(<Socket />);
    const box = container.querySelector('[data-socket="value"]');
    expect(box).not.toBeNull();
    expect(box?.textContent).toBe('');
  });

  it('draws an empty pill with no status word', () => {
    const { container } = render(<Pill />);
    const pill = container.querySelector('[data-tone="empty"]');
    expect(pill).not.toBeNull();
    expect(pill?.textContent).toBe('');
  });
});
