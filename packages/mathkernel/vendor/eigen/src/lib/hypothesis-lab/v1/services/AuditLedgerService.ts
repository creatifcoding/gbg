import { Effect } from 'effect';
import type { AuditEvent } from '../schemas';
import { LedgerPersistenceError } from '../errors';
import { SqliteLedgerStore } from '../persistence/sqlite';
import { JsonLedgerExport } from '../persistence/jsonExport';

export class AuditLedgerService extends Effect.Service<AuditLedgerService>()(
  'tmnl/hypothesis-lab/AuditLedgerService',
  {
    dependencies: [SqliteLedgerStore.Default, JsonLedgerExport.Default],
    effect: Effect.gen(function* () {
      const sqlite = yield* SqliteLedgerStore;
      const exporter = yield* JsonLedgerExport;

      const append = (event: AuditEvent) =>
        sqlite.append(event).pipe(
          Effect.mapError(
            (cause) =>
              new LedgerPersistenceError({
                message: 'Failed to append event to SQLite ledger store.',
                cause,
              })
          ),
          Effect.withSpan('HypothesisLab.AuditLedger.append')
        );

      const appendMany = (events: ReadonlyArray<AuditEvent>) =>
        Effect.forEach(events, append, { concurrency: 1, discard: true }).pipe(
          Effect.withSpan('HypothesisLab.AuditLedger.appendMany')
        );

      const exportJson = (events: ReadonlyArray<AuditEvent>) =>
        exporter.exportJson(events).pipe(
          Effect.mapError(
            (cause) =>
              new LedgerPersistenceError({
                message: 'Failed to export audit ledger JSON payload.',
                cause,
              })
          )
        );

      const exportJsonl = (events: ReadonlyArray<AuditEvent>) =>
        exporter.exportJsonl(events).pipe(
          Effect.mapError(
            (cause) =>
              new LedgerPersistenceError({
                message: 'Failed to export audit ledger JSONL payload.',
                cause,
              })
          )
        );

      const readPersisted = () => sqlite.readAll();

      return {
        append,
        appendMany,
        exportJson,
        exportJsonl,
        readPersisted,
      } as const;
    }),
  }
) {}
