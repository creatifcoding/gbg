/**
 * Annotation System - Service Exports
 *
 * Effect services for annotation management.
 *
 * @module editor/v3/extensions/annotations/services
 */

export {
  // Service
  AnnotationService,
  AnnotationServiceLive,

  // Types
  type AnnotationServiceShape,
  type AnnotationQuery,
  type AnnotationState,
} from './AnnotationService';

export {
  // Service
  IntentRegistry,
  IntentRegistryLive,

  // Built-in actions
  copyToClipboardAction,
  logAction,
  openUrlAction,
  registerBuiltinActions,

  // Types
  type IntentRegistryShape,
  type ActionContext,
  type ActionProgram,
  type RegisteredAction,
} from './IntentRegistry';

export {
  // Service
  IntentExecutor,
  IntentExecutorLive,

  // Types
  type IntentExecutorShape,
  type ExecutionContext,
  type ExecutionResult,
  type PopoverRequest,
  type NavigationRequest,
  type ExecutorHandlers,
} from './IntentExecutor';
