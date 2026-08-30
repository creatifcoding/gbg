import { loadA0Json, loadPinSnapshot } from './a0-pin.ts';
import {
  attemptIdOf,
  authorize,
  buildPacket,
  digestOf,
  dryRun,
  type DelegationAttempt,
  type TaskPacket,
} from './delegation.ts';
import { OmLedger, type ForgetInput, type RecallQuery, type RememberResult } from './memory.ts';
import { loadPolicies, loadRegistry } from './specialist.ts';
import {
  defaultCapabilities,
  type Capability,
  type Clock,
  type LoadedRegistry,
  SPECIALIST_IDS,
  type AttemptId,
  type ThreadId,
} from './types.ts';

export type OpenHierarchyOptions = {
  readonly clock?: Clock;
  readonly assistantRoot?: string;
};

export type ExportBundle = {
  readonly threadId: ThreadId;
  readonly exportedAt: string;
  readonly working: ReturnType<OmLedger['exportThread']>['working'];
  readonly records: ReturnType<OmLedger['exportThread']>['records'];
  readonly attempts: readonly DelegationAttempt[];
};

export type Hierarchy = {
  readonly registry: LoadedRegistry;
  readonly capabilities: readonly Capability[];
  readonly delegate: (input: unknown) => DelegationAttempt;
  readonly cancel: (attemptId: AttemptId | string) => DelegationAttempt;
  readonly remember: (input: unknown) => RememberResult;
  readonly recall: (query: RecallQuery) => ReturnType<OmLedger['recall']>;
  readonly forget: (input: ForgetInput) => ReturnType<OmLedger['forget']>;
  readonly exportThread: (threadId: ThreadId | string) => ExportBundle;
};

const assertSpecialistSnapshot = (assistantRoot?: string): void => {
  const constraints = loadA0Json<{ readonly specialists: readonly string[] }>(
    'policies/subagent-constraints.json',
    assistantRoot,
  );
  if (constraints.specialists.length !== SPECIALIST_IDS.length) {
    throw new Error('A0 specialist snapshot length mismatch');
  }
  for (const id of SPECIALIST_IDS) {
    if (!constraints.specialists.includes(id)) {
      throw new Error(`A0 specialist snapshot missing ${id}`);
    }
  }
};

export const openHierarchy = (options?: OpenHierarchyOptions): Hierarchy => {
  assertSpecialistSnapshot(options?.assistantRoot);
  const pin = loadPinSnapshot();
  if (pin.omLiveObserverReflector !== 'QUARANTINED_UPSTREAM') {
    throw new Error('observer/reflector pin must stay quarantined');
  }
  const policies = loadPolicies();
  const registry = loadRegistry();
  const now = options?.clock?.now ?? (() => new Date().toISOString());
  const ledger = new OmLedger(now);
  const attempts = new Map<string, DelegationAttempt>();
  const byDigest = new Map<string, DelegationAttempt>();

  const complete = (packet: TaskPacket, digest: ReturnType<typeof digestOf>): DelegationAttempt => {
    const attemptId = attemptIdOf(digest);
    const completed = {
      state: 'completed' as const,
      attemptId,
      digest,
      specialist: packet.specialist,
      mode: packet.mode,
      threadId: packet.threadId,
      packet,
      yield: dryRun(packet),
    };
    attempts.set(attemptId, completed);
    byDigest.set(digest, completed);
    return completed;
  };

  const delegate = (input: unknown): DelegationAttempt => {
    const digest = digestOf(input);
    const prior = byDigest.get(digest);
    if (prior !== undefined) return prior;
    const authorized = authorize({ input, registry });
    if (authorized.kind === 'rejected') {
      attempts.set(authorized.attempt.attemptId, authorized.attempt);
      byDigest.set(digest, authorized.attempt);
      return authorized.attempt;
    }
    const packet = buildPacket({
      request: authorized.request,
      specialist: authorized.specialist,
      policy: policies.delegation,
    });
    return complete(packet, digest);
  };

  const cancel = (attemptId: AttemptId | string): DelegationAttempt => {
    const existing = attempts.get(String(attemptId));
    if (existing === undefined) {
      return {
        state: 'rejected',
        attemptId: attemptIdOf(digestOf({ cancel: attemptId })),
        digest: digestOf({ cancel: attemptId }),
        specialist: 'unknown',
        mode: 'unknown',
        threadId: '',
        reasons: ['unknown-specialist'],
      };
    }
    return existing;
  };

  return {
    registry,
    capabilities: defaultCapabilities(),
    delegate,
    cancel,
    remember: (input) => ledger.remember(input),
    recall: (query) => ledger.recall(query),
    forget: (input) => ledger.forget(input),
    exportThread: (threadId) => {
      const exported = ledger.exportThread(threadId);
      return {
        ...exported,
        exportedAt: now(),
        attempts: [...attempts.values()].filter((attempt) => attempt.threadId === exported.threadId),
      };
    },
  };
};
