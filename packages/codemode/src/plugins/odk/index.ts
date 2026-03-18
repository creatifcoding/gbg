/**
 * @module odk
 *
 * ODK (Overlay Development Kit) — meta-overlay that validates,
 * inspects, and scaffolds CodemodeOverlays.
 *
 * All validation uses runtime function introspection.
 * No string signatures, no source parsing, no dry-run invocation.
 */

export { odk } from "./overlay.js"
export { validate, CONTRACT_RULES } from "./contract.js"
export { conformance } from "./conformance.js"
export { inspect, inventoryFacets, introspectMethods, compare } from "./inspect.js"
export { scaffold, buildManifest, testHarness } from "./scaffold.js"
export { listTemplates, getTemplate, TEMPLATES } from "./templates.js"
export type { ScaffoldOptions } from "./scaffold.js"
export type {
  ContractRule,
  RuleCategory,
  Severity,
  Violation,
  ValidationReport,
  ConformanceLevel,
  ConformanceResult,
  FacetInventory,
  MethodIntrospection,
  InspectionReport,
  TemplateName,
  TemplateConfig,
  ScaffoldResult,
  CatalogEntry,
  ComparisonReport,
  PackageReport,
} from "./types.js"
export { CONFORMANCE_LABELS } from "./types.js"
