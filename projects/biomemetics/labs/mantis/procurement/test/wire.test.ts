import { describe, expect, it } from 'vitest';
import { MANTIS_PROCUREMENT_PCT_CONTRACT, wireStack } from '../src/wire';

describe('gbg wire stack', () => {
  it('depends on pct/msh/lnk and does not invent a procurement contract', () => {
    expect(MANTIS_PROCUREMENT_PCT_CONTRACT).toBeNull();
    expect(typeof wireStack.pct.isProcedure).toBe('function');
    expect(wireStack.msh.SubjectRegistry).toBeTruthy();
    expect(wireStack.lnk.Offset).toBeTruthy();
    expect(wireStack.contract).toBeNull();
  });
});
