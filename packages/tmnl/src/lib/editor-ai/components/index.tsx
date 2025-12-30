/**
 * EditorAI Components
 *
 * React components and HOCs for EditorAI integration.
 *
 * @module editor-ai/components
 */

export {
  EditorAIProvider,
  useEditorAIContext,
  type EditorAIContextValue,
  type EditorAIProviderProps,
} from './EditorAIProvider'

export {
  withEditorAI,
  withEditorAIRef,
  type WithEditorAIConfig,
  type WithEditorAIInjectedProps,
} from './withEditorAI'

export {
  EditorAIDrawer,
  type EditorAIDrawerProps,
} from './EditorAIDrawer'
