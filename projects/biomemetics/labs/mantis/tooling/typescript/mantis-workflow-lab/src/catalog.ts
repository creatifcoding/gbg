import { readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

import { pins } from "./pins.ts";
import {
  defaultMantisRoot,
  defaultWorkflowsRoot,
  resolveUnderRoot,
} from "./paths.ts";
import type {
  Budgets,
  CatalogCase,
  SleepPolicy,
  WorkflowDefinitionJson,
} from "./types.ts";

export const FROZEN_CLOCK = "2026-08-21T12:00:00Z";

export interface ToolAssayRecord {
  readonly assayId: string;
  readonly identity: { readonly id: string; readonly version: string };
  readonly effects: {
    readonly read: boolean;
    readonly write: boolean;
    readonly externalMutation: boolean;
    readonly deviceImpact: boolean;
  };
  readonly behavior: {
    readonly idempotent: boolean;
  };
  readonly authority: {
    readonly category: string;
  };
  readonly review: {
    readonly disposition: string;
  };
  readonly data: {
    readonly secrets: boolean;
  };
}

export interface ToolAdmissionRecord {
  readonly admissionId: string;
  readonly toolId: string;
  readonly assayId: string;
  readonly state: string;
}

export interface PrimitiveToolEntry {
  readonly id: string;
  readonly version: string;
  readonly assayId: string;
  readonly admission: string;
  readonly source: string;
}

export interface PrimitiveSnapshot {
  readonly tools: readonly PrimitiveToolEntry[];
  readonly forbidden: readonly string[];
  readonly mappingKinds: readonly string[];
  readonly sleepSignals: readonly string[];
}

export interface EnvelopeJson {
  readonly kind: "LaboratoryEnvelope";
  readonly definitionId: string;
  readonly budgets: Budgets;
  readonly requestContextSchema: object;
  readonly sleepPolicy: SleepPolicy;
  readonly capabilityClass: string;
}

export interface CatalogResources {
  readonly mantisRoot: string;
  readonly workflowsRoot: string;
  readonly clock: string;
  readonly pins: typeof pins;
  readonly snapshot: PrimitiveSnapshot;
  readonly forbiddenToolIds: ReadonlySet<string>;
  readonly lintRules: {
    readonly forbiddenToolIds: readonly string[];
    readonly sleepSignals: readonly string[];
    readonly requireLoopBound: boolean;
    readonly requireParallelBound: boolean;
    readonly denyReplayUnsafeWrites: boolean;
  };
  readonly assays: ReadonlyMap<string, ToolAssayRecord>;
  readonly admissions: ReadonlyMap<string, ToolAdmissionRecord>;
  readonly catalogCases: readonly CatalogCase[];
  readJson(relativeOrAbs: string): Promise<unknown>;
  readDefinition(relativePath: string): Promise<WorkflowDefinitionJson>;
  readEnvelope(relativePath: string): Promise<EnvelopeJson>;
  readCaseFile(id: string): Promise<CatalogCase>;
}

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await readFile(filePath, "utf8")) as unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asAssay(value: unknown): ToolAssayRecord {
  if (!isObject(value)) {
    throw new Error("assay must be object");
  }
  return value as unknown as ToolAssayRecord;
}

function asAdmission(value: unknown): ToolAdmissionRecord {
  if (!isObject(value)) {
    throw new Error("admission must be object");
  }
  return value as unknown as ToolAdmissionRecord;
}

export async function openCatalogResources(options: {
  readonly root?: string | URL;
  readonly now?: () => Date;
}): Promise<CatalogResources> {
  const mantisRoot =
    options.root === undefined
      ? defaultMantisRoot()
      : typeof options.root === "string"
        ? path.resolve(options.root)
        : path.resolve(
            typeof options.root === "object" && "pathname" in options.root
              ? decodeURIComponent(
                  new URL(options.root.href).pathname,
                )
              : String(options.root),
          );

  const workflowsRoot = existsSync(
    path.join(mantisRoot, "assistant", "workflows"),
  )
    ? path.join(mantisRoot, "assistant", "workflows")
    : existsSync(path.join(mantisRoot, "fixture-catalog"))
      ? mantisRoot
      : defaultWorkflowsRoot(defaultMantisRoot());

  const resolvedMantis =
    path.basename(path.dirname(workflowsRoot)) === "assistant"
      ? path.dirname(path.dirname(workflowsRoot))
      : defaultMantisRoot();

  const snapshot = (await readJsonFile(
    path.join(workflowsRoot, "laboratory", "primitive-snapshot.json"),
  )) as PrimitiveSnapshot;

  const forbiddenDoc = (await readJsonFile(
    path.join(
      workflowsRoot,
      "laboratory",
      "imported-a0",
      "forbidden-tools.json",
    ),
  )) as { tools: { id: string }[] };

  const lintRules = (await readJsonFile(
    path.join(workflowsRoot, "linter", "rules.json"),
  )) as CatalogResources["lintRules"] & Record<string, unknown>;

  const catalogIndex = (await readJsonFile(
    path.join(workflowsRoot, "fixture-catalog", "catalog.json"),
  )) as { clock: string; cases: { id: string; expect: string }[] };

  const assays = new Map<string, ToolAssayRecord>();
  const admissions = new Map<string, ToolAdmissionRecord>();

  const importedAssays = [
    ["assay.care-source-read.v1", "assay.care-source-read.json"],
    ["assay.supply-transit-read.v1", "assay.supply-transit-read.json"],
  ] as const;
  for (const [assayId, file] of importedAssays) {
    const assay = asAssay(
      await readJsonFile(
        path.join(workflowsRoot, "laboratory", "imported-a0", file),
      ),
    );
    assays.set(assayId, assay);
    assays.set(assay.identity.id, assay);
  }

  const importedAdmits = [
    ["care-source-read", "admit.care-source-read.json"],
    ["supply-transit-read", "admit.supply-transit-read.json"],
  ] as const;
  for (const [toolId, file] of importedAdmits) {
    const admission = asAdmission(
      await readJsonFile(
        path.join(workflowsRoot, "laboratory", "imported-a0", file),
      ),
    );
    admissions.set(toolId, admission);
    admissions.set(admission.assayId, admission);
  }

  const assayDir = path.join(workflowsRoot, "fixture-catalog", "assays");
  for (const name of await readdir(assayDir)) {
    if (!name.endsWith(".json")) continue;
    if (
      name.endsWith(".input.json") ||
      name.endsWith(".output.json") ||
      name.endsWith(".admission.json")
    ) {
      continue;
    }
    const assay = asAssay(await readJsonFile(path.join(assayDir, name)));
    assays.set(assay.assayId, assay);
    assays.set(assay.identity.id, assay);
    const admissionPath = path.join(
      assayDir,
      name.replace(/\.json$/, ".admission.json"),
    );
    if (existsSync(admissionPath)) {
      const admission = asAdmission(await readJsonFile(admissionPath));
      admissions.set(admission.toolId, admission);
      admissions.set(admission.assayId, admission);
    }
  }

  const caseFiles: CatalogCase[] = [];
  for (const entry of catalogIndex.cases) {
    const positive = path.join(
      workflowsRoot,
      "fixture-catalog",
      "positive",
      `${entry.id}.json`,
    );
    const negative = path.join(
      workflowsRoot,
      "fixture-catalog",
      "negative",
      `${entry.id}.json`,
    );
    const file = existsSync(positive)
      ? positive
      : existsSync(negative)
        ? negative
        : null;
    if (!file) {
      throw new Error(`catalog case file missing for ${entry.id}`);
    }
    caseFiles.push((await readJsonFile(file)) as CatalogCase);
  }

  const forbiddenToolIds = new Set<string>([
    ...forbiddenDoc.tools.map((t) => t.id),
    ...lintRules.forbiddenToolIds,
    ...snapshot.forbidden,
  ]);

  const resolvePath = (relativePath: string): string => {
    if (path.isAbsolute(relativePath)) return relativePath;
    if (relativePath.startsWith("assistant/workflows/")) {
      return resolveUnderRoot(workflowsRoot, relativePath);
    }
    if (relativePath.startsWith("assistant/")) {
      return path.join(resolvedMantis, relativePath);
    }
    return path.join(workflowsRoot, relativePath);
  };

  return {
    mantisRoot: resolvedMantis,
    workflowsRoot,
    clock: catalogIndex.clock || FROZEN_CLOCK,
    pins,
    snapshot,
    forbiddenToolIds,
    lintRules: {
      forbiddenToolIds: lintRules.forbiddenToolIds,
      sleepSignals: lintRules.sleepSignals,
      requireLoopBound: lintRules.requireLoopBound,
      requireParallelBound: lintRules.requireParallelBound,
      denyReplayUnsafeWrites: lintRules.denyReplayUnsafeWrites,
    },
    assays,
    admissions,
    catalogCases: caseFiles,
    async readJson(relativeOrAbs: string): Promise<unknown> {
      return readJsonFile(resolvePath(relativeOrAbs));
    },
    async readDefinition(
      relativePath: string,
    ): Promise<WorkflowDefinitionJson> {
      return (await readJsonFile(
        resolvePath(relativePath),
      )) as WorkflowDefinitionJson;
    },
    async readEnvelope(relativePath: string): Promise<EnvelopeJson> {
      return (await readJsonFile(resolvePath(relativePath))) as EnvelopeJson;
    },
    async readCaseFile(id: string): Promise<CatalogCase> {
      const found = caseFiles.find((c) => c.id === id);
      if (!found) {
        throw new Error(`unknown catalog case ${id}`);
      }
      return found;
    },
  };
}
