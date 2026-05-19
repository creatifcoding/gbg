import { describe, expect, it } from 'vitest';

import {
  EffectSuiEffectVersion,
  EffectSuiPackageName,
  EffectSuiPackageVersion,
} from './index';

describe('@tmnl/effect-sui scaffold', () => {
  it('exports package identity constants', () => {
    expect(EffectSuiPackageName).toBe('@tmnl/effect-sui');
    expect(EffectSuiPackageVersion).toBe('0.0.1');
    expect(EffectSuiEffectVersion).toBe('4.0.0-beta.59');
  });
});
