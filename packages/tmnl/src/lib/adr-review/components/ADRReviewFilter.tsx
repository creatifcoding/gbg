/**
 * ADRReviewFilter
 *
 * Filter controls for status and unit type.
 */
import React from 'react'
import { Filter, Download } from 'lucide-react'
import { useAtomValue } from 'effect-atom'
import { cn } from '@/lib/utils'
import { statusFilterAtom, unitTypeFilterAtom } from '../atoms'
import { setStatusFilter, setUnitTypeFilter, downloadDigest } from '../atoms/operations'
import { UNIT_TAGS, getUnitDisplayName, type ReviewUnitTag } from '../schemas/unit'
import type { ReviewStatus } from '../schemas/status'

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface ADRReviewFilterProps {
  /**
   * Show export button.
   */
  showExport?: boolean

  /**
   * Optional className for the container.
   */
  className?: string
}

// -----------------------------------------------------------------------------
// Select Component
// -----------------------------------------------------------------------------

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  label: string
}

function Select({ value, onChange, options, label }: SelectProps) {
  return (
    <div className="flex items-center gap-2">
      <label className="text-xs text-neutral-500 uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2 py-1 text-sm bg-neutral-800 border border-neutral-700 rounded text-neutral-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ADRReviewFilter({ showExport = true, className }: ADRReviewFilterProps) {
  const statusFilter = useAtomValue(statusFilterAtom)
  const typeFilter = useAtomValue(unitTypeFilterAtom)

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'discuss', label: 'Discuss' },
  ]

  const typeOptions = [
    { value: 'all', label: 'All Types' },
    ...UNIT_TAGS.map((tag) => ({
      value: tag,
      label: getUnitDisplayName(tag),
    })),
  ]

  return (
    <div className={cn('flex items-center gap-4 flex-wrap', className)}>
      <div className="flex items-center gap-2 text-neutral-400">
        <Filter className="w-4 h-4" />
        <span className="text-sm font-medium">Filters</span>
      </div>

      <Select
        label="Status"
        value={statusFilter}
        onChange={(v) => setStatusFilter(v as ReviewStatus | 'all')}
        options={statusOptions}
      />

      <Select
        label="Type"
        value={typeFilter}
        onChange={(v) => setUnitTypeFilter(v as ReviewUnitTag | 'all')}
        options={typeOptions}
      />

      {showExport && (
        <button
          type="button"
          onClick={downloadDigest}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
        >
          <Download className="w-4 h-4" />
          <span>Export JSON</span>
        </button>
      )}
    </div>
  )
}
