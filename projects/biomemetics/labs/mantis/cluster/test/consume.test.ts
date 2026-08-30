import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import {
  cluster,
  KUBE_CONTEXT,
  LAB_GROUP,
  PROCUREMENT_APPLET_ROUTES,
  PROCUREMENT_PGLITE_MOUNT,
  procurementApplet,
  procurementNamespace,
} from '../src/index';
import { mantisClusterManifests } from '../src/manifests';

const root = dirname(fileURLToPath(import.meta.url));
const indexSrc = readFileSync(join(root, '../src/index.ts'), 'utf8');
const manifestsSrc = readFileSync(join(root, '../src/manifests.ts'), 'utf8');
const readme = readFileSync(join(root, '../README.md'), 'utf8');

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
    expect(readme).toContain('@gbg/cluster');
    expect(readme).toContain('hosts applets');
    expect(readme).toContain('@gbg/nexus');
    expect(readme).toContain('Ship when CI is green on the lab branch');
    expect(readme).toContain('Operator default is ship');
    expect(readme).toContain('Do not sit on a green generate');
    expect(readme).toContain('Dockerd from the existing gbg flake only');
    expect(readme).toContain('Package merge is not a running cluster');
    expect(readme).toContain('Missing OpenRouter or Paper bearer is not a merge gate');
    expect(readme).toContain('first `LabApplet`');
    expect(readme).toContain('PGlite');
    expect(readme).not.toContain('existing TMNL k3d default');
    expect(readme).not.toContain('the TMNL cluster');
    expect(readme).not.toContain('the one stack');
    expect(readme).not.toContain('Hold deploy');
    expect(readme).not.toContain('Hold merge');
    expect(readme).not.toContain('from this land');
    expect(readme).not.toContain('The applet is not started');
    expect(readme).not.toContain('not applied');
    expect(readme).not.toContain('gateway-plan-against');
    expect(readme).not.toContain('Cosmo-in-tmnl');
    expect(readme).not.toContain('nexus-prose-only');
  });

  test('extends with a procurement Namespace Manifest', () => {
    expect(procurementNamespace).toEqual({
      apiVersion: 'v1',
      kind: 'Namespace',
      metadata: { name: 'procurement' },
    });
    expect(mantisClusterManifests).toContainEqual({
      id: 'ProcurementNamespace',
      manifest: procurementNamespace,
    });
    expect(manifestsSrc).not.toContain('AWS.providers');
    expect(manifestsSrc).not.toContain('kind-dev');
    expect(manifestsSrc).not.toContain('/home/');
    expect(manifestsSrc).not.toContain('/nix/');
    expect(manifestsSrc).not.toContain('Cloudflare');
  });

  test('extends with a procurement LabApplet object', () => {
    expect(procurementApplet.kind).toBe('LabApplet');
    expect(procurementApplet.apiVersion).toBe('tmnl.gbg.dev/v1alpha1');
    expect(procurementApplet.metadata).toEqual({
      name: 'procurement',
      namespace: 'procurement',
    });
    expect(procurementApplet.spec.routes).toEqual(PROCUREMENT_APPLET_ROUTES);
    expect(procurementApplet.spec.routes).toHaveLength(5);
    expect(procurementApplet.spec.persistence).toEqual({
      size: '1Gi',
      mountPath: PROCUREMENT_PGLITE_MOUNT,
    });
    expect(PROCUREMENT_PGLITE_MOUNT).toBe('/data/pglite');
    expect('image' in procurementApplet.spec).toBe(false);
    expect(JSON.stringify(procurementApplet)).not.toMatch(
      /dkr\.ecr|gcr\.io|azurecr\.io|repository/,
    );
    expect(JSON.stringify(procurementApplet)).not.toMatch(/sqlite|postgres|catalog/i);
    expect(mantisClusterManifests).toContainEqual({
      id: 'ProcurementApplet',
      manifest: procurementApplet,
    });
    expect(manifestsSrc).not.toContain('Alchemy.Stack');
    expect(manifestsSrc).not.toContain('alchemy deploy');
    expect(indexSrc).not.toContain('Kubernetes.Manifest');
  });
});
