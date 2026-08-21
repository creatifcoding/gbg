/**
 * TypeScript projection of the A0 Draft 2020-12 JSON Schemas.
 * Cross-language meaning lives in assistant/contracts; these types follow that catalog.
 */
export type SchemaVersion = '1.0.0';

export type CareSubject = {
  readonly schemaVersion: SchemaVersion;
  readonly kind: 'CareSubject';
  readonly careSubjectId: `care.${string}`;
  readonly createdAt: string;
  readonly displayName?: string;
  readonly housing: {
    readonly kind:
      | 'temporary-cup'
      | 'temporary-enclosure'
      | 'established-enclosure'
      | 'unknown';
    readonly notes?: string;
  };
  readonly catalogSpecimen: false;
  readonly taxonHypothesisRef?: string;
  readonly notes?: string;
};

export type Observation = {
  readonly schemaVersion: SchemaVersion;
  readonly kind: 'Observation';
  readonly observationId: `obs.${string}`;
  readonly careSubjectId: `care.${string}`;
  readonly recordedAt: string;
  readonly sourceClass: 'observed';
  readonly recordClass: 'observation';
  readonly mediaDigest?: string;
  readonly statements: ReadonlyArray<{
    readonly text: string;
    readonly status: 'observed' | 'unverified';
    readonly region?: string;
  }>;
  readonly scalePresent?: boolean;
};

export type Interpretation = {
  readonly schemaVersion: SchemaVersion;
  readonly kind: 'Interpretation';
  readonly interpretationId: `interp.${string}`;
  readonly careSubjectId: `care.${string}`;
  readonly observationRefs?: readonly `obs.${string}`[];
  readonly recordedAt: string;
  readonly recordClass: 'interpretation';
  readonly status: 'hypothetical' | 'disputed' | 'withdrawn';
  readonly claims: ReadonlyArray<{
    readonly kind: 'taxon-rank' | 'life-stage' | 'health' | 'other';
    readonly text: string;
    readonly confidence: number;
    readonly confirmed: false;
    readonly sources?: readonly string[];
  }>;
};

export type CareEvent = {
  readonly schemaVersion: SchemaVersion;
  readonly kind: 'CareEvent';
  readonly careEventId: `event.${string}`;
  readonly careSubjectId: `care.${string}`;
  readonly recordedAt: string;
  readonly eventType:
    | 'offered'
    | 'eaten'
    | 'refused'
    | 'removed'
    | 'misted'
    | 'cleaned'
    | 'outcome';
  readonly humanConfirmed: true;
  readonly idempotencyKey?: string;
  readonly adviceRef?: `advice.${string}`;
  readonly notes?: string;
};

export type CareAdvice = {
  readonly schemaVersion: SchemaVersion;
  readonly kind: 'CareAdvice';
  readonly adviceId: `advice.${string}`;
  readonly careSubjectId: `care.${string}`;
  readonly runId?: `run.${string}`;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly capabilityClass: 'P0' | 'P1' | 'P2';
  readonly executable: false;
  readonly confidence: number;
  readonly statements: ReadonlyArray<{
    readonly text: string;
    readonly kind: 'do-now' | 'buy' | 'offer-amount' | 'warning' | 'reminder';
    readonly numerical: boolean;
    readonly withheld: boolean;
    readonly sources?: ReadonlyArray<{
      readonly id: string;
      readonly applicability: 'applies' | 'partial' | 'unknown';
    }>;
  }>;
};

export type AssistantRun = {
  readonly schemaVersion: SchemaVersion;
  readonly kind: 'AssistantRun';
  readonly runId: `run.${string}`;
  readonly traceId?: string;
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly mode:
    | 'care'
    | 'observe'
    | 'research'
    | 'terrarium-read'
    | 'review'
    | 'service-sim';
  readonly resourceId: string;
  readonly threadId: `care:${string}:${string}`;
  readonly careSubjectId?: `care.${string}`;
  readonly agentId?: string;
  readonly workflowId?: string;
  readonly memoryRecordClass: 'assistant-memory';
  readonly versions: {
    readonly mastraCore: string;
    readonly copilotkitRuntime: string;
    readonly aguiMastra: string;
    readonly effect: string;
    readonly typescript: string;
    readonly model: string;
    readonly controllerConfig: string;
    readonly tools: string;
    readonly memory: string;
    readonly workflow: string;
  };
  readonly cost?: {
    readonly inputTokens?: number;
    readonly outputTokens?: number;
  };
};

export type ToolAssayRecord = {
  readonly schemaVersion: SchemaVersion;
  readonly kind: 'ToolAssayRecord';
  readonly assayId: `assay.${string}`;
  readonly recordedAt: string;
  readonly identity: {
    readonly id: string;
    readonly version: string;
    readonly provider: string;
    readonly sourceUrl?: string;
    readonly digest: string;
    readonly license: string;
  };
  readonly contract: {
    readonly inputSchemaRef: string;
    readonly outputSchemaRef: string;
    readonly errors: readonly string[];
    readonly timeoutMs: number;
    readonly streaming: boolean;
    readonly determinism: 'deterministic' | 'idempotent' | 'non-deterministic';
  };
  readonly effects: {
    readonly read: boolean;
    readonly write: boolean;
    readonly execute: boolean;
    readonly externalMutation: boolean;
    readonly deviceImpact: boolean;
    readonly rollback: 'none' | 'compensating' | 'native';
  };
  readonly authority: {
    readonly actor: 'assistant' | 'keeper' | 'edge' | 'service';
    readonly category:
      | 'read-public'
      | 'read-private'
      | 'draft-local'
      | 'external-write'
      | 'device-intent'
      | 'device-command'
      | 'admin';
    readonly credential?: string;
    readonly allowedModes: ReadonlyArray<AssistantRun['mode']>;
    readonly allowedAgents: readonly string[];
    readonly llmExposed: boolean;
  };
  readonly data: {
    readonly privacyClass: 'public' | 'private' | 'secret' | 'ephemeral-location';
    readonly retention?: string;
    readonly networkEgress: boolean;
    readonly secrets: boolean;
    readonly location: 'none' | 'ephemeral-coarse' | 'forbidden-exact';
    readonly media: 'none' | 'digest-only' | 'selected-annotation';
  };
  readonly behavior: {
    readonly idempotent: boolean;
    readonly retrySafe: boolean;
    readonly cancellation: 'safe' | 'unsafe' | 'unknown';
    readonly concurrency: 'safe' | 'exclusive' | 'unknown';
    readonly rateLimit?: string;
    readonly costLimit?: string;
  };
  readonly evidence: {
    readonly sourceClassProduced:
      | 'none'
      | 'observed'
      | 'calculated'
      | 'external-source'
      | 'unverified';
    readonly provenanceFields?: readonly string[];
    readonly simulator: boolean;
    readonly fixtures: readonly string[];
  };
  readonly safety: {
    readonly staleStatePolicy: 'fail-closed' | 'refresh' | 'not-applicable';
    readonly preconditions?: readonly string[];
    readonly approvalTier: 'none' | 'ask' | 'human-local' | 'never';
    readonly physicalInterlocks: boolean;
  };
  readonly verification: {
    readonly staticLint: boolean;
    readonly sandboxSmoke: boolean;
    readonly negativeTests: readonly string[];
    readonly adversarialTests: readonly string[];
  };
  readonly review: {
    readonly assessor: string;
    readonly independentReviewer?: string;
    readonly disposition:
      | 'discovered'
      | 'quarantined'
      | 'assayed'
      | 'simulated'
      | 'admitted-read'
      | 'admitted-write'
      | 'revoked';
    readonly expiry?: string;
    readonly reAssayTriggers?: readonly string[];
  };
};

export type ToolAdmission = {
  readonly schemaVersion: SchemaVersion;
  readonly kind: 'ToolAdmission';
  readonly admissionId: `admit-tool.${string}`;
  readonly toolId: string;
  readonly assayId: `assay.${string}`;
  readonly state:
    | 'discovered'
    | 'quarantined'
    | 'assayed'
    | 'simulated'
    | 'admitted-read'
    | 'admitted-write'
    | 'revoked';
  readonly admittedAt: string;
  readonly expiresAt?: string;
  readonly assessor: string;
  readonly reviewer: string;
  readonly notes?: string;
};

export type DynamicWorkflowDefinition = {
  readonly schemaVersion: SchemaVersion;
  readonly kind: 'DynamicWorkflowDefinition';
  readonly definitionId: `wf.${string}`;
  readonly version: string;
  readonly digest: string;
  readonly description?: string;
  readonly capabilityClass: 'P0' | 'P1' | 'P2';
  readonly author: string;
  readonly sourcePrompt?: string;
  readonly modelRun?: string;
  readonly expiresAt?: string;
  readonly inputSchema: object;
  readonly outputSchema: object;
  readonly stateSchema?: object;
  readonly graph: ReadonlyArray<{
    readonly type: 'tool' | 'agent' | 'workflow' | 'mapping';
    readonly id: string;
    readonly toolId?: string;
    readonly agentId?: string;
    readonly workflowId?: string;
  }>;
  readonly referencedPrimitives: ReadonlyArray<{
    readonly kind: 'tool' | 'agent' | 'workflow';
    readonly id: string;
    readonly version: string;
    readonly assayId: string;
  }>;
  readonly prohibited: {
    readonly deviceCommand: true;
    readonly browserMutation: true;
    readonly secrets: true;
    readonly directCanonicalMutation: true;
    readonly specimenDbWrite: true;
  };
};

export type WorkflowAdmission = {
  readonly schemaVersion: SchemaVersion;
  readonly kind: 'WorkflowAdmission';
  readonly admissionId: `admit-wf.${string}`;
  readonly definitionId: `wf.${string}`;
  readonly definitionVersion: string;
  readonly digest: string;
  readonly state:
    | 'draft'
    | 'schema-validated'
    | 'primitives-resolved'
    | 'assay-closed'
    | 'policy-linted'
    | 'simulated'
    | 'adversarially-evaluated'
    | 'human-approved'
    | 'signed-immutable'
    | 'active'
    | 'revoked';
  readonly reviewer: string;
  readonly admittedAt: string;
  readonly signature?: string;
  readonly notes?: string;
};

export type WorkflowRunReceipt = {
  readonly schemaVersion: SchemaVersion;
  readonly kind: 'WorkflowRunReceipt';
  readonly runId: `wfrun.${string}`;
  readonly definitionId: `wf.${string}`;
  readonly definitionVersion: string;
  readonly digest: string;
  readonly startedAt: string;
  readonly endedAt?: string;
  readonly status: 'running' | 'suspended' | 'success' | 'failed' | 'cancelled';
  readonly sideEffectClass: 'read-only' | 'proven-idempotent' | 'external-mutation';
  readonly replaySafe: boolean;
  readonly externalEffectCount?: number;
};

export type ActuationIntent = {
  readonly schemaVersion: SchemaVersion;
  readonly kind: 'ActuationIntent';
  readonly intentId: `intent.${string}`;
  readonly runId?: `run.${string}`;
  readonly proposedAt: string;
  readonly expiresAt: string;
  readonly capabilityClass: 'P3' | 'P4' | 'P5';
  readonly action: string;
  readonly executable: false;
  readonly rationale?: string;
};

export type ActuationCommand = {
  readonly schemaVersion: SchemaVersion;
  readonly kind: 'ActuationCommand';
  readonly commandId: `cmd.${string}`;
  readonly intentId: `intent.${string}`;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly action: string;
  readonly executable: true;
  readonly liveActuation: false;
  readonly issuer: 'edge-supervisor' | 'human-local-service';
  readonly nonce?: string;
};

export type ActuationReceipt = {
  readonly schemaVersion: SchemaVersion;
  readonly kind: 'ActuationReceipt';
  readonly receiptId: `rcpt.${string}`;
  readonly commandId: `cmd.${string}`;
  readonly intentId?: `intent.${string}`;
  readonly recordedAt: string;
  readonly disposition: 'accepted' | 'rejected' | 'expired' | 'faulted' | 'not-run';
  readonly detail?: string;
};
