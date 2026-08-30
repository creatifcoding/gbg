import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { galleryViews } from '../src/gallery.tsx';
import { TerrariumCard } from '../src/TerrariumCard.tsx';

describe('TerrariumCard paints fixture honesty', () => {
  it('paints known and simulated on known-fresh', () => {
    const { container } = render(<TerrariumCard view={galleryViews.known} />);
    const card = container.querySelector('.terra-card');
    expect(card?.getAttribute('data-source-class')).toBe('simulated');
    expect(card?.getAttribute('data-video')).toBe('available');
    expect(container.querySelector('[data-channel="air.dry-bulb"]')?.getAttribute('data-honesty')).toBe(
      'known',
    );
    expect(
      container.querySelector('[data-channel="enclosure.illuminance"]')?.getAttribute('data-honesty'),
    ).toBe('simulated');
    expect(container.textContent).toMatch(/SIMULATED PLANT/);
    expect(container.textContent).toMatch(/stream=none/);
    expect(container.textContent).toMatch(/rec\.air\.dry-bulb\.known/);
  });

  it('paints stale after inject', () => {
    const { container } = render(<TerrariumCard view={galleryViews.stale} />);
    expect(container.querySelector('[data-channel="air.dry-bulb"]')?.getAttribute('data-honesty')).toBe(
      'stale',
    );
  });

  it('paints faulted and mutes video after pinch inject', () => {
    const { container } = render(<TerrariumCard view={galleryViews.faulted} />);
    expect(container.querySelector('.terra-card')?.getAttribute('data-video')).toBe('unavailable');
    expect(
      container.querySelector('[data-channel="rail.local-branch-voltage"]')?.getAttribute('data-honesty'),
    ).toBe('faulted');
    expect(container.textContent).toMatch(/Camera unavailable/);
  });

  it('paints unavailable channels from the fixture', () => {
    const { container } = render(<TerrariumCard view={galleryViews.unavailable} />);
    expect(
      container.querySelector('[data-channel="air.relative-humidity"]')?.getAttribute('data-honesty'),
    ).toBe('unavailable');
    expect(
      container.querySelector('[data-channel="enclosure.illuminance"]')?.getAttribute('data-honesty'),
    ).toBe('unavailable');
  });

  it('gallery holds one card per honesty class', () => {
    expect(galleryViews.known.channels.some((channel) => channel.paint === 'known')).toBe(true);
    expect(galleryViews.stale.channels.some((channel) => channel.paint === 'stale')).toBe(true);
    expect(galleryViews.simulated.channels.some((channel) => channel.paint === 'simulated')).toBe(true);
    expect(galleryViews.faulted.channels.some((channel) => channel.paint === 'faulted')).toBe(true);
    expect(galleryViews.unavailable.channels.some((channel) => channel.paint === 'unavailable')).toBe(
      true,
    );
  });
});
