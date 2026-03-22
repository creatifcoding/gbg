/**
 * FSM Primitives
 *
 * Reusable components for visualizing finite state machines.
 *
 * @module primitives/fsm
 */

export {
  StateNode,
  getStateColors,
  type StateNodeProps,
  type FsmStateType,
  type StateColors,
} from './StateNode'

export {
  TransitionArrow,
  type TransitionArrowProps,
  type ArrowDirection,
} from './TransitionArrow'

export {
  TransitionRule,
  type TransitionRuleProps,
} from './TransitionRule'
