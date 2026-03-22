/**
 * Panel System Service
 *
 * Pure Effect service for panel validation and business logic.
 * Does NOT directly manipulate atoms - that's done via operation atoms.
 */

import { Effect } from 'effect';
import type {
  PanelId,
  LayoutId,
  PanelConfig,
  PanelGroupConfig,
  LayoutConfig,
  PanelState,
  PanelType,
  PanelDirection,
} from './types';

export class PanelService extends Effect.Service<PanelService>()(
  'tmnl/panels/PanelService',
  {
    effect: Effect.gen(function* () {
      /**
       * Validate panel configuration
       */
      const validatePanel = (config: PanelConfig) =>
        Effect.gen(function* () {
          if (config.minSize !== null && config.maxSize !== null) {
            if (config.minSize > config.maxSize) {
              return yield* Effect.fail(
                new Error('minSize must be <= maxSize')
              );
            }
          }

          if (
            config.defaultSize !== null &&
            config.minSize !== null &&
            config.defaultSize < config.minSize
          ) {
            return yield* Effect.fail(
              new Error('defaultSize must be >= minSize')
            );
          }

          if (
            config.defaultSize !== null &&
            config.maxSize !== null &&
            config.defaultSize > config.maxSize
          ) {
            return yield* Effect.fail(
              new Error('defaultSize must be <= maxSize')
            );
          }

          return config;
        });

      /**
       * Validate layout configuration
       */
      const validateLayout = (layout: LayoutConfig) =>
        Effect.gen(function* () {
          const groupIds = new Set(layout.groups.map((g) => g.id));

          if (!groupIds.has(layout.rootGroup)) {
            return yield* Effect.fail(
              new Error(`Root group ${layout.rootGroup} not found in groups`)
            );
          }

          for (const group of layout.groups) {
            for (const panelId of group.panels) {
              const panelExists = layout.panels.some((p) => p.id === panelId);
              if (!panelExists) {
                return yield* Effect.fail(
                  new Error(
                    `Panel ${panelId} referenced in group ${group.id} not found`
                  )
                );
              }
            }
          }

          return layout;
        });

      const createDefaultPanel = (
        id: PanelId,
        type: PanelType,
        title: string | null = null
      ): PanelConfig => ({
        _tag: 'PanelConfig',
        id,
        type,
        title,
        defaultSize: null,
        minSize: null,
        maxSize: null,
        collapsible: true,
        collapsed: false,
        metadata: null,
      });

      const createDefaultGroup = (
        id: string,
        direction: PanelDirection,
        panels: PanelId[]
      ): PanelGroupConfig => ({
        _tag: 'PanelGroupConfig',
        id,
        direction,
        panels,
        autoSaveId: null,
      });

      const createDefaultLayout = (
        id: LayoutId,
        name: string,
        groups: PanelGroupConfig[],
        panels: PanelConfig[]
      ): LayoutConfig => {
        const now = new Date();
        return {
          _tag: 'LayoutConfig',
          id,
          name,
          description: null,
          rootGroup: groups[0]?.id ?? 'root',
          groups,
          panels,
          createdAt: now,
          updatedAt: now,
        };
      };

      const createInitialState = (config: PanelConfig): PanelState => ({
        _tag: 'PanelState',
        id: config.id,
        size: config.defaultSize ?? 50,
        collapsed: config.collapsed,
        visible: true,
      });

      return {
        validatePanel,
        validateLayout,
        createDefaultPanel,
        createDefaultGroup,
        createDefaultLayout,
        createInitialState,
      } as const;
    }),
  }
) {}
