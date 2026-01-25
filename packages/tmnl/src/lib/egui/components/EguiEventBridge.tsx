import { useCallback } from 'react';
import type { EguiEvent } from '../schemas';
import { publishEguiEvents, useEguiEventStream } from '../eventBus';
import { eguiRegistry } from '../registry';
import { EguiCanvas, type EguiCanvasProps } from './EguiCanvas';
import type { Registry as AtomRegistry } from '@effect-atom/atom/Registry';

export type EguiEventBridgeProps = EguiCanvasProps & {
  registry?: AtomRegistry;
};

export function EguiEventBridge({
  onEvents,
  registry = eguiRegistry,
  ...props
}: EguiEventBridgeProps) {
  useEguiEventStream(registry);

  const handleEvents = useCallback(
    (events: readonly EguiEvent[]) => {
      publishEguiEvents(events);
      onEvents?.(events);
    },
    [onEvents]
  );

  return <EguiCanvas {...props} onEvents={handleEvents} />;
}
