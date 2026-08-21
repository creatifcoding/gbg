/**
 * Per-test Postgres catalog. Real Postgres, not PGlite, not DuckDB.
 * Default: postgres://specimendb:specimendb@127.0.0.1:5432/specimendb
 * Override with SPECIMENDB_PG_URL.
 */

import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import * as Effect from 'effect/Effect';
import { layer } from '../src/layers.js';

export const catalogAdminUrl =
  process.env['SPECIMENDB_PG_URL'] ??
  'postgres://specimendb:specimendb@127.0.0.1:5432/specimendb';

const dbUrl = (name: string): string => {
  const url = new URL(catalogAdminUrl);
  url.pathname = `/${name}`;
  return url.toString();
};

const ident = (name: string): string => {
  if (!/^s_[a-f0-9]{8,32}$/.test(name)) {
    throw new Error(`refusing to create database ${name}`);
  }
  return name;
};

export const runCatalog = async <A>(
  assetsRoot: string,
  program: Effect.Effect<A, unknown, never>,
): Promise<A> => {
  const name = ident(`s_${randomUUID().replaceAll('-', '').slice(0, 16)}`);
  const admin = new Client({ connectionString: catalogAdminUrl });
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE ${name}`);
  } finally {
    await admin.end();
  }
  try {
    return await Effect.runPromise(
      Effect.scoped(program).pipe(
        Effect.provide(
          layer({
            url: dbUrl(name),
            assetsRoot,
          }),
        ),
      ) as Effect.Effect<A>,
    );
  } finally {
    const drop = new Client({ connectionString: catalogAdminUrl });
    await drop.connect();
    try {
      await drop.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    } finally {
      await drop.end();
    }
  }
};
