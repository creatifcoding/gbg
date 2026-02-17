import { Effect, Stream } from 'effect';
import { buffer as streamBuffer } from '@/lib/streams';
import type { ChartSeries } from '@/lib/charting/v2';

export const createPointEffect = (tickRef: { current: number }) =>
  Effect.sync(() => {
    const t = tickRef.current;
    const y =
      Math.sin(t * 0.08) * 0.9 +
      Math.sin(t * 0.015) * 0.6 +
      (Math.random() - 0.5) * 0.12;
    tickRef.current += 1;
    return { t, x: t, y };
  }).pipe(Effect.tap(() => Effect.yieldNow()));

export const createBufferedPointStream = (params: {
  tickRef: { current: number };
  flushIntervalMs: number;
}) =>
  Stream.repeatEffect(createPointEffect(params.tickRef)).pipe(
    streamBuffer(`${params.flushIntervalMs} millis`)
  ) as Stream.Stream<ChartSeries>;
