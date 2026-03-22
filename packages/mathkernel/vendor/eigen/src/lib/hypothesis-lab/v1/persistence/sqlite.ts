import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  truncateSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';
import { Effect, Schema } from 'effect';
import { AuditEvent as AuditEventSchema, type AuditEvent } from '../schemas';
import {
  SQLITE_LEDGER_FALLBACK_JSONL,
  SQLITE_LEDGER_FILENAME,
  SQLITE_LEDGER_ORDER_COLUMN,
  SQLITE_LEDGER_TABLE,
} from './sqliteLedgerConfig';

export class SqliteLedgerBootstrapError extends Schema.TaggedError<SqliteLedgerBootstrapError>()(
  'SqliteLedgerBootstrapError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  }
) {}

export class SqliteLedgerValidationError extends Schema.TaggedError<SqliteLedgerValidationError>()(
  'SqliteLedgerValidationError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  }
) {}

export class SqliteLedgerWriteError extends Schema.TaggedError<SqliteLedgerWriteError>()(
  'SqliteLedgerWriteError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  }
) {}

export class SqliteLedgerReadError extends Schema.TaggedError<SqliteLedgerReadError>()(
  'SqliteLedgerReadError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  }
) {}

export class SqliteLedgerDecodeError extends Schema.TaggedError<SqliteLedgerDecodeError>()(
  'SqliteLedgerDecodeError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  }
) {}

export class SqliteLedgerResetError extends Schema.TaggedError<SqliteLedgerResetError>()(
  'SqliteLedgerResetError',
  {
    message: Schema.String,
    cause: Schema.optional(Schema.Defect),
  }
) {}

type StorageMode = 'sqlite-bun' | 'jsonl-fallback';

interface LedgerAdapter {
  readonly mode: StorageMode;
  readonly append: (event: AuditEvent) => Effect.Effect<void, unknown>;
  readonly readAll: () => Effect.Effect<ReadonlyArray<AuditEvent>, unknown>;
  readonly clear: () => Effect.Effect<void, unknown>;
}

interface BunDatabase {
  exec(sql: string): void;
  query(sql: string): {
    run(...params: ReadonlyArray<unknown>): unknown;
    all(...params: ReadonlyArray<unknown>): ReadonlyArray<unknown>;
  };
  close?: () => void;
}

const decodeAuditEvent = Schema.decodeUnknown(AuditEventSchema);

const isBunRuntime = (): boolean =>
  typeof globalThis === 'object' &&
  globalThis !== null &&
  typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined';

const ensureParentDirectory = (filePath: string): void => {
  const directory = dirname(filePath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
};

const normalizeSqliteRow = (row: unknown): string => {
  if (typeof row === 'string') {
    return row;
  }

  if (Array.isArray(row) && typeof row[0] === 'string') {
    return row[0];
  }

  if (row !== null && typeof row === 'object') {
    const candidate = row as { payloadJson?: unknown; payload_json?: unknown; 0?: unknown };
    if (typeof candidate.payloadJson === 'string') {
      return candidate.payloadJson;
    }
    if (typeof candidate.payload_json === 'string') {
      return candidate.payload_json;
    }
    if (typeof candidate[0] === 'string') {
      return candidate[0];
    }
  }

  throw new SqliteLedgerDecodeError({
    message: 'Unexpected SQLite row shape while decoding payload_json.',
    cause: row,
  });
};

const decodePersistedEvent = (payloadJson: string) =>
  Effect.try({
    try: () => JSON.parse(payloadJson),
    catch: (cause) =>
      new SqliteLedgerDecodeError({
        message: 'Failed to parse persisted audit event payload JSON.',
        cause,
      }),
  }).pipe(
    Effect.flatMap((decoded) =>
      decodeAuditEvent(decoded).pipe(
        Effect.mapError(
          (cause) =>
            new SqliteLedgerDecodeError({
              message: 'Persisted audit event failed AuditEvent schema decode.',
              cause,
            })
        )
      )
    )
  );

const makeJsonlFallbackAdapter = (): LedgerAdapter => {
  ensureParentDirectory(SQLITE_LEDGER_FALLBACK_JSONL);
  if (!existsSync(SQLITE_LEDGER_FALLBACK_JSONL)) {
    writeFileSync(SQLITE_LEDGER_FALLBACK_JSONL, '');
  }

  const append = (event: AuditEvent) =>
    Effect.gen(function* () {
      const validatedEvent = yield* decodeAuditEvent(event).pipe(
        Effect.mapError(
          (cause) =>
            new SqliteLedgerValidationError({
              message: 'Rejected append: payload did not satisfy AuditEvent schema.',
              cause,
            })
        )
      );

      const payload = JSON.stringify(validatedEvent);
      appendFileSync(SQLITE_LEDGER_FALLBACK_JSONL, `${payload}\n`, { encoding: 'utf-8' });
    }).pipe(
      Effect.mapError((cause) =>
        cause instanceof SqliteLedgerValidationError
          ? cause
          : new SqliteLedgerWriteError({
              message: `Failed to append event into JSONL fallback ledger (${SQLITE_LEDGER_FALLBACK_JSONL}).`,
              cause,
            })
      ),
      Effect.withSpan('HypothesisLab.SqliteLedgerStore.appendFallback')
    );

  const readAll = () =>
    Effect.gen(function* () {
      if (!existsSync(SQLITE_LEDGER_FALLBACK_JSONL)) {
        return [] as const;
      }

      const raw = readFileSync(SQLITE_LEDGER_FALLBACK_JSONL, 'utf-8');
      const lines = raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      return yield* Effect.forEach(lines, decodePersistedEvent, { concurrency: 1 });
    }).pipe(
      Effect.mapError(
        (cause) =>
          new SqliteLedgerReadError({
            message: `Failed to read JSONL fallback ledger (${SQLITE_LEDGER_FALLBACK_JSONL}).`,
            cause,
          })
      ),
      Effect.withSpan('HypothesisLab.SqliteLedgerStore.readAllFallback')
    );

  const clear = () =>
    Effect.try({
      try: () => {
        ensureParentDirectory(SQLITE_LEDGER_FALLBACK_JSONL);
        truncateSync(SQLITE_LEDGER_FALLBACK_JSONL, 0);
      },
      catch: (cause) =>
        new SqliteLedgerResetError({
          message: `Failed to reset JSONL fallback ledger (${SQLITE_LEDGER_FALLBACK_JSONL}).`,
          cause,
        }),
    }).pipe(Effect.withSpan('HypothesisLab.SqliteLedgerStore.clearFallback'));

  return {
    mode: 'jsonl-fallback',
    append,
    readAll,
    clear,
  };
};

const makeBunSqliteAdapter = (): Effect.Effect<LedgerAdapter, SqliteLedgerBootstrapError> =>
  Effect.tryPromise({
    try: async () => {
      ensureParentDirectory(SQLITE_LEDGER_FILENAME);
      const sqliteSpecifier: string = 'bun' + ':sqlite';
      const sqliteModule = await import(sqliteSpecifier);
      const Database = (sqliteModule as { Database: new (path: string) => BunDatabase }).Database;
      const db = new Database(SQLITE_LEDGER_FILENAME);

      db.exec(`
        CREATE TABLE IF NOT EXISTS ${SQLITE_LEDGER_TABLE} (
          ${SQLITE_LEDGER_ORDER_COLUMN} INTEGER PRIMARY KEY AUTOINCREMENT,
          run_id TEXT NOT NULL,
          event_type TEXT NOT NULL,
          event_timestamp INTEGER NOT NULL,
          payload_json TEXT NOT NULL,
          inserted_at_ms INTEGER NOT NULL
        )
      `);

      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_hypothesis_lab_audit_ledger_run_seq
        ON ${SQLITE_LEDGER_TABLE} (run_id, ${SQLITE_LEDGER_ORDER_COLUMN})
      `);

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS hypothesis_lab_audit_ledger_no_update
        BEFORE UPDATE ON ${SQLITE_LEDGER_TABLE}
        BEGIN
          SELECT RAISE(ABORT, 'append-only ledger: updates are forbidden');
        END;
      `);

      db.exec(`
        CREATE TRIGGER IF NOT EXISTS hypothesis_lab_audit_ledger_no_delete
        BEFORE DELETE ON ${SQLITE_LEDGER_TABLE}
        BEGIN
          SELECT RAISE(ABORT, 'append-only ledger: deletes are forbidden');
        END;
      `);

      const append = (event: AuditEvent) =>
        Effect.gen(function* () {
          const validatedEvent = yield* decodeAuditEvent(event).pipe(
            Effect.mapError(
              (cause) =>
                new SqliteLedgerValidationError({
                  message: 'Rejected append: payload did not satisfy AuditEvent schema.',
                  cause,
                })
            )
          );

          const payloadJson = JSON.stringify(validatedEvent);
          db.query(
            `INSERT INTO ${SQLITE_LEDGER_TABLE} (run_id, event_type, event_timestamp, payload_json, inserted_at_ms)
             VALUES (?, ?, ?, ?, ?)`
          ).run(
            validatedEvent.runId,
            validatedEvent._tag,
            validatedEvent.timestamp,
            payloadJson,
            Date.now()
          );
        }).pipe(
          Effect.mapError((cause) =>
            cause instanceof SqliteLedgerValidationError
              ? cause
              : new SqliteLedgerWriteError({
                  message: `Failed to append event into SQLite ledger (${SQLITE_LEDGER_FILENAME}).`,
                  cause,
                })
          ),
          Effect.withSpan('HypothesisLab.SqliteLedgerStore.appendSqlite')
        );

      const readAll = () =>
        Effect.gen(function* () {
          const rows = db
            .query(
              `SELECT payload_json AS payloadJson
               FROM ${SQLITE_LEDGER_TABLE}
               ORDER BY ${SQLITE_LEDGER_ORDER_COLUMN} ASC`
            )
            .all();

          return yield* Effect.forEach(rows, (row) => decodePersistedEvent(normalizeSqliteRow(row)), {
            concurrency: 1,
          });
        }).pipe(
          Effect.mapError(
            (cause) =>
              new SqliteLedgerReadError({
                message: `Failed to read SQLite ledger ordered by ${SQLITE_LEDGER_ORDER_COLUMN}.`,
                cause,
              })
          ),
          Effect.withSpan('HypothesisLab.SqliteLedgerStore.readAllSqlite')
        );

      const clear = () =>
        Effect.try({
          try: () => {
            db.exec(`DROP TABLE IF EXISTS ${SQLITE_LEDGER_TABLE}`);
            db.exec(`
              CREATE TABLE IF NOT EXISTS ${SQLITE_LEDGER_TABLE} (
                ${SQLITE_LEDGER_ORDER_COLUMN} INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                event_timestamp INTEGER NOT NULL,
                payload_json TEXT NOT NULL,
                inserted_at_ms INTEGER NOT NULL
              )
            `);
          },
          catch: (cause) =>
            new SqliteLedgerResetError({
              message: `Failed to reset SQLite ledger (${SQLITE_LEDGER_FILENAME}).`,
              cause,
            }),
        }).pipe(Effect.withSpan('HypothesisLab.SqliteLedgerStore.clearSqlite'));

      return {
        mode: 'sqlite-bun' as const,
        append,
        readAll,
        clear,
      };
    },
    catch: (cause) =>
      new SqliteLedgerBootstrapError({
        message: `Failed to bootstrap SQLite ledger at ${SQLITE_LEDGER_FILENAME}.`,
        cause,
      }),
  });

export class SqliteLedgerStore extends Effect.Service<SqliteLedgerStore>()(
  'tmnl/hypothesis-lab/SqliteLedgerStore',
  {
    effect: Effect.gen(function* () {
      const adapter = isBunRuntime()
        ? yield* makeBunSqliteAdapter().pipe(
            Effect.catchAll(() => Effect.succeed(makeJsonlFallbackAdapter()))
          )
        : makeJsonlFallbackAdapter();

      yield* Effect.annotateCurrentSpan({
        ledgerStorageMode: adapter.mode,
        sqlitePath: SQLITE_LEDGER_FILENAME,
        fallbackPath: SQLITE_LEDGER_FALLBACK_JSONL,
      });

      return {
        append: adapter.append,
        readAll: adapter.readAll,
        clear: adapter.clear,
      } as const;
    }),
  }
) {}
