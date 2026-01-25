/**
 * AnimeJS Auto-Layout Schema
 *
 * Typed selectors for auto-layout targets used by the MorphCard testbed.
 *
 * @module morph-card/schemas/anime-layout
 */

import { Schema } from 'effect';

export const AnimeLayoutTarget = Schema.Literal(
  'tmnl-layout-accordion',
  'tmnl-layout-nav',
  'tmnl-layout-periodic',
  'tmnl-layout-planets',
  'tmnl-layout-todo',
  'tmnl-layout-code',
  'tmnl-layout-rgb'
);

export type AnimeLayoutTarget = Schema.Schema.Type<typeof AnimeLayoutTarget>;

