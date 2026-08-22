import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { cluster, KUBE_CONTEXT, LAB_GROUP, procurementNamespace } from '../src/index';
import { mantisClusterManifests } from '../src/manifests';

const root = dirname(fileURLToPath(import.meta.url));
const indexSrc = readFileSync(join(root, '../src/index.ts'), 'utf8');
const manifestsSrc = readFileSync(join(root, '../src/manifests.ts'), 'utf8');

describe('mantis cluster roseleaf', () => {
  test('consumes @gbg/cluster k3d-tmnl kubeconfig', () => {
    expect(KUBE_CONTEXT).toBe('k3d-tmnl');
    expect(LAB_GROUP).toBe('tmnl.gbg.dev');
    expect(cluster.auth.kind).toBe('kubeconfig');
    if (cluster.auth.kind !== 'kubeconfig') {
      throw new Error('expected kubeconfig auth');
    }
    expect(cluster.auth.context).toBe('k3d-tmnl');
    expect(cluster.auth.path).toBeUndefined();
  });

  test('does not own a second Alchemy stack', () => {
    expect(existsSync(join(root, '../alchemy.run.ts'))).toBe(false);
    expect(indexSrc).toContain("from '@gbg/cluster'");
    expect(indexSrc).not.toContain('Alchemy.Stack');
    expect(manifestsSrc).not.toContain('Alchemy.Stack');
  });

  test('extends with a procurement Namespace Manifest', () => {
    expect(procurementNamespace).toEqual({
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: { name: 'procurement' },
    });
    expect(mantisClusterManifests).toEqual([
      { id: 'ProcurementNamespace', manifest: procurementNamespace },
    ]);
    expect(manifestsSrc).not.toContain('AWS.providers');
    expect(manifestsSrc).not.toContain('kind-dev');
    expect(manifestsSrc).not.toContain('/home/');
    expect(manifestsSrc).not.toContain('/nix/');
    expect(manifestsSrc).not.toContain('Cloudflare');
  });
});
