import { Transaction } from '@mysten/sui/transactions';
import * as Effect from 'effect-v4/Effect';
import * as Schema from 'effect-v4/Schema';
import { describe, expect, it } from 'vitest';

import { decodeSuiAddress, decodeSuiObjectId, decodeSuiTypeTagString, SuiPtbInvalidError } from '../schema';
import {
  analyzePtb,
  gas,
  input,
  make,
  makeBuilder,
  nestedResult,
  pure,
  result,
  SuiPtbAst,
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

    const analysis = Effect.runSync(analyzePtb(ast.label, ast.inputs, ast.commands));

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

    const error = Effect.runSync(Effect.flip(analyzePtb(ast.label, ast.inputs, ast.commands)));
    expect(error).toBeInstanceOf(SuiPtbInvalidError);
    expect(error.message).toMatch(/unavailable result 0/);
  });

  it('rejects invalid Result shorthand and GasCoin by-value positions known statically', () => {
    const badResult = new SuiPtbAst({
      label: 'bad-result-shorthand',
      inputs: [pure({ name: 'recipient', typeTag: address, value: sender })],
      commands: [
        new SuiPtbSplitCoins({ coin: gas(), amounts: [input(0, 'pure'), input(0, 'pure')] }),
        new SuiPtbTransferObjects({ objects: [result(0)], address: input(0, 'pure') }),
      ],
    });

    const badResultError = Effect.runSync(Effect.flip(analyzePtb(badResult.label, badResult.inputs, badResult.commands)));
    expect(badResultError).toBeInstanceOf(SuiPtbInvalidError);
    expect(badResultError.message).toMatch(/uses Result\(0\) but command 0 has 2 results/);

    const badGasAmount = new SuiPtbAst({
      label: 'bad-gas-amount',
      inputs: [],
      commands: [new SuiPtbSplitCoins({ coin: gas(), amounts: [gas()] })],
    });

    const badGasAmountError = Effect.runSync(
      Effect.flip(analyzePtb(badGasAmount.label, badGasAmount.inputs, badGasAmount.commands)),
    );
    expect(badGasAmountError).toBeInstanceOf(SuiPtbInvalidError);
    expect(badGasAmountError.message).toMatch(/SplitCoins amount 0 cannot use GasCoin by value/);
  });

  it('compiles to a Mysten Transaction through a ManagedRuntime builder without submitting', async () => {
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

    const builder = makeBuilder();
    const artifact = builder.buildSync(make(ast));
    await builder.dispose();

    expect(artifact.transaction).toBeInstanceOf(Transaction);
    expect(artifact.inputs).toHaveLength(2);
    expect(artifact.commands).toHaveLength(2);
    expect(artifact.requirements).toEqual({ requiresProvider: true, requiresPayment: true, requiresAuth: true });

    const data = artifact.transaction?.getData() as { readonly commands?: ReadonlyArray<{ readonly $kind: string }> };
    expect(data.commands?.map((command) => command.$kind)).toEqual(['SplitCoins', 'TransferObjects']);
  });

  it('normalizes live compiler failures as SuiPtbInvalidError through the ManagedRuntime builder', async () => {
    const ast = new SuiPtbAst({
      label: 'bad-compiler-ref',
      inputs: [],
      commands: [new SuiPtbSplitCoins({ coin: gas(), amounts: [input(99, 'pure')] })],
    });

    const builder = makeBuilder();
    const error = builder.runtime.runSync(Effect.flip(make(ast)));
    await builder.dispose();

    expect(error).toBeInstanceOf(SuiPtbInvalidError);
    expect(error.phase).toBe('analyze');
    expect(error.message).toContain('missing input 99');
  });
});
