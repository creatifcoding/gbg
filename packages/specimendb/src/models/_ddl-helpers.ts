/**
 * DDL helpers. Tiny; CHECK constraints share the same literals as Effect Schema.
 * Shape mined from tmnl iiot `models/_ddl-helpers.ts`. Do not import tmnl.
 *
 * @module @tmnl/specimendb/models/_ddl-helpers
 */

export const enumValues = <T extends Record<string, string>>(
  values: T,
): readonly T[keyof T][] => Object.values(values) as unknown as readonly T[keyof T][]

export const sqlTextLiteral = (value: string): string => `'${value.replaceAll("'", "''")}'`

export const sqlTextLiteralList = (values: readonly string[]): string =>
  values.map(sqlTextLiteral).join(', ')
