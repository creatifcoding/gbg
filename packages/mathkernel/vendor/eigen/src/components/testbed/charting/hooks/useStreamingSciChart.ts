import { useEffect, useRef, useState } from 'react';
import { Cause, Chunk, Effect, Fiber, Stream } from 'effect';
import type { ChartSeries, ChartState } from '@/lib/charting/v2';
import {
  applyStreamBatch,
  createBufferedPointStream,
  emptyStreamStats,
  type StreamStats,
} from '../stream';

type StreamInstance = {
  appendBatchFast?: (
    points: ReadonlyArray<ChartSeries[number]>,
    maxPoints?: number
  ) => void;
  appendPointFast?: (point: ChartSeries[number], maxPoints?: number) => void;
};

export const useStreamingSciChart = (params: {
  state: ChartState;
  isStreaming: boolean;
  instance: StreamInstance | null;
  pointCount: number;
  targetFps: number;
  appendData: (data: ChartSeries) => unknown;
  clearData: () => unknown;
  scope: string;
}) => {
  const {
    state,
    isStreaming,
    instance,
    pointCount,
    targetFps,
    appendData,
    clearData,
    scope,
  } = params;

  const [fps, setFps] = useState(0);
  const [streamStats, setStreamStats] = useState<StreamStats>(emptyStreamStats());
  const tickRef = useRef(0);
  const statsRef = useRef<StreamStats>(emptyStreamStats());

  useEffect(() => {
    if (state !== 'READY' || !isStreaming || !instance) return;

    const flushIntervalMs = Math.max(
      1,
      Math.floor(1000 / Math.max(1, targetFps))
    );
    let frameCount = 0;
    let lastSecond = performance.now();

    statsRef.current = emptyStreamStats();

    const firehoseStream = createBufferedPointStream({
      tickRef,
      flushIntervalMs,
    });

    const streamFiber = Effect.runFork(
      firehoseStream.pipe(
        Stream.tap((chunk) =>
          Effect.sync(() => {
            const points = Chunk.toReadonlyArray(
              Chunk.takeRight(chunk, Math.max(1, pointCount))
            );
            if (points.length === 0) return;

            const flushStart = performance.now();
            const mode = applyStreamBatch({
              instance,
              points,
              maxPoints: pointCount,
              appendData,
            });

            statsRef.current.mode = mode;
            statsRef.current.batches += 1;
            statsRef.current.pointsApplied += points.length;
            statsRef.current.lastFlushMs = performance.now() - flushStart;

            frameCount += points.length;
            const now = performance.now();
            if (now - lastSecond >= 1000) {
              setFps(frameCount);
              setStreamStats({ ...statsRef.current });
              frameCount = 0;
              lastSecond = now;
            }
          })
        ),
        Stream.runDrain,
        Effect.catchAllCause((cause) =>
          Effect.logError(`[ChartingTestbed] ${scope}:stream\n${Cause.pretty(cause)}`)
        )
      )
    );

    return () => {
      Effect.runFork(Fiber.interrupt(streamFiber));
      setStreamStats(emptyStreamStats());
      void clearData();
    };
  }, [
    state,
    isStreaming,
    instance,
    pointCount,
    targetFps,
    appendData,
    clearData,
    scope,
  ]);

  return {
    fps,
    streamStats,
  } as const;
};
