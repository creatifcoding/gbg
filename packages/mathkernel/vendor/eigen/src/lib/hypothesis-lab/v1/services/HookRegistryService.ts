import { Effect, Schema } from 'effect';
import {
  EvidenceRecord,
  Hypothesis,
  type EvidenceRecord as EvidenceRecordType,
} from '../schemas';
import { HookResolutionError } from '../errors';

export interface HookDefinition {
  readonly key: string;
  readonly version: string;
  readonly resolvedTo: string;
  readonly inputSchema: Schema.Schema.AnyNoContext;
  readonly outputSchema: Schema.Schema.AnyNoContext;
  readonly run: (input: unknown) => Effect.Effect<unknown, unknown>;
}

const StatementLengthInput = Schema.Struct({
  runId: Schema.String,
  hypotheses: Schema.Array(Hypothesis),
});

type StatementLengthInput = typeof StatementLengthInput.Type;

const StatementLengthOutput = Schema.Struct({
  evidence: Schema.Array(EvidenceRecord),
});

const buildStatementLengthEvidence = (
  input: StatementLengthInput
): ReadonlyArray<EvidenceRecordType> => {
  const a = input.hypotheses.find((hypothesis) => hypothesis.label === 'A');
  const b = input.hypotheses.find((hypothesis) => hypothesis.label === 'B');

  if (!a || !b) {
    return [];
  }

  const lengthA = a.statement.length;
  const lengthB = b.statement.length;
  const delta = Math.abs(lengthA - lengthB);

  const confidence = delta === 0 ? 0.5 : Math.min(0.95, 0.5 + delta / 400);

  return [
    EvidenceRecord.make({
      id: `ev-${crypto.randomUUID()}`,
      runId: input.runId,
      source: 'tools.validate.statement-length',
      summary: `Statement lengths A=${lengthA}, B=${lengthB}, delta=${delta}`,
      confidence,
      metadata: {
        lengthA,
        lengthB,
        delta,
      },
      createdAt: Date.now(),
    }),
  ];
};

const statementLengthHook: HookDefinition = {
  key: 'tools.validate.statement-length',
  version: '1.0.0',
  resolvedTo: '@tmnl/hypothesis-lab/hooks/statement-length',
  inputSchema: StatementLengthInput,
  outputSchema: StatementLengthOutput,
  run: (input) =>
    Effect.gen(function* () {
      const decoded = yield* Schema.decodeUnknown(StatementLengthInput)(input);
      return {
        evidence: buildStatementLengthEvidence(decoded),
      };
    }).pipe(Effect.withSpan('HypothesisLab.Hook.statement-length')),
};

export class HookRegistryService extends Effect.Service<HookRegistryService>()(
  'tmnl/hypothesis-lab/HookRegistryService',
  {
    sync: () => {
      const hooks = new Map<string, HookDefinition>([
        [statementLengthHook.key, statementLengthHook],
      ]);

      const resolve = (hookKey: string) =>
        Effect.sync(() => hooks.get(hookKey)).pipe(
          Effect.flatMap((hook) =>
            hook
              ? Effect.succeed(hook)
              : Effect.fail(
                  new HookResolutionError({
                    hookKey,
                    message: `Hook not found: ${hookKey}`,
                  })
                )
          ),
          Effect.withSpan('HypothesisLab.HookRegistry.resolve')
        );

      const register = (hook: HookDefinition) =>
        Effect.sync(() => {
          hooks.set(hook.key, hook);
        });

      const list = () => Effect.sync(() => Array.from(hooks.values()));

      return {
        resolve,
        register,
        list,
      } as const;
    },
  }
) {}
