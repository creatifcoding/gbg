import { Atom } from '@effect-atom/atom';
import type {
  AuditEvent,
  DecisionMatrix,
  EvidenceRecord,
  HookPlanCompiled,
  Hypothesis,
  HypothesisRun,
  ReplayReport,
  RunStatus,
  Verdict,
} from '../schemas';

export const runAtom = Atom.make<HypothesisRun | null>(null) as Atom.Writable<
  HypothesisRun | null,
  HypothesisRun | null
>;
export const hypothesesAtom = Atom.make<ReadonlyArray<Hypothesis>>([]) as Atom.Writable<
  ReadonlyArray<Hypothesis>,
  ReadonlyArray<Hypothesis>
>;
export const compiledPlanAtom = Atom.make<HookPlanCompiled | null>(null) as Atom.Writable<
  HookPlanCompiled | null,
  HookPlanCompiled | null
>;
export const evidenceAtom = Atom.make<ReadonlyArray<EvidenceRecord>>([]) as Atom.Writable<
  ReadonlyArray<EvidenceRecord>,
  ReadonlyArray<EvidenceRecord>
>;
export const matrixAtom = Atom.make<DecisionMatrix | null>(null) as Atom.Writable<
  DecisionMatrix | null,
  DecisionMatrix | null
>;
export const verdictAtom = Atom.make<Verdict | null>(null) as Atom.Writable<
  Verdict | null,
  Verdict | null
>;
export const replayReportAtom = Atom.make<ReplayReport | null>(null) as Atom.Writable<
  ReplayReport | null,
  ReplayReport | null
>;
export const auditEventsAtom = Atom.make<ReadonlyArray<AuditEvent>>([]) as Atom.Writable<
  ReadonlyArray<AuditEvent>,
  ReadonlyArray<AuditEvent>
>;
export const statusAtom = Atom.make<RunStatus>('idle') as Atom.Writable<RunStatus, RunStatus>;
export const errorMessageAtom = Atom.make<string | null>(null) as Atom.Writable<
  string | null,
  string | null
>;

export const isRatifiedAtom = Atom.make((get) => get(verdictAtom)?.ratified ?? false);

export const strictReplayPassedAtom = Atom.make((get) => {
  const report = get(replayReportAtom);
  if (!report) {
    return false;
  }
  return report.status !== 'failed' && report.strictDriftCount === 0;
});

export const winnerAtom = Atom.make((get) => get(verdictAtom)?.winner ?? 'Tie');
