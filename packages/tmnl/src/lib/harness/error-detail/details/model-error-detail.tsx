/**
 * ModelErrorDetail — model-catalog-failed, model-resolution-failed.
 *
 * @module harness/error-detail/details/model-error-detail
 */

import { memo, useMemo } from 'react'
import { useErrorDetail } from '../detail-context'
import { DetailHeader, DetailMessage, MetadataGrid, RawAccordion, ActionFooter, formatTimestamp, type MetadataRow } from '../detail-parts'
import type { ActionDef } from '../types'

const ACTIONS: ReadonlyArray<ActionDef> = [
  { label: 'Retry Catalog', action: 'retry-catalog', primary: true },
  { label: 'Switch Model', action: 'switch-model' },
  { label: 'Dismiss', action: 'dismiss' },
]

/** Parse model name from message: "Model 'claude-opus-4'" or "model claude-opus-4" */
function parseModelName(msg: string): string | null {
  const m = msg.match(/[Mm]odel '([^']+)'/) ?? msg.match(/[Mm]odel\s+(\S+)/)
  return m ? m[1] : null
}

export const ModelErrorDetail = memo(function ModelErrorDetail() {
  const { state } = useErrorDetail()

  const modelName = useMemo(() => parseModelName(state.message), [state.message])

  const rows = useMemo<ReadonlyArray<MetadataRow>>(() => {
    const out: MetadataRow[] = []
    if (modelName) out.push({ label: 'model', value: modelName, accent: true })
    out.push({ label: 'code', value: state.code })
    out.push({ label: 'at', value: formatTimestamp(state.at) })
    return out
  }, [modelName, state.code, state.at])

  return (
    <>
      <DetailHeader />
      <DetailMessage />
      <MetadataGrid rows={rows} />
      <RawAccordion />
      <ActionFooter defs={ACTIONS} />
    </>
  )
})

export { ACTIONS as MODEL_ACTIONS }
