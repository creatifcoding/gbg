import {
  SCHEMA_VERSION,
  WORKSPACE_REF,
  type BiologicalFunction,
  type Mechanism,
  type Structure,
} from '../../observations/src/types.ts';
import { PipelineRefused } from '../../observations/src/types.ts';
import {
  validateFunction,
  validateMechanism,
} from '../../observations/src/validate.ts';

export interface MechanismDraft {
  readonly mechanismId: string;
  readonly hypothesis: string;
  readonly falsifier: string;
  readonly status: Mechanism['status'];
  readonly states: readonly string[];
  readonly members: Mechanism['members'];
  readonly failureModes: readonly string[];
  readonly verificationPlan: string;
  readonly review: Mechanism['review'];
}

export interface FunctionDraft {
  readonly functionId: string;
  readonly statement: string;
  readonly status: BiologicalFunction['status'];
  readonly limits: readonly string[];
  readonly review: BiologicalFunction['review'];
}

export const deriveMechanism = (
  structure: Structure | undefined,
  draft: MechanismDraft,
): Mechanism => {
  const record = {
    schemaVersion: SCHEMA_VERSION,
    kind: 'Mechanism' as const,
    mechanismId: draft.mechanismId,
    structureRef: structure?.structureId ?? '',
    workspaceRef: WORKSPACE_REF,
    hypothesis: draft.hypothesis,
    falsifier: draft.falsifier,
    status: draft.status,
    states: draft.states,
    members: draft.members,
    failureModes: draft.failureModes,
    verificationPlan: draft.verificationPlan,
    review: draft.review,
  };
  const validated = validateMechanism(record, structure);
  if (!validated.valid || validated.value === undefined) {
    throw new PipelineRefused(validated.reasons);
  }
  return validated.value;
};

export const deriveFunction = (
  mechanism: Mechanism | undefined,
  draft: FunctionDraft,
): BiologicalFunction => {
  const record = {
    schemaVersion: SCHEMA_VERSION,
    kind: 'Function' as const,
    functionId: draft.functionId,
    mechanismRef: mechanism?.mechanismId ?? '',
    workspaceRef: WORKSPACE_REF,
    statement: draft.statement,
    status: draft.status,
    limits: draft.limits,
    review: draft.review,
  };
  const validated = validateFunction(record, mechanism);
  if (!validated.valid || validated.value === undefined) {
    throw new PipelineRefused(validated.reasons);
  }
  return validated.value;
};
