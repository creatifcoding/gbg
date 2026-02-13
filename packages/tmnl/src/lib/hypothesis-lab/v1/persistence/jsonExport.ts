import { Effect } from 'effect';
import type { AuditEvent } from '../schemas';

/**
 * JSON export boundary for audit artifacts.
 *
 * This returns JSON/JSONL payloads that can be persisted by platform-specific adapters.
 */
export class JsonLedgerExport extends Effect.Service<JsonLedgerExport>()(
  'tmnl/hypothesis-lab/JsonLedgerExport',
  {
    sync: () => ({
      exportJson: (events: ReadonlyArray<AuditEvent>): Effect.Effect<string> =>
        Effect.sync(() => JSON.stringify(events, null, 2)).pipe(
          Effect.withSpan('HypothesisLab.JsonLedgerExport.exportJson')
        ),

      exportJsonl: (events: ReadonlyArray<AuditEvent>): Effect.Effect<string> =>
        Effect.sync(() => events.map((event) => JSON.stringify(event)).join('\n')).pipe(
          Effect.withSpan('HypothesisLab.JsonLedgerExport.exportJsonl')
        ),
    }),
  }
) {}
