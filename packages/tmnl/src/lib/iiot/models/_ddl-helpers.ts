/**
 * DDL generation helpers.
 *
 * These helpers are intentionally tiny and only accept internal compile-time
 * literals. They let DDL CHECK constraints share the same value constants as
 * Effect Schema literals without depending on private Schema AST internals.
 *
 * @module
 */

export const enumValues = <T extends Record<string, string>>(values: T): readonly T[keyof T][] =>
  Object.values(values) as readonly T[keyof T][]

export const sqlTextLiteral = (value: string): string =>
  `'${value.replaceAll("'", "''")}'`

export const sqlTextLiteralList = (values: readonly string[]): string =>
  values.map(sqlTextLiteral).join(', ')
