/**
 * @tmnl/pct/procedures — Procedure values and groups.
 *
 * The unit of authoring per `PCT.md` §5. A `Procedure` is a typed,
 * named, versioned operation; a `ProcedureGroup` is a record of them.
 *
 * @module @tmnl/pct/procedures
 */

export {
  ProcedureKind,
  isCacheable,
  isIdempotent,
  isStreaming,
} from "./ProcedureKind.js"

export {
  type Procedure,
  type ProcedureOptions,
  type SchemaType,
  type SchemaTypes,
  duplex,
  make,
  mutation,
  pure,
  query,
  schemaId,
  stream,
} from "./Procedure.js"

export {
  type ProcedureGroup,
  findByName,
  findBySchemaId,
  make as makeGroup,
  of as groupOf,
  toMap,
} from "./ProcedureGroup.js"

export {
  type ProcedureDocument,
  type ProcedureGroupDocument,
  fromDocument,
  fromGroupDocument,
  toDocument,
  toGroupDocument,
} from "./Document.js"
