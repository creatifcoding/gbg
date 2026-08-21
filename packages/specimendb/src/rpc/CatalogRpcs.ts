/**
 * Entity / component RPC. Attach and MintActivity are systems: they iterate
 * components and write new ones. Extra lab systems (Export / Project / Doctor /
 * AppendActivity) live on SpecimenRpcs — same RpcGroup as Intake.
 *
 * @module @tmnl/specimendb/rpc/CatalogRpcs
 */

import * as Schema from 'effect/Schema';
import * as Rpc from 'effect/unstable/rpc/Rpc';
import * as RpcGroup from 'effect/unstable/rpc/RpcGroup';
import { Component } from '../schemas/components.js';
import { CatalogError, EntityNotFoundError } from '../schemas/errors.js';
import {
  AttachPayload,
  CatalogRecord,
  GetComponentsPayload,
  GetEntityPayload,
  ListEntitiesPayload,
  MintActivityPayload,
  MintEntityPayload,
} from '../schemas/entity.js';
import {
  AttachTag,
  GetComponentsTag,
  GetEntityTag,
  ListEntitiesTag,
  MintActivityTag,
  MintEntityTag,
} from '../tags.js';

export const GetEntity = Rpc.make(GetEntityTag, {
  payload: GetEntityPayload,
  success: CatalogRecord,
  error: Schema.Union([CatalogError, EntityNotFoundError]),
});

export const ListEntities = Rpc.make(ListEntitiesTag, {
  payload: ListEntitiesPayload,
  success: Schema.Array(CatalogRecord),
  error: CatalogError,
});

export const GetComponents = Rpc.make(GetComponentsTag, {
  payload: GetComponentsPayload,
  success: Schema.Array(Component),
  error: Schema.Union([CatalogError, EntityNotFoundError]),
});

export const Attach = Rpc.make(AttachTag, {
  payload: AttachPayload,
  success: CatalogRecord,
  error: Schema.Union([CatalogError, EntityNotFoundError]),
});

export const MintEntity = Rpc.make(MintEntityTag, {
  payload: MintEntityPayload,
  success: CatalogRecord,
  error: Schema.Union([CatalogError, EntityNotFoundError]),
});

export const MintActivity = Rpc.make(MintActivityTag, {
  payload: MintActivityPayload,
  success: CatalogRecord,
  error: Schema.Union([CatalogError, EntityNotFoundError]),
});

export class CatalogRpcs extends RpcGroup.make(
  GetEntity,
  ListEntities,
  GetComponents,
  Attach,
  MintEntity,
  MintActivity,
) {}
