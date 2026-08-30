import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { manifestsDir, policiesDir } from './paths.ts';
import {
  CONTEXT_FILTER,
  FORBIDDEN_TOOL_IDS,
  HierarchyLoadError,
  SPECIALIST_IDS,
  brandTool,
  isForbiddenTool,
  isHostMode,
  isSpecialistId,
  type AssayedToolId,
  type Budget,
  type HostMode,
  type LoadedRegistry,
  type LoadedSpecialist,
  type ManifestRefusalReason,
  type SourceClass,
  type SpecialistForbidden,
  type SpecialistId,
  type SpecialistYield,
} from './types.ts';

const SOURCE_CLASSES: readonly SourceClass[] = [
  'reviewed-source',
  'visible-fact',
  'hypothesis',
  'ephemeral-inventory',
  'telemetry-read',
  'evidence-draft',
  'workflow-draft',
  'assay-report',
  'attack-report',
];

const FORBIDDEN_BY_ID: { readonly [K in SpecialistId]: SpecialistForbidden<K> } = {
  'care-source': ['diagnose', 'publish', 'actuate'],
  'observation-extractor': ['assert-taxon', 'measure-without-scale'],
  'taxon-hypothesis': ['confirm-taxon', 'set-automation', 'emit-observation', 'mint-specimen'],
  'supply-transit': ['retain-address', 'purchase', 'infer-locality'],
  'terrarium-diagnostician': ['clear-latch', 'move-rail', 'energize'],
  'evidence-curator': ['accept-own-evidence', 'write-specimendb'],
  'workflow-composer': ['register-workflow', 'execute-draft'],
  'tool-assessor': ['admit-tool'],
  'adversarial-reviewer': ['edit-candidate', 'issue-admission'],
};

const YIELD_KIND_BY_ID: { readonly [K in SpecialistId]: SpecialistYield<K>['kind'] } = {
  'care-source': 'care-advice-draft',
  'observation-extractor': 'observation-draft',
  'taxon-hypothesis': 'interpretation',
  'supply-transit': 'supply-plan',
  'terrarium-diagnostician': 'diagnostic-read',
  'evidence-curator': 'evidence-draft',
  'workflow-composer': 'workflow-draft',
  'tool-assessor': 'assay-report',
  'adversarial-reviewer': 'attack-report',
};

export type ParseManifestResult =
  | { readonly ok: true; readonly specialist: LoadedSpecialist }
  | { readonly ok: false; readonly reasons: readonly ManifestRefusalReason[] };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSourceClass = (value: string): value is SourceClass =>
  (SOURCE_CLASSES as readonly string[]).includes(value);

const sameStrings = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length && left.every((item, index) => item === right[index]);

const parseBudget = (value: unknown): Budget | undefined => {
  if (!isRecord(value)) return undefined;
  const { maxSteps, timeoutMs, maxTokens } = value;
  if (
    typeof maxSteps !== 'number' ||
    typeof timeoutMs !== 'number' ||
    typeof maxTokens !== 'number' ||
    maxSteps < 1 ||
    timeoutMs < 1 ||
    maxTokens < 1
  ) {
    return undefined;
  }
  return { maxSteps, timeoutMs, maxTokens };
};

const parseModes = (value: unknown): readonly HostMode[] | undefined => {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const modes: HostMode[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || !isHostMode(item)) return undefined;
    modes.push(item);
  }
  return modes;
};

const parseTools = (
  value: unknown,
): { readonly ok: true; readonly tools: readonly AssayedToolId[] } | { readonly ok: false } => {
  if (!Array.isArray(value)) return { ok: false };
  const tools: AssayedToolId[] = [];
  for (const item of value) {
    if (typeof item !== 'string' || item.trim() === '') return { ok: false };
    if (isForbiddenTool(item) || (FORBIDDEN_TOOL_IDS as readonly string[]).includes(item)) {
      return { ok: false };
    }
    tools.push(brandTool(item));
  }
  return { ok: true, tools };
};

const parseContextFilter = (value: unknown): boolean => {
  if (!isRecord(value)) return false;
  return (
    value.stripExactLocation === true &&
    value.stripSecrets === true &&
    value.stripUnrelatedMedia === true &&
    value.stripRawToolDumps === true &&
    value.preserveSourceStatus === true &&
    value.preserveCorrelationIds === true &&
    value.includeFullTranscript === false
  );
};

export const parseManifest = (input: unknown): ParseManifestResult => {
  if (!isRecord(input)) {
    return { ok: false, reasons: ['policy-schema'] };
  }
  if (input.forked !== false) {
    return { ok: false, reasons: ['forked-prohibited'] };
  }
  if (typeof input.id !== 'string' || !isSpecialistId(input.id)) {
    return { ok: false, reasons: ['unknown-specialist'] };
  }
  const id = input.id;
  const toolsParsed = parseTools(input.tools);
  if (!toolsParsed.ok) {
    const hasForbidden =
      Array.isArray(input.tools) &&
      input.tools.some((item) => typeof item === 'string' && isForbiddenTool(item));
    return { ok: false, reasons: [hasForbidden ? 'forbidden-tool' : 'policy-schema'] };
  }
  if (typeof input.purpose !== 'string' || input.purpose.trim() === '') {
    return { ok: false, reasons: ['policy-schema'] };
  }
  if (typeof input.sourceClass !== 'string' || !isSourceClass(input.sourceClass)) {
    return { ok: false, reasons: ['policy-schema'] };
  }
  const modes = parseModes(input.modes);
  const budget = parseBudget(input.budget);
  if (modes === undefined || budget === undefined || !parseContextFilter(input.contextFilter)) {
    return { ok: false, reasons: ['policy-schema'] };
  }
  if (!Array.isArray(input.forbiddenActions) || typeof input.yieldKind !== 'string') {
    return { ok: false, reasons: ['policy-schema'] };
  }
  const expectedForbidden = FORBIDDEN_BY_ID[id];
  const actions = input.forbiddenActions.filter((item): item is string => typeof item === 'string');
  if (!sameStrings(actions, expectedForbidden) || input.yieldKind !== YIELD_KIND_BY_ID[id]) {
    return { ok: false, reasons: ['policy-schema'] };
  }

  const specialist: LoadedSpecialist = {
    id,
    purpose: input.purpose,
    sourceClass: input.sourceClass,
    modes,
    tools: toolsParsed.tools,
    budget,
    contextFilter: CONTEXT_FILTER,
    forbiddenActions: expectedForbidden,
    yieldKind: YIELD_KIND_BY_ID[id],
    forked: false,
  };
  return { ok: true, specialist };
};

export type OmPolicy = {
  readonly memoryRecordClass: 'assistant-memory';
  readonly threadScopedOm: 'on';
  readonly resourceScopedOm: 'off';
  readonly observerReflector: 'QUARANTINED_UPSTREAM';
  readonly canonicalCorrectionRewritesText: false;
  readonly deleteIsTombstone: true;
};

export type DelegationPolicy = {
  readonly includeFullTranscript: false;
  readonly maxExcerptChars: number;
  readonly maxNestedDepth: number;
  readonly blockPrivilegeEscalation: true;
  readonly prohibitSelfReview: true;
  readonly prohibitToolSelfAdmission: true;
  readonly defaultExecution: 'policy-dry-run';
};

const parseOmPolicy = (input: unknown): OmPolicy => {
  if (!isRecord(input)) {
    throw new HierarchyLoadError(['policy-schema']);
  }
  if (input.resourceScopedOm !== 'off') {
    throw new HierarchyLoadError(['resource-scoped-om']);
  }
  if (input.memoryRecordClass !== 'assistant-memory') {
    throw new HierarchyLoadError(['om-record-class']);
  }
  if (input.threadScopedOm !== 'on' || input.observerReflector !== 'QUARANTINED_UPSTREAM') {
    throw new HierarchyLoadError(['policy-schema']);
  }
  return {
    memoryRecordClass: 'assistant-memory',
    threadScopedOm: 'on',
    resourceScopedOm: 'off',
    observerReflector: 'QUARANTINED_UPSTREAM',
    canonicalCorrectionRewritesText: false,
    deleteIsTombstone: true,
  };
};

const parseDelegationPolicy = (input: unknown): DelegationPolicy => {
  if (!isRecord(input)) {
    throw new HierarchyLoadError(['policy-schema']);
  }
  if (
    input.includeFullTranscript !== false ||
    input.blockPrivilegeEscalation !== true ||
    input.prohibitSelfReview !== true ||
    input.prohibitToolSelfAdmission !== true ||
    input.defaultExecution !== 'policy-dry-run' ||
    typeof input.maxExcerptChars !== 'number' ||
    typeof input.maxNestedDepth !== 'number'
  ) {
    throw new HierarchyLoadError(['policy-schema']);
  }
  return {
    includeFullTranscript: false,
    maxExcerptChars: input.maxExcerptChars,
    maxNestedDepth: input.maxNestedDepth,
    blockPrivilegeEscalation: true,
    prohibitSelfReview: true,
    prohibitToolSelfAdmission: true,
    defaultExecution: 'policy-dry-run',
  };
};

export const loadPolicies = (): {
  readonly om: OmPolicy;
  readonly delegation: DelegationPolicy;
  readonly specialistIds: readonly SpecialistId[];
} => {
  const om = parseOmPolicy(
    JSON.parse(readFileSync(path.join(policiesDir, 'observational-memory.json'), 'utf8')),
  );
  const delegation = parseDelegationPolicy(
    JSON.parse(readFileSync(path.join(policiesDir, 'delegation.json'), 'utf8')),
  );
  const registryRaw: unknown = JSON.parse(
    readFileSync(path.join(policiesDir, 'specialist-registry.json'), 'utf8'),
  );
  if (!isRecord(registryRaw) || registryRaw.forked !== false || !Array.isArray(registryRaw.specialists)) {
    throw new HierarchyLoadError(['policy-schema']);
  }
  const specialistIds = registryRaw.specialists.filter(
    (item): item is SpecialistId => typeof item === 'string' && isSpecialistId(item),
  );
  if (specialistIds.length !== SPECIALIST_IDS.length) {
    throw new HierarchyLoadError(['incomplete-registry']);
  }
  return { om, delegation, specialistIds };
};

export const loadRegistry = (): LoadedRegistry => {
  const files = readdirSync(manifestsDir).filter((name) => name.endsWith('.json'));
  const loaded = new Map<SpecialistId, LoadedSpecialist>();
  for (const file of files) {
    const parsed = parseManifest(JSON.parse(readFileSync(path.join(manifestsDir, file), 'utf8')));
    if (!parsed.ok) {
      throw new HierarchyLoadError(parsed.reasons, `${file}: ${parsed.reasons.join(',')}`);
    }
    loaded.set(parsed.specialist.id, parsed.specialist);
  }
  for (const id of SPECIALIST_IDS) {
    if (!loaded.has(id)) {
      throw new HierarchyLoadError(['missing-specialist', 'incomplete-registry'], id);
    }
  }
  const get = <Id extends SpecialistId>(id: Id): LoadedSpecialist<Id> => {
    const row = loaded.get(id);
    if (row === undefined || row.id !== id) {
      throw new HierarchyLoadError(['missing-specialist']);
    }
    return row as LoadedSpecialist<Id>;
  };
  return {
    'care-source': get('care-source'),
    'observation-extractor': get('observation-extractor'),
    'taxon-hypothesis': get('taxon-hypothesis'),
    'supply-transit': get('supply-transit'),
    'terrarium-diagnostician': get('terrarium-diagnostician'),
    'evidence-curator': get('evidence-curator'),
    'workflow-composer': get('workflow-composer'),
    'tool-assessor': get('tool-assessor'),
    'adversarial-reviewer': get('adversarial-reviewer'),
  };
};
