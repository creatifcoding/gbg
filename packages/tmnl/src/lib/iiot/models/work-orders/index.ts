/**
 * IIoT Work Order Models Barrel Export
 *
 * @module
 */

export { WorkOrderModel } from './WorkOrderModel'
export { WorkOrderTransitionModel } from './WorkOrderTransitionModel'
export {
  createWorkOrderTransitionsTable,
  createTransitionsImmutabilityTrigger,
  setupWorkOrderTransitions,
} from './WorkOrderTransitionModel.ddl'
