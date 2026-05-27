type UnknownRecord = Record<PropertyKey, unknown>;

export function asRecord(value: unknown): UnknownRecord | undefined {
  return value !== null && typeof value === 'object' ? value as UnknownRecord : undefined;
}

export function messageOf(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  const record = asRecord(cause);
  const message = record?.message;
  return typeof message === 'string' ? message : String(cause);
}
