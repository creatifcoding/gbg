import { createHash } from 'node:crypto';

import { redactSensitive } from './redact.ts';
import {
  asCareSubjectId,
  asThreadId,
  isForbiddenTool,
  isHostMode,
  isSpecialistId,
  type AttemptId,
  type CareSubjectId,
  type HostMode,
  type LoadedRegistry,
  type LoadedSpecialist,
  type RequestDigest,
  type SpecialistId,
  type ThreadId,
} from './types.ts';
import type { DelegationPolicy } from './specialist.ts';

export type { AttemptId, RequestDigest };

export type DelegationRequest = {
  readonly specialist: SpecialistId;
  readonly mode: HostMode;
  readonly threadId: ThreadId;
  readonly careSubjectId: CareSubjectId;
  readonly goal: string;
  readonly transcriptExcerpt: string;
  readonly correlationIds?: readonly string[];
  readonly sourceStatus?: string;
  readonly mediaDigests?: readonly string[];
};

export type TaskPacket = {
  readonly specialist: SpecialistId;
  readonly goal: string;
  readonly allowedTools: LoadedSpecialist['tools'];
  readonly budget: LoadedSpecialist['budget'];
  readonly mode: HostMode;
  readonly careSubjectId: CareSubjectId;
  readonly threadId: ThreadId;
  readonly context: {
    readonly notes: string;
    readonly sourceStatus?: string;
    readonly correlationIds: readonly string[];
    readonly mediaDigests: readonly string[];
  };
};

export type RejectionReason =
  | 'unknown-specialist'
  | 'forked-prohibited'
  | 'specialist-unavailable-in-mode'
  | 'over-budget'
  | 'undeclared-tool'
  | 'forbidden-tool'
  | 'privilege-escalation'
  | 'self-review'
  | 'specimen-mint'
  | 'confirmed-taxon'
  | 'fake-locality'
  | 'resource-scoped-om'
  | 'nested-depth';

export type PolicyDryRunYield = {
  readonly kind: 'policy-dry-run';
  readonly packet: TaskPacket;
  readonly wouldCall: LoadedSpecialist['tools'];
};

type AttemptBase = {
  readonly attemptId: AttemptId;
  readonly digest: RequestDigest;
  readonly specialist: SpecialistId;
  readonly mode: HostMode;
  readonly threadId: ThreadId;
  readonly packet: TaskPacket;
};

export type RejectedAttempt = {
  readonly state: 'rejected';
  readonly attemptId: AttemptId;
  readonly digest: RequestDigest;
  readonly specialist: SpecialistId | string;
  readonly mode: HostMode | string;
  readonly threadId: string;
  readonly reasons: readonly [RejectionReason, ...RejectionReason[]];
};

export type CompletedAttempt = AttemptBase & {
  readonly state: 'completed';
  readonly yield: PolicyDryRunYield;
};

export type DelegationAttempt = RejectedAttempt | CompletedAttempt;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export type ParseRequestResult =
  | { readonly ok: true; readonly request: DelegationRequest }
  | { readonly ok: false; readonly reasons: readonly [RejectionReason, ...RejectionReason[]] };

const reasonsOf = (
  ...reasons: readonly [RejectionReason, ...RejectionReason[]]
): readonly [RejectionReason, ...RejectionReason[]] => reasons;

export const parseDelegationRequest = (input: unknown): ParseRequestResult => {
  if (!isRecord(input)) {
    return { ok: false, reasons: reasonsOf('unknown-specialist') };
  }
  const reasons: RejectionReason[] = [];
  if (input.forked === true) reasons.push('forked-prohibited');
  if ('targetMode' in input || 'elevateMode' in input || 'nextMode' in input) {
    reasons.push('privilege-escalation');
  }
  if (input.confirmed === true || input.taxonConfirmed === true) {
    reasons.push('confirmed-taxon');
  }
  if (typeof input.specimenId === 'string' || input.catalogSpecimen === true) {
    reasons.push('specimen-mint');
  }
  if (typeof input.locality === 'string' || typeof input.gps === 'string') {
    reasons.push('fake-locality');
  }
  if (input.resourceScopedOm === true || input.resourceScoped === true) {
    reasons.push('resource-scoped-om');
  }
  if (typeof input.depth === 'number' && input.depth > 1) {
    reasons.push('nested-depth');
  }
  if (Array.isArray(input.tools)) {
    for (const tool of input.tools) {
      if (typeof tool === 'string' && isForbiddenTool(tool)) reasons.push('forbidden-tool');
    }
  }
  if (typeof input.specialist !== 'string' || !isSpecialistId(input.specialist)) {
    reasons.push('unknown-specialist');
  }
  if (typeof input.mode !== 'string' || !isHostMode(input.mode)) {
    reasons.push('privilege-escalation');
  }
  if (reasons.length > 0) {
    const [first, ...rest] = reasons;
    if (first === undefined) {
      return { ok: false, reasons: reasonsOf('unknown-specialist') };
    }
    return { ok: false, reasons: [first, ...rest] };
  }
  if (
    typeof input.specialist !== 'string' ||
    !isSpecialistId(input.specialist) ||
    typeof input.mode !== 'string' ||
    !isHostMode(input.mode) ||
    typeof input.threadId !== 'string' ||
    typeof input.careSubjectId !== 'string' ||
    typeof input.goal !== 'string' ||
    typeof input.transcriptExcerpt !== 'string'
  ) {
    return { ok: false, reasons: reasonsOf('unknown-specialist') };
  }
  try {
    const correlationIds = Array.isArray(input.correlationIds)
      ? input.correlationIds.filter((item): item is string => typeof item === 'string')
      : undefined;
    const mediaDigests = Array.isArray(input.mediaDigests)
      ? input.mediaDigests.filter((item): item is string => typeof item === 'string')
      : undefined;
    const request: DelegationRequest = {
      specialist: input.specialist,
      mode: input.mode,
      threadId: asThreadId(input.threadId),
      careSubjectId: asCareSubjectId(input.careSubjectId),
      goal: input.goal,
      transcriptExcerpt: input.transcriptExcerpt,
      ...(typeof input.sourceStatus === 'string' ? { sourceStatus: input.sourceStatus } : {}),
      ...(correlationIds === undefined ? {} : { correlationIds }),
      ...(mediaDigests === undefined ? {} : { mediaDigests }),
    };
    return { ok: true, request };
  } catch {
    return { ok: false, reasons: reasonsOf('unknown-specialist') };
  }
};

const selfReview = (input: Record<string, unknown>, specialist: SpecialistId): boolean => {
  if (input.reviewOf === specialist || input.selfReview === true) return true;
  if (specialist === 'tool-assessor' && (input.admit === true || input.admission === true)) {
    return true;
  }
  if (specialist === 'evidence-curator' && (input.accept === true || input.accepted === true)) {
    return true;
  }
  if (specialist === 'adversarial-reviewer' && (input.edit === true || input.edits === true)) {
    return true;
  }
  return false;
};

export type AuthorizeResult =
  | {
      readonly kind: 'ok';
      readonly request: DelegationRequest;
      readonly specialist: LoadedSpecialist;
    }
  | { readonly kind: 'rejected'; readonly attempt: RejectedAttempt };

export const authorize = (args: {
  readonly input: unknown;
  readonly registry: LoadedRegistry;
}): AuthorizeResult => {
  const parsed = parseDelegationRequest(args.input);
  const digest = digestOf(args.input);
  const attemptId = attemptIdOf(digest);
  if (!parsed.ok) {
    const specialist =
      isRecord(args.input) && typeof args.input.specialist === 'string'
        ? args.input.specialist
        : 'unknown';
    const mode =
      isRecord(args.input) && typeof args.input.mode === 'string' ? args.input.mode : 'unknown';
    const threadId =
      isRecord(args.input) && typeof args.input.threadId === 'string' ? args.input.threadId : '';
    return {
      kind: 'rejected',
      attempt: {
        state: 'rejected',
        attemptId,
        digest,
        specialist,
        mode,
        threadId,
        reasons: parsed.reasons,
      },
    };
  }
  const request = parsed.request;
  const extra: RejectionReason[] = [];
  if (isRecord(args.input) && selfReview(args.input, request.specialist)) {
    extra.push('self-review');
  }
  const specialist = args.registry[request.specialist];
  if (!specialist.modes.includes(request.mode)) {
    extra.push('specialist-unavailable-in-mode');
  }
  if (isRecord(args.input) && Array.isArray(args.input.tools)) {
    for (const tool of args.input.tools) {
      if (typeof tool !== 'string') continue;
      if (isForbiddenTool(tool)) extra.push('forbidden-tool');
      else if (!(specialist.tools as readonly string[]).includes(tool)) {
        extra.push('undeclared-tool');
      }
    }
  }
  if (
    isRecord(args.input) &&
    typeof args.input.maxSteps === 'number' &&
    args.input.maxSteps > specialist.budget.maxSteps
  ) {
    extra.push('over-budget');
  }
  if (extra.length > 0) {
    const [first, ...rest] = extra;
    if (first === undefined) {
      throw new Error('rejection list empty');
    }
    return {
      kind: 'rejected',
      attempt: {
        state: 'rejected',
        attemptId,
        digest,
        specialist: request.specialist,
        mode: request.mode,
        threadId: request.threadId,
        reasons: [first, ...rest],
      },
    };
  }
  return { kind: 'ok', request, specialist };
};

export const buildPacket = (args: {
  readonly request: DelegationRequest;
  readonly specialist: LoadedSpecialist;
  readonly policy: DelegationPolicy;
}): TaskPacket => {
  const stripped = redactSensitive(args.request.transcriptExcerpt);
  const notes = stripped.slice(0, args.policy.maxExcerptChars);
  return {
    specialist: args.request.specialist,
    goal: args.request.goal,
    allowedTools: args.specialist.tools,
    budget: args.specialist.budget,
    mode: args.request.mode,
    careSubjectId: args.request.careSubjectId,
    threadId: args.request.threadId,
    context: {
      notes,
      correlationIds: args.request.correlationIds ?? [],
      mediaDigests: args.request.mediaDigests ?? [],
      ...(args.request.sourceStatus === undefined
        ? {}
        : { sourceStatus: args.request.sourceStatus }),
    },
  };
};

export const dryRun = (packet: TaskPacket): PolicyDryRunYield => ({
  kind: 'policy-dry-run',
  packet,
  wouldCall: packet.allowedTools,
});

export const digestOf = (input: unknown): RequestDigest => {
  const body = JSON.stringify(input);
  return createHash('sha256').update(body).digest('hex') as RequestDigest;
};

export const attemptIdOf = (digest: RequestDigest): AttemptId =>
  `att.${digest.slice(0, 24)}` as AttemptId;
