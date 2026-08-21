import type { Composer, Assessor, AdversarialReviewer, HumanGovernor } from "./identities.ts";
import {
  DraftBrand,
  SignedBrand,
  ActiveBrand,
  RevokedBrand,
} from "./identities.ts";

export type CapabilityClass = "P0" | "P1" | "P2";

export type DiagnosticPath = `/${string}`;

export type DiagnosticSeverity = "error" | "warning" | "info";

export interface Diagnostic {
  readonly path: DiagnosticPath;
  readonly code: string;
  readonly severity: DiagnosticSeverity;
  readonly message: string;
}

export interface Budgets {
  readonly wallTimeMs: number;
  readonly maxSteps: number;
  readonly maxParallel: number;
  readonly maxLoopIterations: number;
  readonly maxTokens: number;
  readonly maxToolCalls: number;
  readonly maxCostUsd: number;
  readonly cancellable: boolean;
}

export interface SleepPolicy {
  readonly allowedSignals: readonly ("reminder" | "revalidation")[];
}

export interface ProhibitedFlags {
  readonly deviceCommand: true;
  readonly browserMutation: true;
  readonly secrets: true;
  readonly directCanonicalMutation: true;
  readonly specimenDbWrite: true;
}

export interface GraphNode {
  readonly type: "tool" | "agent" | "workflow" | "mapping";
  readonly id: string;
  readonly toolId?: string;
  readonly agentId?: string;
  readonly workflowId?: string;
  readonly mapping?: string;
  readonly signal?: string;
  readonly durationMs?: number;
  readonly maxIterations?: number;
  readonly maxParallel?: number;
  readonly bounds?: Partial<Budgets>;
}

export interface ReferencedPrimitive {
  readonly kind: "tool" | "agent" | "workflow";
  readonly id: string;
  readonly version: string;
  readonly assayId: string;
}

export type Stage =
  | "draft"
  | "schema-validated"
  | "primitives-resolved"
  | "assay-closed"
  | "policy-linted"
  | "simulated"
  | "adversarially-evaluated"
  | "human-approved"
  | "signed-immutable"
  | "active"
  | "expired"
  | "revoked";

export type ActorRole =
  | "composer"
  | "assessor"
  | "adversarial-reviewer"
  | "human";

export interface AuditEntry {
  readonly at: string;
  readonly from: Stage;
  readonly to: Stage;
  readonly actorId: string;
  readonly actorRole: ActorRole;
  readonly note?: string;
}

export interface AssayPrimitiveStatus {
  readonly id: string;
  readonly version: string;
  readonly assayId: string;
  readonly admissionState: string;
}

export interface AssayClosure {
  readonly closed: boolean;
  readonly primitives: readonly AssayPrimitiveStatus[];
  readonly missing: readonly Diagnostic[];
}

export type SideEffectClass =
  | "read-only"
  | "proven-idempotent"
  | "external-mutation";

export interface SimulatorEvidence {
  readonly ok: boolean;
  readonly budgetsRespected: boolean;
  readonly sideEffectClass: SideEffectClass;
  readonly diagnostics: readonly Diagnostic[];
}

export interface AdversarialEvidence {
  readonly verdict: "pass" | "fail";
  readonly summary: string;
  readonly findings: readonly Diagnostic[];
}

export interface WorkflowDefinitionJson {
  readonly schemaVersion: "1.0.0";
  readonly kind: "DynamicWorkflowDefinition";
  readonly definitionId: `wf.${string}`;
  readonly version: string;
  readonly digest: string;
  readonly capabilityClass: CapabilityClass;
  readonly author: string;
  readonly inputSchema: object;
  readonly outputSchema: object;
  readonly stateSchema?: object;
  readonly graph: readonly GraphNode[];
  readonly referencedPrimitives: readonly ReferencedPrimitive[];
  readonly prohibited: ProhibitedFlags;
  readonly description?: string;
  readonly sourcePrompt?: string;
  readonly modelRun?: string;
  readonly expiresAt?: string;
}

export interface DraftDefinition {
  readonly [DraftBrand]: true;
  readonly definition: WorkflowDefinitionJson;
  readonly budgets: Budgets;
  readonly requestContextSchema: object;
  readonly sleepPolicy: SleepPolicy;
  readonly composedBy: Composer;
  readonly digest: string;
}

export interface AdmissionRecord {
  readonly admissionId: `admit-wf.${string}`;
  readonly definitionId: `wf.${string}`;
  readonly definitionVersion: string;
  readonly digest: string;
  readonly stage: Stage;
  readonly composer: string;
  readonly assessor?: string;
  readonly adversarialReviewer?: string;
  readonly human?: string;
  readonly definition: WorkflowDefinitionJson;
  readonly budgets: Budgets;
  readonly requestContextSchema: object;
  readonly sleepPolicy: SleepPolicy;
  readonly assay?: AssayClosure;
  readonly simulator?: SimulatorEvidence;
  readonly adversarial?: AdversarialEvidence;
  readonly signature?: string;
  readonly admittedAt?: string;
  readonly activatedAt?: string;
  readonly revokedAt?: string;
  readonly reason?: string;
  readonly notes?: string;
  readonly history: readonly AuditEntry[];
}

export type Evaluation =
  | {
      readonly kind: "closed";
      readonly draft: DraftDefinition;
      readonly record: AdmissionRecord;
      readonly diagnostics: readonly Diagnostic[];
    }
  | {
      readonly kind: "failed";
      readonly draft: DraftDefinition;
      readonly record: AdmissionRecord;
      readonly diagnostics: readonly Diagnostic[];
    };

export interface ApprovalPacket {
  readonly draft: DraftDefinition;
  readonly evaluation: Evaluation;
  readonly diff: unknown;
  readonly capabilities: unknown;
  readonly sources: unknown;
  readonly costs: unknown;
  readonly expiry?: string;
}

export interface SignedVersion {
  readonly [SignedBrand]: true;
  readonly admissionId: `admit-wf.${string}`;
  readonly definitionId: `wf.${string}`;
  readonly definitionVersion: string;
  readonly digest: string;
  readonly state: "signed-immutable";
  readonly reviewer: HumanGovernor;
  readonly admittedAt: string;
  readonly signature: string;
  readonly notes?: string;
  readonly record: AdmissionRecord;
}

export interface ActiveAdmission {
  readonly [ActiveBrand]: true;
  readonly admissionId: `admit-wf.${string}`;
  readonly definitionId: `wf.${string}`;
  readonly definitionVersion: string;
  readonly digest: string;
  readonly state: "active";
  readonly reviewer: HumanGovernor;
  readonly admittedAt: string;
  readonly activatedAt: string;
  readonly signature: string;
  readonly notes?: string;
  readonly record: AdmissionRecord;
}

export interface RevokedAdmission {
  readonly [RevokedBrand]: true;
  readonly admissionId: `admit-wf.${string}`;
  readonly definitionId: `wf.${string}`;
  readonly definitionVersion: string;
  readonly digest: string;
  readonly state: "revoked";
  readonly reviewer: HumanGovernor;
  readonly admittedAt: string;
  readonly revokedAt: string;
  readonly reason: string;
  readonly signature: string;
  readonly priorState: "active" | "signed-immutable";
  readonly record: AdmissionRecord;
}

export interface WorkflowAdmissionWire {
  readonly schemaVersion: "1.0.0";
  readonly kind: "WorkflowAdmission";
  readonly admissionId: `admit-wf.${string}`;
  readonly definitionId: `wf.${string}`;
  readonly definitionVersion: string;
  readonly digest: string;
  readonly state:
    | "draft"
    | "schema-validated"
    | "primitives-resolved"
    | "assay-closed"
    | "policy-linted"
    | "simulated"
    | "adversarially-evaluated"
    | "human-approved"
    | "signed-immutable"
    | "active"
    | "revoked";
  readonly reviewer: string;
  readonly admittedAt: string;
  readonly signature?: string;
  readonly notes?: string;
}

export interface WorkflowRunReceipt {
  readonly schemaVersion: "1.0.0";
  readonly kind: "WorkflowRunReceipt";
  readonly runId: `wfrun.${string}`;
  readonly definitionId: `wf.${string}`;
  readonly definitionVersion: string;
  readonly digest: string;
  readonly startedAt: string;
  readonly status: "running" | "suspended" | "success" | "failed" | "cancelled";
  readonly sideEffectClass: SideEffectClass;
  readonly replaySafe: boolean;
  readonly endedAt?: string;
  readonly externalEffectCount?: number;
}

export interface LaboratoryOptions {
  readonly root?: string | URL;
  readonly schemaPrefer?: "live-then-snapshot" | "snapshot-only";
  readonly now?: () => Date;
}

export interface CatalogCase {
  readonly id: string;
  readonly expect: "admit" | "reject" | "reject-identity";
  readonly definition: string;
  readonly envelope: string;
  readonly composer: string;
  readonly assessor: string;
  readonly adversary: string;
  readonly governor: string;
  readonly diagnosticPath?: DiagnosticPath;
}

export interface CatalogReportCase {
  readonly id: string;
  readonly expect: CatalogCase["expect"];
  readonly ok: boolean;
  readonly stage: Stage;
  readonly diagnostics: readonly Diagnostic[];
}

export interface CatalogReport {
  readonly ok: boolean;
  readonly clock: string;
  readonly cases: readonly CatalogReportCase[];
}

export type LabIdentity =
  | Composer
  | Assessor
  | AdversarialReviewer
  | HumanGovernor;

export type {
  Composer,
  Assessor,
  AdversarialReviewer,
  HumanGovernor,
};
