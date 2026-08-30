import { fileURLToPath } from "node:url";
import path from "node:path";

export function defaultMantisRoot(): string {
  return path.resolve(fileURLToPath(new URL("../../../../", import.meta.url)));
}

export function defaultWorkflowsRoot(mantisRoot = defaultMantisRoot()): string {
  return path.join(mantisRoot, "assistant", "workflows");
}

export function resolveUnderRoot(root: string, relativePath: string): string {
  if (relativePath.startsWith("assistant/workflows/")) {
    return path.join(
      root,
      relativePath.slice("assistant/workflows/".length),
    );
  }
  if (path.isAbsolute(relativePath)) {
    return relativePath;
  }
  return path.join(root, relativePath);
}
