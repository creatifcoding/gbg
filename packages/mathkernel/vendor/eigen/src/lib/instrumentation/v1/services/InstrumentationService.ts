import { Effect, Context, Layer, Ref } from 'effect';
import type {
  InstrumentationConfigShape,
  CapturedSpan,
  SpanAttributes,
  SpanKind,
  SpanStatus,
} from '../types';

export class InstrumentationConfig extends Context.Tag(
  'tmnl/instrumentation/Config'
)<InstrumentationConfig, InstrumentationConfigShape>() {
  static Default = Layer.succeed(this, {
    serviceName: 'tmnl',
    enableTracing: true,
    enableMetrics: false,
    sampleRate: 1.0,
  });

  static Custom = (config: InstrumentationConfigShape) =>
    Layer.succeed(this, config);
}

export class InstrumentationService extends Effect.Service<InstrumentationService>()(
  'tmnl/instrumentation/InstrumentationService',
  {
    effect: Effect.gen(function* () {
      const config = yield* InstrumentationConfig;
      const capturedSpans = yield* Ref.make<readonly CapturedSpan[]>([]);
      const activeSpans = yield* Ref.make<Map<string, CapturedSpan>>(new Map());

      const captureSpan = (span: CapturedSpan) =>
        Effect.gen(function* () {
          if (!config.enableTracing) return;

          yield* Ref.update(capturedSpans, (spans) => [...spans, span]);
          yield* Effect.logDebug('Span captured', {
            spanId: span.spanId,
            name: span.name,
            duration:
              span.endTime && span.startTime
                ? span.endTime.getTime() - span.startTime.getTime()
                : undefined,
          });
        });

      const startSpan = (
        name: string,
        kind: SpanKind,
        attributes: SpanAttributes
      ) =>
        Effect.gen(function* () {
          const spanId = crypto.randomUUID();
          const traceId = crypto.randomUUID();

          const span: CapturedSpan = {
            spanId,
            traceId,
            name,
            kind,
            startTime: new Date(),
            status: 'unset',
            attributes,
            events: [],
            serviceName: config.serviceName,
          };

          yield* Ref.update(activeSpans, (spans) =>
            new Map(spans).set(spanId, span)
          );

          return spanId;
        });

      const endSpan = (spanId: string, status: SpanStatus) =>
        Effect.gen(function* () {
          const spans = yield* Ref.get(activeSpans);
          const span = spans.get(spanId);

          if (!span) {
            yield* Effect.logWarning('Attempted to end non-existent span', {
              spanId,
            });
            return;
          }

          const completedSpan: CapturedSpan = {
            ...span,
            endTime: new Date(),
            status,
          };

          yield* captureSpan(completedSpan);
          yield* Ref.update(activeSpans, (s) => {
            const updated = new Map(s);
            updated.delete(spanId);
            return updated;
          });
        });

      const getCapturedSpans = () => Ref.get(capturedSpans);

      const clearCapturedSpans = () => Ref.set(capturedSpans, []);

      return {
        captureSpan,
        startSpan,
        endSpan,
        getCapturedSpans,
        clearCapturedSpans,
      } as const;
    }),
    dependencies: [InstrumentationConfig.Default],
  }
) {}
