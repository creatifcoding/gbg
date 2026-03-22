import { Effect } from 'effect';
import { ReplayReport, type AuditEvent } from '../schemas';
import { ReplayEvaluationError } from '../errors';
import { classifyReplayDrifts } from './ReplayDriftClassifier';

export class ReplayService extends Effect.Service<ReplayService>()(
  'tmnl/hypothesis-lab/ReplayService',
  {
    sync: () => {
      const evaluate = (
        runId: string,
        events: ReadonlyArray<AuditEvent>
      ): Effect.Effect<typeof ReplayReport.Type, ReplayEvaluationError> =>
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan({ runId });

          if (events.length === 0) {
            return yield* Effect.fail(
              new ReplayEvaluationError({
                runId,
                message: 'Cannot evaluate replay with zero audit events.',
              })
            );
          }

          const classification = classifyReplayDrifts(runId, events);

          // NOTE: ReplayReport schema currently has no severity/recommendedAction fields.
          // We emit this data through span annotations to preserve schema compatibility.
          yield* Effect.annotateCurrentSpan({
            replaySeverity: classification.severity,
            replayRecommendedAction: classification.recommendedAction,
            replaySummaryCounts: JSON.stringify(classification.summaryCounts),
          });

          return ReplayReport.make({
            replayId: `replay-${crypto.randomUUID()}`,
            runId,
            status: classification.status,
            strictDriftCount: classification.strictDriftCount,
            tolerantDriftCount: classification.tolerantDriftCount,
            drifts: classification.drifts,
            generatedAt: Date.now(),
          });
        }).pipe(Effect.withSpan('HypothesisLab.ReplayService.evaluate'));

      return {
        evaluate,
      } as const;
    },
  }
) {}
