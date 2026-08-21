/**
 * Test helper: catalog layer plus SqlClient / EntityState in the test program
 * (production `layer()` does not leak SqlClient — #91).
 */

import * as Layer from 'effect/Layer';
import { CatalogStateLive, layer } from '../src/layers.js';
import { CatalogSqlLive, catalogPgFromEnv } from '../src/repos/pg.js';
import { CatalogConfigLayer } from '../src/schemas/config.js';

export const testCatalogLayer = (assetsRoot: string) => {
  const config = { pg: catalogPgFromEnv(), assetsRoot };
  const sql = CatalogSqlLive.pipe(Layer.provide(CatalogConfigLayer(config)));
  return Layer.mergeAll(
    layer(config),
    CatalogStateLive.pipe(Layer.provide(sql)),
    sql,
  );
};
