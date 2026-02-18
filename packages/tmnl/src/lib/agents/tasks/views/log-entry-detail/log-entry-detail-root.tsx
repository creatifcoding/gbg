import type { PropsWithChildren } from 'react'
import type { AssembledLogEntry } from '../../services/CodecService'
import { LogEntryDetailContext } from './log-entry-detail-context'
import { LogEntryDetailFields } from './log-entry-detail-fields'
import { LogEntryFlushContainers } from './log-entry-flush-containers'
import {
  LogEntryJsonBlock,
  LogEntryMetadataJsonBlock,
  LogEntryPayloadJsonBlock,
} from './log-entry-json-block'
import { LogEntryStackTrace } from './log-entry-stack-trace'

export interface LogEntryDetailRootProps extends PropsWithChildren {
  readonly entry: AssembledLogEntry
}

const DefaultDetailLayout = () => (
  <>
    <LogEntryDetail.Fields />
    <LogEntryDetail.FlushContainers />
    <LogEntryDetail.PayloadJson />
    <LogEntryDetail.MetadataJson />
    <LogEntryDetail.StackTrace />
  </>
)

export function LogEntryDetailRoot({ entry, children }: LogEntryDetailRootProps) {
  return (
    <LogEntryDetailContext.Provider value={{ entry }}>
      <div className="rvn-chat__inline-task-detail at-log-detail">
        {children ?? <DefaultDetailLayout />}
      </div>
    </LogEntryDetailContext.Provider>
  )
}

export const LogEntryDetail = Object.assign(LogEntryDetailRoot, {
  Fields: LogEntryDetailFields,
  FlushContainers: LogEntryFlushContainers,
  JsonBlock: LogEntryJsonBlock,
  PayloadJson: LogEntryPayloadJsonBlock,
  MetadataJson: LogEntryMetadataJsonBlock,
  StackTrace: LogEntryStackTrace,
})
