/**
 * MapBlock Extension
 *
 * Custom block that renders a Mapbox + deck.gl map.
 * Stores viewState and markers as document attributes.
 *
 * @module editor/v3/extensions/blocks/MapBlock
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { nanoid } from 'nanoid';
import type { MapViewState } from '@deck.gl/core';

import { MapBlockView } from './MapBlockView';
import { DEFAULT_VIEW_STATE, DEFAULT_MAP_STYLE } from './atoms';

// =============================================================================
// Types
// =============================================================================

export interface MapBlockMarker {
  position: [number, number];
  color: [number, number, number];
}

export interface MapBlockAttrs {
  /** Unique block ID */
  id: string;
  /** Map view state */
  viewState: MapViewState;
  /** Mapbox style URL */
  mapStyle: string;
  /** Marker data */
  markers: MapBlockMarker[];
}

export interface MapBlockOptions {
  /** HTML attributes for the container */
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mapBlock: {
      /** Insert a map block */
      insertMap: (options?: { viewState?: Partial<MapViewState> }) => ReturnType;
      /** Delete the current map block */
      deleteMap: () => ReturnType;
    };
  }
}

// =============================================================================
// Extension
// =============================================================================

export const MapBlock = Node.create<MapBlockOptions>({
  name: 'mapBlock',

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  group: 'block',

  atom: true,

  selectable: true,

  draggable: true,

  addAttributes() {
    return {
      id: {
        default: () => nanoid(12),
        parseHTML: (element) => element.getAttribute('data-id') || nanoid(12),
        renderHTML: (attributes) => ({ 'data-id': attributes.id }),
      },
      viewState: {
        default: DEFAULT_VIEW_STATE,
        parseHTML: (element) => {
          const dataAttr = element.getAttribute('data-view-state');
          if (dataAttr) {
            try {
              return JSON.parse(dataAttr);
            } catch {
              return DEFAULT_VIEW_STATE;
            }
          }
          return DEFAULT_VIEW_STATE;
        },
        renderHTML: (attributes) => ({
          'data-view-state': JSON.stringify(attributes.viewState),
        }),
      },
      mapStyle: {
        default: DEFAULT_MAP_STYLE,
        parseHTML: (element) => element.getAttribute('data-map-style') || DEFAULT_MAP_STYLE,
        renderHTML: (attributes) => ({ 'data-map-style': attributes.mapStyle }),
      },
      markers: {
        default: [],
        parseHTML: (element) => {
          const dataAttr = element.getAttribute('data-markers');
          if (dataAttr) {
            try {
              return JSON.parse(dataAttr);
            } catch {
              return [];
            }
          }
          return [];
        },
        renderHTML: (attributes) => ({
          'data-markers': JSON.stringify(attributes.markers),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="mapBlock"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'mapBlock',
        'data-id': node.attrs.id,
        'data-view-state': JSON.stringify(node.attrs.viewState),
        'data-map-style': node.attrs.mapStyle,
        'data-markers': JSON.stringify(node.attrs.markers),
      }),
      ['div', { class: 'map-placeholder' }, 'Map Block (requires JavaScript)'],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MapBlockView);
  },

  addCommands() {
    return {
      insertMap:
        (options = {}) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              id: nanoid(12),
              viewState: { ...DEFAULT_VIEW_STATE, ...options.viewState },
              mapStyle: DEFAULT_MAP_STYLE,
              markers: [],
            },
          });
        },
      deleteMap:
        () =>
        ({ commands }) => {
          return commands.deleteNode(this.name);
        },
    };
  },
});

// =============================================================================
// Re-exports
// =============================================================================

export { MapBlockView } from './MapBlockView';
export {
  createMapBlockAtoms,
  getMapBlockAtoms,
  disposeMapBlockAtoms,
  defaultPayloadToMarkers,
  DEFAULT_VIEW_STATE,
  DEFAULT_MAP_STYLE,
  DEFAULT_MAP_CONFIG,
  type MapBlockAtoms,
  type MapBlockState,
  type MapConfig,
  type MapStreamConfig,
  type MarkerData,
} from './atoms';
export {
  useMapStreamBinding,
  type UseMapStreamBindingOptions,
  type UseMapStreamBindingReturn,
} from './useStreamBinding';
