import * as React from 'react';
import { Registry, RegistryContext } from '@effect-atom/atom-react';

export const eguiRegistry = Registry.make();

export function EguiEventProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return React.createElement(
    RegistryContext.Provider,
    { value: eguiRegistry },
    children
  );
}
