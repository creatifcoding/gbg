import * as React from 'react';
import { useEffect, useRef, type CSSProperties } from 'react';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { LayerFactory } from './services/LayerFactory';
import { LayerManager } from './services/LayerManager';
import { IdGenerator } from './services/IdGenerator';
import type { LayerConfig, LayerInstance, PositionMode } from './types';

/**
 * withLayering HOC
 *
 * Wraps a component and registers it as a layer in the layer system
 * Automatically manages layer lifecycle (creation, registration, cleanup)
 *
 * NOTE: This HOC creates a wrapper div that applies layer styles
 * NOTE: For pass-through mode, use captureClicks: true to enable click handling on children
 *
 * TODO: Add support for layer state synchronization via atoms
 * TODO: Implement dynamic z-index updates from LayerManager
 *
 * @param Component - React component to wrap
 * @param config - Layer configuration
 * @returns Wrapped component with layer management
 */
export function withLayering<P extends object>(
  Component: React.ComponentType<P>,
  config: LayerConfig
) {
  return function LayerWrapper(props: P) {
    const layerIdRef = useRef<string | null>(null);
    const cleanupRef = useRef<(() => void) | null>(null);

    // Create layer on mount
    useEffect(() => {
      // NOTE: Build the full service layer for Effect execution
      // TODO: Consider caching/reusing the runtime for performance
      const serviceLayer = Layer.mergeAll(
        IdGenerator.Default,
        LayerFactory.Default,
        LayerManager.Default
      );

      // Create the Effect program for layer creation and registration
      const createLayerProgram = Effect.gen(function* () {
        const factory = yield* LayerFactory;
        const manager = yield* LayerManager;

        // Create layer with optional onResort closure
        const layer = yield* factory.createLayer(
          config,
          (layer: LayerInstance) =>
            Effect.gen(function* () {
              // Custom resort logic can be added here
              // TODO: Implement visual feedback for resort events
              yield* Effect.log(
                `Layer ${layer.name} resorted to z-index ${layer.zIndex}`
              );
            })
        );

        // Register layer
        yield* manager.addLayer(layer);
        return layer.id;
      });

      // NOTE: Execute with proper Layer provision
      // TODO: Use a more robust Effect runtime integration pattern
      const program = Effect.gen(function* () {
        // Run the layer creation program
        const layerId = yield* createLayerProgram;
        layerIdRef.current = layerId;

        // Return cleanup function
        return () => {
          // NOTE: Cleanup runs the remove layer effect
          // TODO: Ensure machine.stop() is called in LayerManager.removeLayer
          const removeProgram = Effect.gen(function* () {
            const manager = yield* LayerManager;
            yield* manager.removeLayer(layerId);
          });

          Effect.runPromise(Effect.provide(removeProgram, serviceLayer)).catch(
            console.error
          );
        };
      });

      Effect.runPromise(Effect.provide(program, serviceLayer))
        .then((cleanup) => {
          cleanupRef.current = cleanup;
        })
        .catch(console.error);

      // Cleanup function
      return () => {
        if (cleanupRef.current) {
          cleanupRef.current();
          cleanupRef.current = null;
        }
      };
    }, []);

    // Calculate position styles based on positionMode
    // NOTE: 'relative' is default for backward compatibility
    const positionStyle = getPositionStyle(config.positionMode ?? 'relative');

    // Calculate pointer-events style
    // NOTE: pass-through sets container to none, but captureClicks adds inner wrapper
    const pointerEventsStyle = getPointerEventsStyle(config.pointerEvents);

    // Calculate visibility/opacity styles
    const visibilityStyle: CSSProperties = {
      opacity: config.visible === false ? 0 : 1,
    };

    // Combine all styles for outer wrapper
    const wrapperStyle: CSSProperties = {
      ...positionStyle,
      zIndex: config.zIndex,
      ...visibilityStyle,
      ...pointerEventsStyle.outer,
    };

    // Determine if we need an inner click-capture wrapper
    // NOTE: This is the hotfix for pass-through click handling
    // When pointerEvents is 'pass-through' and captureClicks is true,
    // we wrap children in a div with pointer-events: auto
    const needsClickCapture =
      config.pointerEvents === 'pass-through' && config.captureClicks === true;

    return (
      <div
        style={wrapperStyle}
        data-layer-id={layerIdRef.current}
        data-layer-name={config.name}
        data-layer-position={config.positionMode ?? 'relative'}
      >
        {needsClickCapture ? (
          // Inner wrapper to capture clicks in pass-through mode
          // NOTE: This div restores pointer-events for children
          // TODO: Consider making this configurable (e.g., specific areas only)
          <div style={pointerEventsStyle.inner}>{<Component {...props} />}</div>
        ) : (
          <Component {...props} />
        )}
      </div>
    );
  };
}

/**
 * Get CSS position styles for a given position mode
 *
 * NOTE: Each mode has different coordinate system implications
 * TODO: Add inset/offset properties for fine-grained positioning
 *
 * @param mode - Position mode
 * @returns CSSProperties for position
 */
function getPositionStyle(mode: PositionMode): CSSProperties {
  switch (mode) {
    case 'fixed':
      // NOTE: Fixed positioning is relative to viewport
      // TODO: Add support for inset values (top, right, bottom, left)
      return {
        position: 'fixed',
        // Default to full viewport for fixed layers
        // NOTE: Can be overridden by component styles
        inset: 0,
      };

    case 'absolute':
      // NOTE: Absolute positioning is relative to nearest positioned ancestor
      // TODO: Add warning if no positioned ancestor exists
      return {
        position: 'absolute',
      };

    case 'sticky':
      // NOTE: Sticky is hybrid - relative until scroll threshold
      // TODO: Add support for scroll threshold configuration
      return {
        position: 'sticky',
      };

    case 'relative':
    default:
      // NOTE: Relative is the default for backward compatibility
      return {
        position: 'relative',
      };
  }
}

/**
 * Get pointer-events styles for outer wrapper and optional inner wrapper
 *
 * NOTE: This is the key fix for click event handling in pass-through mode
 *
 * The pass-through pattern:
 * - Outer wrapper: pointer-events: none (events pass through the container)
 * - Inner wrapper: pointer-events: auto (children can still receive events)
 *
 * TODO: Consider adding 'capture' mode that captures events before children
 *
 * @param behavior - Pointer events behavior
 * @returns Object with outer and inner CSSProperties
 */
function getPointerEventsStyle(behavior: LayerConfig['pointerEvents']): {
  outer: CSSProperties;
  inner: CSSProperties;
} {
  switch (behavior) {
    case 'none':
      // Layer ignores all pointer events
      return {
        outer: { pointerEvents: 'none' },
        inner: { pointerEvents: 'none' }, // Children also ignore
      };

    case 'pass-through':
      // Container passes through, children can capture
      // NOTE: Inner wrapper is only rendered if captureClicks is true
      return {
        outer: { pointerEvents: 'none' },
        inner: { pointerEvents: 'auto' }, // Children can capture events
      };

    case 'auto':
    default:
      // Layer captures all pointer events (default)
      return {
        outer: { pointerEvents: 'auto' },
        inner: { pointerEvents: 'auto' },
      };
  }
}

/**
 * Export type for external use
 *
 * NOTE: This allows consumers to type their layer configurations
 */
export type { LayerConfig };
