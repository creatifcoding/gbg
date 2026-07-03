/**
 * EVMService — Earned Value Management Calculations
 *
 * The quantitative backbone. Computes CPI/SPI/EAC/ETC/TCPI at
 * WorkPackage, Zone, and Project levels.
 *
 * Key insight from the domain research:
 *   "CPI rarely recovers by more than 10% once it drops below threshold
 *    at the 20% completion mark."
 *
 * This service doesn't just calculate — it interprets. It flags
 * CPI < 0.90 at 20%+ completion as a red alert. It detects zone-level
 * divergence that project-level metrics mask.
 *
 * All calculations use PHYSICAL progress (quantities), not spend.
 * EV = BAC × (actualQty / plannedQty), not BAC × (actualCost / budgetedCost).
 *
 * @module sios/services/EVMService
 */

import { Effect, Context, Layer } from 'effect'
import { EVMSnapshot } from '../schemas/value-objects'

// =============================================================================
// Types
// =============================================================================

/** Input data for EVM calculation — what we need from the WorkPackage */
export interface EVMInput {
  /** Budget at Completion (planned total cost) */
  readonly budgetedCost: number
  /** Budget at Completion in hours */
  readonly budgetedHours: number
  /** Planned quantity of work */
  readonly plannedQty: number
  /** Actual quantity completed (physical progress) */
  readonly actualQty: number
  /** Planned value of work scheduled to date (time-based) */
  readonly scheduledQtyToDate: number
  /** Actual cost expended */
  readonly actualCost: number
  /** Actual hours expended */
  readonly actualHours: number
  /** Snapshot date */
  readonly asOf: string
}

/** Alert severity for EVM health signals */
export type EVMAlertSeverity = 'info' | 'warning' | 'critical'

/** An EVM health alert */
export interface EVMAlert {
  readonly severity: EVMAlertSeverity
  readonly metric: string
  readonly value: number
  readonly threshold: number
  readonly message: string
}

/** Full EVM result including calculated metrics + health alerts */
export interface EVMResult {
  readonly snapshot: typeof EVMSnapshot.Type
  readonly alerts: ReadonlyArray<EVMAlert>
}

// =============================================================================
// Service Interface
// =============================================================================

export interface EVMServiceShape {
  /**
   * Calculate EVM snapshot from raw input data.
   * Pure calculation — no database access.
   */
  readonly calculate: (input: EVMInput) => EVMResult

  /**
   * Detect zone-level divergence.
   * Compares individual WP CPIs against the aggregated project CPI.
   * Flags when any WP's CPI diverges > threshold from the mean.
   */
  readonly detectDivergence: (
    wpCPIs: ReadonlyArray<{ workPackageId: string; cpi: number; discipline: string }>,
    projectCPI: number,
    threshold?: number
  ) => ReadonlyArray<EVMAlert>

  /**
   * Check CPI stability rule.
   * If % complete > 20% and CPI < 0.90, flag it.
   * CPI rarely recovers by more than 10% after this point.
   */
  readonly checkCPIStability: (
    percentComplete: number,
    cpi: number
  ) => ReadonlyArray<EVMAlert>
}

// =============================================================================
// Service Tag
// =============================================================================

export class EVMService extends Context.Tag('sios/EVMService')<
  EVMService,
  EVMServiceShape
>() {}

// =============================================================================
// Implementation
// =============================================================================

const makeEVMService = (): EVMServiceShape => {
  const calculate = (input: EVMInput): EVMResult => {
    const { budgetedCost, plannedQty, actualQty, scheduledQtyToDate, actualCost, asOf } = input

    // Guard: avoid division by zero
    const safeDiv = (a: number, b: number): number =>
      b === 0 ? 0 : a / b

    // Physical % complete
    const percentComplete = safeDiv(actualQty, plannedQty) * 100

    // Earned Value = BAC × physical % complete
    const ev = budgetedCost * safeDiv(actualQty, plannedQty)

    // Planned Value = BAC × scheduled % complete
    const pv = budgetedCost * safeDiv(scheduledQtyToDate, plannedQty)

    // Actual Cost (passed in directly)
    const ac = actualCost

    // Cost Performance Index
    const cpi = safeDiv(ev, ac)

    // Schedule Performance Index
    const spi = safeDiv(ev, pv)

    // Estimate at Completion
    const eac = cpi > 0 ? safeDiv(budgetedCost, cpi) : budgetedCost * 2

    // Variance at Completion
    const vac = budgetedCost - eac

    const snapshot: typeof EVMSnapshot.Type = {
      bac: budgetedCost,
      pv,
      ev,
      ac,
      spi: Math.round(spi * 1000) / 1000,
      cpi: Math.round(cpi * 1000) / 1000,
      eac: Math.round(eac * 100) / 100,
      vac: Math.round(vac * 100) / 100,
      percentComplete: Math.round(percentComplete * 10) / 10,
      asOf,
    }

    const alerts: EVMAlert[] = [
      ...checkCPIStability(percentComplete, cpi),
    ]

    // SPI < 0.85 warning
    if (spi > 0 && spi < 0.85) {
      alerts.push({
        severity: spi < 0.75 ? 'critical' : 'warning',
        metric: 'SPI',
        value: spi,
        threshold: 0.85,
        message: `Schedule Performance Index at ${spi.toFixed(2)} — ${spi < 0.75 ? 'severely' : ''} behind schedule`,
      })
    }

    // CPI < 0.90 warning
    if (cpi > 0 && cpi < 0.90) {
      alerts.push({
        severity: cpi < 0.80 ? 'critical' : 'warning',
        metric: 'CPI',
        value: cpi,
        threshold: 0.90,
        message: `Cost Performance Index at ${cpi.toFixed(2)} — burning budget faster than earning value`,
      })
    }

    // TCPI check — is recovery even feasible?
    if (ac < budgetedCost && ev < budgetedCost) {
      const tcpi = safeDiv(budgetedCost - ev, budgetedCost - ac)
      if (tcpi > 1.20) {
        alerts.push({
          severity: 'critical',
          metric: 'TCPI',
          value: tcpi,
          threshold: 1.20,
          message: `To-Complete Performance Index at ${tcpi.toFixed(2)} — recovery is practically unachievable (>1.20)`,
        })
      } else if (tcpi > 1.10) {
        alerts.push({
          severity: 'warning',
          metric: 'TCPI',
          value: tcpi,
          threshold: 1.10,
          message: `To-Complete Performance Index at ${tcpi.toFixed(2)} — recovery will be challenging`,
        })
      }
    }

    return { snapshot, alerts }
  }

  const detectDivergence = (
    wpCPIs: ReadonlyArray<{ workPackageId: string; cpi: number; discipline: string }>,
    projectCPI: number,
    threshold: number = 0.15
  ): ReadonlyArray<EVMAlert> => {
    const alerts: EVMAlert[] = []

    for (const wp of wpCPIs) {
      const divergence = Math.abs(wp.cpi - projectCPI)
      if (divergence > threshold) {
        const direction = wp.cpi < projectCPI ? 'underperforming' : 'overperforming'
        alerts.push({
          severity: wp.cpi < projectCPI ? 'warning' : 'info',
          metric: 'CPI_DIVERGENCE',
          value: wp.cpi,
          threshold: projectCPI,
          message: `${wp.discipline} WP ${wp.workPackageId} CPI ${wp.cpi.toFixed(2)} is ${direction} vs project ${projectCPI.toFixed(2)} (divergence: ${divergence.toFixed(2)})`,
        })
      }
    }

    return alerts
  }

  const checkCPIStability = (
    percentComplete: number,
    cpi: number
  ): ReadonlyArray<EVMAlert> => {
    const alerts: EVMAlert[] = []

    if (percentComplete >= 20 && cpi > 0 && cpi < 0.90) {
      alerts.push({
        severity: 'critical',
        metric: 'CPI_STABILITY',
        value: cpi,
        threshold: 0.90,
        message: `CPI is ${cpi.toFixed(2)} at ${percentComplete.toFixed(0)}% completion. ` +
          `CPI rarely recovers more than 10% past the 20% mark. ` +
          `Forecast from ${cpi.toFixed(2)}, not a hoped-for recovery.`,
      })
    }

    return alerts
  }

  return { calculate, detectDivergence, checkCPIStability }
}

// =============================================================================
// Layer
// =============================================================================

export const EVMServiceLive = Layer.succeed(EVMService, makeEVMService())
