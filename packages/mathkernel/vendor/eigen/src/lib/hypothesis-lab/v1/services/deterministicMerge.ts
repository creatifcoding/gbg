import type { EvidenceRecord } from '../schemas';

export interface FrozenMergePolicy {
  readonly mergeContractRef: string;
  readonly tieBreakOrder: readonly [
    'confidence:desc',
    'mergePolicy:asc',
    'sequence:asc',
    'stepId:asc',
    'hookKey:asc',
    'evidenceId:asc'
  ];
}

export interface EvidenceContribution {
  readonly evidence: EvidenceRecord;
  readonly origin: {
    readonly stepId: string;
    readonly hookKey: string;
    readonly sequence: number;
    readonly mergePolicy?: string;
  };
}

export interface MergeTieBreakDecision {
  readonly mergeContractRef: string;
  readonly scope: string;
  readonly mergeKey: string;
  readonly winnerStepId: string;
  readonly winnerHookKey: string;
  readonly droppedStepIds: ReadonlyArray<string>;
  readonly droppedHookKeys: ReadonlyArray<string>;
  readonly tieBreakOrder: FrozenMergePolicy['tieBreakOrder'];
}

export interface DeterministicMergeResult {
  readonly merged: ReadonlyArray<EvidenceContribution>;
  readonly decisions: ReadonlyArray<MergeTieBreakDecision>;
}

export interface SequencedFailure {
  readonly sequence: number;
  readonly stepId: string;
  readonly hookKey: string;
  readonly reason: string;
}

export interface SequencedStepOutcome {
  readonly sequence: number;
  readonly stepId: string;
  readonly hookKey: string;
  readonly outcome: 'success' | 'failure' | 'quarantined';
  readonly reason?: string;
}

const stableSerialize = (value: unknown): string => {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableSerialize(entry)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort((a, b) => a.localeCompare(b));

  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
};

const compareStrings = (a: string, b: string): number => a.localeCompare(b);

const parseMergePolicyPriority = (mergePolicy: string | undefined): number => {
  if (!mergePolicy) {
    return Number.POSITIVE_INFINITY;
  }

  const match = /^priority:(-?\d+)$/u.exec(mergePolicy.trim());
  if (match) {
    return Number.parseInt(match[1], 10);
  }

  return Number.POSITIVE_INFINITY;
};

const evidenceIdentity = (evidence: EvidenceRecord): string =>
  [
    evidence.runId,
    evidence.source,
    evidence.summary,
    stableSerialize(evidence.metadata),
    evidence.id,
  ].join('::');

export const mergeKeyFromEvidence = (evidence: EvidenceRecord): string =>
  [evidence.runId, evidence.source, evidence.summary, stableSerialize(evidence.metadata)].join('::');

export const freezeMergePolicy = (mergeContractRef: string): FrozenMergePolicy => ({
  mergeContractRef,
  tieBreakOrder: [
    'confidence:desc',
    'mergePolicy:asc',
    'sequence:asc',
    'stepId:asc',
    'hookKey:asc',
    'evidenceId:asc',
  ],
});

const compareByTieBreak = (
  left: EvidenceContribution,
  right: EvidenceContribution,
  frozenPolicy: FrozenMergePolicy
): number => {
  for (const rule of frozenPolicy.tieBreakOrder) {
    if (rule === 'confidence:desc') {
      if (left.evidence.confidence !== right.evidence.confidence) {
        return right.evidence.confidence - left.evidence.confidence;
      }
      continue;
    }

    if (rule === 'mergePolicy:asc') {
      const leftPriority = parseMergePolicyPriority(left.origin.mergePolicy);
      const rightPriority = parseMergePolicyPriority(right.origin.mergePolicy);
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      const leftPolicy = left.origin.mergePolicy ?? '';
      const rightPolicy = right.origin.mergePolicy ?? '';
      if (leftPolicy !== rightPolicy) {
        return compareStrings(leftPolicy, rightPolicy);
      }
      continue;
    }

    if (rule === 'sequence:asc') {
      if (left.origin.sequence !== right.origin.sequence) {
        return left.origin.sequence - right.origin.sequence;
      }
      continue;
    }

    if (rule === 'stepId:asc') {
      if (left.origin.stepId !== right.origin.stepId) {
        return compareStrings(left.origin.stepId, right.origin.stepId);
      }
      continue;
    }

    if (rule === 'hookKey:asc') {
      if (left.origin.hookKey !== right.origin.hookKey) {
        return compareStrings(left.origin.hookKey, right.origin.hookKey);
      }
      continue;
    }

    if (rule === 'evidenceId:asc') {
      const leftIdentity = evidenceIdentity(left.evidence);
      const rightIdentity = evidenceIdentity(right.evidence);
      if (leftIdentity !== rightIdentity) {
        return compareStrings(leftIdentity, rightIdentity);
      }
    }
  }

  return 0;
};

const compareMergedOutput = (
  left: EvidenceContribution,
  right: EvidenceContribution,
  frozenPolicy: FrozenMergePolicy
): number => {
  if (left.origin.sequence !== right.origin.sequence) {
    return left.origin.sequence - right.origin.sequence;
  }

  const leftKey = mergeKeyFromEvidence(left.evidence);
  const rightKey = mergeKeyFromEvidence(right.evidence);

  if (leftKey !== rightKey) {
    return compareStrings(leftKey, rightKey);
  }

  return compareByTieBreak(left, right, frozenPolicy);
};

export const deterministicMergeContributions = (
  contributions: ReadonlyArray<EvidenceContribution>,
  scope: string,
  frozenPolicy: FrozenMergePolicy
): DeterministicMergeResult => {
  const buckets = new Map<string, Array<EvidenceContribution>>();

  for (const contribution of contributions) {
    const mergeKey = mergeKeyFromEvidence(contribution.evidence);
    const bucket = buckets.get(mergeKey);

    if (bucket) {
      bucket.push(contribution);
      continue;
    }

    buckets.set(mergeKey, [contribution]);
  }

  const merged: Array<EvidenceContribution> = [];
  const decisions: Array<MergeTieBreakDecision> = [];

  const sortedMergeKeys = Array.from(buckets.keys()).sort((a, b) => a.localeCompare(b));

  for (const mergeKey of sortedMergeKeys) {
    const candidates = buckets.get(mergeKey);
    if (!candidates || candidates.length === 0) {
      continue;
    }

    const ranked = [...candidates].sort((left, right) => compareByTieBreak(left, right, frozenPolicy));
    const winner = ranked[0];
    merged.push(winner);

    if (ranked.length > 1) {
      decisions.push({
        mergeContractRef: frozenPolicy.mergeContractRef,
        scope,
        mergeKey,
        winnerStepId: winner.origin.stepId,
        winnerHookKey: winner.origin.hookKey,
        droppedStepIds: ranked.slice(1).map((candidate) => candidate.origin.stepId),
        droppedHookKeys: ranked.slice(1).map((candidate) => candidate.origin.hookKey),
        tieBreakOrder: frozenPolicy.tieBreakOrder,
      });
    }
  }

  return {
    merged: merged.sort((left, right) => compareMergedOutput(left, right, frozenPolicy)),
    decisions,
  };
};

export const sortFailuresDeterministically = <T extends SequencedFailure>(
  failures: ReadonlyArray<T>
): ReadonlyArray<T> =>
  [...failures].sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }

    if (left.stepId !== right.stepId) {
      return left.stepId.localeCompare(right.stepId);
    }

    if (left.hookKey !== right.hookKey) {
      return left.hookKey.localeCompare(right.hookKey);
    }

    return left.reason.localeCompare(right.reason);
  });

export const sortStepOutcomesDeterministically = <T extends SequencedStepOutcome>(
  outcomes: ReadonlyArray<T>
): ReadonlyArray<T> =>
  [...outcomes].sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }

    if (left.stepId !== right.stepId) {
      return left.stepId.localeCompare(right.stepId);
    }

    if (left.hookKey !== right.hookKey) {
      return left.hookKey.localeCompare(right.hookKey);
    }

    return left.outcome.localeCompare(right.outcome);
  });

export const sortEvidenceDeterministically = <T extends EvidenceRecord>(
  evidence: ReadonlyArray<T>
): ReadonlyArray<T> =>
  [...evidence].sort((left, right) => {
    const leftKey = mergeKeyFromEvidence(left);
    const rightKey = mergeKeyFromEvidence(right);

    if (leftKey !== rightKey) {
      return leftKey.localeCompare(rightKey);
    }

    return left.id.localeCompare(right.id);
  });
