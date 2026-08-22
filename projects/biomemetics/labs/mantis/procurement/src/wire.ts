import * as LnkContracts from '@tmnl/lnk/contracts';
import { SubjectRegistry } from '@tmnl/msh/subject';
import { isProcedure } from '@tmnl/pct/procedures';

/**
 * No published Pact procedure exists for the mantis procurement book.
 * Register/buy/receive/need/vendors still load through Start server fns
 * onto the local PGlite. Do not add fetch, EventSource, or a one-off bus.
 * New remote I/O goes through @tmnl/pct over @tmnl/msh and @tmnl/lnk.
 */
export const MANTIS_PROCUREMENT_PCT_CONTRACT = null;

export const wireStack = {
  pct: { isProcedure },
  msh: { SubjectRegistry },
  lnk: { Offset: LnkContracts.Offset },
  contract: MANTIS_PROCUREMENT_PCT_CONTRACT,
} as const;
