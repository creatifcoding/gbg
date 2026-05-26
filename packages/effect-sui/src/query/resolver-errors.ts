/** Object resolver error normalization. */

import { SuiObjectLoadError, SuiSchemaDecodeError, SuiTransportError } from '../schema';
import type { SuiObjectResolveRequest } from '../services';

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

  return new SuiObjectLoadError({
    code: 'unknown',
    message: cause instanceof Error ? cause.message : String(cause),
    objectId: request.id,
    cause,
  });
};
