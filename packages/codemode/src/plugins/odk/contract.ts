/**
 * @module odk/contract
 *
 * Contract rules for CodemodeOverlay validation.
 * Each rule introspects the live overlay object — typeof, .name, .length.
 * No string parsing, no dry-run invocation, no source analysis.
 */

import type { ContractRule, ValidationReport, Violation } from "./types.js"

// ── Helper: safe property access ─────────────────────────────────

const has = (obj: any, key: string): boolean =>
  obj != null && typeof obj === "object" && key in obj

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0

const isFunction = (v: unknown): v is Function =>
  typeof v === "function"

const isObject = (v: unknown): v is Record<string, unknown> =>
  v != null && typeof v === "object" && !Array.isArray(v)

const isArray = (v: unknown): v is readonly unknown[] =>
  Array.isArray(v)

// ── Structural Rules (S1–S4) ─────────────────────────────────────

const S1: ContractRule = {
  id: "S1",
  category: "structural",
  severity: "error",
  description: "Overlay must have a non-empty string `id`",
  check: (o: any) =>
    isNonEmptyString(o?.id) ? null : `id is ${typeof o?.id}, expected non-empty string`,
}

const S2: ContractRule = {
  id: "S2",
  category: "structural",
  severity: "error",
  description: "Overlay must have a non-empty string `name`",
  check: (o: any) =>
    isNonEmptyString(o?.name) ? null : `name is ${typeof o?.name}, expected non-empty string`,
}

const S3: ContractRule = {
  id: "S3",
  category: "structural",
  severity: "error",
  description: "Overlay must have a `methods` object with at least one function",
  check: (o: any) => {
    if (!isObject(o?.methods)) return `methods is ${typeof o?.methods}, expected object`
    const fns = Object.values(o.methods).filter(isFunction)
    if (fns.length === 0) return "methods object has no callable functions"
    return null
  },
}

const S4: ContractRule = {
  id: "S4",
  category: "structural",
  severity: "warning",
  description: "Every value in `methods` should be typeof function",
  check: (o: any) => {
    if (!isObject(o?.methods)) return null // S3 catches this
    const bad = Object.entries(o.methods)
      .filter(([, v]) => !isFunction(v))
      .map(([k, v]) => `${k}: typeof ${typeof v}`)
    return bad.length > 0 ? `Non-function methods: ${bad.join(", ")}` : null
  },
}

// ── Guide Rules (G1–G4) ─────────────────────────────────────────

const G1: ContractRule = {
  id: "G1",
  category: "guide",
  severity: "warning",
  description: "If guide exists, it must have a non-empty sections array",
  check: (o: any) => {
    if (!has(o, "guide")) return null // no guide is valid (just means not covered)
    if (!isArray(o.guide?.sections)) return "guide.sections is not an array"
    if (o.guide.sections.length === 0) return "guide.sections is empty"
    return null
  },
}

const G2: ContractRule = {
  id: "G2",
  category: "guide",
  severity: "error",
  description: "Each guide section must have string id, string slot, number priority",
  check: (o: any) => {
    if (!isArray(o?.guide?.sections)) return null
    const bad: string[] = []
    for (const s of o.guide.sections) {
      if (!isNonEmptyString(s?.id)) bad.push(`section missing id`)
      if (!isNonEmptyString(s?.slot)) bad.push(`section ${s?.id ?? "?"} missing slot`)
      if (typeof s?.priority !== "number") bad.push(`section ${s?.id ?? "?"} priority is ${typeof s?.priority}`)
    }
    return bad.length > 0 ? bad.join("; ") : null
  },
}

const G3: ContractRule = {
  id: "G3",
  category: "guide",
  severity: "error",
  description: "Guide section content must be string or function returning string",
  check: (o: any) => {
    if (!isArray(o?.guide?.sections)) return null
    const bad: string[] = []
    for (const s of o.guide.sections) {
      const c = s?.content
      if (typeof c !== "string" && typeof c !== "function") {
        bad.push(`section ${s?.id ?? "?"} content is ${typeof c}`)
      }
    }
    return bad.length > 0 ? bad.join("; ") : null
  },
}

const G4: ContractRule = {
  id: "G4",
  category: "guide",
  severity: "warning",
  description: "Guide section ids should be unique",
  check: (o: any) => {
    if (!isArray(o?.guide?.sections)) return null
    const ids = o.guide.sections.map((s: any) => s?.id).filter(Boolean)
    const dupes = ids.filter((id: string, i: number) => ids.indexOf(id) !== i)
    return dupes.length > 0 ? `Duplicate section ids: ${[...new Set(dupes)].join(", ")}` : null
  },
}

// ── Coverage Rules (C1–C3) ───────────────────────────────────────

const C1: ContractRule = {
  id: "C1",
  category: "coverage",
  severity: "info",
  description: "Overlay should have guide sections (documentation)",
  check: (o: any) =>
    isArray(o?.guide?.sections) && o.guide.sections.length > 0
      ? null
      : "No guide sections — methods are undocumented",
}

const C2: ContractRule = {
  id: "C2",
  category: "coverage",
  severity: "info",
  description: "Overlay should have steer fragments (prompt steering)",
  check: (o: any) =>
    isArray(o?.steer?.fragments) && o.steer.fragments.length > 0
      ? null
      : "No steer fragments — no prompt-level guidance",
}

const C3: ContractRule = {
  id: "C3",
  category: "coverage",
  severity: "info",
  description: "All methods should have named functions (not anonymous)",
  check: (o: any) => {
    if (!isObject(o?.methods)) return null
    const anon = Object.entries(o.methods)
      .filter(([, fn]) => isFunction(fn) && (!fn.name || fn.name === "anonymous"))
      .map(([k]) => k)
    return anon.length > 0 ? `Anonymous methods: ${anon.join(", ")}` : null
  },
}

// ── Steer Rules (T1–T3) ─────────────────────────────────────────

const T1: ContractRule = {
  id: "T1",
  category: "steer",
  severity: "error",
  description: "Each steer fragment must have string id and content (string or function)",
  check: (o: any) => {
    if (!isArray(o?.steer?.fragments)) return null
    const bad: string[] = []
    for (const f of o.steer.fragments) {
      if (!isNonEmptyString(f?.id)) bad.push("fragment missing id")
      const c = f?.content
      if (typeof c !== "string" && typeof c !== "function") {
        bad.push(`fragment ${f?.id ?? "?"} content is ${typeof c}`)
      }
    }
    return bad.length > 0 ? bad.join("; ") : null
  },
}

const T2: ContractRule = {
  id: "T2",
  category: "steer",
  severity: "warning",
  description: "Steer fragment ids should be unique",
  check: (o: any) => {
    if (!isArray(o?.steer?.fragments)) return null
    const ids = o.steer.fragments.map((f: any) => f?.id).filter(Boolean)
    const dupes = ids.filter((id: string, i: number) => ids.indexOf(id) !== i)
    return dupes.length > 0 ? `Duplicate fragment ids: ${[...new Set(dupes)].join(", ")}` : null
  },
}

const T3: ContractRule = {
  id: "T3",
  category: "steer",
  severity: "warning",
  description: "Steer suppress threshold should be 0-1 if present",
  check: (o: any) => {
    const t = o?.steer?.suppress?.threshold
    if (t == null) return null
    if (typeof t !== "number" || t < 0 || t > 1) return `suppress.threshold is ${t}, expected 0-1`
    return null
  },
}

// ── Procedure Rules (P1–P2) ──────────────────────────────────────

const P1: ContractRule = {
  id: "P1",
  category: "procedures",
  severity: "error",
  description: "Each seed procedure must have string name, function fn, string manifest",
  check: (o: any) => {
    if (!isArray(o?.procedures)) return null
    const bad: string[] = []
    for (const p of o.procedures) {
      if (!isNonEmptyString(p?.name)) bad.push("procedure missing name")
      if (!isFunction(p?.fn)) bad.push(`procedure ${p?.name ?? "?"} fn is ${typeof p?.fn}`)
      if (!isNonEmptyString(p?.manifest)) bad.push(`procedure ${p?.name ?? "?"} missing manifest`)
    }
    return bad.length > 0 ? bad.join("; ") : null
  },
}

const P2: ContractRule = {
  id: "P2",
  category: "procedures",
  severity: "warning",
  description: "Procedure names should be unique",
  check: (o: any) => {
    if (!isArray(o?.procedures)) return null
    const names = o.procedures.map((p: any) => p?.name).filter(Boolean)
    const dupes = names.filter((n: string, i: number) => names.indexOf(n) !== i)
    return dupes.length > 0 ? `Duplicate procedure names: ${[...new Set(dupes)].join(", ")}` : null
  },
}

// ── Lifecycle Rules (L1–L3) ──────────────────────────────────────

const L1: ContractRule = {
  id: "L1",
  category: "lifecycle",
  severity: "error",
  description: "Lifecycle hooks must be functions if present",
  check: (o: any) => {
    if (!has(o, "lifecycle") || !isObject(o.lifecycle)) return null
    const hooks = ["onLoad", "onUnload", "onEval", "onResult", "onTurn"]
    const bad: string[] = []
    for (const h of hooks) {
      if (h in o.lifecycle && !isFunction(o.lifecycle[h])) {
        bad.push(`lifecycle.${h} is ${typeof o.lifecycle[h]}`)
      }
    }
    return bad.length > 0 ? bad.join("; ") : null
  },
}

const L2: ContractRule = {
  id: "L2",
  category: "lifecycle",
  severity: "error",
  description: "dispose must be a function if present",
  check: (o: any) => {
    if (!has(o, "dispose")) return null
    return isFunction(o.dispose) ? null : `dispose is ${typeof o.dispose}, expected function`
  },
}

const L3: ContractRule = {
  id: "L3",
  category: "lifecycle",
  severity: "warning",
  description: "version should be a string if present (semver recommended)",
  check: (o: any) => {
    if (!has(o, "version")) return null
    return isNonEmptyString(o.version) ? null : `version is ${typeof o.version}`
  },
}

// ── All Rules ────────────────────────────────────────────────────

export const CONTRACT_RULES: ReadonlyArray<ContractRule> = [
  S1, S2, S3, S4,
  G1, G2, G3, G4,
  C1, C2, C3,
  T1, T2, T3,
  P1, P2,
  L1, L2, L3,
]

// ── Validate ─────────────────────────────────────────────────────

/**
 * Run all contract rules against a live overlay object.
 * Returns a ValidationReport — errors block conformance, warnings don't.
 */
export function validate(overlay: unknown): ValidationReport {
  const errors: Violation[] = []
  const warnings: Violation[] = []
  const info: Violation[] = []

  for (const rule of CONTRACT_RULES) {
    const message = rule.check(overlay)
    if (message != null) {
      const violation: Violation = {
        ruleId: rule.id,
        category: rule.category,
        severity: rule.severity,
        message: rule.description,
        detail: message,
      }
      switch (rule.severity) {
        case "error": errors.push(violation); break
        case "warning": warnings.push(violation); break
        case "info": info.push(violation); break
      }
    }
  }

  return {
    errors,
    warnings,
    info,
    valid: errors.length === 0,
    rulesChecked: CONTRACT_RULES.length,
  }
}
