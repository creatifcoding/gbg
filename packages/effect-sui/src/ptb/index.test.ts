import { Transaction } from '@mysten/sui/transactions';
import * as Effect from 'effect-v4/Effect';
import * as Schema from 'effect-v4/Schema';
import { describe, expect, it } from 'vitest';

import { decodeSuiAddress, decodeSuiObjectId, decodeSuiTypeTagString, SuiInvariantViolation } from '../schema';
import {
  analyzePtb,
  gas,
  input,
  makeSuiPTB,
  nestedResult,
  pure,
  result,
  SuiPtbAst,
  SuiPtbLive,
  SuiPtbMoveCall,
  SuiPtbSplitCoins,
  SuiPtbTransferObjects,
} from './index';

describe('SuiPTB AST and compiler', () => {
  const sender = decodeSuiAddress('0x8');
  const packageId = decodeSuiObjectId('0x2');
  const u64 = decodeSuiTypeTagString('u64');
  const address = decodeSuiTypeTagString('address');

  it('decodes schema-backed PTB AST values', () => {
    const decoded = Schema.decodeUnknownSync(SuiPtbAst)({
      label: 'counter.increment',
      inputs: [
        { _tag: 'PureInput', name: 'amount', typeTag: 'u64', value: 1 },
      ],
      commands: [
        {
          _tag: 'MoveCall',
          packageId: '0x2',
          module: 'counter',
          functionName: 'increment',
          typeArguments: [],
          arguments: [{ _tag: 'Input', index: 0, inputKind: 'pure' }],
        },
      ],
    });

    expect(decoded.inputs[0]._tag).toBe('PureInput');
    expect(decoded.commands[0]._tag).toBe('MoveCall');
  });

  it('analyzes inputs, commands, object IDs, and result references', () => {
    const ast = new SuiPtbAst({
      label: 'split-and-transfer',
      inputs: [
        pure({ name: 'recipient', typeTag: address, value: sender }),
        pure({ name: 'amount', typeTag: u64, value: 1n }),
      ],
      commands: [
        new SuiPtbSplitCoins({ coin: gas(), amounts: [input(1, 'pure')] }),
        new SuiPtbTransferObjects({ objects: [nestedResult(0, 0)], address: input(0, 'pure') }),
      ],
    });

    const analysis = analyzePtb(ast.label, ast.inputs, ast.commands);

    expect(analysis.inputs).toHaveLength(2);
    expect(analysis.commands.map((command) => command._tag)).toEqual(['SplitCoins', 'TransferObjects']);
    expect(analysis.objectIds).toEqual([]);
    expect(analysis.diagnostics).toEqual([]);
  });

  it('rejects forward result references during analysis', () => {
    const ast = new SuiPtbAst({
      label: 'bad-forward-ref',
      inputs: [],
      commands: [
        new SuiPtbMoveCall({
          packageId,
          module: 'counter',
          functionName: 'increment',
          typeArguments: [],
          arguments: [result(0)],
        }),
      ],
    });

    expect(() => analyzePtb(ast.label, ast.inputs, ast.commands)).toThrow(/unavailable result 0/);
  });

  it('compiles to a Mysten Transaction without submitting', () => {
    const ast = new SuiPtbAst({
      label: 'split-and-transfer',
      inputs: [
        pure({ name: 'recipient', typeTag: address, value: sender }),
        pure({ name: 'amount', typeTag: u64, value: 1n }),
      ],
      commands: [
        new SuiPtbSplitCoins({ coin: gas(), amounts: [input(1, 'pure')] }),
        new SuiPtbTransferObjects({ objects: [nestedResult(0, 0)], address: input(0, 'pure') }),
      ],
    });

    const artifact = Effect.runSync(makeSuiPTB(ast).pipe(Effect.provide(SuiPtbLive)));

    expect(artifact.transaction).toBeInstanceOf(Transaction);
    expect(artifact.inputs).toHaveLength(2);
    expect(artifact.commands).toHaveLength(2);
    expect(artifact.requirements).toEqual({ requiresProvider: true, requiresPayment: true, requiresAuth: true });

    const data = artifact.transaction?.getData() as { readonly commands?: ReadonlyArray<{ readonly $kind: string }> };
    expect(data.commands?.map((command) => command.$kind)).toEqual(['SplitCoins', 'TransferObjects']);
  });

  it('normalizes live compiler failures as SuiInvariantViolation', () => {
    const ast = new SuiPtbAst({
      label: 'bad-compiler-ref',
      inputs: [],
      commands: [new SuiPtbSplitCoins({ coin: gas(), amounts: [input(99, 'pure')] })],
    });

    const error = Effect.runSync(
      Effect.flip(makeSuiPTB(ast).pipe(Effect.provide(SuiPtbLive))),
    );

    expect(error).toBeInstanceOf(SuiInvariantViolation);
    expect(error.invariant).toBe('SuiPTB.analyze');
    expect(error.message).toContain('missing input 99');
  });
});
