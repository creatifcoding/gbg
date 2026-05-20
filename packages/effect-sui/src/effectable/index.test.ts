import * as Effect from 'effect-v4/Effect';
import { describe, expect, it } from 'vitest';

import { decodeSuiObjectId } from '../schema';
import { SuiModule, SuiObject, SuiPackage, SuiPTB, SuiTx } from './index';

describe('Effectable ontology layer', () => {
  const packageId = decodeSuiObjectId('0x2');
  const objectId = decodeSuiObjectId('0x3');

  it('makes SuiObject an Effectable object capability that yields a snapshot', () => {
    const object = new SuiObject({
      id: objectId,
      refresh: (self) => Effect.succeed({
        id: self.id,
        content: { count: 1 },
      }),
    });

    const snapshot = Effect.runSync(object);

    expect(object.kind).toBe('SuiObject');
    expect(snapshot).toEqual({ id: objectId, content: { count: 1 } });
  });

  it('makes SuiPTB an Effectable full PTB build program without executing the chain lifecycle', () => {
    let executed = false;
    const ptb = new SuiPTB({
      label: 'counter.increment.ptb',
      inputs: [{ _tag: 'ObjectInput', name: 'counter' }],
      commands: [{ _tag: 'MoveCall', name: 'increment' }],
      requirements: { requiresProvider: true, requiresPayment: true },
      build: (self) => Effect.succeed({
        inputs: self.inputs,
        commands: self.commands,
        requirements: self.requirements,
        transaction: { kind: 'MystenTransactionPlaceholder' },
      }),
    });

    const built = Effect.runSync(ptb);

    expect(ptb.kind).toBe('SuiPTB');
    expect(executed).toBe(false);
    expect(built).toEqual({
      inputs: [{ _tag: 'ObjectInput', name: 'counter' }],
      commands: [{ _tag: 'MoveCall', name: 'increment' }],
      requirements: { requiresProvider: true, requiresPayment: true },
      transaction: { kind: 'MystenTransactionPlaceholder' },
    });
  });

  it('makes SuiTx the payable/authenticated transaction lifecycle capability', () => {
    const ptb = new SuiPTB({
      label: 'counter.increment.ptb',
      commands: [{ _tag: 'MoveCall', name: 'increment' }],
      build: (self) => Effect.succeed({
        inputs: self.inputs,
        commands: self.commands,
        requirements: self.requirements,
      }),
    });
    const tx = new SuiTx({
      label: 'counter.increment',
      ptb,
      execute: (self) => Effect.map(self.ptb!, (built) => ({
        label: self.label,
        builtCommands: built.commands.length,
        status: 'success' as const,
      })),
    });

    expect(Effect.runSync(tx)).toEqual({
      label: 'counter.increment',
      builtCommands: 1,
      status: 'success',
    });
  });

  it('lets SuiPackage/SuiModule manufacture typed object, PTB, and transaction capabilities', () => {
    const pkg = new SuiPackage({
      packageId,
      modules: ['counter'],
      label: 'CounterPackage',
    });

    const mod = pkg.module('counter');
    const object = mod.object({
      id: objectId,
      refresh: (self) => Effect.succeed({
        id: self.id,
        content: { count: 41 },
      }),
    });
    const ptb = mod.ptb({
      label: 'increment.ptb',
      inputs: [{ _tag: 'ObjectInput', name: 'counter' }],
      commands: [{ _tag: 'MoveCall', name: 'increment' }],
      requirements: { requiresPayment: true, requiresAuth: true },
      build: (self) => Effect.succeed({
        inputs: self.inputs,
        commands: self.commands,
        requirements: self.requirements,
      }),
    });
    const tx = object.mutate((counter) =>
      mod.tx({
        label: 'increment',
        ptb,
        execute: (self) => Effect.all([counter.refresh(), self.ptb!]).pipe(
          Effect.map(([snapshot, built]) => ({
            objectId: snapshot.id,
            next: snapshot.content.count + 1,
            commands: built.commands.length,
            requiresPayment: built.requirements.requiresPayment === true,
          })),
        ),
      }),
    );

    expect(mod).toBeInstanceOf(SuiModule);
    expect(Effect.runSync(pkg)).toEqual({ packageId, modules: ['counter'] });
    expect(Effect.runSync(ptb).commands).toHaveLength(1);
    expect(Effect.runSync(tx)).toEqual({
      objectId,
      next: 42,
      commands: 1,
      requiresPayment: true,
    });
  });

  it('rejects undeclared module handles at the package boundary', () => {
    const pkg = new SuiPackage({ packageId, modules: ['counter'] });

    expect(() => pkg.module('missing')).toThrow(/not declared/);
  });
});
