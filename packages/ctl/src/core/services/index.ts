/**
 * Core Services
 *
 * Effect services for CTL operations.
 *
 * @module @gbg/ctl/core/services
 */

export {
  AgentExecution,
  AgentExecutionLayer,
  parseCtlOutput,
  action,
  type AgentExecutionPort,
  type ExecutionResult,
} from "./agent-execution.js"

export {
  ProjectDiscovery,
  ProjectDiscoveryLayer,
  discoverProject,
  type ProjectDiscoveryPort,
  type DiscoveryResult,
} from "./project-discovery.js"

export {
  CommandRouter,
  CommandRouterLayer,
  routeCommand,
  getHelpText,
  type CommandRouterPort,
  type CommandMeta,
  type RouteMatch,
} from "./command-router.js"

export {
  Catalog,
  CatalogLayer,
  CatalogEntry,
  queryCatalog,
  getCatalogEntry,
  getCatalogByType,
  ComponentType,
  type CatalogPort,
  type CatalogQuery,
  type CatalogResult,
} from "./catalog.js"
