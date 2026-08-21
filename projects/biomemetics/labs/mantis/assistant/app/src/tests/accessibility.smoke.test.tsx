import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MemoryStore } from '../kernel/log';
import { App } from '../ui/App';

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

  it('renders the terrarium as an empty well, never as safe', async () => {
    render(<App store={new MemoryStore()} />);
    await act(async () => {
      screen.getByRole('button', { name: 'Terrarium' }).click();
    });
    expect(await screen.findByRole('heading', { name: 'Telemetry well' })).toBeInTheDocument();
    expect(screen.getByText(/this well is empty/i)).toBeInTheDocument();
    expect(screen.getByRole('status').textContent?.toLowerCase()).toContain('unavailable');
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/\bsafe\b/);
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
