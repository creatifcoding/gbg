import { describe, it, expect } from 'vitest';
import { EvidenceRecord } from '../../schemas';
import {
  deterministicMergeContributions,
  freezeMergePolicy,
  type EvidenceContribution,
} from '../deterministicMerge';

const makeEvidence = (id: string, confidence: number, summary = 'same-summary') =>
  EvidenceRecord.make({
    id,
    runId: 'run-1',
    source: 'hook://test',
    summary,
    confidence,
    metadata: { key: 'value' },
    createdAt: 1,
  });

const makeContribution = (
  id: string,
  confidence: number,
  sequence: number,
  stepId: string,
  mergePolicy?: string
): EvidenceContribution => ({
  evidence: makeEvidence(id, confidence),
  origin: {
    stepId,
    hookKey: `hook.${stepId}`,
    sequence,
    mergePolicy,
  },
});

describe('deterministicMergeContributions', () => {
  it('is invariant to completion/input order', () => {
    const frozen = freezeMergePolicy('merge://group/test/v1');

    const contributions: ReadonlyArray<EvidenceContribution> = [
      makeContribution('ev-low', 0.6, 2, 'step-2'),
      makeContribution('ev-high', 0.9, 1, 'step-1'),
      {
        evidence: makeEvidence('ev-unique', 0.7, 'unique-summary'),
        origin: {
          stepId: 'step-3',
          hookKey: 'hook.step-3',
          sequence: 3,
        },
      },
    ];

    const forward = deterministicMergeContributions(
      contributions,
      'stage:validate:group:test',
      frozen
    );
    const reverse = deterministicMergeContributions(
      [...contributions].reverse(),
      'stage:validate:group:test',
      frozen
    );

    expect(forward.merged.map((entry) => entry.evidence.id)).toEqual(
      reverse.merged.map((entry) => entry.evidence.id)
    );
    expect(forward.decisions).toEqual(reverse.decisions);

    expect(forward.merged.map((entry) => entry.evidence.id)).toEqual([
      'ev-high',
      'ev-unique',
    ]);

    expect(forward.decisions).toHaveLength(1);
    expect(forward.decisions[0]?.winnerStepId).toBe('step-1');
    expect(forward.decisions[0]?.droppedStepIds).toEqual(['step-2']);
  });

  it('uses mergePolicy priority tie-break when confidence is tied', () => {
    const frozen = freezeMergePolicy('merge://group/test/v1');

    const contributions: ReadonlyArray<EvidenceContribution> = [
      makeContribution('ev-a', 0.8, 2, 'step-a', 'priority:10'),
      makeContribution('ev-b', 0.8, 3, 'step-b', 'priority:1'),
    ];

    const merged = deterministicMergeContributions(
      contributions,
      'stage:validate:group:test',
      frozen
    );

    expect(merged.merged).toHaveLength(1);
    expect(merged.merged[0]?.origin.stepId).toBe('step-b');
    expect(merged.decisions[0]?.winnerStepId).toBe('step-b');
  });

  it('falls back to sequence tie-break when confidence and mergePolicy are tied', () => {
    const frozen = freezeMergePolicy('merge://group/test/v1');

    const contributions: ReadonlyArray<EvidenceContribution> = [
      makeContribution('ev-a', 0.8, 5, 'step-b'),
      makeContribution('ev-b', 0.8, 1, 'step-a'),
    ];

    const merged = deterministicMergeContributions(
      contributions,
      'stage:validate:group:test',
      frozen
    );

    expect(merged.merged).toHaveLength(1);
    expect(merged.merged[0]?.origin.stepId).toBe('step-a');
  });
});
