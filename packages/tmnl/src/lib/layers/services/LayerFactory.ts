import * as Effect from 'effect/Effect';
import { IdGenerator } from './IdGenerator';
import { createLayerActor } from '../machines/layerMachine';
import type { LayerConfig, LayerInstance } from '../types';

/**
 * LayerFactory Service - Creates compliant layer instances
 *
 * Ensures all layers have:
 * - Unique IDs via IdGenerator
 * - XState machine actor
 * - z-index property (stored on layer)
 * - Resort closure (callback after z-index changes)
 * - Validated configuration
 */
export class LayerFactory extends Effect.Service<LayerFactory>()(
  'app/layers/LayerFactory',
  {
    effect: Effect.gen(function* () {
      const idGen = yield* IdGenerator;

      /**
       * Create a new layer instance from config
       *
       * @param config - Layer configuration
       * @param onResort - Closure called after layer is resorted (z-index changed)
       * @returns Effect that produces a LayerInstance
       */
      const createLayer = (
        config: LayerConfig,
        onResort?: (layer: LayerInstance) => Effect.Effect<void>
      ): Effect.Effect<LayerInstance, Error> =>
        Effect.gen(function* () {
          // Generate unique ID
          const id = idGen.generate();

          // Create state machine actor
          const machine = createLayerActor(
            config.visible === false ? 'hidden' : 'visible'
          );
          machine.start();

          // Build layer instance
          // NOTE: positionMode defaults to 'relative' for backward compatibility
          // TODO: Add validation for positionMode-specific requirements (e.g., parent context for absolute)
          const layer: LayerInstance = {
            id,
            name: config.name,
            zIndex: config.zIndex,
            visible: config.visible ?? true,
            opacity: config.opacity ?? 1,
            locked: config.locked ?? false,
            pointerEvents: config.pointerEvents ?? 'auto',
            // NOTE: 'relative' is default for backward compatibility with existing layers
            positionMode: config.positionMode ?? 'relative',
            // NOTE: captureClicks enables inner wrapper for pass-through click handling
            // TODO: Consider making this default to true for pass-through mode
            captureClicks: config.captureClicks ?? false,
            metadata: {
              ...config.metadata,
              // Store resort closure in metadata
              onResort: onResort
                ? (layer: LayerInstance) => Effect.runPromise(onResort(layer))
                : undefined,
            },
            machine,
          };

          // Validate configuration
          yield* validateLayer(layer);

          return layer;
        });

      /**
       * Validate layer configuration
       */
      const validateLayer = (
        layer: LayerInstance
      ): Effect.Effect<void, Error> =>
        Effect.gen(function* () {
          // Validate z-index range
          if (layer.zIndex < -1000 || layer.zIndex > 10000) {
            yield* Effect.fail(
              new Error(
                `Invalid z-index: ${layer.zIndex}. Must be between -1000 and 10000`
              )
            );
          }

          // Validate opacity range
          if (layer.opacity < 0 || layer.opacity > 1) {
            yield* Effect.fail(
              new Error(
                `Invalid opacity: ${layer.opacity}. Must be between 0 and 1`
              )
            );
          }

          // Validate name
          if (!layer.name || layer.name.trim() === '') {
            yield* Effect.fail(new Error('Layer name cannot be empty'));
          }
        });

      return {
        createLayer,
        validateLayer,
      } as const;
    }),
    dependencies: [IdGenerator.Default],
  }
) {}
