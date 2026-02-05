/**
 * Conductor Registry
 *
 * Dedicated global registry for conductor atoms.
 * Isolated from MorphCard/Terminal registries.
 */

import * as React from 'react'
import { Registry, RegistryContext } from '@effect-atom/atom-react'

export const conductorRegistry = Registry.make()

export function ConductorRegistryProvider({
  children,
}: {
  children: React.ReactNode
}): React.ReactElement {
  return React.createElement(
    RegistryContext.Provider,
    { value: conductorRegistry },
    children,
  )
}
