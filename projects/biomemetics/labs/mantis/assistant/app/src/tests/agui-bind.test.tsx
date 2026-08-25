import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { emptyAssistantRun, resolveAguiBind } from '../contracts/a0';
import { MemoryStore } from '../kernel/log';
import { App } from '../ui/App';
import { expectBlankFields, expectNoBannedCopy, TELEMETRY_FIELDS } from './chrome';

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

describe('Ask CopilotKit chrome', () => {
  it('draws a blank local stream and blank terrarium telemetry', async () => {
    render(<App store={new MemoryStore()} />);
    await act(async () => {
      screen.getByRole('button', { name: 'Ask' }).click();
    });
    const streamBox = await screen.findByRole('region', { name: 'CopilotKit stream' });
    expect(streamBox).toBeInTheDocument();
    expectBlankFields(streamBox, ['stream']);
    expectNoBannedCopy();

    await act(async () => {
      screen.getByRole('button', { name: 'Terrarium' }).click();
    });
    const telemetry = await screen.findByRole('article', { name: 'Terrarium telemetry' });
    expect(telemetry).toBeInTheDocument();
    expectBlankFields(telemetry, TELEMETRY_FIELDS);
    expectNoBannedCopy();
  });
});
