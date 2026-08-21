import { contentDigest } from "./digest.ts";
import type { CatalogResources, ToolAssayRecord } from "./catalog.ts";
import type { SchemaBundle } from "./schema.ts";
import type {
  ActorRole,
  AdmissionRecord,
  AssayClosure,
  AssayPrimitiveStatus,
  AuditEntry,
  Diagnostic,
  DiagnosticPath,
  GraphNode,
  SideEffectClass,
  SimulatorEvidence,
  Stage,
  WorkflowDefinitionJson,
} from "./types.ts";

export interface ActorRef {
  readonly id: string;
  readonly role: ActorRole;
}

export type Intent =
  | { readonly kind: "advance" }
  | { readonly kind: "revoke"; readonly reason: string }
  | { readonly kind: "expire" };

export type CheckResult =
  | { readonly ok: true; readonly patch: Partial<AdmissionRecord> }
  | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] };

export interface CheckCtx {
  readonly record: AdmissionRecord;
  readonly catalog: CatalogResources;
  readonly schemas: SchemaBundle;
  readonly actor: ActorRef;
  readonly intent: Intent;
  readonly clock: string;
}

interface StageRow {
  readonly from: Stage;
  readonly to: Stage;
  readonly intent: Intent["kind"];
  readonly allowedRoles: readonly ActorRole[];
  readonly check: (ctx: CheckCtx) => CheckResult;
}

function error(
  path: DiagnosticPath,
  code: string,
  message: string,
): Diagnostic {
  return { path, code, severity: "error", message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nodePath(index: number, field?: string): DiagnosticPath {
  return (field === undefined
    ? `/graph/${index}`
    : `/graph/${index}/${field}`) as DiagnosticPath;
}

function mappingKind(node: GraphNode): string | undefined {
  if (typeof node.mapping === "string") {
    return node.mapping;
  }
  return undefined;
}

function schemaAndGraph(ctx: CheckCtx): CheckResult {
  const def = ctx.record.definition as unknown;
  if (!ctx.schemas.validateDefinition(def)) {
    const first = ctx.schemas.validateDefinition.errors?.[0];
    const rawPath = first?.instancePath;
    const path = (
      rawPath === undefined || rawPath === "" ? "/" : rawPath
    ) as DiagnosticPath;
    return {
      ok: false,
      diagnostics: [
        error(
          path,
          "schema-invalid",
          first?.message ?? "definition failed schema validation",
        ),
      ],
    };
  }

  const computed = contentDigest(
    ctx.record.definition as unknown as Record<string, unknown>,
  );
  if (computed !== ctx.record.definition.digest) {
    return {
      ok: false,
      diagnostics: [
        error(
          "/digest",
          "digest-mismatch",
          "definition digest does not match A3 content hash",
        ),
      ],
    };
  }

  if (
    ctx.record.definition.capabilityClass !== "P0" &&
    ctx.record.definition.capabilityClass !== "P1" &&
    ctx.record.definition.capabilityClass !== "P2"
  ) {
    return {
      ok: false,
      diagnostics: [
        error("/capabilityClass", "capability-denied", "P0–P2 only"),
      ],
    };
  }

  if (!isRecord(ctx.record.requestContextSchema)) {
    return {
      ok: false,
      diagnostics: [
        error(
          "/requestContextSchema",
          "request-context-required",
          "envelope requestContextSchema is required",
        ),
      ],
    };
  }

  return {
    ok: true,
    patch: { assessor: ctx.actor.id },
  };
}

function resolvePrimitives(ctx: CheckCtx): CheckResult {
  const diagnostics: Diagnostic[] = [];
  const byId = new Map(
    ctx.catalog.snapshot.tools.map((t) => [`${t.id}@${t.version}`, t] as const),
  );

  for (let i = 0; i < ctx.record.definition.graph.length; i += 1) {
    const node = ctx.record.definition.graph[i];
    if (!node) continue;
    if (node.type === "tool") {
      const toolId = node.toolId;
      if (toolId === undefined || toolId.trim() === "") {
        diagnostics.push(
          error(nodePath(i, "toolId"), "tool-missing", "tool node requires toolId"),
        );
        continue;
      }
      if (ctx.catalog.forbiddenToolIds.has(toolId)) {
        diagnostics.push(
          error(
            nodePath(i, "toolId"),
            "forbidden-tool",
            `tool ${toolId} is forbidden`,
          ),
        );
        continue;
      }
      const prim = ctx.record.definition.referencedPrimitives.find(
        (p) => p.id === toolId,
      );
      const version = prim?.version ?? "1.0.0";
      const snap = byId.get(`${toolId}@${version}`);
      if (!snap && !ctx.catalog.assays.has(toolId)) {
        diagnostics.push(
          error(
            nodePath(i, "toolId"),
            "unassayed-primitive",
            `tool ${toolId} is not in the primitive snapshot`,
          ),
        );
      }
    }
    if (node.type === "mapping") {
      const kind = mappingKind(node);
      if (kind === undefined) {
        diagnostics.push(
          error(nodePath(i), "mapping-kind-missing", "mapping kind required"),
        );
      } else if (!ctx.catalog.snapshot.mappingKinds.includes(kind)) {
        diagnostics.push(
          error(
            nodePath(i),
            "mapping-kind-unknown",
            `mapping kind ${kind} is not registered`,
          ),
        );
      }
    }
  }

  for (const prim of ctx.record.definition.referencedPrimitives) {
    if (prim.kind !== "tool") continue;
    if (ctx.catalog.forbiddenToolIds.has(prim.id)) {
      const idx = ctx.record.definition.graph.findIndex(
        (n) => n.type === "tool" && n.toolId === prim.id,
      );
      diagnostics.push(
        error(
          nodePath(idx >= 0 ? idx : 0, "toolId"),
          "forbidden-tool",
          `referenced primitive ${prim.id} is forbidden`,
        ),
      );
      continue;
    }
    const snap = byId.get(`${prim.id}@${prim.version}`);
    if (!snap && !ctx.catalog.assays.has(prim.id)) {
      const idx = ctx.record.definition.graph.findIndex(
        (n) => n.type === "tool" && n.toolId === prim.id,
      );
      diagnostics.push(
        error(
          nodePath(idx >= 0 ? idx : 0, "toolId"),
          "unassayed-primitive",
          `primitive ${prim.id}@${prim.version} unresolved`,
        ),
      );
    }
  }

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }
  return { ok: true, patch: {} };
}

function sideEffectOf(assay: ToolAssayRecord): SideEffectClass {
  if (assay.effects.externalMutation || (assay.effects.write && !assay.behavior.idempotent)) {
    return "external-mutation";
  }
  if (assay.behavior.idempotent && assay.effects.write) {
    return "proven-idempotent";
  }
  return "read-only";
}

function closeAssay(ctx: CheckCtx): CheckResult {
  const primitives: AssayPrimitiveStatus[] = [];
  const missing: Diagnostic[] = [];

  for (const prim of ctx.record.definition.referencedPrimitives) {
    if (prim.kind !== "tool") {
      missing.push(
        error(
          "/referencedPrimitives",
          "unsupported-primitive-kind",
          `A3 only closes tool primitives (got ${prim.kind})`,
        ),
      );
      continue;
    }

    const idx = ctx.record.definition.graph.findIndex(
      (n) => n.type === "tool" && n.toolId === prim.id,
    );
    const path = nodePath(idx >= 0 ? idx : 0, "toolId");

    if (ctx.catalog.forbiddenToolIds.has(prim.id) || prim.id === "device-command") {
      missing.push(
        error(path, "forbidden-tool", `tool ${prim.id} is denied`),
      );
      continue;
    }

    const assay =
      ctx.catalog.assays.get(prim.assayId) ??
      ctx.catalog.assays.get(prim.id);
    const admission =
      ctx.catalog.admissions.get(prim.id) ??
      ctx.catalog.admissions.get(prim.assayId);

    if (!assay) {
      missing.push(
        error(path, "assay-missing", `no assay for ${prim.id}`),
      );
      continue;
    }

    if (!admission) {
      missing.push(
        error(path, "admission-missing", `no tool admission for ${prim.id}`),
      );
      continue;
    }

    const admittedOk =
      admission.state === "admitted-read" ||
      (admission.state === "admitted-write" &&
        assay.behavior.idempotent &&
        !assay.effects.externalMutation);

    if (!admittedOk) {
      missing.push(
        error(
          path,
          "assay-not-admitted",
          `tool ${prim.id} admission state ${admission.state} is not admitted-read/proven-idempotent`,
        ),
      );
      continue;
    }

    if (assay.effects.deviceImpact) {
      missing.push(
        error(path, "device-impact", `tool ${prim.id} reports deviceImpact`),
      );
      continue;
    }

    if (assay.data.secrets) {
      missing.push(
        error(path, "secrets", `tool ${prim.id} touches secrets`),
      );
      continue;
    }

    if (
      assay.effects.externalMutation ||
      assay.review.disposition === "quarantined" ||
      sideEffectOf(assay) === "external-mutation"
    ) {
      missing.push(
        error(
          path,
          "replay-unsafe-write",
          `tool ${prim.id} is quarantined or external-mutation`,
        ),
      );
      continue;
    }

    primitives.push({
      id: prim.id,
      version: prim.version,
      assayId: prim.assayId,
      admissionState: admission.state,
    });
  }

  // Graph tools must also resolve even if omitted from referencedPrimitives.
  for (let i = 0; i < ctx.record.definition.graph.length; i += 1) {
    const node = ctx.record.definition.graph[i];
    if (!node || node.type !== "tool" || node.toolId === undefined) continue;
    const toolId = node.toolId;
    if (ctx.catalog.forbiddenToolIds.has(toolId)) {
      missing.push(
        error(nodePath(i, "toolId"), "forbidden-tool", `tool ${toolId} is denied`),
      );
      continue;
    }
    const covered = primitives.some((p) => p.id === toolId);
    const alreadyMissing = missing.some(
      (d) => d.path === nodePath(i, "toolId"),
    );
    if (!covered && !alreadyMissing) {
      const assay = ctx.catalog.assays.get(toolId);
      const admission = ctx.catalog.admissions.get(toolId);
      if (!assay || !admission || admission.state !== "admitted-read") {
        missing.push(
          error(
            nodePath(i, "toolId"),
            "assay-not-closed",
            `graph tool ${toolId} is not assay-closed`,
          ),
        );
      }
    }
  }

  const closed = missing.length === 0;
  const assay: AssayClosure = { closed, primitives, missing };
  if (!closed) {
    return { ok: false, diagnostics: missing };
  }
  return { ok: true, patch: { assay } };
}

function lintPolicy(ctx: CheckCtx): CheckResult {
  const diagnostics: Diagnostic[] = [];
  const { prohibited } = ctx.record.definition;
  if (
    !prohibited.deviceCommand ||
    !prohibited.browserMutation ||
    !prohibited.secrets ||
    !prohibited.directCanonicalMutation ||
    !prohibited.specimenDbWrite
  ) {
    diagnostics.push(
      error(
        "/prohibited",
        "prohibited-flags",
        "all prohibited flags must be true",
      ),
    );
  }

  for (let i = 0; i < ctx.record.definition.graph.length; i += 1) {
    const node = ctx.record.definition.graph[i];
    if (!node) continue;

    if (node.type === "tool" && node.toolId !== undefined) {
      if (ctx.catalog.forbiddenToolIds.has(node.toolId)) {
        diagnostics.push(
          error(
            nodePath(i, "toolId"),
            "forbidden-tool",
            `tool ${node.toolId} forbidden by policy`,
          ),
        );
      }
    }

    if (node.type === "mapping") {
      const kind = mappingKind(node);
      if (kind === "sleep") {
        const signal = node.signal;
        if (
          signal !== "reminder" &&
          signal !== "revalidation"
        ) {
          diagnostics.push(
            error(
              nodePath(i, "signal"),
              "sleep-signal-denied",
              "sleep may emit reminder|revalidation only",
            ),
          );
        } else if (
          !ctx.record.sleepPolicy.allowedSignals.includes(signal) ||
          !ctx.catalog.lintRules.sleepSignals.includes(signal)
        ) {
          diagnostics.push(
            error(
              nodePath(i, "signal"),
              "sleep-signal-denied",
              `signal ${signal} not allowed by sleep policy`,
            ),
          );
        }
      }

      if (kind === "foreach" || kind === "loop") {
        const bound =
          node.maxIterations ??
          node.bounds?.maxLoopIterations;
        if (
          ctx.catalog.lintRules.requireLoopBound &&
          (bound === undefined ||
            bound > ctx.record.budgets.maxLoopIterations ||
            bound <= 0)
        ) {
          diagnostics.push(
            error(
              nodePath(i),
              "unbounded-loop",
              "foreach/loop requires maxIterations within envelope budgets",
            ),
          );
        }
      }

      if (kind === "parallel") {
        const bound = node.maxParallel ?? node.bounds?.maxParallel;
        if (
          ctx.catalog.lintRules.requireParallelBound &&
          (bound === undefined ||
            bound > ctx.record.budgets.maxParallel ||
            bound <= 0)
        ) {
          diagnostics.push(
            error(
              nodePath(i),
              "unbounded-parallel",
              "parallel requires a bound within envelope budgets",
            ),
          );
        }
      }
    }
  }

  if (
    !Number.isFinite(ctx.record.budgets.maxLoopIterations) ||
    !Number.isFinite(ctx.record.budgets.wallTimeMs)
  ) {
    diagnostics.push(
      error("/budgets", "budgets-required", "envelope budgets must be finite"),
    );
  }

  if (diagnostics.length > 0) {
    return { ok: false, diagnostics };
  }
  return { ok: true, patch: {} };
}

function simulate(ctx: CheckCtx): CheckResult {
  const diagnostics: Diagnostic[] = [];
  let sideEffectClass: SideEffectClass = "read-only";

  for (let i = 0; i < ctx.record.definition.graph.length; i += 1) {
    const node = ctx.record.definition.graph[i];
    if (!node) continue;

    if (node.type === "tool" && node.toolId !== undefined) {
      const assay =
        ctx.catalog.assays.get(node.toolId) ??
        ctx.catalog.assays.get(
          ctx.record.definition.referencedPrimitives.find(
            (p) => p.id === node.toolId,
          )?.assayId ?? "",
        );
      if (!assay) {
        diagnostics.push(
          error(
            nodePath(i, "toolId"),
            "sim-missing-assay",
            `cannot simulate unknown tool ${node.toolId}`,
          ),
        );
        continue;
      }
      const effect = sideEffectOf(assay);
      if (effect === "external-mutation") {
        diagnostics.push(
          error(
            nodePath(i, "toolId"),
            "replay-unsafe",
            `tool ${node.toolId} is external-mutation; durable replay disabled`,
          ),
        );
        sideEffectClass = "external-mutation";
      } else if (
        effect === "proven-idempotent" &&
        sideEffectClass === "read-only"
      ) {
        sideEffectClass = "proven-idempotent";
      }
    }

    if (node.type === "mapping" && mappingKind(node) === "sleep") {
      const signal = node.signal;
      if (signal !== "reminder" && signal !== "revalidation") {
        diagnostics.push(
          error(
            nodePath(i, "signal"),
            "sleep-signal-denied",
            "simulator rejects deferred-command sleep",
          ),
        );
      }
    }

    if (
      node.type === "mapping" &&
      (mappingKind(node) === "foreach" || mappingKind(node) === "loop")
    ) {
      const bound = node.maxIterations ?? node.bounds?.maxLoopIterations;
      if (bound === undefined) {
        diagnostics.push(
          error(nodePath(i), "unbounded-loop", "simulator refuses unbounded loop"),
        );
      }
    }
  }

  const simulator: SimulatorEvidence = {
    ok: diagnostics.length === 0,
    budgetsRespected: diagnostics.length === 0,
    sideEffectClass,
    diagnostics,
  };

  if (!simulator.ok) {
    return { ok: false, diagnostics };
  }
  return { ok: true, patch: { simulator } };
}

function adversarialEval(ctx: CheckCtx): CheckResult {
  const findings: Diagnostic[] = [];

  for (let i = 0; i < ctx.record.definition.graph.length; i += 1) {
    const node = ctx.record.definition.graph[i];
    if (!node) continue;
    if (node.type === "tool" && node.toolId !== undefined) {
      if (
        ctx.catalog.forbiddenToolIds.has(node.toolId) ||
        node.toolId.startsWith("mcp.")
      ) {
        findings.push(
          error(
            nodePath(i, "toolId"),
            "adversarial-tool",
            `adversarial corpus rejects ${node.toolId}`,
          ),
        );
      }
    }
  }

  if (findings.length > 0) {
    return {
      ok: false,
      diagnostics: findings,
    };
  }

  return {
    ok: true,
    patch: {
      adversarialReviewer: ctx.actor.id,
      adversarial: {
        verdict: "pass",
        summary: "adversarial corpus clean for P0–P2 laboratory fixtures",
        findings: [],
      },
    },
  };
}

function refuseIfComposer(ctx: CheckCtx): Diagnostic | undefined {
  if (ctx.actor.id === ctx.record.composer) {
    return error(
      "/reviewer",
      "composer-self-admit",
      "composer cannot register, approve, or activate its own output",
    );
  }
  return undefined;
}

function distinctIdentities(ctx: CheckCtx): Diagnostic | undefined {
  const ids = [
    ctx.record.composer,
    ctx.record.assessor,
    ctx.record.adversarialReviewer,
    ctx.actor.id,
  ].filter((x): x is string => x !== undefined);
  if (new Set(ids).size !== ids.length) {
    return error(
      "/reviewer",
      "identity-collision",
      "composer, assessor, adversarial reviewer, and human must be distinct ids",
    );
  }
  return undefined;
}

function humanApprove(ctx: CheckCtx): CheckResult {
  const blocked = refuseIfComposer(ctx) ?? distinctIdentities(ctx);
  if (blocked) {
    return { ok: false, diagnostics: [blocked] };
  }
  if (ctx.record.assay?.closed !== true) {
    return {
      ok: false,
      diagnostics: [
        error("/assay", "assay-open", "cannot approve an evaluation that did not close"),
      ],
    };
  }
  if (ctx.record.simulator?.ok !== true) {
    return {
      ok: false,
      diagnostics: [
        error(
          "/simulator",
          "simulator-failed",
          "cannot approve an evaluation that did not close",
        ),
      ],
    };
  }
  if (ctx.record.adversarial?.verdict !== "pass") {
    return {
      ok: false,
      diagnostics: [
        error(
          "/adversarial",
          "adversarial-failed",
          "cannot approve an evaluation that did not close",
        ),
      ],
    };
  }
  return {
    ok: true,
    patch: { human: ctx.actor.id },
  };
}

function signImmutable(ctx: CheckCtx): CheckResult {
  const blocked = refuseIfComposer(ctx);
  if (blocked) {
    return { ok: false, diagnostics: [blocked] };
  }
  if (ctx.record.human !== undefined && ctx.record.human !== ctx.actor.id) {
    return {
      ok: false,
      diagnostics: [
        error(
          "/reviewer",
          "governor-mismatch",
          "signing governor must match approving governor",
        ),
      ],
    };
  }
  return {
    ok: true,
    patch: {
      human: ctx.actor.id,
      admittedAt: ctx.clock,
    },
  };
}

function activateRow(ctx: CheckCtx): CheckResult {
  const blocked = refuseIfComposer(ctx);
  if (blocked) {
    return { ok: false, diagnostics: [blocked] };
  }
  const expiresAt = ctx.record.definition.expiresAt;
  if (expiresAt !== undefined && Date.parse(ctx.clock) >= Date.parse(expiresAt)) {
    return {
      ok: false,
      diagnostics: [
        error("/expiresAt", "expired", "definition expired before activation"),
      ],
    };
  }
  return {
    ok: true,
    patch: {
      activatedAt: ctx.clock,
    },
  };
}

function revokeRow(ctx: CheckCtx): CheckResult {
  const blocked = refuseIfComposer(ctx);
  if (blocked) {
    return { ok: false, diagnostics: [blocked] };
  }
  if (ctx.intent.kind !== "revoke") {
    return {
      ok: false,
      diagnostics: [error("/", "intent-mismatch", "revoke intent required")],
    };
  }
  return {
    ok: true,
    patch: {
      revokedAt: ctx.clock,
      reason: ctx.intent.reason,
      human: ctx.actor.id,
    },
  };
}

function expireRow(ctx: CheckCtx): CheckResult {
  return {
    ok: true,
    patch: {
      revokedAt: ctx.clock,
      reason: "expired",
      notes: `expired:${ctx.clock}`,
    },
  };
}

/** Private transition law. Not exported from package index. */
const STAGE_TABLE: readonly StageRow[] = [
  {
    from: "draft",
    to: "schema-validated",
    intent: "advance",
    allowedRoles: ["assessor"],
    check: schemaAndGraph,
  },
  {
    from: "schema-validated",
    to: "primitives-resolved",
    intent: "advance",
    allowedRoles: ["assessor"],
    check: resolvePrimitives,
  },
  {
    from: "primitives-resolved",
    to: "assay-closed",
    intent: "advance",
    allowedRoles: ["assessor"],
    check: closeAssay,
  },
  {
    from: "assay-closed",
    to: "policy-linted",
    intent: "advance",
    allowedRoles: ["assessor"],
    check: lintPolicy,
  },
  {
    from: "policy-linted",
    to: "simulated",
    intent: "advance",
    allowedRoles: ["assessor"],
    check: simulate,
  },
  {
    from: "simulated",
    to: "adversarially-evaluated",
    intent: "advance",
    allowedRoles: ["adversarial-reviewer"],
    check: adversarialEval,
  },
  {
    from: "adversarially-evaluated",
    to: "human-approved",
    intent: "advance",
    allowedRoles: ["human"],
    check: humanApprove,
  },
  {
    from: "human-approved",
    to: "signed-immutable",
    intent: "advance",
    allowedRoles: ["human"],
    check: signImmutable,
  },
  {
    from: "signed-immutable",
    to: "active",
    intent: "advance",
    allowedRoles: ["human"],
    check: activateRow,
  },
  {
    from: "signed-immutable",
    to: "revoked",
    intent: "revoke",
    allowedRoles: ["human"],
    check: revokeRow,
  },
  {
    from: "active",
    to: "revoked",
    intent: "revoke",
    allowedRoles: ["human"],
    check: revokeRow,
  },
  {
    from: "human-approved",
    to: "expired",
    intent: "expire",
    allowedRoles: ["human", "assessor"],
    check: expireRow,
  },
  {
    from: "signed-immutable",
    to: "expired",
    intent: "expire",
    allowedRoles: ["human", "assessor"],
    check: expireRow,
  },
  {
    from: "active",
    to: "expired",
    intent: "expire",
    allowedRoles: ["human", "assessor"],
    check: expireRow,
  },
];

export type AdvanceResult =
  | { readonly ok: true; readonly record: AdmissionRecord }
  | {
      readonly ok: false;
      readonly record: AdmissionRecord;
      readonly diagnostics: readonly Diagnostic[];
    };

function appendHistory(
  record: AdmissionRecord,
  from: Stage,
  to: Stage,
  actor: ActorRef,
  clock: string,
  note?: string,
): readonly AuditEntry[] {
  const entry: AuditEntry = {
    at: clock,
    from,
    to,
    actorId: actor.id,
    actorRole: actor.role,
    ...(note !== undefined ? { note } : {}),
  };
  return [...record.history, entry];
}

/**
 * Apply consecutive matching stage-table rows for this actor until blocked.
 * When `stopAt` is set, halt after transitioning to that stage.
 * Not exported from package index.
 */
export function advanceRecord(
  record: AdmissionRecord,
  catalog: CatalogResources,
  schemas: SchemaBundle,
  actor: ActorRef,
  intent: Intent = { kind: "advance" },
  clock: string,
  stopAt?: Stage,
): AdvanceResult {
  let current = record;
  let progressed = false;

  for (const row of STAGE_TABLE) {
    if (row.from !== current.stage) continue;
    if (row.intent !== intent.kind) continue;
    if (!row.allowedRoles.includes(actor.role)) {
      break;
    }

    const result = row.check({
      record: current,
      catalog,
      schemas,
      actor,
      intent,
      clock,
    });

    if (!result.ok) {
      return {
        ok: false,
        record: current,
        diagnostics: result.diagnostics,
      };
    }

    const next: AdmissionRecord = {
      ...current,
      ...result.patch,
      stage: row.to,
      history: appendHistory(
        current,
        row.from,
        row.to,
        actor,
        clock,
        intent.kind === "revoke" ? intent.reason : undefined,
      ),
    };
    current = next;
    progressed = true;

    if (stopAt !== undefined && current.stage === stopAt) {
      break;
    }
  }

  if (!progressed && intent.kind === "advance") {
    return { ok: true, record: current };
  }

  return { ok: true, record: current };
}

export function admissionIdFor(
  definitionId: `wf.${string}`,
  version: string,
): `admit-wf.${string}` {
  const slug = definitionId.slice("wf.".length);
  return `admit-wf.${slug}.v${version.replace(/[^a-z0-9.-]/gi, "-").toLowerCase()}` as `admit-wf.${string}`;
}

export function draftToRecord(
  definition: WorkflowDefinitionJson,
  budgets: AdmissionRecord["budgets"],
  requestContextSchema: object,
  sleepPolicy: AdmissionRecord["sleepPolicy"],
  composerId: string,
): AdmissionRecord {
  return {
    admissionId: admissionIdFor(definition.definitionId, definition.version),
    definitionId: definition.definitionId,
    definitionVersion: definition.version,
    digest: definition.digest,
    stage: "draft",
    composer: composerId,
    definition,
    budgets,
    requestContextSchema,
    sleepPolicy,
    history: [],
  };
}

export function evaluateThroughAdversarial(
  record: AdmissionRecord,
  catalog: CatalogResources,
  schemas: SchemaBundle,
  assessor: ActorRef,
  adversary: ActorRef,
  clock: string,
): AdvanceResult {
  const assessed = advanceRecord(
    record,
    catalog,
    schemas,
    assessor,
    { kind: "advance" },
    clock,
  );
  if (!assessed.ok) {
    return assessed;
  }
  if (assessed.record.stage !== "simulated") {
    return {
      ok: false,
      record: assessed.record,
      diagnostics: [
        error(
          "/",
          "assess-incomplete",
          `assessor stopped at ${assessed.record.stage}`,
        ),
      ],
    };
  }
  return advanceRecord(
    assessed.record,
    catalog,
    schemas,
    adversary,
    { kind: "advance" },
    clock,
  );
}
