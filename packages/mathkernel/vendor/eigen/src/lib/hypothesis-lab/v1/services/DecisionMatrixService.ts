import { Effect } from 'effect';
import {
  DecisionMatrix,
  Verdict,
  type Hypothesis,
  type EvidenceRecord,
  type MatrixCriterion,
  type TrustGate,
  type TrustGateStatus,
  type Winner,
} from '../schemas';
import { MatrixComputationError } from '../errors';

export interface TrustGateOutcome {
  readonly gate: TrustGate;
  readonly status: TrustGateStatus;
  readonly detail: string;
}

export interface DecisionDraft {
  readonly matrix: typeof DecisionMatrix.Type;
  readonly verdict: typeof Verdict.Type;
  readonly trustGates: ReadonlyArray<TrustGateOutcome>;
}

const safeAverage = (values: ReadonlyArray<number>): number => {
  if (values.length === 0) {
    return 0;
  }
  const total = values.reduce((sum, value) => sum + value, 0);
  return total / values.length;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const classifyEisenhower = (score: number): 'Do' | 'Schedule' | 'Delegate' | 'Eliminate' => {
  if (score >= 0.75) {
    return 'Do';
  }
  if (score >= 0.55) {
    return 'Schedule';
  }
  if (score >= 0.35) {
    return 'Delegate';
  }
  return 'Eliminate';
};

const winnerFromNumeric = (a: number, b: number): Winner => {
  if (a === b) {
    return 'Tie';
  }
  return a > b ? 'A' : 'B';
};

const eisenhowerRank = (quadrant: 'Do' | 'Schedule' | 'Delegate' | 'Eliminate'): number => {
  switch (quadrant) {
    case 'Do':
      return 4;
    case 'Schedule':
      return 3;
    case 'Delegate':
      return 2;
    case 'Eliminate':
      return 1;
  }
};

const winnerFromEisenhower = (
  a: 'Do' | 'Schedule' | 'Delegate' | 'Eliminate',
  b: 'Do' | 'Schedule' | 'Delegate' | 'Eliminate'
): Winner => winnerFromNumeric(eisenhowerRank(a), eisenhowerRank(b));

const hasValue = (value: string): boolean => value.trim().length > 0;

const isPinnedRef = (value: string): boolean => value.startsWith('pin:') && hasValue(value);

const evaluateTrustGates = (
  criteria: ReadonlyArray<MatrixCriterion>
): ReadonlyArray<TrustGateOutcome> => {
  const hasRationale = criteria.every((criterion) => hasValue(criterion.rationale));
  const hasCitations = criteria.every(
    (criterion) => criterion.citations.length > 0 && criterion.citations.every(hasValue)
  );
  const hasProvenance = criteria.every(
    (criterion) =>
      hasValue(criterion.provenance.modelPin) && hasValue(criterion.provenance.promptPin)
  );
  const hasPinnedModelPrompt = criteria.every(
    (criterion) =>
      isPinnedRef(criterion.provenance.modelPin) && isPinnedRef(criterion.provenance.promptPin)
  );

  return [
    {
      gate: 'required_rationale',
      status: hasRationale ? 'passed' : 'failed',
      detail: hasRationale
        ? 'Every criterion includes an explicit rationale.'
        : 'At least one criterion is missing rationale.',
    },
    {
      gate: 'required_citations',
      status: hasCitations ? 'passed' : 'failed',
      detail: hasCitations
        ? 'Every criterion includes at least one citation reference.'
        : 'At least one criterion is missing citations.',
    },
    {
      gate: 'required_provenance',
      status: hasProvenance ? 'passed' : 'failed',
      detail: hasProvenance
        ? 'Every criterion includes provenance placeholders.'
        : 'At least one criterion is missing provenance metadata.',
    },
    {
      gate: 'model_prompt_pinning',
      status: hasPinnedModelPrompt ? 'passed' : 'failed',
      detail: hasPinnedModelPrompt
        ? 'Model and prompt references are pinned.'
        : 'Model/prompt references must be pinned with pin:* values.',
    },
    {
      gate: 'dual_run_consistency',
      status: 'pending',
      detail: 'Awaiting phase-one ratification confirmation.',
    },
    {
      gate: 'human_signoff',
      status: 'pending',
      detail: 'Awaiting phase-two human signoff.',
    },
  ] as const;
};

export class DecisionMatrixService extends Effect.Service<DecisionMatrixService>()(
  'tmnl/hypothesis-lab/DecisionMatrixService',
  {
    sync: () => {
      const draftFromEvidence = (
        runId: string,
        hypotheses: ReadonlyArray<Hypothesis>,
        evidence: ReadonlyArray<EvidenceRecord>
      ): Effect.Effect<DecisionDraft, MatrixComputationError> =>
        Effect.gen(function* () {
          yield* Effect.annotateCurrentSpan({ runId });

          const a = hypotheses.find((hypothesis) => hypothesis.label === 'A');
          const b = hypotheses.find((hypothesis) => hypothesis.label === 'B');

          if (!a || !b) {
            return yield* Effect.fail(
              new MatrixComputationError({
                runId,
                message: 'Both hypotheses A and B are required to draft a matrix.',
              })
            );
          }

          const normalizedLengthA = Math.min(1, a.statement.length / 500);
          const normalizedLengthB = Math.min(1, b.statement.length / 500);

          const avgConfidence = safeAverage(evidence.map((entry) => entry.confidence));
          const evidenceWeight = clamp(avgConfidence || 0.5, 0.25, 0.75);
          const clarityWeight = 1 - evidenceWeight;

          // Confidence remains a separate channel and is projected explicitly into this score term.
          const evidenceSignalA = Math.min(1, avgConfidence + 0.05);
          const evidenceSignalB = Math.max(0, avgConfidence - 0.05);

          const evidenceRefs = evidence.map((entry) => entry.id);
          const citations = evidence.length
            ? evidence.map((entry) => `evidence:${entry.source}:${entry.id}`)
            : ['evidence:pending'];

          const criteria: ReadonlyArray<MatrixCriterion> = [
            {
              criterion: 'statement_clarity_proxy',
              weight: clarityWeight,
              scoreA: normalizedLengthA,
              scoreB: normalizedLengthB,
              rationale: 'Longer, structured statements receive a bounded clarity proxy score.',
              citations,
              provenance: {
                modelPin: 'pin:model:hypothesis-lab-v1',
                promptPin: 'pin:prompt:decision-matrix-v1',
                evidenceRefs,
              },
            },
            {
              criterion: 'evidence_confidence_projection',
              weight: evidenceWeight,
              scoreA: evidenceSignalA,
              scoreB: evidenceSignalB,
              rationale:
                'Evidence confidence is projected into scoring via an explicit confidence->score mapping.',
              citations,
              provenance: {
                modelPin: 'pin:model:hypothesis-lab-v1',
                promptPin: 'pin:prompt:decision-matrix-v1',
                evidenceRefs,
              },
            },
          ];

          const trustGates = evaluateTrustGates(criteria);
          const hardGateFailures = trustGates.filter(
            (gate) =>
              gate.status === 'failed' &&
              (gate.gate === 'required_rationale' ||
                gate.gate === 'required_citations' ||
                gate.gate === 'required_provenance' ||
                gate.gate === 'model_prompt_pinning')
          );

          if (hardGateFailures.length > 0) {
            return yield* Effect.fail(
              new MatrixComputationError({
                runId,
                message: `Trust gate failure: ${hardGateFailures
                  .map((gate) => `${gate.gate} (${gate.detail})`)
                  .join('; ')}`,
              })
            );
          }

          const aggregateA = criteria.reduce((acc, item) => acc + item.weight * item.scoreA, 0);
          const aggregateB = criteria.reduce((acc, item) => acc + item.weight * item.scoreB, 0);
          const aggregateWinner = winnerFromNumeric(aggregateA, aggregateB);

          const eisenhowerA = classifyEisenhower(aggregateA);
          const eisenhowerB = classifyEisenhower(aggregateB);
          const eisenhowerWinner = winnerFromEisenhower(eisenhowerA, eisenhowerB);

          const hasConflict =
            aggregateWinner !== 'Tie' &&
            eisenhowerWinner !== 'Tie' &&
            aggregateWinner !== eisenhowerWinner;

          const winner: Winner = hasConflict
            ? 'Tie'
            : aggregateWinner !== 'Tie'
              ? aggregateWinner
              : eisenhowerWinner;

          const matrix = DecisionMatrix.make({
            id: `matrix-${crypto.randomUUID()}`,
            runId,
            criteria,
            aggregateA,
            aggregateB,
            aggregateWinner,
            eisenhowerA,
            eisenhowerB,
            eisenhowerWinner,
            hasConflict,
            adaptiveWeightPolicy: {
              policyId: 'adaptive-confidence-v1',
              clarityWeight,
              evidenceWeight,
            },
            createdAt: Date.now(),
          });

          const verdict = Verdict.make({
            id: `verdict-${crypto.randomUUID()}`,
            runId,
            winner,
            aggregateWinner,
            eisenhowerWinner,
            hasConflict,
            conflictAcknowledged: !hasConflict,
            rationale: hasConflict
              ? `Draft conflict: aggregate winner=${aggregateWinner}, Eisenhower winner=${eisenhowerWinner}. Phase-one acknowledgement required.`
              : `Draft winner=${winner} with aligned aggregate/eisenhower signals A=${aggregateA.toFixed(3)} B=${aggregateB.toFixed(3)}.`,
            ratified: false,
            ratifiedBy: null,
            ratificationPhase: 'phase1_pending',
            createdAt: Date.now(),
            finalizedAt: null,
          });

          return {
            matrix,
            verdict,
            trustGates,
          };
        }).pipe(Effect.withSpan('HypothesisLab.DecisionMatrixService.draftFromEvidence'));

      return {
        draftFromEvidence,
      } as const;
    },
  }
) {}
