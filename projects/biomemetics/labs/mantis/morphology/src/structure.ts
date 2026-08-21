import { SCHEMA_VERSION, WORKSPACE_REF, type Observation, type Structure } from '../../observations/src/types.ts';
import { PipelineRefused } from '../../observations/src/types.ts';
import { validateStructure } from '../../observations/src/validate.ts';

export interface StructureDraft {
  readonly structureId: string;
  readonly basis: Structure['basis'];
  readonly description: string;
  readonly review: Structure['review'];
}

export const deriveStructure = (
  observation: Observation | undefined,
  draft: StructureDraft,
): Structure => {
  const record = {
    schemaVersion: SCHEMA_VERSION,
    kind: 'Structure' as const,
    structureId: draft.structureId,
    observationRef: observation?.observationId ?? '',
    workspaceRef: WORKSPACE_REF,
    basis: draft.basis,
    description: draft.description,
    review: draft.review,
  };
  const validated = validateStructure(record, observation);
  if (!validated.valid || validated.value === undefined) {
    throw new PipelineRefused(validated.reasons);
  }
  return validated.value;
};
