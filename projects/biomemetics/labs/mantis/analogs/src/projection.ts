import {
  AttachRpcContract,
  LOCAL_EVIDENCE_RECORD_REF,
  localEvidenceRef,
  type AnalogLink,
  type BiologicalFunction,
  type ComponentProjection,
  type GovernedProjectionPlan,
  type Mechanism,
  type Observation,
  type ProjectionProvenance,
  type RefusalReason,
  type Structure,
} from '../../observations/src/types.ts';
import { PipelineRefused } from '../../observations/src/types.ts';
import {
  refuseLabAsSpecimen,
  reviewIsAccepted as reviewOk,
} from '../../observations/src/validate.ts';

export { AttachRpcContract, localEvidenceRef };

export interface ProjectionInput {
  readonly observation: Observation;
  readonly structure?: Structure;
  readonly mechanism?: Mechanism;
  readonly fn?: BiologicalFunction;
  readonly analog?: AnalogLink;
  readonly gitSha: string;
  readonly runId: string;
  readonly specimenId?: string;
  readonly caller?: unknown;
}

const sourceClassFor = (
  observation: Observation,
): 'observed' | 'measured' =>
  (observation.measurements?.length ?? 0) > 0 ? 'measured' : 'observed';

const provenanceFor = (
  observation: Observation,
  evidenceRef: string,
  claimRef: string,
): ProjectionProvenance => {
  const review = observation.review;
  return {
    evidenceId: observation.observationId,
    evidenceRef,
    claimRefs: [claimRef],
    sourceClass: sourceClassFor(observation),
    recordedAt: observation.recordedAt,
    inputRefs: [
      {
        ref: observation.media.path,
        role: 'source-media',
        sha256: observation.media.sha256,
      },
    ],
    observationSourceRefs: observation.statements
      .map((statement) => statement.sourceRef)
      .filter((ref): ref is string => ref !== undefined && ref.trim() !== ''),
    artifactRefs: [
      {
        path: observation.media.path,
        mediaType: observation.media.mediaType,
        sha256: observation.media.sha256,
      },
    ],
    review: {
      reviewer: review.reviewer as string,
      reviewedAt: review.reviewedAt as string,
    },
  };
};

/**
 * Thin governed projection. Mirrors PR 33 Attach payload tags. Never writes a
 * store, never inserts a Specimen, never mutates locality or taxon.
 */
export const planGovernedProjection = (
  input: ProjectionInput,
): GovernedProjectionPlan => {
  const reasons: RefusalReason[] = refuseLabAsSpecimen(input.specimenId);
  const evidenceRef = localEvidenceRef(input.gitSha, input.runId);
  if (!LOCAL_EVIDENCE_RECORD_REF.test(evidenceRef)) {
    reasons.push('evidence-not-local-run');
  }

  const observationReview = reviewOk(input.observation.review);
  if (!observationReview) reasons.push('unverified-evidence');

  if (reasons.length > 0) throw new PipelineRefused([...new Set(reasons)]);

  const projections: ComponentProjection[] = [];
  const claim = `claim:${input.observation.observationId}`;
  const provenance = provenanceFor(input.observation, evidenceRef, claim);
  const observedText = input.observation.statements.find(
    (statement) => statement.status === 'observed',
  )?.text;
  if (observedText !== undefined) {
    projections.push({
      component: { _tag: 'Observation', text: observedText },
      provenance,
    });
  }
  if (input.structure !== undefined && reviewOk(input.structure.review)) {
    projections.push({
      component: { _tag: 'Structure', text: input.structure.description },
      provenance: { ...provenance, claimRefs: [`${claim}:structure`] },
    });
  }
  if (input.mechanism !== undefined && reviewOk(input.mechanism.review)) {
    projections.push({
      component: { _tag: 'Mechanism', text: input.mechanism.hypothesis },
      provenance: { ...provenance, claimRefs: [`${claim}:mechanism`] },
    });
  }
  if (input.fn !== undefined && reviewOk(input.fn.review)) {
    projections.push({
      component: { _tag: 'Function', text: input.fn.statement },
      provenance: { ...provenance, claimRefs: [`${claim}:function`] },
    });
  }
  if (input.analog !== undefined && reviewOk(input.analog.review)) {
    projections.push({
      component: {
        _tag: 'AnalogLink',
        target: input.analog.target,
        ...(input.analog.note === undefined ? {} : { note: input.analog.note }),
      },
      provenance: { ...provenance, claimRefs: [`${claim}:analog`] },
    });
  }

  const blockers: GovernedProjectionPlan['blockers'] =
    projections.length === 0
      ? ['specimendb-attach-unavailable', 'no-admissible-evidence']
      : ['specimendb-attach-unavailable'];

  return {
    projections,
    executable: false,
    storeWrite: false,
    localityMutated: false,
    taxonMutated: false,
    blocker: 'specimendb-attach-unavailable',
    blockers,
    evidenceRef,
  };
};
