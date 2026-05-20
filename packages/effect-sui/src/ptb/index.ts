/** Programmable transaction block AST, analyzer, and Mysten compiler surfaces. */

import { Transaction } from '@mysten/sui/transactions';
import * as Effect from 'effect-v4/Effect';
import type * as Exit from 'effect-v4/Exit';
import * as Layer from 'effect-v4/Layer';
import * as ManagedRuntime from 'effect-v4/ManagedRuntime';
import * as Schema from 'effect-v4/Schema';

import { SuiPTB, type SuiPtbBuildArtifact } from '../effectable';
import {
  SharedObjectRef,
  SuiInvariantViolation,
  SuiObjectId,
  SuiObjectRef,
  SuiTypeTagString,
} from '../schema';
import {
  SuiPtbAnalyzer,
  type SuiPtbAnalysis,
  type SuiPtbAnalyzerShape,
  SuiPtbCompiler,
  type SuiPtbCompilerShape,
} from '../services';

export type MystenTransaction = Transaction;

// ─── Arguments ───────────────────────────────────────────────────────────────

export const SuiPtbInputKind = Schema.Literals(['pure', 'object', 'withdrawal'] as const);
export type SuiPtbInputKind = typeof SuiPtbInputKind.Type;

const nonNegativeInt = Schema.makeFilter<number>((value) => value >= 0, {
  expected: 'a non-negative integer',
});

export class SuiPtbGasCoin extends Schema.TaggedClass<SuiPtbGasCoin>()('GasCoin', {}) {}

export class SuiPtbInputArgument extends Schema.TaggedClass<SuiPtbInputArgument>()('Input', {
  index: Schema.Int.check(nonNegativeInt),
  inputKind: Schema.optional(SuiPtbInputKind),
}) {}

export class SuiPtbResultArgument extends Schema.TaggedClass<SuiPtbResultArgument>()('Result', {
  index: Schema.Int.check(nonNegativeInt),
}) {}

export class SuiPtbNestedResultArgument extends Schema.TaggedClass<SuiPtbNestedResultArgument>()(
  'NestedResult',
  {
    index: Schema.Int.check(nonNegativeInt),
    nestedIndex: Schema.Int.check(nonNegativeInt),
  },
) {}

export const SuiPtbArgument = Schema.Union([
  SuiPtbGasCoin,
  SuiPtbInputArgument,
  SuiPtbResultArgument,
  SuiPtbNestedResultArgument,
]);
export type SuiPtbArgument = typeof SuiPtbArgument.Type;

// ─── Inputs ──────────────────────────────────────────────────────────────────

export class SuiPtbPureInput extends Schema.TaggedClass<SuiPtbPureInput>()('PureInput', {
  name: Schema.optional(Schema.String),
  typeTag: SuiTypeTagString,
  value: Schema.Unknown,
  bytes: Schema.optional(Schema.Uint8Array),
}) {}

export class SuiPtbObjectInput extends Schema.TaggedClass<SuiPtbObjectInput>()('ObjectInput', {
  name: Schema.optional(Schema.String),
  objectId: SuiObjectId,
}) {}

export class SuiPtbObjectRefInput extends Schema.TaggedClass<SuiPtbObjectRefInput>()(
  'ObjectRefInput',
  {
    name: Schema.optional(Schema.String),
    ref: SuiObjectRef,
  },
) {}

export class SuiPtbSharedObjectInput extends Schema.TaggedClass<SuiPtbSharedObjectInput>()(
  'SharedObjectInput',
  {
    name: Schema.optional(Schema.String),
    ref: SharedObjectRef,
  },
) {}

export class SuiPtbReceivingObjectInput extends Schema.TaggedClass<SuiPtbReceivingObjectInput>()(
  'ReceivingObjectInput',
  {
    name: Schema.optional(Schema.String),
    ref: SuiObjectRef,
  },
) {}

export const SuiPtbInputAst = Schema.Union([
  SuiPtbPureInput,
  SuiPtbObjectInput,
  SuiPtbObjectRefInput,
  SuiPtbSharedObjectInput,
  SuiPtbReceivingObjectInput,
]);
export type SuiPtbInputAst = typeof SuiPtbInputAst.Type;

// ─── Commands ────────────────────────────────────────────────────────────────

export class SuiPtbSplitCoins extends Schema.TaggedClass<SuiPtbSplitCoins>()('SplitCoins', {
  name: Schema.optional(Schema.String),
  coin: SuiPtbArgument,
  amounts: Schema.Array(SuiPtbArgument),
}) {}

export class SuiPtbMergeCoins extends Schema.TaggedClass<SuiPtbMergeCoins>()('MergeCoins', {
  name: Schema.optional(Schema.String),
  destination: SuiPtbArgument,
  sources: Schema.Array(SuiPtbArgument),
}) {}

export class SuiPtbTransferObjects extends Schema.TaggedClass<SuiPtbTransferObjects>()(
  'TransferObjects',
  {
    name: Schema.optional(Schema.String),
    objects: Schema.Array(SuiPtbArgument),
    address: SuiPtbArgument,
  },
) {}

export class SuiPtbMoveCall extends Schema.TaggedClass<SuiPtbMoveCall>()('MoveCall', {
  name: Schema.optional(Schema.String),
  packageId: SuiObjectId,
  module: Schema.String,
  functionName: Schema.String,
  typeArguments: Schema.optional(Schema.Array(SuiTypeTagString)),
  arguments: Schema.Array(SuiPtbArgument),
}) {}

export class SuiPtbMakeMoveVec extends Schema.TaggedClass<SuiPtbMakeMoveVec>()('MakeMoveVec', {
  name: Schema.optional(Schema.String),
  type: Schema.optional(SuiTypeTagString),
  elements: Schema.Array(SuiPtbArgument),
}) {}

export class SuiPtbPublish extends Schema.TaggedClass<SuiPtbPublish>()('Publish', {
  name: Schema.optional(Schema.String),
  modules: Schema.Array(Schema.Uint8Array),
  dependencies: Schema.Array(SuiObjectId),
}) {}

export class SuiPtbUpgrade extends Schema.TaggedClass<SuiPtbUpgrade>()('Upgrade', {
  name: Schema.optional(Schema.String),
  modules: Schema.Array(Schema.Uint8Array),
  dependencies: Schema.Array(SuiObjectId),
  packageId: SuiObjectId,
  ticket: SuiPtbArgument,
}) {}

export const SuiPtbCommandAst = Schema.Union([
  SuiPtbSplitCoins,
  SuiPtbMergeCoins,
  SuiPtbTransferObjects,
  SuiPtbMoveCall,
  SuiPtbMakeMoveVec,
  SuiPtbPublish,
  SuiPtbUpgrade,
]);
export type SuiPtbCommandAst = typeof SuiPtbCommandAst.Type;

export class SuiPtbAst extends Schema.Class<SuiPtbAst>('SuiPtbAst')({
  label: Schema.String,
  inputs: Schema.Array(SuiPtbInputAst),
  commands: Schema.Array(SuiPtbCommandAst),
}) {}

// ─── Constructors ────────────────────────────────────────────────────────────

export const gas = (): SuiPtbGasCoin => new SuiPtbGasCoin({});
export const input = (index: number, inputKind?: SuiPtbInputKind): SuiPtbInputArgument =>
  new SuiPtbInputArgument({ index, inputKind });
export const result = (index: number): SuiPtbResultArgument => new SuiPtbResultArgument({ index });
export const nestedResult = (index: number, nestedIndex: number): SuiPtbNestedResultArgument =>
  new SuiPtbNestedResultArgument({ index, nestedIndex });

export const pure = (options: {
  readonly name?: string;
  readonly typeTag: SuiTypeTagString;
  readonly value: unknown;
  readonly bytes?: Uint8Array;
}): SuiPtbPureInput => new SuiPtbPureInput(options);

export const object = (objectId: SuiObjectId, name?: string): SuiPtbObjectInput =>
  new SuiPtbObjectInput({ objectId, name });
export const objectRef = (ref: SuiObjectRef, name?: string): SuiPtbObjectRefInput =>
  new SuiPtbObjectRefInput({ ref, name });
export const sharedObject = (ref: SharedObjectRef, name?: string): SuiPtbSharedObjectInput =>
  new SuiPtbSharedObjectInput({ ref, name });
export const receivingObject = (ref: SuiObjectRef, name?: string): SuiPtbReceivingObjectInput =>
  new SuiPtbReceivingObjectInput({ ref, name });

// ─── Analyzer ────────────────────────────────────────────────────────────────

export const makeAnalyzer = (): SuiPtbAnalyzerShape => ({
  analyze: (ptb) => analyzePtb(ptb.label, ptb.inputs, ptb.commands),
});

export const SuiPtbAnalyzerLive = Layer.succeed(SuiPtbAnalyzer)(makeAnalyzer());

export function analyzePtb(
  label: string,
  inputs: ReadonlyArray<unknown>,
  commands: ReadonlyArray<unknown>,
): Effect.Effect<SuiPtbAnalysis, SuiInvariantViolation> {
  return Effect.gen(function* () {
    const parsedInputs = yield* Effect.all(inputs.map((entry, index) => decodeInput(entry, index)));
    const parsedCommands = yield* Effect.all(commands.map((entry, index) => decodeCommand(entry, index)));
    const diagnostics: string[] = [];
    const objectIds = new Set<SuiObjectId>();

    const seenNames = new Set<string>();
    for (const entry of parsedInputs) {
      if (entry.name) {
        if (seenNames.has(entry.name)) diagnostics.push(`duplicate input name: ${entry.name}`);
        seenNames.add(entry.name);
      }

      switch (entry._tag) {
        case 'ObjectInput':
          objectIds.add(entry.objectId);
          break;
        case 'ObjectRefInput':
        case 'ReceivingObjectInput':
          objectIds.add(entry.ref.objectId);
          break;
        case 'SharedObjectInput':
          objectIds.add(entry.ref.objectId);
          break;
        case 'PureInput':
          break;
      }
    }

    for (const [commandIndex, command] of parsedCommands.entries()) {
      const args = commandArguments(command);
      for (const [argIndex, arg] of args.entries()) {
        yield* validateArgument(arg, commandIndex, argIndex, parsedInputs.length, parsedCommands);
      }

      switch (command._tag) {
        case 'SplitCoins':
          if (command.amounts.length === 0) diagnostics.push(`command ${commandIndex} SplitCoins has no amounts`);
          for (const [amountIndex, amount] of command.amounts.entries()) {
            yield* rejectGasCoin(amount, `command ${commandIndex} SplitCoins amount ${amountIndex}`);
          }
          break;
        case 'MergeCoins':
          if (command.sources.length === 0) diagnostics.push(`command ${commandIndex} MergeCoins has no sources`);
          break;
        case 'TransferObjects':
          if (command.objects.length === 0) diagnostics.push(`command ${commandIndex} TransferObjects has no objects`);
          yield* rejectGasCoin(command.address, `command ${commandIndex} TransferObjects address`);
          break;
        case 'MoveCall':
          if (!command.module || !command.functionName) {
            diagnostics.push(`command ${commandIndex} MoveCall is missing module/function`);
          }
          break;
        case 'MakeMoveVec':
          if (command.elements.length === 0) diagnostics.push(`command ${commandIndex} MakeMoveVec has no elements`);
          break;
        case 'Publish':
          if (command.modules.length === 0) diagnostics.push(`command ${commandIndex} Publish has no modules`);
          break;
        case 'Upgrade':
          if (command.modules.length === 0) diagnostics.push(`command ${commandIndex} Upgrade has no modules`);
          yield* rejectGasCoin(command.ticket, `command ${commandIndex} Upgrade ticket`);
          break;
      }
    }

    return {
      inputs: parsedInputs,
      commands: parsedCommands,
      objectIds: [...objectIds],
      diagnostics: diagnostics.map((message) => `${label}: ${message}`),
    };
  });
}

// ─── Compiler ────────────────────────────────────────────────────────────────

export interface SuiPtbCompileOptions {
  readonly transaction?: Transaction;
}

export const makeCompiler = (options: SuiPtbCompileOptions = {}): SuiPtbCompilerShape => ({
  compile: ({ ptb, analysis }) => compilePtb({
    transaction: options.transaction ?? new Transaction(),
    label: ptb.label,
    inputs: analysis?.inputs ?? ptb.inputs,
    commands: analysis?.commands ?? ptb.commands,
    requirements: ptb.requirements,
  }),
});

export const SuiPtbCompilerLive = Layer.succeed(SuiPtbCompiler)(makeCompiler());
export const SuiPtbLive = Layer.merge(SuiPtbAnalyzerLive, SuiPtbCompilerLive);

export type SuiPtbRuntime = ManagedRuntime.ManagedRuntime<SuiPtbAnalyzer | SuiPtbCompiler, never>;

export interface SuiPtbBuilder {
  readonly runtime: SuiPtbRuntime;
  readonly build: <A, E>(
    ptb: SuiPTB<A, E, SuiPtbAnalyzer | SuiPtbCompiler>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<SuiPtbBuildArtifact<A>>;
  readonly buildSync: <A, E>(ptb: SuiPTB<A, E, SuiPtbAnalyzer | SuiPtbCompiler>) => SuiPtbBuildArtifact<A>;
  readonly buildExit: <A, E>(
    ptb: SuiPTB<A, E, SuiPtbAnalyzer | SuiPtbCompiler>,
    options?: { readonly signal?: AbortSignal },
  ) => Promise<Exit.Exit<SuiPtbBuildArtifact<A>, E>>;
  readonly dispose: () => Promise<void>;
}

export const makeRuntime = (
  layer: Layer.Layer<SuiPtbAnalyzer | SuiPtbCompiler, never, never> = SuiPtbLive,
): SuiPtbRuntime => ManagedRuntime.make(layer);

export const makeBuilder = (runtime: SuiPtbRuntime = makeRuntime()): SuiPtbBuilder => ({
  runtime,
  build: (ptb, options) => runtime.runPromise(ptb, options),
  buildSync: (ptb) => runtime.runSync(ptb),
  buildExit: (ptb, options) => runtime.runPromiseExit(ptb, options),
  dispose: () => runtime.dispose(),
});

export function compilePtb(options: {
  readonly transaction?: Transaction;
  readonly label: string;
  readonly inputs: ReadonlyArray<unknown>;
  readonly commands: ReadonlyArray<unknown>;
  readonly requirements?: SuiPtbBuildArtifact<Transaction>['requirements'];
}): Effect.Effect<SuiPtbBuildArtifact<Transaction>, SuiInvariantViolation> {
  return Effect.gen(function* () {
    const tx = options.transaction ?? new Transaction();
    const parsedInputs = yield* Effect.all(options.inputs.map((entry, index) => decodeInput(entry, index)));
    const parsedCommands = yield* Effect.all(options.commands.map((entry, index) => decodeCommand(entry, index)));
    const inputArgs = yield* Effect.all(parsedInputs.map((entry) => compileInput(tx, entry)));

    for (const [commandIndex, command] of parsedCommands.entries()) {
      yield* compileCommand(tx, command, commandIndex, inputArgs);
    }

    return {
      transaction: tx,
      inputs: parsedInputs,
      commands: parsedCommands,
      requirements: options.requirements ?? { requiresProvider: true, requiresPayment: true, requiresAuth: true },
    };
  });
}

export const make = (ast: SuiPtbAst): SuiPTB<Transaction, unknown, SuiPtbAnalyzer | SuiPtbCompiler> =>
  new SuiPTB<Transaction, unknown, SuiPtbAnalyzer | SuiPtbCompiler>({
    label: ast.label,
    inputs: ast.inputs,
    commands: ast.commands,
    requirements: { requiresProvider: true, requiresPayment: true, requiresAuth: true },
    build: (self) =>
      SuiPtbAnalyzer.use((analyzer) =>
        Effect.flatMap(analyzer.analyze(self), (analysis) =>
          SuiPtbCompiler.use((compiler) =>
            Effect.map(
              compiler.compile({ ptb: self, analysis }),
              (artifact) => artifact as SuiPtbBuildArtifact<Transaction>,
            ),
          ),
        ),
      ),
  });


// ─── Internals ───────────────────────────────────────────────────────────────

type MystenArgument =
  | { readonly $kind: 'GasCoin'; readonly GasCoin: true }
  | { readonly $kind: 'Input'; readonly Input: number; readonly type?: 'pure' | 'object' | 'withdrawal' }
  | { readonly $kind: 'Result'; readonly Result: number }
  | { readonly $kind: 'NestedResult'; readonly NestedResult: [number, number] };

function decodeInput(entry: unknown, index: number): Effect.Effect<SuiPtbInputAst, SuiInvariantViolation> {
  return Effect.try({
    try: () => Schema.decodeUnknownSync(SuiPtbInputAst)(entry, { errors: 'all' } as never) as SuiPtbInputAst,
    catch: (cause) => normalizePtbError(`input.${index}`, cause),
  });
}

function decodeCommand(entry: unknown, index: number): Effect.Effect<SuiPtbCommandAst, SuiInvariantViolation> {
  return Effect.try({
    try: () => Schema.decodeUnknownSync(SuiPtbCommandAst)(entry, { errors: 'all' } as never) as SuiPtbCommandAst,
    catch: (cause) => normalizePtbError(`command.${index}`, cause),
  });
}

function commandArguments(command: SuiPtbCommandAst): ReadonlyArray<SuiPtbArgument> {
  switch (command._tag) {
    case 'SplitCoins':
      return [command.coin, ...command.amounts];
    case 'MergeCoins':
      return [command.destination, ...command.sources];
    case 'TransferObjects':
      return [...command.objects, command.address];
    case 'MoveCall':
      return command.arguments;
    case 'MakeMoveVec':
      return command.elements;
    case 'Publish':
      return [];
    case 'Upgrade':
      return [command.ticket];
  }
}

function validateArgument(
  arg: SuiPtbArgument,
  commandIndex: number,
  argIndex: number,
  inputCount: number,
  commands: ReadonlyArray<SuiPtbCommandAst>,
): Effect.Effect<void, SuiInvariantViolation> {
  switch (arg._tag) {
    case 'Input':
      return arg.index >= inputCount
        ? Effect.fail(ptbInvariant('analyze', `command ${commandIndex} arg ${argIndex} references missing input ${arg.index}`))
        : Effect.void;
    case 'Result': {
      if (arg.index >= commandIndex) {
        return Effect.fail(ptbInvariant('analyze', `command ${commandIndex} arg ${argIndex} references unavailable result ${arg.index}`));
      }
      const arity = knownCommandResultArity(commands[arg.index]);
      return arity !== undefined && arity !== 1
        ? Effect.fail(ptbInvariant(
            'analyze',
            `command ${commandIndex} arg ${argIndex} uses Result(${arg.index}) but command ${arg.index} has ${arity} results`,
          ))
        : Effect.void;
    }
    case 'NestedResult': {
      if (arg.index >= commandIndex) {
        return Effect.fail(ptbInvariant('analyze', `command ${commandIndex} arg ${argIndex} references unavailable nested result ${arg.index}`));
      }
      const arity = knownCommandResultArity(commands[arg.index]);
      return arity !== undefined && arg.nestedIndex >= arity
        ? Effect.fail(ptbInvariant(
            'analyze',
            `command ${commandIndex} arg ${argIndex} references missing nested result ${arg.index}.${arg.nestedIndex}`,
          ))
        : Effect.void;
    }
    case 'GasCoin':
      return Effect.void;
  }
}

function rejectGasCoin(arg: SuiPtbArgument, context: string): Effect.Effect<void, SuiInvariantViolation> {
  return arg._tag === 'GasCoin'
    ? Effect.fail(ptbInvariant('analyze', `${context} cannot use GasCoin by value`))
    : Effect.void;
}

function knownCommandResultArity(command: SuiPtbCommandAst | undefined): number | undefined {
  switch (command?._tag) {
    case 'SplitCoins':
      return command.amounts.length;
    case 'MergeCoins':
    case 'TransferObjects':
      return 0;
    case 'MakeMoveVec':
    case 'Publish':
    case 'Upgrade':
      return 1;
    case 'MoveCall':
    case undefined:
      return undefined;
  }
}

function compileInput(tx: Transaction, entry: SuiPtbInputAst): Effect.Effect<MystenArgument, SuiInvariantViolation> {
  return Effect.try({
    try: () => {
      switch (entry._tag) {
        case 'PureInput':
          return entry.bytes ? tx.pure(entry.bytes) : tx.pure(entry.typeTag as never, entry.value as never);
        case 'ObjectInput':
          return tx.object(entry.objectId) as MystenArgument;
        case 'ObjectRefInput':
          return tx.objectRef(entry.ref.toMysten()) as MystenArgument;
        case 'SharedObjectInput':
          return tx.sharedObjectRef(entry.ref.toMysten()) as MystenArgument;
        case 'ReceivingObjectInput':
          return tx.receivingRef(entry.ref.toMysten()) as MystenArgument;
      }
    },
    catch: (cause) => normalizePtbError(`compile.input.${entry._tag}`, cause),
  });
}

function compileCommand(
  tx: Transaction,
  command: SuiPtbCommandAst,
  commandIndex: number,
  inputs: ReadonlyArray<MystenArgument>,
): Effect.Effect<void, SuiInvariantViolation> {
  return Effect.gen(function* () {
    switch (command._tag) {
      case 'SplitCoins': {
        const coin = yield* compileArg(command.coin, inputs);
        const amounts = yield* Effect.all(command.amounts.map((amount) => compileArg(amount, inputs)));
        yield* applyCommand(commandIndex, () => tx.splitCoins(coin, amounts));
        return;
      }
      case 'MergeCoins': {
        const destination = yield* compileArg(command.destination, inputs);
        const sources = yield* Effect.all(command.sources.map((source) => compileArg(source, inputs)));
        yield* applyCommand(commandIndex, () => tx.mergeCoins(destination, sources));
        return;
      }
      case 'TransferObjects': {
        const objects = yield* Effect.all(command.objects.map((objectArg) => compileArg(objectArg, inputs)));
        const address = yield* compileArg(command.address, inputs);
        yield* applyCommand(commandIndex, () => tx.transferObjects(objects, address));
        return;
      }
      case 'MoveCall': {
        const args = yield* Effect.all(command.arguments.map((arg) => compileArg(arg, inputs)));
        yield* applyCommand(commandIndex, () =>
          tx.moveCall({
            target: `${command.packageId}::${command.module}::${command.functionName}`,
            typeArguments: command.typeArguments ? [...command.typeArguments] : undefined,
            arguments: args,
          }),
        );
        return;
      }
      case 'MakeMoveVec': {
        const elements = yield* Effect.all(command.elements.map((element) => compileArg(element, inputs)));
        yield* applyCommand(commandIndex, () => tx.makeMoveVec({ type: command.type, elements }));
        return;
      }
      case 'Publish':
        yield* applyCommand(commandIndex, () =>
          tx.publish({
            modules: command.modules.map((moduleBytes) => [...moduleBytes]),
            dependencies: [...command.dependencies],
          }),
        );
        return;
      case 'Upgrade': {
        const ticket = yield* compileArg(command.ticket, inputs);
        yield* applyCommand(commandIndex, () =>
          tx.upgrade({
            modules: command.modules.map((moduleBytes) => [...moduleBytes]),
            dependencies: [...command.dependencies],
            package: command.packageId,
            ticket,
          }),
        );
        return;
      }
    }
  });
}

function applyCommand(
  commandIndex: number,
  apply: () => unknown,
): Effect.Effect<void, SuiInvariantViolation> {
  return Effect.try({
    try: () => {
      apply();
    },
    catch: (cause) => normalizePtbError(`compile.command.${commandIndex}`, cause),
  });
}

function compileArg(arg: SuiPtbArgument, inputs: ReadonlyArray<MystenArgument>): Effect.Effect<MystenArgument, SuiInvariantViolation> {
  switch (arg._tag) {
    case 'GasCoin':
      return Effect.succeed({ $kind: 'GasCoin', GasCoin: true });
    case 'Input': {
      const resolved = inputs[arg.index];
      return resolved
        ? Effect.succeed(resolved)
        : Effect.fail(ptbInvariant('compile', `Missing input ${arg.index}`));
    }
    case 'Result':
      return Effect.succeed({ $kind: 'Result', Result: arg.index });
    case 'NestedResult':
      return Effect.succeed({ $kind: 'NestedResult', NestedResult: [arg.index, arg.nestedIndex] });
  }
}

function ptbInvariant(phase: 'analyze' | 'compile', message: string, cause?: unknown): SuiInvariantViolation {
  return new SuiInvariantViolation({
    invariant: `SuiPTB.${phase}`,
    message,
    cause,
  });
}

function normalizePtbError(phase: string, cause: unknown): SuiInvariantViolation {
  if (cause instanceof SuiInvariantViolation) return cause;
  return new SuiInvariantViolation({
    invariant: `SuiPTB.${phase}`,
    message: cause instanceof Error ? cause.message : String(cause),
    cause,
  });
}
