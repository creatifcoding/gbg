import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { PACKAGE_ROOT } from '../src/index';

describe('home boundary', () => {
  test('does not copy leftover tmnl Pepr Cosmo operator sources', () => {
    expect(existsSync(join(PACKAGE_ROOT, 'pepr.ts'))).toBe(false);
    expect(existsSync(join(PACKAGE_ROOT, 'crd'))).toBe(false);
    expect(existsSync(join(PACKAGE_ROOT, 'controller'))).toBe(false);
    expect(existsSync(join(PACKAGE_ROOT, 'src/infra/graph'))).toBe(false);
  });
});
