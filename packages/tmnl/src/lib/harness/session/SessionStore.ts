import { Context, Effect } from 'effect'

import {
  HarnessSessionStore,
  HarnessSessionStoreError,
  type HarnessSessionStoreShape,
} from '../HarnessSessionStore'
import type { HarnessSessionId } from '../schemas'
import type { HarnessSessionMeta, HarnessSessionMetaPatch } from './schemas'

export interface HarnessSessionStoreExtendedShape extends HarnessSessionStoreShape {
  readonly listSessions: () => Effect.Effect<ReadonlyArray<HarnessSessionMeta>, HarnessSessionStoreError>
  readonly updateMeta: (
    sessionId: HarnessSessionId,
    partial: HarnessSessionMetaPatch,
  ) => Effect.Effect<void, HarnessSessionStoreError>
}

export const HarnessSessionStoreExtended = Context.GenericTag<HarnessSessionStoreExtendedShape>(
  'tmnl/harness/SessionStoreExtended',
)

export {
  HarnessSessionStore,
  HarnessSessionStoreError,
  type HarnessSessionStoreShape,
}
