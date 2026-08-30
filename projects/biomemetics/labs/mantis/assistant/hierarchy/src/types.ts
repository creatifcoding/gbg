export type SpecialistId =
  | 'care-source'
  | 'observation-extractor'
  | 'taxon-hypothesis'
  | 'supply-transit'
  | 'terrarium-diagnostician'
  | 'evidence-curator'
  | 'workflow-composer'
  | 'tool-assessor'
  | 'adversarial-reviewer';

export type HostMode =
  | 'care'
  | 'observe'
  | 'research'
  | 'terrarium-read'
  | 'review'
  | 'service-sim';

export type ThreadId = string & { readonly __brand: 'ThreadId' };
export type CareSubjectId = string & { readonly __brand: 'CareSubjectId' };
export type AttemptId = string & { readonly __brand: 'AttemptId' };
export type OmRecordId = string & { readonly __brand: 'OmRecordId' };
export type RequestDigest = string & { readonly __brand: 'RequestDigest' };
export type AssayedToolId = string & { readonly __brand: 'AssayedToolId' };

export type ForbiddenToolId =
  | 'device-command'
  | 'admin'
  | 'specimen-db-write'
  | 'live-catalog-write'
  | 'browser-mutate';

export const FORBIDDEN_TOOL_IDS: readonly ForbiddenToolId[] = [
  'device-command',
  'admin',
  'specimen-db-write',
  'live-catalog-write',
  'browser-mutate',
];

export const SPECIALIST_IDS: readonly SpecialistId[] = [
  'care-source',
  'observation-extractor',
  'taxon-hypothesis',
  'supply-transit',
  'terrarium-diagnostician',
  'evidence-curator',
  'workflow-composer',
  'tool-assessor',
  'adversarial-reviewer',
];

export const HOST_MODES: readonly HostMode[] = [
  'care',
  'observe',
  'research',
  'terrarium-read',
  'review',
  'service-sim',
];

export type Clock = { readonly now: () => string };

export type CapabilityStatus =
  | 'policy-tested'
  | 'snapshot-checked'
  | 'QUARANTINED_UPSTREAM';

export type Capability = {
  readonly id: string;
  readonly status: CapabilityStatus;
  readonly detail: string;
};

export type SourceClass =
  | 'reviewed-source'
  | 'visible-fact'
  | 'hypothesis'
  | 'ephemeral-inventory'
  | 'telemetry-read'
  | 'evidence-draft'
  | 'workflow-draft'
  | 'assay-report'
  | 'attack-report';

export type Budget = {
  readonly maxSteps: number;
  readonly timeoutMs: number;
  readonly maxTokens: number;
};

export type ContextFilter = {
  readonly stripExactLocation: true;
  readonly stripSecrets: true;
  readonly stripUnrelatedMedia: true;
  readonly stripRawToolDumps: true;
  readonly preserveSourceStatus: true;
  readonly preserveCorrelationIds: true;
  readonly includeFullTranscript: false;
};

export const CONTEXT_FILTER: ContextFilter = {
  stripExactLocation: true,
  stripSecrets: true,
  stripUnrelatedMedia: true,
  stripRawToolDumps: true,
  preserveSourceStatus: true,
  preserveCorrelationIds: true,
  includeFullTranscript: false,
};

type SpecialistForbiddenMap = {
  readonly 'care-source': readonly ['diagnose', 'publish', 'actuate'];
  readonly 'observation-extractor': readonly ['assert-taxon', 'measure-without-scale'];
  readonly 'taxon-hypothesis': readonly [
    'confirm-taxon',
    'set-automation',
    'emit-observation',
    'mint-specimen',
  ];
  readonly 'supply-transit': readonly ['retain-address', 'purchase', 'infer-locality'];
  readonly 'terrarium-diagnostician': readonly ['clear-latch', 'move-rail', 'energize'];
  readonly 'evidence-curator': readonly ['accept-own-evidence', 'write-specimendb'];
  readonly 'workflow-composer': readonly ['register-workflow', 'execute-draft'];
  readonly 'tool-assessor': readonly ['admit-tool'];
  readonly 'adversarial-reviewer': readonly ['edit-candidate', 'issue-admission'];
};

export type SpecialistForbidden<Id extends SpecialistId> = SpecialistForbiddenMap[Id];

export type InterpretationClaim = {
  readonly kind: 'taxon-rank' | 'life-stage' | 'health' | 'other';
  readonly text: string;
  readonly confidence: number;
  readonly confirmed: false;
  readonly sources?: readonly string[];
};

export type InterpretationYield = {
  readonly kind: 'interpretation';
  readonly recordClass: 'interpretation';
  readonly status: 'hypothetical' | 'disputed' | 'withdrawn';
  readonly claims: readonly [InterpretationClaim, ...InterpretationClaim[]];
};

export type SpecialistYieldMap = {
  readonly 'care-source': {
    readonly kind: 'care-advice-draft';
    readonly executable: false;
    readonly sourced: true;
  };
  readonly 'observation-extractor': {
    readonly kind: 'observation-draft';
    readonly recordClass: 'observation';
    readonly assertsTaxon: false;
  };
  readonly 'taxon-hypothesis': InterpretationYield;
  readonly 'supply-transit': {
    readonly kind: 'supply-plan';
    readonly retainsAddress: false;
    readonly infersLocality: false;
  };
  readonly 'terrarium-diagnostician': {
    readonly kind: 'diagnostic-read';
    readonly issuesCommand: false;
  };
  readonly 'evidence-curator': {
    readonly kind: 'evidence-draft';
    readonly accepted: false;
  };
  readonly 'workflow-composer': {
    readonly kind: 'workflow-draft';
    readonly registered: false;
  };
  readonly 'tool-assessor': {
    readonly kind: 'assay-report';
    readonly admitted: false;
  };
  readonly 'adversarial-reviewer': {
    readonly kind: 'attack-report';
    readonly edits: false;
  };
};

export type SpecialistYield<Id extends SpecialistId> = SpecialistYieldMap[Id];

export type LoadedSpecialist<Id extends SpecialistId = SpecialistId> = {
  readonly id: Id;
  readonly purpose: string;
  readonly sourceClass: SourceClass;
  readonly modes: readonly HostMode[];
  readonly tools: readonly AssayedToolId[];
  readonly budget: Budget;
  readonly contextFilter: ContextFilter;
  readonly forbiddenActions: SpecialistForbidden<Id>;
  readonly yieldKind: SpecialistYield<Id>['kind'];
  readonly forked: false;
};

export type LoadedRegistry = { readonly [K in SpecialistId]: LoadedSpecialist<K> };

export type ManifestRefusalReason =
  | 'missing-specialist'
  | 'unknown-specialist'
  | 'forked-prohibited'
  | 'forbidden-tool'
  | 'resource-scoped-om'
  | 'om-record-class'
  | 'incomplete-registry'
  | 'policy-schema';

export class HierarchyLoadError extends Error {
  readonly code = 'HIERARCHY_LOAD_REFUSED';
  readonly reasons: readonly ManifestRefusalReason[];
  constructor(reasons: readonly ManifestRefusalReason[], message?: string) {
    super(message ?? reasons.join(','));
    this.name = 'HierarchyLoadError';
    this.reasons = reasons;
  }
}

export const THREAD_ID = /^care:[a-z][a-z0-9.-]*:[a-z][a-z0-9.-]*$/;
export const CARE_SUBJECT_ID = /^care\.[a-z][a-z0-9.-]*$/;

export function isSpecialistId(value: string): value is SpecialistId {
  return (SPECIALIST_IDS as readonly string[]).includes(value);
}

export function isHostMode(value: string): value is HostMode {
  return (HOST_MODES as readonly string[]).includes(value);
}

export function isForbiddenTool(value: string): value is ForbiddenToolId {
  return (FORBIDDEN_TOOL_IDS as readonly string[]).includes(value);
}

export function asThreadId(value: string): ThreadId {
  if (!THREAD_ID.test(value)) {
    throw new TypeError(`thread id rejected: ${value}`);
  }
  return value as ThreadId;
}

export function asCareSubjectId(value: string): CareSubjectId {
  if (!CARE_SUBJECT_ID.test(value)) {
    throw new TypeError(`care subject id rejected: ${value}`);
  }
  return value as CareSubjectId;
}

export function brandTool(value: string): AssayedToolId {
  if (value.trim() === '' || isForbiddenTool(value)) {
    throw new TypeError(`tool id refused: ${value}`);
  }
  return value as AssayedToolId;
}

export function emptyWorkingMemory(): {
  readonly preferences: readonly string[];
  readonly activeGoal: string | null;
  readonly unresolvedQuestions: readonly string[];
} {
  return { preferences: [], activeGoal: null, unresolvedQuestions: [] };
}

export function interpretationYield(input: {
  readonly status: InterpretationYield['status'];
  readonly claims: readonly [
    Omit<InterpretationClaim, 'confirmed'>,
    ...Omit<InterpretationClaim, 'confirmed'>[],
  ];
}): InterpretationYield {
  const toClaim = (claim: Omit<InterpretationClaim, 'confirmed'>): InterpretationClaim => ({
    kind: claim.kind,
    text: claim.text,
    confidence: claim.confidence,
    confirmed: false,
    ...(claim.sources === undefined ? {} : { sources: claim.sources }),
  });
  const [head, ...tail] = input.claims;
  const claims: InterpretationYield['claims'] = [toClaim(head), ...tail.map(toClaim)];
  return {
    kind: 'interpretation',
    recordClass: 'interpretation',
    status: input.status,
    claims,
  };
}

export function defaultCapabilities(): readonly Capability[] {
  return [
    {
      id: 'specialist-registry',
      status: 'policy-tested',
      detail: 'Nine inspectable manifests load as a complete registry with forked:false',
    },
    {
      id: 'delegation-attempt',
      status: 'policy-tested',
      detail:
        'Task packet is constructed minimum; privilege escalation and forbidden tools reject',
    },
    {
      id: 'om-ledger',
      status: 'policy-tested',
      detail: 'Thread-scoped assistant-memory ledger with supersession, forget, and export',
    },
    {
      id: 'thread-om-live-observer-reflector',
      status: 'QUARANTINED_UPSTREAM',
      detail:
        'A2 does not start a live observational-memory observer or reflector cycle.',
    },
  ];
}
