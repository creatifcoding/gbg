/**
 * Transfer v2 — Atom Registry
 *
 * Module-level registry for transfer atoms. Follows the codebase pattern
 * (morph-card, conductor, etc.) of Registry.make() + RegistryContext.Provider.
 *
 * @since v2
 */
import { createElement, type ReactNode } from 'react'
import { Registry } from '@effect-atom/atom'
import { RegistryContext } from '@effect-atom/atom-react'

export const transferRegistry = Registry.make()

export function TransferRegistryProvider({ children }: { children: ReactNode }) {
  return createElement(RegistryContext.Provider, { value: transferRegistry }, children)
}
