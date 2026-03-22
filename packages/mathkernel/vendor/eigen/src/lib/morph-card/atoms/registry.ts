/**
 * MorphCard Registry
 *
 * Dedicated global registry for MorphCard atoms.
 * Keep MorphCard state isolated from other registries.
 */

import * as React from 'react';
import { Registry, RegistryContext } from '@effect-atom/atom-react';

export const morphCardRegistry = Registry.make();

export function MorphCardRegistryProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return React.createElement(
    RegistryContext.Provider,
    { value: morphCardRegistry },
    children
  );
}

