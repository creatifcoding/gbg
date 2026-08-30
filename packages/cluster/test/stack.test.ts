import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import stack, { cluster } from '../alchemy.run';

const root = dirname(fileURLToPath(import.meta.url));
const alchemyRun = readFileSync(join(root, '../alchemy.run.ts'), 'utf8');
const clusterSrc = readFileSync(join(root, '../src/cluster.ts'), 'utf8');

describe('lab cluster stack', () => {
  test('targets k3d-tmnl through default kubeconfig resolution', () => {
    expect(cluster.auth.kind).toBe('kubeconfig');
    if (cluster.auth.kind !== 'kubeconfig') {
      throw new Error('expected kubeconfig auth');
    }
    expect(cluster.auth.context).toBe('k3d-tmnl');
    expect(cluster.auth.path).toBeUndefined();
  });

  test('declares a stack without applying it', () => {
    expect(stack).toBeDefined();
  });

  test('source stays kubernetes-only and host-portable', () => {
    expect(clusterSrc).toContain(
      'export const cluster = Kubernetes.KubeConfig({ context: "k3d-tmnl" });',
    );
    expect(alchemyRun).toContain('Kubernetes.providers()');
    expect(alchemyRun).toContain('Alchemy.localState()');
    expect(alchemyRun).toContain('LabImageCRD');
    expect(alchemyRun).toContain('LabRegistryCRD');
    expect(alchemyRun).toContain('LabWorkloadCRD');
    expect(alchemyRun).toContain('LabAppletCRD');
    expect(alchemyRun).not.toContain('MantisCluster');
    expect(alchemyRun).not.toContain('kind: "Namespace"');
    expect(alchemyRun).not.toContain('name: "procurement"');
    expect(alchemyRun).not.toContain('AWS.providers');
    expect(alchemyRun).not.toContain('kind-dev');
    expect(alchemyRun).not.toContain('/home/');
    expect(alchemyRun).not.toContain('/nix/');
    expect(alchemyRun).not.toContain('Cloudflare');
    expect(alchemyRun).not.toContain('ECR');
    expect(alchemyRun).not.toContain('NATS');
    expect(clusterSrc).not.toContain('AWS.providers');
    expect(clusterSrc).not.toContain('kind-dev');
    expect(clusterSrc).not.toContain('/home/');
    expect(clusterSrc).not.toContain('/nix/');
  });
});
