/**
 * Scene3DBlock Extension
 *
 * Custom block that renders a react-three-fiber 3D scene.
 * Stores camera state, entities, and simulation config as document attributes.
 *
 * Architecture:
 * - Uses effect-atom for reactive state management
 * - Entity data structure mirrors kori traits (Position3D, Velocity3D)
 * - Simulation can be played/paused with time scale control
 *
 * @module editor/v3/extensions/blocks/Scene3DBlock
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { nanoid } from 'nanoid';

import { Scene3DBlockView } from './Scene3DBlockView';
import {
  DEFAULT_CAMERA,
  DEFAULT_SCENE_CONFIG,
  createDemoEntities,
  type EntityData,
  type CameraState,
  type SceneConfig,
} from './atoms';

// =============================================================================
// Types
// =============================================================================

export interface Scene3DBlockAttrs {
  /** Unique block ID */
  id: string;
  /** Camera state */
  camera: CameraState;
  /** Scene configuration */
  config: SceneConfig;
  /** Entity data */
  entities: EntityData[];
}

export interface Scene3DBlockOptions {
  /** HTML attributes for the container */
  HTMLAttributes: Record<string, unknown>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    scene3DBlock: {
      /** Insert a 3D scene block */
      insertScene3D: (options?: { entities?: EntityData[] }) => ReturnType;
      /** Delete the current scene block */
      deleteScene3D: () => ReturnType;
    };
  }
}

// =============================================================================
// Extension
// =============================================================================

export const Scene3DBlock = Node.create<Scene3DBlockOptions>({
  name: 'scene3DBlock',

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
      camera: {
        default: DEFAULT_CAMERA,
        parseHTML: (element) => {
          const dataAttr = element.getAttribute('data-camera');
          if (dataAttr) {
            try {
              return JSON.parse(dataAttr);
            } catch {
              return DEFAULT_CAMERA;
            }
          }
          return DEFAULT_CAMERA;
        },
        renderHTML: (attributes) => ({
          'data-camera': JSON.stringify(attributes.camera),
        }),
      },
      config: {
        default: DEFAULT_SCENE_CONFIG,
        parseHTML: (element) => {
          const dataAttr = element.getAttribute('data-config');
          if (dataAttr) {
            try {
              return JSON.parse(dataAttr);
            } catch {
              return DEFAULT_SCENE_CONFIG;
            }
          }
          return DEFAULT_SCENE_CONFIG;
        },
        renderHTML: (attributes) => ({
          'data-config': JSON.stringify(attributes.config),
        }),
      },
      entities: {
        default: [],
        parseHTML: (element) => {
          const dataAttr = element.getAttribute('data-entities');
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
          'data-entities': JSON.stringify(attributes.entities),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="scene3DBlock"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-type': 'scene3DBlock',
        'data-id': node.attrs.id,
        'data-camera': JSON.stringify(node.attrs.camera),
        'data-config': JSON.stringify(node.attrs.config),
        'data-entities': JSON.stringify(node.attrs.entities),
      }),
      ['div', { class: 'scene3d-placeholder' }, '3D Scene Block (requires JavaScript)'],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(Scene3DBlockView);
  },

  addCommands() {
    return {
      insertScene3D:
        (options = {}) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              id: nanoid(12),
              camera: DEFAULT_CAMERA,
              config: DEFAULT_SCENE_CONFIG,
              entities: options.entities || createDemoEntities(),
            },
          });
        },
      deleteScene3D:
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

export { Scene3DBlockView } from './Scene3DBlockView';
export {
  createScene3DBlockAtoms,
  getScene3DBlockAtoms,
  disposeScene3DBlockAtoms,
  createDemoEntities,
  defaultPayloadToEntities,
  DEFAULT_CAMERA,
  DEFAULT_SCENE_CONFIG,
  type Scene3DBlockAtoms,
  type Scene3DBlockState,
  type Scene3DStreamConfig,
  type CameraState,
  type EntityData,
  type SceneConfig,
} from './atoms';
export {
  useScene3DStreamBinding,
  type UseScene3DStreamBindingOptions,
  type UseScene3DStreamBindingReturn,
} from './useStreamBinding';
export {
  // Kori trait mapping
  entityToTraits,
  traitsToEntity,
  entitiesToEntityData,
  // Stream materialization
  StreamEntityPayload,
  StreamEntity,
  createScene3DMaterializeOptions,
  createEntityMaterializeOptions,
  // Kori World query
  queryScene3DEntities,
} from './kori-bridge';
export {
  // Kori World React integration
  useKoriEntities,
  koriWorldRuntimeAtom,
  queryKoriEntities,
  type UseKoriEntitiesOptions,
  type UseKoriEntitiesReturn,
} from './useKoriEntities';
