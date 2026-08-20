import {
  SCHEMA_VERSION,
  WORKSPACE_REF,
  type AnalogLink,
  type BiologicalFunction,
} from '../../observations/src/types.ts';
import { PipelineRefused } from '../../observations/src/types.ts';
import { validateAnalog } from '../../observations/src/validate.ts';

export interface AnalogDraft {
  readonly analogId: string;
  readonly target: string;
  readonly limit: string;
  readonly nonEquivalence: string;
  readonly note?: string;
  readonly review: AnalogLink['review'];
}

export const deriveAnalog = (
  fn: BiologicalFunction | undefined,
  draft: AnalogDraft,
): AnalogLink => {
  const record = {
    schemaVersion: SCHEMA_VERSION,
    kind: 'AnalogLink' as const,
    analogId: draft.analogId,
    functionRef: fn?.functionId ?? '',
    workspaceRef: WORKSPACE_REF,
    target: draft.target,
    direction: 'biology-to-engineering' as const,
    equivalent: false as const,
    limit: draft.limit,
    nonEquivalence: draft.nonEquivalence,
    ...(draft.note === undefined ? {} : { note: draft.note }),
    review: draft.review,
  };
  const validated = validateAnalog(record, fn);
  if (!validated.valid || validated.value === undefined) {
    throw new PipelineRefused(validated.reasons);
  }
  return validated.value;
};
