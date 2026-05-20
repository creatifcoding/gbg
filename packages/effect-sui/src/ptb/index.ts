/** Programmable transaction block AST, analyzer, and Mysten compiler surfaces. */

import { Transaction } from '@mysten/sui/transactions';
import * as Effect from 'effect-v4/Effect';
import * as Layer from 'effect-v4/Layer';
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

export const makeSuiPtbAnalyzer = (): SuiPtbAnalyzerShape => ({
  analyze: (ptb) => Effect.try({
    try: () => analyzePtb(ptb.label, ptb.inputs, ptb.commands),
    catch: (cause) => normalizePtbError('analyze', cause),
  }),
});

export const SuiPtbAnalyzerLive = Layer.succeed(SuiPtbAnalyzer)(makeSuiPtbAnalyzer());

export function analyzePtb(
  label: string,
  inputs: ReadonlyArray<unknown>,
  commands: ReadonlyArray<unknown>,
): SuiPtbAnalysis {
  const parsedInputs = inputs.map((entry, index) => decodeInput(entry, index));
  const parsedCommands = commands.map((entry, index) => decodeCommand(entry, index));
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

  parsedCommands.forEach((command, commandIndex) => {
    const args = commandArguments(command);
    args.forEach((arg, argIndex) => validateArgument(arg, commandIndex, argIndex, parsedInputs.length));

    switch (command._tag) {
      case 'SplitCoins':
        if (command.amounts.length === 0) diagnostics.push(`command ${commandIndex} SplitCoins has no amounts`);
        break;
      case 'MergeCoins':
        if (command.sources.length === 0) diagnostics.push(`command ${commandIndex} MergeCoins has no sources`);
        break;
      case 'TransferObjects':
        if (command.objects.length === 0) diagnostics.push(`command ${commandIndex} TransferObjects has no objects`);
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
        break;
    }
  });

  return {
    inputs: parsedInputs,
    commands: parsedCommands,
    objectIds: [...objectIds],
    diagnostics: diagnostics.map((message) => `${label}: ${message}`),
  };
}

// ─── Compiler ────────────────────────────────────────────────────────────────

export interface SuiPtbCompileOptions {
  readonly transaction?: Transaction;
}

export const makeSuiPtbCompiler = (options: SuiPtbCompileOptions = {}): SuiPtbCompilerShape => ({
  compile: ({ ptb, analysis }) => Effect.try({
    try: () => compilePtb({
      transaction: options.transaction ?? new Transaction(),
      label: ptb.label,
      inputs: analysis?.inputs ?? ptb.inputs,
      commands: analysis?.commands ?? ptb.commands,
      requirements: ptb.requirements,
    }),
    catch: (cause) => normalizePtbError('compile', cause),
  }),
});

export const SuiPtbCompilerLive = Layer.succeed(SuiPtbCompiler)(makeSuiPtbCompiler());
export const SuiPtbLive = Layer.merge(SuiPtbAnalyzerLive, SuiPtbCompilerLive);

export function compilePtb(options: {
  readonly transaction?: Transaction;
  readonly label: string;
  readonly inputs: ReadonlyArray<unknown>;
  readonly commands: ReadonlyArray<unknown>;
  readonly requirements?: SuiPtbBuildArtifact<Transaction>['requirements'];
}): SuiPtbBuildArtifact<Transaction> {
  const tx = options.transaction ?? new Transaction();
  const parsedInputs = options.inputs.map((entry, index) => decodeInput(entry, index));
  const parsedCommands = options.commands.map((entry, index) => decodeCommand(entry, index));
  const inputArgs = parsedInputs.map((entry) => compileInput(tx, entry));

  parsedCommands.forEach((command, commandIndex) => {
    compileCommand(tx, command, commandIndex, inputArgs);
  });

  return {
    transaction: tx,
    inputs: parsedInputs,
    commands: parsedCommands,
    requirements: options.requirements ?? { requiresProvider: true, requiresPayment: true, requiresAuth: true },
  };
}

export const makeSuiPTB = (ast: SuiPtbAst): SuiPTB<Transaction, unknown, SuiPtbAnalyzer | SuiPtbCompiler> =>
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

function decodeInput(entry: unknown, index: number): SuiPtbInputAst {
  return Schema.decodeUnknownSync(SuiPtbInputAst)(entry, {
    errors: 'all',
  } as never) as SuiPtbInputAst;
}

function decodeCommand(entry: unknown, index: number): SuiPtbCommandAst {
  return Schema.decodeUnknownSync(SuiPtbCommandAst)(entry, {
    errors: 'all',
  } as never) as SuiPtbCommandAst;
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
): void {
  switch (arg._tag) {
    case 'Input':
      if (arg.index >= inputCount) {
        throw new Error(`command ${commandIndex} arg ${argIndex} references missing input ${arg.index}`);
      }
      return;
    case 'Result':
      if (arg.index >= commandIndex) {
        throw new Error(`command ${commandIndex} arg ${argIndex} references unavailable result ${arg.index}`);
      }
      return;
    case 'NestedResult':
      if (arg.index >= commandIndex) {
        throw new Error(`command ${commandIndex} arg ${argIndex} references unavailable nested result ${arg.index}`);
      }
      return;
    case 'GasCoin':
      return;
  }
}

function compileInput(tx: Transaction, entry: SuiPtbInputAst): MystenArgument {
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
}

function compileCommand(
  tx: Transaction,
  command: SuiPtbCommandAst,
  commandIndex: number,
  inputs: ReadonlyArray<MystenArgument>,
): void {
  switch (command._tag) {
    case 'SplitCoins':
      tx.splitCoins(compileArg(command.coin, inputs), command.amounts.map((amount) => compileArg(amount, inputs)));
      return;
    case 'MergeCoins':
      tx.mergeCoins(compileArg(command.destination, inputs), command.sources.map((source) => compileArg(source, inputs)));
      return;
    case 'TransferObjects':
      tx.transferObjects(
        command.objects.map((objectArg) => compileArg(objectArg, inputs)),
        compileArg(command.address, inputs),
      );
      return;
    case 'MoveCall':
      tx.moveCall({
        target: `${command.packageId}::${command.module}::${command.functionName}`,
        typeArguments: command.typeArguments ? [...command.typeArguments] : undefined,
        arguments: command.arguments.map((arg) => compileArg(arg, inputs)),
      });
      return;
    case 'MakeMoveVec':
      tx.makeMoveVec({
        type: command.type,
        elements: command.elements.map((element) => compileArg(element, inputs)),
      });
      return;
    case 'Publish':
      tx.publish({
        modules: command.modules.map((moduleBytes) => [...moduleBytes]),
        dependencies: [...command.dependencies],
      });
      return;
    case 'Upgrade':
      tx.upgrade({
        modules: command.modules.map((moduleBytes) => [...moduleBytes]),
        dependencies: [...command.dependencies],
        package: command.packageId,
        ticket: compileArg(command.ticket, inputs),
      });
      return;
    default:
      throw new Error(`Unsupported command at index ${commandIndex}`);
  }
}

function compileArg(arg: SuiPtbArgument, inputs: ReadonlyArray<MystenArgument>): MystenArgument {
  switch (arg._tag) {
    case 'GasCoin':
      return { $kind: 'GasCoin', GasCoin: true };
    case 'Input': {
      const resolved = inputs[arg.index];
      if (!resolved) throw new Error(`Missing input ${arg.index}`);
      return resolved;
    }
    case 'Result':
      return { $kind: 'Result', Result: arg.index };
    case 'NestedResult':
      return { $kind: 'NestedResult', NestedResult: [arg.index, arg.nestedIndex] };
  }
}

function normalizePtbError(phase: 'analyze' | 'compile', cause: unknown): SuiInvariantViolation {
  if (cause instanceof SuiInvariantViolation) return cause;
  return new SuiInvariantViolation({
    invariant: `SuiPTB.${phase}`,
    message: cause instanceof Error ? cause.message : String(cause),
    cause,
  });
}
