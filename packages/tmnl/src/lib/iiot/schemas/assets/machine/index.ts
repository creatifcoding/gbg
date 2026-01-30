/**
 * Machine Schema Module
 *
 * ISA-95 Work Unit - production equipment within a line.
 *
 * @module @gbg/tmnl/iiot/schemas/assets/machine
 */

export {
  // Identifier
  MachineId,
  makeMachineId,
  // Entity (Schema class)
  MachineSchema,
  // Entity (Namespace with Schema + Type)
  Machine,
  type MachineType,
  // Command params
  CreateMachineParams,
  type CreateMachineParams as CreateMachineParamsType,
} from './schema'
