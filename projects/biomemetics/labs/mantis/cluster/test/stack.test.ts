import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import stack, { cluster } from "../alchemy.run.ts";

const alchemyRun = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../alchemy.run.ts"),
  "utf8",
);

describe("mantis cluster stack", () => {
  test("targets k3d-tmnl through default kubeconfig resolution", () => {
    expect(cluster.auth.kind).toBe("kubeconfig");
    if (cluster.auth.kind !== "kubeconfig") {
      throw new Error("expected kubeconfig auth");
    }
    expect(cluster.auth.context).toBe("k3d-tmnl");
    expect(cluster.auth.path).toBeUndefined();
  });

  test("declares a stack without applying it", () => {
    expect(stack).toBeDefined();
  });

  test("source stays kubernetes-only and host-portable", () => {
    expect(alchemyRun).toContain(
      'const cluster = Kubernetes.KubeConfig({ context: "k3d-tmnl" });',
    );
    expect(alchemyRun).toContain("Kubernetes.providers()");
    expect(alchemyRun).toContain("Alchemy.localState()");
    expect(alchemyRun).toContain('kind: "Namespace"');
    expect(alchemyRun).toContain('name: "procurement"');
    expect(alchemyRun).not.toContain("AWS.providers");
    expect(alchemyRun).not.toContain("kind-dev");
    expect(alchemyRun).not.toContain("/home/");
    expect(alchemyRun).not.toContain("/nix/");
    expect(alchemyRun).not.toContain("Cloudflare");
  });
});
