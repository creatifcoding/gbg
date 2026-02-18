/**
 * MorphChat Atom Registry
 *
 * Dedicated global registry for MorphChat atoms.
 * Keeps MorphChat state isolated from MorphCard and other registries.
 *
 * Pattern: same as morph-card/atoms/registry.ts
 *
 * @module morphchat/atoms/registry
 */

import * as React from 'react'
import { Registry, RegistryContext } from '@effect-atom/atom-react'

/** Dedicated registry for all MorphChat atoms */
export const morphChatRegistry = Registry.make()

/**
 * Provider component — wrap any subtree that uses MorphChat.
 *
 * ```tsx
 * <MorphChatRegistryProvider>
 *   <MorphChat.Surface spec={...} adapter={...} />
 * </MorphChatRegistryProvider>
 * ```
 */
export function MorphChatRegistryProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return React.createElement(
    RegistryContext.Provider,
    { value: morphChatRegistry },
    children,
  )
}
