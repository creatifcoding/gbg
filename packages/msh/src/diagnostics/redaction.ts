/** Safe redaction helpers for diagnostics output. */

import * as Cause from 'effect/Cause';

export const REDACTED = '<redacted>';

const jwtPattern = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g;
const nkeySeedPattern = /\bS[A-Z0-9]{20,}\b/g;
const bearerPattern = /\bBearer\s+[^\s,;]+/gi;
const tokenAssignmentPattern = /\b(token|jwt|seed|secret|password|authorization|creds?)\s*[:=]\s*[^\s,;]+/gi;
const sensitiveKeyPattern = /(token|jwt|seed|secret|password|authorization|authenticator|creds?|credential)/i;

export const redactString = (value: string): string =>
  value
    .replace(jwtPattern, REDACTED)
    .replace(nkeySeedPattern, REDACTED)
    .replace(bearerPattern, `Bearer ${REDACTED}`)
    .replace(tokenAssignmentPattern, (_match, key: string) => `${key}=${REDACTED}`);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const redactDiagnosticValue = (value: unknown, seen = new WeakSet<object>()): unknown => {
  if (typeof value === 'string') return redactString(value);
  if (typeof value !== 'object' || value === null) return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) return value.map((item) => redactDiagnosticValue(item, seen));
  if (!isPlainObject(value)) return redactString(String(value));

  const out: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    out[key] = sensitiveKeyPattern.test(key)
      ? REDACTED
      : redactDiagnosticValue(entry, seen);
  }
  return out;
};

export const redactCause = (cause: Cause.Cause<unknown>): string =>
  redactString(Cause.pretty(cause));
