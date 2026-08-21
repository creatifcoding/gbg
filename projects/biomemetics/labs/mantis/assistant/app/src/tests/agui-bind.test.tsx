import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { emptyAssistantRun, resolveAguiBind } from '../contracts/a0';
import { MemoryStore } from '../kernel/log';
import { App } from '../ui/App';

describe('resolveAguiBind', () => {
  it('returns local when runtimeUrl is empty and CopilotKit is present', () => {
    expect(
      resolveAguiBind({
        runtimeUrl: '',
        copilotKitPresent: true,
        a0MastraAdapterPresent: false,
      }),
    ).toEqual({ kind: 'local' });
  });

  it('returns http when runtimeUrl is set', () => {
    expect(
      resolveAguiBind({
        runtimeUrl: 'https://a0.example/agui',
        copilotKitPresent: true,
        a0MastraAdapterPresent: false,
      }),
    ).toEqual({ kind: 'http', runtimeUrl: 'https://a0.example/agui' });
  });

  it('returns empty when neither CopilotKit nor an A0 adapter exists', () => {
    expect(
      resolveAguiBind({
        runtimeUrl: '',
        copilotKitPresent: false,
        a0MastraAdapterPresent: false,
      }),
    ).toEqual({ kind: 'empty' });
  });

  it('maps local and http binds to a bound AssistantRun mastra field', () => {
    expect(emptyAssistantRun('care').mastra).toBe('bound');
  });
});

describe('Ask Mastra well', () => {
  it('shows local-bind copy, not empty-well, and keeps Terrarium empty', async () => {
    render(<App store={new MemoryStore()} />);
    await act(async () => {
      screen.getByRole('button', { name: 'Ask' }).click();
    });
    expect(await screen.findByRole('heading', { name: 'Bound locally' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Empty well' })).not.toBeInTheDocument();

    await act(async () => {
      screen.getByRole('button', { name: 'Terrarium' }).click();
    });
    expect(await screen.findByRole('heading', { name: 'Telemetry well' })).toBeInTheDocument();
    expect(screen.getByText(/this well is empty/i)).toBeInTheDocument();
    expect(document.body.textContent?.toLowerCase()).not.toMatch(/\bsafe\b/);
  });
});
