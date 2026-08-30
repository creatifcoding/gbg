import { asThreadId, emptyWorkingMemory, type OmRecordId, type ThreadId } from './types.ts';
import { redactSensitive } from './redact.ts';

export type OmRecordClass = 'assistant-memory';

export type OmKind =
  | 'conversation-observation'
  | 'conversation-reflection'
  | 'canonical-correction'
  | 'working-memory';

export type OmLifecycle = 'active' | 'superseded' | 'deleted';

export type CanonicalRef = {
  readonly kind: 'CareEvent' | 'Observation' | 'Interpretation' | 'CareAdvice';
  readonly id: string;
};

export type WorkingMemory = {
  readonly preferences: readonly string[];
  readonly activeGoal: string | null;
  readonly unresolvedQuestions: readonly string[];
};

export type OmRecord = {
  readonly recordClass: OmRecordClass;
  readonly recordId: OmRecordId;
  readonly threadId: ThreadId;
  readonly kind: OmKind;
  readonly state: OmLifecycle;
  readonly text: string;
  readonly createdAt: string;
  readonly supersedes?: readonly OmRecordId[];
  readonly canonicalRef?: CanonicalRef;
};

export type RememberInput = {
  readonly threadId: ThreadId | string;
  readonly kind: OmKind;
  readonly text: string;
  readonly supersedes?: readonly (OmRecordId | string)[];
  readonly canonicalRef?: CanonicalRef;
  readonly working?: WorkingMemory;
};

export type RememberRefusalReason =
  | 'om-record-class'
  | 'resource-scoped-om'
  | 'blank-text'
  | 'unknown-thread'
  | 'canonical-rewrite'
  | 'working-memory-shape';

export type RememberResult =
  | { readonly ok: true; readonly record: OmRecord; readonly working: WorkingMemory }
  | { readonly ok: false; readonly reasons: readonly RememberRefusalReason[] };

export type RecallQuery = {
  readonly threadId: ThreadId | string;
  readonly preferCanonical: boolean;
};

export type RecallView = {
  readonly threadId: ThreadId;
  readonly records: readonly OmRecord[];
  readonly working: WorkingMemory;
};

export type ForgetInput = {
  readonly threadId: ThreadId | string;
  readonly recordId: OmRecordId | string;
};

export type ForgetReceipt = {
  readonly recordId: OmRecordId;
  readonly state: 'deleted';
};

export type ExportedOmRow =
  | { readonly recordId: OmRecordId; readonly state: 'deleted' }
  | OmRecord;

const OM_KINDS: readonly OmKind[] = [
  'conversation-observation',
  'conversation-reflection',
  'canonical-correction',
  'working-memory',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isOmKind = (value: string): value is OmKind =>
  (OM_KINDS as readonly string[]).includes(value);

const brandOmId = (value: string): OmRecordId => value as OmRecordId;

export class OmLedger {
  readonly #rows = new Map<string, OmRecord[]>();
  readonly #working = new Map<string, WorkingMemory>();
  readonly #seq = { n: 0 };
  readonly now: () => string;

  constructor(now: () => string) {
    this.now = now;
  }

  remember(input: unknown): RememberResult {
    if (!isRecord(input)) {
      return { ok: false, reasons: ['working-memory-shape'] };
    }
    if ('recordClass' in input && input.recordClass !== 'assistant-memory') {
      return { ok: false, reasons: ['om-record-class'] };
    }
    if (input.resourceScoped === true || input.resourceScopedOm === true) {
      return { ok: false, reasons: ['resource-scoped-om'] };
    }
    if (input.rewrite === true || typeof input.rewriteText === 'string') {
      return { ok: false, reasons: ['canonical-rewrite'] };
    }
    if (typeof input.threadId !== 'string' || typeof input.kind !== 'string' || !isOmKind(input.kind)) {
      return { ok: false, reasons: ['unknown-thread'] };
    }
    if (typeof input.text !== 'string' || input.text.trim() === '') {
      return { ok: false, reasons: ['blank-text'] };
    }
    let threadId: ThreadId;
    try {
      threadId = asThreadId(input.threadId);
    } catch {
      return { ok: false, reasons: ['unknown-thread'] };
    }
    if (input.kind === 'working-memory' && input.working !== undefined && !isWorking(input.working)) {
      return { ok: false, reasons: ['working-memory-shape'] };
    }

    this.#seq.n += 1;
    const recordId = brandOmId(`om.${String(this.#seq.n).padStart(4, '0')}`);
    const supersedes = Array.isArray(input.supersedes)
      ? input.supersedes.filter((item): item is string => typeof item === 'string').map(brandOmId)
      : undefined;
    const canonicalRef = isCanonicalRef(input.canonicalRef) ? input.canonicalRef : undefined;
    const record: OmRecord = {
      recordClass: 'assistant-memory',
      recordId,
      threadId,
      kind: input.kind,
      state: 'active',
      text: redactSensitive(input.text),
      createdAt: this.now(),
      ...(supersedes === undefined || supersedes.length === 0 ? {} : { supersedes }),
      ...(canonicalRef === undefined ? {} : { canonicalRef }),
    };

    const rows = this.#rows.get(threadId) ?? [];
    if (supersedes !== undefined) {
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (row !== undefined && supersedes.includes(row.recordId) && row.state === 'active') {
          rows[i] = { ...row, state: 'superseded' };
        }
      }
    }
    rows.push(record);
    this.#rows.set(threadId, rows);

    if (input.kind === 'working-memory' && isWorking(input.working)) {
      this.#working.set(threadId, input.working);
    } else if (!this.#working.has(threadId)) {
      this.#working.set(threadId, emptyWorkingMemory());
    }

    return {
      ok: true,
      record,
      working: this.#working.get(threadId) ?? emptyWorkingMemory(),
    };
  }

  recall(query: RecallQuery): RecallView {
    const threadId = asThreadId(query.threadId);
    const rows = this.#rows.get(threadId) ?? [];
    const visible = rows.filter((row) => row.state !== 'deleted');
    const ordered = query.preferCanonical
      ? [...visible].sort((a, b) => Number(b.kind === 'canonical-correction') - Number(a.kind === 'canonical-correction'))
      : visible;
    return {
      threadId,
      records: ordered,
      working: this.#working.get(threadId) ?? emptyWorkingMemory(),
    };
  }

  forget(input: ForgetInput): ForgetReceipt {
    const threadId = asThreadId(input.threadId);
    const recordId = brandOmId(String(input.recordId));
    const rows = this.#rows.get(threadId) ?? [];
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      if (row !== undefined && row.recordId === recordId) {
        rows[i] = { ...row, state: 'deleted', text: '' };
      }
    }
    this.#rows.set(threadId, rows);
    return { recordId, state: 'deleted' };
  }

  exportThread(threadIdRaw: ThreadId | string): {
    readonly threadId: ThreadId;
    readonly working: WorkingMemory;
    readonly records: readonly ExportedOmRow[];
  } {
    const threadId = asThreadId(threadIdRaw);
    const rows = this.#rows.get(threadId) ?? [];
    const records: ExportedOmRow[] = rows.map((row) =>
      row.state === 'deleted' ? { recordId: row.recordId, state: 'deleted' as const } : row,
    );
    return {
      threadId,
      working: this.#working.get(threadId) ?? emptyWorkingMemory(),
      records,
    };
  }
}

const isWorking = (value: unknown): value is WorkingMemory => {
  if (!isRecord(value)) return false;
  return (
    Array.isArray(value.preferences) &&
    (value.activeGoal === null || typeof value.activeGoal === 'string') &&
    Array.isArray(value.unresolvedQuestions)
  );
};

const isCanonicalRef = (value: unknown): value is CanonicalRef => {
  if (!isRecord(value)) return false;
  return (
    (value.kind === 'CareEvent' ||
      value.kind === 'Observation' ||
      value.kind === 'Interpretation' ||
      value.kind === 'CareAdvice') &&
    typeof value.id === 'string'
  );
};
