import { createHash } from "node:crypto";

export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) => {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      const obj = v as Record<string, unknown>;
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(obj).sort()) {
        sorted[key] = obj[key];
      }
      return sorted;
    }
    return v;
  });
}

export function sha256Hex(payload: string | Uint8Array): string {
  return createHash("sha256").update(payload).digest("hex");
}

/** A3 content digest: sha256 of canonical JSON with `digest` omitted. */
export function contentDigest(definition: Record<string, unknown>): string {
  const { digest: _omit, ...rest } = definition;
  return sha256Hex(canonicalJson(rest));
}

export function signatureDigest(parts: {
  readonly admissionId: string;
  readonly digest: string;
  readonly reviewer: string;
  readonly admittedAt: string;
}): string {
  return sha256Hex(
    `${parts.admissionId}|${parts.digest}|${parts.reviewer}|${parts.admittedAt}`,
  );
}
