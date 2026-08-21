import { contentDigest, signatureDigest } from "./digest.ts";
import { openCatalogResources, FROZEN_CLOCK, type CatalogResources } from "./catalog.ts";
import {
  ActiveBrand,
  DraftBrand,
  RevokedBrand,
  SignedBrand,
  asAdversarialReviewer,
  asAssessor,
  asComposer,
  asHumanGovernor,
  assertHumanGovernor,
  isMintedIdentity,
  type AdversarialReviewer,
  type Assessor,
  type Composer,
  type HumanGovernor,
} from "./identities.ts";
import { pins } from "./pins.ts";
import {
  advanceRecord,
  draftToRecord,
  evaluateThroughAdversarial,
  type ActorRef,
} from "./pipeline.ts";
import { assertValid, loadSchemaBundle, type SchemaBundle } from "./schema.ts";
import type {
  ActiveAdmission,
  ApprovalPacket,
  CatalogReport,
  CatalogReportCase,
  Diagnostic,
  DraftDefinition,
  Evaluation,
  LaboratoryOptions,
  RevokedAdmission,
  SignedVersion,
  WorkflowAdmissionWire,
  WorkflowDefinitionJson,
  WorkflowRunReceipt,
} from "./types.ts";

export interface Laboratory {
  readonly pins: typeof pins;
  loadDraft(composer: Composer, definitionPath: string, envelopePath: string): Promise<DraftDefinition>;
  parseDraft(composer: Composer, definition: unknown, envelope: unknown): DraftDefinition;
  evaluate(
    assessor: Assessor,
    draft: DraftDefinition,
    opts?: { readonly adversary?: AdversarialReviewer },
  ): Promise<Evaluation>;
  present(evaluation: Evaluation): ApprovalPacket;
  approve(governor: HumanGovernor, packet: ApprovalPacket): Promise<SignedVersion>;
  activate(governor: HumanGovernor, signed: SignedVersion): Promise<ActiveAdmission>;
  revoke(
    governor: HumanGovernor,
    admission: ActiveAdmission | SignedVersion,
    reason: string,
  ): Promise<RevokedAdmission>;
  bindRun(
    active: ActiveAdmission,
    input: unknown,
  ): Promise<WorkflowRunReceipt>;
  runCatalog(): Promise<CatalogReport>;
  toAdmissionWire(
    admission: SignedVersion | ActiveAdmission | RevokedAdmission,
  ): WorkflowAdmissionWire;
}

function asDefinition(value: unknown): WorkflowDefinitionJson {
  if (typeof value !== "object" || value === null) {
    throw new Error("definition must be an object");
  }
  return value as WorkflowDefinitionJson;
}

function mintDraft(
  definition: WorkflowDefinitionJson,
  envelope: {
    budgets: DraftDefinition["budgets"];
    requestContextSchema: object;
    sleepPolicy: DraftDefinition["sleepPolicy"];
  },
  composer: Composer,
): DraftDefinition {
  return {
    [DraftBrand]: true,
    definition,
    budgets: envelope.budgets,
    requestContextSchema: envelope.requestContextSchema,
    sleepPolicy: envelope.sleepPolicy,
    composedBy: composer,
    digest: definition.digest,
  };
}

function requireClosed(evaluation: Evaluation): asserts evaluation is Extract<
  Evaluation,
  { kind: "closed" }
> {
  if (evaluation.kind !== "closed") {
    throw Object.assign(
      new Error("cannot approve an evaluation that did not close"),
      {
        code: "evaluation-open",
        diagnostics: evaluation.diagnostics,
      },
    );
  }
}

export async function openLaboratory(
  options: LaboratoryOptions = {},
): Promise<Laboratory> {
  const catalog = await openCatalogResources({
    ...(options.root !== undefined ? { root: options.root } : {}),
    ...(options.now !== undefined ? { now: options.now } : {}),
  });
  const schemas = await loadSchemaBundle({
    workflowsRoot: catalog.workflowsRoot,
    mantisRoot: catalog.mantisRoot,
    schemaPrefer: options.schemaPrefer ?? "live-then-snapshot",
  });
  const clock = () =>
    options.now !== undefined
      ? options.now().toISOString().replace(/\.\d{3}Z$/, "Z")
      : catalog.clock || FROZEN_CLOCK;

  const ledger = new Map<string, ActiveAdmission | RevokedAdmission | SignedVersion>();

  const lab: Laboratory = {
    pins,

    async loadDraft(composer, definitionPath, envelopePath) {
      const definition = await catalog.readDefinition(definitionPath);
      const envelope = await catalog.readEnvelope(envelopePath);
      return lab.parseDraft(composer, definition, envelope);
    },

    parseDraft(composer, definitionUnknown, envelopeUnknown) {
      if (!isMintedIdentity(composer) || composer.role !== "composer") {
        throw new Error("composer identity required");
      }
      const definition = asDefinition(definitionUnknown);
      assertValid(schemas.validateDefinition, definition, "DynamicWorkflowDefinition");
      const computed = contentDigest(
        definition as unknown as Record<string, unknown>,
      );
      if (computed !== definition.digest) {
        throw new Error(
          `digest mismatch: fixture ${definition.digest} != computed ${computed}`,
        );
      }
      if (
        typeof envelopeUnknown !== "object" ||
        envelopeUnknown === null ||
        !("budgets" in envelopeUnknown) ||
        !("requestContextSchema" in envelopeUnknown) ||
        !("sleepPolicy" in envelopeUnknown)
      ) {
        throw new Error("envelope requires budgets, requestContextSchema, sleepPolicy");
      }
      const envelope = envelopeUnknown as {
        budgets: DraftDefinition["budgets"];
        requestContextSchema: object;
        sleepPolicy: DraftDefinition["sleepPolicy"];
      };
      return mintDraft(definition, envelope, composer);
    },

    async evaluate(assessor, draft, opts) {
      if (!isMintedIdentity(assessor) || assessor.role !== "assessor") {
        throw new Error("assessor identity required");
      }
      const adversary =
        opts?.adversary ??
        asAdversarialReviewer("adversarial-reviewer-fixture");
      if (
        !isMintedIdentity(adversary) ||
        adversary.role !== "adversarial-reviewer"
      ) {
        throw new Error("adversarial reviewer identity required");
      }

      const record = draftToRecord(
        draft.definition,
        draft.budgets,
        draft.requestContextSchema,
        draft.sleepPolicy,
        draft.composedBy.id,
      );

      const result = evaluateThroughAdversarial(
        record,
        catalog,
        schemas,
        { id: assessor.id, role: "assessor" },
        { id: adversary.id, role: "adversarial-reviewer" },
        clock(),
      );

      if (!result.ok) {
        return {
          kind: "failed",
          draft,
          record: result.record,
          diagnostics: result.diagnostics,
        };
      }
      if (result.record.stage !== "adversarially-evaluated") {
        return {
          kind: "failed",
          draft,
          record: result.record,
          diagnostics: [
            {
              path: "/",
              code: "evaluate-incomplete",
              severity: "error",
              message: `stopped at ${result.record.stage}`,
            },
          ],
        };
      }
      return {
        kind: "closed",
        draft,
        record: result.record,
        diagnostics: [],
      };
    },

    present(evaluation) {
      const def = evaluation.draft.definition;
      return {
        draft: evaluation.draft,
        evaluation,
        diff: {
          definitionId: def.definitionId,
          version: def.version,
          digest: def.digest,
          graph: def.graph,
          stage: evaluation.record.stage,
        },
        capabilities: {
          capabilityClass: def.capabilityClass,
          prohibited: def.prohibited,
        },
        sources: def.referencedPrimitives,
        costs: evaluation.draft.budgets,
        ...(def.expiresAt !== undefined ? { expiry: def.expiresAt } : {}),
      };
    },

    async approve(governor, packet) {
      assertHumanGovernor(governor);
      requireClosed(packet.evaluation);

      if (governor.id === packet.evaluation.record.composer) {
        const diagnostic: Diagnostic = {
          path: "/reviewer",
          code: "composer-self-admit",
          severity: "error",
          message: "composer cannot register, approve, or activate its own output",
        };
        throw Object.assign(new Error(diagnostic.message), {
          code: diagnostic.code,
          path: diagnostic.path,
          diagnostics: [diagnostic],
        });
      }

      const advanced = advanceRecord(
        packet.evaluation.record,
        catalog,
        schemas,
        { id: governor.id, role: "human" },
        { kind: "advance" },
        clock(),
        "signed-immutable",
      );

      if (!advanced.ok) {
        throw Object.assign(new Error(advanced.diagnostics[0]?.message ?? "approve failed"), {
          code: advanced.diagnostics[0]?.code,
          path: advanced.diagnostics[0]?.path,
          diagnostics: advanced.diagnostics,
        });
      }

      const record = advanced.record;
      if (record.stage !== "signed-immutable") {
        throw new Error(`approve expected signed-immutable, got ${record.stage}`);
      }

      const admittedAt = record.admittedAt ?? clock();
      const signature = signatureDigest({
        admissionId: record.admissionId,
        digest: record.digest,
        reviewer: governor.id,
        admittedAt,
      });
      const signedRecord = {
        ...record,
        admittedAt,
        signature,
        human: governor.id,
      };
      const signed: SignedVersion = {
        [SignedBrand]: true,
        admissionId: signedRecord.admissionId,
        definitionId: signedRecord.definitionId,
        definitionVersion: signedRecord.definitionVersion,
        digest: signedRecord.digest,
        state: "signed-immutable",
        reviewer: governor,
        admittedAt,
        signature,
        record: signedRecord,
      };
      ledger.set(signed.admissionId, signed);
      return signed;
    },

    async activate(governor, signed) {
      assertHumanGovernor(governor);
      if (governor.id === signed.record.composer) {
        throw Object.assign(new Error("composer cannot activate own output"), {
          code: "composer-self-admit",
          path: "/reviewer",
        });
      }

      const result = advanceRecord(
        signed.record,
        catalog,
        schemas,
        { id: governor.id, role: "human" },
        { kind: "advance" },
        clock(),
      );
      if (!result.ok) {
        throw Object.assign(new Error(result.diagnostics[0]?.message ?? "activate failed"), {
          diagnostics: result.diagnostics,
          code: result.diagnostics[0]?.code,
          path: result.diagnostics[0]?.path,
        });
      }
      if (result.record.stage !== "active") {
        throw new Error(`activate expected active, got ${result.record.stage}`);
      }

      const active: ActiveAdmission = {
        [ActiveBrand]: true,
        admissionId: result.record.admissionId,
        definitionId: result.record.definitionId,
        definitionVersion: result.record.definitionVersion,
        digest: result.record.digest,
        state: "active",
        reviewer: governor,
        admittedAt: result.record.admittedAt ?? signed.admittedAt,
        activatedAt: result.record.activatedAt ?? clock(),
        signature: result.record.signature ?? signed.signature,
        record: {
          ...result.record,
          signature: result.record.signature ?? signed.signature,
          admittedAt: result.record.admittedAt ?? signed.admittedAt,
        },
      };
      ledger.set(active.admissionId, active);
      return active;
    },

    async revoke(governor, admission, reason) {
      assertHumanGovernor(governor);
      const result = advanceRecord(
        admission.record,
        catalog,
        schemas,
        { id: governor.id, role: "human" },
        { kind: "revoke", reason },
        clock(),
      );
      if (!result.ok) {
        throw Object.assign(new Error(result.diagnostics[0]?.message ?? "revoke failed"), {
          diagnostics: result.diagnostics,
        });
      }
      const revoked: RevokedAdmission = {
        [RevokedBrand]: true,
        admissionId: result.record.admissionId,
        definitionId: result.record.definitionId,
        definitionVersion: result.record.definitionVersion,
        digest: result.record.digest,
        state: "revoked",
        reviewer: governor,
        admittedAt: result.record.admittedAt ?? admission.admittedAt,
        revokedAt: result.record.revokedAt ?? clock(),
        reason,
        signature: result.record.signature ?? admission.signature,
        priorState: admission.state === "active" ? "active" : "signed-immutable",
        record: result.record,
      };
      ledger.set(revoked.admissionId, revoked);
      return revoked;
    },

    async bindRun(active, _input) {
      const current = ledger.get(active.admissionId) ?? active;
      if (current.state === "revoked") {
        throw Object.assign(new Error("revoked admission cannot bind new runs"), {
          code: "revoked",
          path: "/state",
        });
      }
      if (current.state !== "active") {
        throw Object.assign(new Error("only ActiveAdmission can bindRun"), {
          code: "not-active",
          path: "/state",
        });
      }

      const sideEffectClass =
        active.record.simulator?.sideEffectClass ?? "read-only";
      if (sideEffectClass === "external-mutation") {
        throw Object.assign(
          new Error("external-mutation graphs cannot bind for durable replay"),
          {
            code: "replay-unsafe",
            path: "/sideEffectClass",
          },
        );
      }

      const receipt: WorkflowRunReceipt = {
        schemaVersion: "1.0.0",
        kind: "WorkflowRunReceipt",
        runId: `wfrun.${active.definitionId.slice(3)}` as `wfrun.${string}`,
        definitionId: active.definitionId,
        definitionVersion: active.definitionVersion,
        digest: active.digest,
        startedAt: clock(),
        status: "running",
        sideEffectClass,
        replaySafe: true,
      };

      if (receipt.digest !== active.record.digest) {
        throw new Error("receipt digest must equal definition content digest");
      }

      assertValid(schemas.validateRunReceipt, receipt, "WorkflowRunReceipt");
      return receipt;
    },

    async runCatalog() {
      return runCatalogWith(lab, catalog);
    },

    toAdmissionWire(admission) {
      const wireState =
        admission.state === "revoked" &&
        admission.record.notes?.startsWith("expired:")
          ? "revoked"
          : admission.state;
      const notes =
        "reason" in admission
          ? admission.reason
          : admission.notes !== undefined
            ? admission.notes
            : undefined;
      const wire: WorkflowAdmissionWire = {
        schemaVersion: "1.0.0",
        kind: "WorkflowAdmission",
        admissionId: admission.admissionId,
        definitionId: admission.definitionId,
        definitionVersion: admission.definitionVersion,
        digest: admission.digest,
        state: wireState,
        reviewer: admission.reviewer.id,
        admittedAt: admission.admittedAt,
        ...(admission.signature !== undefined
          ? { signature: admission.signature }
          : {}),
        ...(notes !== undefined ? { notes } : {}),
      };
      assertValid(schemas.validateAdmission, wire, "WorkflowAdmission");
      return wire;
    },
  };

  return lab;
}

async function runCatalogWith(
  lab: Laboratory,
  catalog: CatalogResources,
): Promise<CatalogReport> {
  const cases: CatalogReportCase[] = [];
  let ok = true;

  for (const entry of catalog.catalogCases) {
    const composer = asComposer(entry.composer);
    const assessor = asAssessor(entry.assessor);
    const adversary = asAdversarialReviewer(entry.adversary);
    const governor = asHumanGovernor(entry.governor);

    try {
      const draft = await lab.loadDraft(
        composer,
        entry.definition,
        entry.envelope,
      );
      const evaluation = await lab.evaluate(assessor, draft, { adversary });

      if (entry.expect === "admit") {
        if (evaluation.kind !== "closed") {
          ok = false;
          cases.push({
            id: entry.id,
            expect: entry.expect,
            ok: false,
            stage: evaluation.record.stage,
            diagnostics: evaluation.diagnostics,
          });
          continue;
        }
        const packet = lab.present(evaluation);
        const signed = await lab.approve(governor, packet);
        await lab.activate(governor, signed);
        cases.push({
          id: entry.id,
          expect: entry.expect,
          ok: true,
          stage: "active",
          diagnostics: [],
        });
        continue;
      }

      if (entry.expect === "reject") {
        const failed = evaluation.kind === "failed";
        const pathOk =
          entry.diagnosticPath === undefined ||
          evaluation.diagnostics.some((d) => d.path === entry.diagnosticPath);
        const caseOk = failed && pathOk;
        if (!caseOk) ok = false;
        cases.push({
          id: entry.id,
          expect: entry.expect,
          ok: caseOk,
          stage: evaluation.record.stage,
          diagnostics: evaluation.diagnostics,
        });
        continue;
      }

      if (evaluation.kind !== "closed") {
        ok = false;
        cases.push({
          id: entry.id,
          expect: entry.expect,
          ok: false,
          stage: evaluation.record.stage,
          diagnostics: evaluation.diagnostics,
        });
        continue;
      }
      const packet = lab.present(evaluation);
      let identityRejected = false;
      let diagnostics: Diagnostic[] = [];
      try {
        await lab.approve(governor, packet);
      } catch (err) {
        identityRejected = true;
        const e = err as { diagnostics?: Diagnostic[]; path?: string; code?: string };
        diagnostics =
          e.diagnostics ??
          [
            {
              path: (e.path ?? "/reviewer") as Diagnostic["path"],
              code: e.code ?? "composer-self-admit",
              severity: "error",
              message: err instanceof Error ? err.message : "identity rejected",
            },
          ];
      }
      const pathOk =
        entry.diagnosticPath === undefined ||
        diagnostics.some((d) => d.path === entry.diagnosticPath);
      const caseOk = identityRejected && pathOk;
      if (!caseOk) ok = false;
      cases.push({
        id: entry.id,
        expect: entry.expect,
        ok: caseOk,
        stage: evaluation.record.stage,
        diagnostics,
      });
    } catch (err) {
      ok = false;
      cases.push({
        id: entry.id,
        expect: entry.expect,
        ok: false,
        stage: "draft",
        diagnostics: [
          {
            path: "/",
            code: "catalog-error",
            severity: "error",
            message: err instanceof Error ? err.message : String(err),
          },
        ],
      });
    }
  }

  return { ok, clock: catalog.clock, cases };
}

/**
 * Test-only helper. Not exported from package index.
 * Bypasses TypeScript brands to prove runtime identity checks.
 */
export async function smuggleActivate(
  lab: Laboratory,
  actor: Assessor | AdversarialReviewer | Composer | { readonly id: string; readonly role: string },
  signed: SignedVersion,
): Promise<ActiveAdmission> {
  return lab.activate(actor as unknown as HumanGovernor, signed);
}

export async function smuggleApprove(
  lab: Laboratory,
  actor: Assessor | AdversarialReviewer | Composer | { readonly id: string; readonly role: string },
  packet: ApprovalPacket,
): Promise<SignedVersion> {
  return lab.approve(actor as unknown as HumanGovernor, packet);
}

export type { CatalogResources, SchemaBundle, ActorRef };
