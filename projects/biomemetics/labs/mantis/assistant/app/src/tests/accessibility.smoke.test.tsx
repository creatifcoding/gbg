import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../kernel/log';
import { App } from '../ui/App';
import { expectBlankFields, expectNoBannedCopy, TELEMETRY_FIELDS } from './chrome';

describe('accessibility smoke', () => {
  it('exposes named surfaces, hides Service, and never calls terrarium safe', async () => {
    render(<App store={new MemoryStore()} />);
    expect(await screen.findByRole('navigation', { name: 'Keeper surfaces' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Observe' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ask' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Terrarium' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lab' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Service' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Keeper notebook' })).toBeInTheDocument();
  });

  it('draws terrarium telemetry chrome with blank values', async () => {
    render(<App store={new MemoryStore()} />);
    await act(async () => {
      screen.getByRole('button', { name: 'Terrarium' }).click();
    });
    const box = await screen.findByRole('article', { name: 'Terrarium telemetry' });
    expect(box).toBeInTheDocument();
    expectBlankFields(box, TELEMETRY_FIELDS);
    expect(screen.getByRole('status').textContent?.toLowerCase()).toContain('unavailable');
    expectNoBannedCopy();
  });

  it('keeps feeding controls named for a screen reader', async () => {
    render(<App store={new MemoryStore()} />);
    await act(async () => {
      screen.getByRole('button', { name: 'Observe' }).click();
    });
    expect(await screen.findByRole('button', { name: 'Offered' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Eaten' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refused' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Removed' })).toBeInTheDocument();
    expect(screen.getByLabelText('Observation (observed)')).toBeInTheDocument();
  });
});
