/** Object resolver error normalization. */

import { SuiObjectLoadError, SuiSchemaDecodeError, SuiTransportError, type SuiObjectErrorCode } from '../schema';
import type { SuiObjectResolveRequest } from '../services';

const objectErrorCodes = new Set<string>([
  'notExists',
  'dynamicFieldNotFound',
  'deleted',
  'displayError',
  'stale',
  'unknown',
]);

export const normalizeObjectResolveError = (
  request: SuiObjectResolveRequest,
  cause: unknown,
): SuiObjectLoadError | SuiTransportError | SuiSchemaDecodeError => {
  if (
    cause instanceof SuiObjectLoadError ||
    cause instanceof SuiTransportError ||
    cause instanceof SuiSchemaDecodeError
  ) {
    return cause;
  }

  const code = objectErrorCode(cause);
  if (code) {
    return new SuiObjectLoadError({
      code,
      message: messageOf(cause),
      objectId: request.id,
      cause,
    });
  }

  return new SuiTransportError({
    transport: 'unknown',
    message: messageOf(cause),
    cause,
  });
};

function objectErrorCode(cause: unknown): SuiObjectErrorCode | undefined {
  const code = cause !== null && typeof cause === 'object'
    ? (cause as { readonly code?: unknown }).code
    : undefined;
  return typeof code === 'string' && objectErrorCodes.has(code) ? code as SuiObjectErrorCode : undefined;
}

function messageOf(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (cause !== null && typeof cause === 'object') {
    const message = (cause as { readonly message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(cause);
}
