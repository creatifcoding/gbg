import { Either, Schema } from 'effect';
import {
  AuditEvent as AuditEventSchema,
  type AuditEvent,
  type DriftCategory,
  type DriftRecord,
  type ReplayStatus,
} from '../schemas';

export type ReplaySeverity = 'low' | 'medium' | 'high' | 'critical';
export type ReplayChannel = 'strict' | 'tolerant';

export interface DriftSummaryCounts {
  readonly strict_mismatch: number;
  readonly strict_missing_event: number;
  readonly tolerant_drift_numeric: number;
  readonly tolerant_drift_temporal: number;
  readonly schema_drift: number;
  readonly config_drift: number;
}

export interface ReplayClassificationResult {
  readonly status: ReplayStatus;
  readonly severity: ReplaySeverity;
  readonly recommendedAction: string;
  readonly strictDriftCount: number;
  readonly tolerantDriftCount: number;
  readonly summaryCounts: DriftSummaryCounts;
  readonly drifts: ReadonlyArray<DriftRecord>;
}

interface IndexedEvent {
  readonly event: AuditEvent;
  readonly index: number;
  readonly channel: ReplayChannel;
}

const STRICT_CHANNEL_EVENT_TAGS = new Set<AuditEvent['_tag']>([
  'RunCreated',
  'HypothesisSeeded',
  'HookPlanCompiledEvent',
  'HookInvoked',
  'MatrixDrafted',
  'VerdictRatified',
]);

const TOLERANT_CHANNEL_EVENT_TAGS = new Set<AuditEvent['_tag']>(['ReplayEvaluated']);

const TOLERANCE_ENVELOPES = {
  numericAbsEpsilon: 1e-6,
  durationRelativeTolerance: 0.05,
  timestampDriftWindowMs: 250,
  tolerantHighCountThreshold: 5,
  tolerantHighFrequencyThreshold: 0.3,
} as const;

const STRICT_REQUIRED_COUNTS: ReadonlyArray<
  | { readonly eventType: AuditEvent['_tag']; readonly exact: number }
  | { readonly eventType: AuditEvent['_tag']; readonly minimum: number }
> = [
  { eventType: 'RunCreated', exact: 1 },
  { eventType: 'HypothesisSeeded', minimum: 2 },
  { eventType: 'HookPlanCompiledEvent', exact: 1 },
  { eventType: 'MatrixDrafted', exact: 1 },
  { eventType: 'VerdictRatified', exact: 1 },
];

const emptySummaryCounts = (): DriftSummaryCounts => ({
  strict_mismatch: 0,
  strict_missing_event: 0,
  tolerant_drift_numeric: 0,
  tolerant_drift_temporal: 0,
  schema_drift: 0,
  config_drift: 0,
});

const pushDrift = (
  drifts: DriftRecord[],
  summary: { -readonly [K in keyof DriftSummaryCounts]: number },
  drift: DriftRecord
): void => {
  drifts.push(drift);
  summary[drift.category] += 1;
};

const classifyChannel = (event: AuditEvent): ReplayChannel => {
  if (TOLERANT_CHANNEL_EVENT_TAGS.has(event._tag)) {
    return 'tolerant';
  }

  if (STRICT_CHANNEL_EVENT_TAGS.has(event._tag)) {
    return 'strict';
  }

  // Fail-safe: unknown classifications are treated as strict to protect replay integrity.
  return 'strict';
};

const isDurationLikePath = (path: string): boolean =>
  /(^|\.)(duration|latency|elapsedMs|durationMs|latencyMs)$/i.test(path);

const collectNumericFields = (
  value: unknown,
  path = ''
): ReadonlyArray<{ readonly path: string; readonly value: number }> => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return [{ path, value }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry, index) =>
      collectNumericFields(entry, `${path}[${index}]`)
    );
  }

  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, entry]) =>
      collectNumericFields(entry, path.length > 0 ? `${path}.${key}` : key)
    );
  }

  return [];
};

const numericFieldMap = (event: AuditEvent): ReadonlyMap<string, number> => {
  const entries = collectNumericFields(event)
    .filter(({ path }) => !/(^|\.)timestamp$/i.test(path))
    .map(({ path, value }) => [path, value] as const);

  return new Map(entries);
};

const eventCount = (
  events: ReadonlyArray<AuditEvent>,
  eventType: AuditEvent['_tag']
): number => events.filter((event) => event._tag === eventType).length;

const uniqueCount = <T>(entries: ReadonlyArray<T>): number => new Set(entries).size;

const dedupeDrifts = (drifts: ReadonlyArray<DriftRecord>): ReadonlyArray<DriftRecord> => {
  const seen = new Set<string>();
  const deduped: DriftRecord[] = [];

  for (const drift of drifts) {
    const key = `${drift.category}|${drift.eventType}|${drift.eventSequence}|${drift.path}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(drift);
  }

  return deduped;
};

const classifyEscalation = (
  summary: DriftSummaryCounts,
  totalEvents: number
): {
  readonly status: ReplayStatus;
  readonly severity: ReplaySeverity;
  readonly recommendedAction: string;
} => {
  const hasStrict = summary.strict_mismatch > 0 || summary.strict_missing_event > 0;
  const hasSchemaOrConfig = summary.schema_drift > 0 || summary.config_drift > 0;
  const tolerantCount = summary.tolerant_drift_numeric + summary.tolerant_drift_temporal;

  if (hasStrict) {
    return {
      status: 'failed',
      severity: 'critical',
      recommendedAction:
        'Block finalize. Resolve strict drift records first, then rerun replay against canonical artifacts.',
    };
  }

  if (hasSchemaOrConfig) {
    return {
      status: 'failed',
      severity: 'high',
      recommendedAction:
        'Schema/config divergence detected. Rebuild replay using matching schema version and hook/policy/matrix configuration.',
    };
  }

  if (tolerantCount > 0) {
    const tolerantFrequency = tolerantCount / Math.max(totalEvents, 1);
    const promotedToHigh =
      tolerantCount >= TOLERANCE_ENVELOPES.tolerantHighCountThreshold ||
      tolerantFrequency >= TOLERANCE_ENVELOPES.tolerantHighFrequencyThreshold;

    if (promotedToHigh) {
      return {
        status: 'passed_with_warnings',
        severity: 'high',
        recommendedAction:
          'High-frequency tolerant drift. Review envelope policy and telemetry emitters; escalate for manual replay audit.',
      };
    }

    if (tolerantCount > 1) {
      return {
        status: 'passed_with_warnings',
        severity: 'medium',
        recommendedAction:
          'Review tolerant drift records and confirm envelope thresholds are still valid for this run.',
      };
    }

    return {
      status: 'passed_with_warnings',
      severity: 'low',
      recommendedAction: 'Single tolerant drift observed. Monitor only unless frequency increases.',
    };
  }

  return {
    status: 'passed',
    severity: 'low',
    recommendedAction: 'No action required.',
  };
};

export const classifyReplayDrifts = (
  runId: string,
  events: ReadonlyArray<AuditEvent>
): ReplayClassificationResult => {
  const drifts: DriftRecord[] = [];
  const summaryMutable = { ...emptySummaryCounts() };

  const indexedEvents: ReadonlyArray<IndexedEvent> = events.map((event, index) => ({
    event,
    index,
    channel: classifyChannel(event),
  }));

  for (const { event, index } of indexedEvents) {
    const decode = Schema.decodeUnknownEither(AuditEventSchema)(event as unknown);
    if (Either.isLeft(decode)) {
      pushDrift(drifts, summaryMutable, {
        category: 'schema_drift',
        eventType: event._tag,
        eventSequence: index,
        path: `events[${index}]`,
        expected: 'AuditEvent(v1)',
        actual: String(decode.left),
        toleranceApplied: null,
      });
    }

    if (event.runId !== runId) {
      pushDrift(drifts, summaryMutable, {
        category: 'strict_mismatch',
        eventType: event._tag,
        eventSequence: index,
        path: `events[${index}].runId`,
        expected: runId,
        actual: event.runId,
        toleranceApplied: null,
      });
    }
  }

  for (const requirement of STRICT_REQUIRED_COUNTS) {
    const count = eventCount(events, requirement.eventType);

    if ('exact' in requirement) {
      if (count === 0) {
        pushDrift(drifts, summaryMutable, {
          category: 'strict_missing_event',
          eventType: requirement.eventType,
          eventSequence: -1,
          path: `events.${requirement.eventType}`,
          expected: requirement.exact,
          actual: null,
          toleranceApplied: null,
        });
      } else if (count !== requirement.exact) {
        pushDrift(drifts, summaryMutable, {
          category: 'strict_mismatch',
          eventType: requirement.eventType,
          eventSequence: count,
          path: `events.${requirement.eventType}.count`,
          expected: requirement.exact,
          actual: count,
          toleranceApplied: null,
        });
      }
    } else if (count < requirement.minimum) {
      pushDrift(drifts, summaryMutable, {
        category: 'strict_missing_event',
        eventType: requirement.eventType,
        eventSequence: count,
        path: `events.${requirement.eventType}.count`,
        expected: `>= ${requirement.minimum}`,
        actual: count,
        toleranceApplied: null,
      });
    }
  }

  const hookPlanEvents = events.filter(
    (event): event is Extract<AuditEvent, { _tag: 'HookPlanCompiledEvent' }> =>
      event._tag === 'HookPlanCompiledEvent'
  );
  const uniquePlanCount = uniqueCount(hookPlanEvents.map((event) => event.planId));
  if (uniquePlanCount > 1) {
    pushDrift(drifts, summaryMutable, {
      category: 'config_drift',
      eventType: 'HookPlanCompiledEvent',
      eventSequence: uniquePlanCount,
      path: 'events.HookPlanCompiledEvent.planId',
      expected: 'single planId for replay',
      actual: hookPlanEvents.map((event) => event.planId),
      toleranceApplied: null,
    });
  }

  const matrixEvents = events.filter(
    (event): event is Extract<AuditEvent, { _tag: 'MatrixDrafted' }> => event._tag === 'MatrixDrafted'
  );
  const uniqueMatrixCount = uniqueCount(matrixEvents.map((event) => event.matrixId));
  if (uniqueMatrixCount > 1) {
    pushDrift(drifts, summaryMutable, {
      category: 'config_drift',
      eventType: 'MatrixDrafted',
      eventSequence: uniqueMatrixCount,
      path: 'events.MatrixDrafted.matrixId',
      expected: 'single matrixId for replay',
      actual: matrixEvents.map((event) => event.matrixId),
      toleranceApplied: null,
    });
  }

  const strictEvents = indexedEvents.filter((entry) => entry.channel === 'strict');
  for (let i = 1; i < strictEvents.length; i++) {
    const prev = strictEvents[i - 1]!;
    const curr = strictEvents[i]!;

    if (curr.event.timestamp < prev.event.timestamp) {
      pushDrift(drifts, summaryMutable, {
        category: 'strict_mismatch',
        eventType: curr.event._tag,
        eventSequence: curr.index,
        path: `events[${curr.index}].timestamp`,
        expected: `>= ${prev.event.timestamp}`,
        actual: curr.event.timestamp,
        toleranceApplied: null,
      });
    }
  }

  const tolerantEvents = indexedEvents.filter((entry) => entry.channel === 'tolerant');
  for (let i = 1; i < tolerantEvents.length; i++) {
    const prev = tolerantEvents[i - 1]!;
    const curr = tolerantEvents[i]!;

    if (curr.event.timestamp < prev.event.timestamp) {
      const backwardDriftMs = prev.event.timestamp - curr.event.timestamp;
      if (backwardDriftMs > TOLERANCE_ENVELOPES.timestampDriftWindowMs) {
        pushDrift(drifts, summaryMutable, {
          category: 'tolerant_drift_temporal',
          eventType: curr.event._tag,
          eventSequence: curr.index,
          path: `events[${curr.index}].timestamp`,
          expected: `>= ${prev.event.timestamp - TOLERANCE_ENVELOPES.timestampDriftWindowMs}`,
          actual: curr.event.timestamp,
          toleranceApplied: `timestamp-drift-window<=${TOLERANCE_ENVELOPES.timestampDriftWindowMs}ms`,
        });
      }
    }

    if (curr.event._tag !== prev.event._tag) {
      continue;
    }

    const prevNumbers = numericFieldMap(prev.event);
    const currNumbers = numericFieldMap(curr.event);

    for (const [fieldPath, prevValue] of prevNumbers) {
      if (!currNumbers.has(fieldPath)) {
        continue;
      }

      const currValue = currNumbers.get(fieldPath)!;
      const delta = Math.abs(currValue - prevValue);

      if (isDurationLikePath(fieldPath)) {
        const baseline = Math.max(Math.abs(prevValue), Number.EPSILON);
        const relativeDelta = delta / baseline;
        if (relativeDelta > TOLERANCE_ENVELOPES.durationRelativeTolerance) {
          pushDrift(drifts, summaryMutable, {
            category: 'tolerant_drift_numeric',
            eventType: curr.event._tag,
            eventSequence: curr.index,
            path: `events[${curr.index}].${fieldPath}`,
            expected: `${prevValue} ± ${Math.round(TOLERANCE_ENVELOPES.durationRelativeTolerance * 100)}%`,
            actual: currValue,
            toleranceApplied: `relative-duration<=${Math.round(
              TOLERANCE_ENVELOPES.durationRelativeTolerance * 100
            )}%`,
          });
        }
      } else if (delta > TOLERANCE_ENVELOPES.numericAbsEpsilon) {
        pushDrift(drifts, summaryMutable, {
          category: 'tolerant_drift_numeric',
          eventType: curr.event._tag,
          eventSequence: curr.index,
          path: `events[${curr.index}].${fieldPath}`,
          expected: `${prevValue} ± ${TOLERANCE_ENVELOPES.numericAbsEpsilon}`,
          actual: currValue,
          toleranceApplied: `abs-epsilon<=${TOLERANCE_ENVELOPES.numericAbsEpsilon}`,
        });
      }
    }
  }

  const dedupedDrifts = dedupeDrifts(drifts);
  const finalSummary = emptySummaryCounts() as { -readonly [K in keyof DriftSummaryCounts]: number };
  for (const drift of dedupedDrifts) {
    finalSummary[drift.category] += 1;
  }

  const escalation = classifyEscalation(finalSummary, events.length);

  return {
    status: escalation.status,
    severity: escalation.severity,
    recommendedAction: escalation.recommendedAction,
    strictDriftCount: finalSummary.strict_mismatch + finalSummary.strict_missing_event,
    tolerantDriftCount:
      finalSummary.tolerant_drift_numeric + finalSummary.tolerant_drift_temporal,
    summaryCounts: finalSummary,
    drifts: dedupedDrifts,
  };
};
