import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useStreamingSciChart } from '../hooks/useStreamingSciChart';

describe('useStreamingSciChart', () => {
  it('emits streaming diagnostics when active with appendBatchFast instance', async () => {
    const appendBatchFast = vi.fn();

    const { result, unmount } = renderHook(() =>
      useStreamingSciChart({
        state: 'READY',
        isStreaming: true,
        instance: { appendBatchFast },
        pointCount: 128,
        targetFps: 60,
        appendData: () => undefined,
        clearData: () => undefined,
        scope: 'stream-test',
      })
    );

    await waitFor(
      () => {
        expect(result.current.streamStats.batches).toBeGreaterThan(0);
        expect(result.current.streamStats.pointsApplied).toBeGreaterThan(0);
        expect(result.current.streamStats.mode).toBe('batch');
        expect(appendBatchFast).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );

    unmount();
  });
});
