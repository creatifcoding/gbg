export type ControllerMode =
  | 'care'
  | 'observe'
  | 'research'
  | 'terrarium-read'
  | 'review'
  | 'service-sim';

export type ToolCategory =
  | 'read-public'
  | 'read-private'
  | 'draft-local'
  | 'external-write'
  | 'device-intent'
  | 'device-command'
  | 'admin';

export type PolicyDecision = 'allow' | 'ask' | 'deny';

export type MemoryRecordClass = 'assistant-memory';

export type CapabilityStatus = 'proven' | 'QUARANTINED_UPSTREAM';

export interface CapabilityEntry {
  readonly id: string;
  readonly status: CapabilityStatus;
  readonly detail: string;
}

export interface SessionBinding {
  readonly principalId: string;
  readonly resourceId: string;
  readonly careSubjectId: string;
  readonly mode: ControllerMode;
  readonly threadId: string;
  readonly scope: 'web' | 'background' | 'service-sim';
}

export type InProcessAguiBind = {
  readonly kind: 'in-process-agui-bind';
  readonly basePath: '/api/copilotkit';
  readonly agentId: 'mantis-coordinator';
  readonly resourceId: string;
  readonly threadId: string;
  readonly handler: (request: Request) => Promise<Response>;
};

export interface PolicyInput {
  readonly mode: ControllerMode;
  readonly toolId: string;
  readonly category: ToolCategory | 'unknown';
  readonly perToolDeny?: boolean;
}

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
