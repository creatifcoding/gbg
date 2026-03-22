/**
 * Artifact Cards — TMNL-styled Analysis & Remediation cards
 *
 * Specialized message renderers for task-bearing assistant messages.
 * Composes ChatArtifactCard from chat/card/ and InlineTaskShell from chat/msg/.
 *
 * Used by ThreadView.FullMessage when messages carry task payloads.
 *
 * @module morphchat/components/artifact-cards
 */

import * as React from 'react'
import { BarChart3, AlertTriangle, Zap, Diamond, ExternalLink, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ChatArtifactCard } from '@/lib/chat/card'
import {
  ChatMessageAttachmentLane,
  InlineTaskShell,
} from '@/lib/chat/msg'
import type { AgentTask } from '@/lib/chat/msg/inline-task-types'

const ICON_SIZE = 13
const ICON_STROKE = 1.5

// =============================================================================
// Analysis Card
// =============================================================================

export interface AnalysisCardProps {
  /** Message summary text */
  summary: string
  /** Message ID for attachment lane anchor */
  messageId: string
  /** Inline tasks associated with this analysis */
  tasks?: ReadonlyArray<AgentTask>
  /** Whether task shell starts expanded */
  defaultExpanded?: boolean
}

export function AnalysisCard({
  summary,
  messageId,
  tasks,
  defaultExpanded = false,
}: AnalysisCardProps) {
  return (
    <ChatArtifactCard className="mt-2">
      <ChatArtifactCard.Header>
        <span className="flex items-center gap-1.5 text-cyan-400 font-mono uppercase tracking-wider">
          <BarChart3 size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          Analysis: Sector 4
        </span>
        <span className="flex items-center gap-1.5 text-amber-400 font-mono uppercase tracking-wider">
          <AlertTriangle size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          Variance Detected
        </span>
      </ChatArtifactCard.Header>

      <ChatArtifactCard.Body>
        <p className="text-neutral-300 mb-3" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
          {summary}
        </p>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <ChatArtifactCard.Metric>
            <span className="text-neutral-500 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              Target Pressure
            </span>
            <span className="text-neutral-200 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              2,100 PSI
            </span>
          </ChatArtifactCard.Metric>

          <ChatArtifactCard.Metric className="border-amber-800/30">
            <span className="text-neutral-500 font-mono" style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}>
              Current Reading
            </span>
            <span className="text-amber-300 font-mono" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
              2,415 PSI
            </span>
          </ChatArtifactCard.Metric>
        </div>

        <ChatArtifactCard.Actions>
          <ArtifactAction icon={<ExternalLink size={12} strokeWidth={ICON_STROKE} />}>
            View Logs
          </ArtifactAction>
          <ArtifactAction icon={<Shield size={12} strokeWidth={ICON_STROKE} />} variant="warn">
            Override Safety
          </ArtifactAction>
        </ChatArtifactCard.Actions>
      </ChatArtifactCard.Body>

      {/* Task pipeline */}
      {tasks && tasks.length > 0 && (
        <ChatMessageAttachmentLane.Root messageAnchorId={messageId}>
          <ChatMessageAttachmentLane.InlineTaskThread>
            <InlineTaskShell
              threadId={`analysis:${messageId}`}
              tasks={tasks}
              defaultExpanded={defaultExpanded}
            >
              <InlineTaskShell.ExpandBand
                label={`${tasks.length} analysis task${tasks.length !== 1 ? 's' : ''}`}
              />
              <InlineTaskShell.MetricsBand />
              <InlineTaskShell.ThreadBand estimatedRowHeight={44} overscan={8} />
              <InlineTaskShell.SearchBand placeholder="Filter tasks…" />
            </InlineTaskShell>
          </ChatMessageAttachmentLane.InlineTaskThread>
        </ChatMessageAttachmentLane.Root>
      )}
    </ChatArtifactCard>
  )
}

AnalysisCard.displayName = 'MorphChat.AnalysisCard'

// =============================================================================
// Remediation Card
// =============================================================================

export interface RemediationCardProps {
  /** Message summary text */
  summary: string
  /** Message ID for attachment lane anchor */
  messageId: string
  /** Inline tasks for the remediation pipeline */
  tasks: ReadonlyArray<AgentTask>
  /** Whether task shell starts expanded */
  defaultExpanded?: boolean
}

export function RemediationCard({
  summary,
  messageId,
  tasks,
  defaultExpanded = false,
}: RemediationCardProps) {
  return (
    <ChatArtifactCard className="mt-2">
      <ChatArtifactCard.Header>
        <span className="flex items-center gap-1.5 text-emerald-400 font-mono uppercase tracking-wider">
          <Zap size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          Remediation: V-4821-A
        </span>
        <span className="flex items-center gap-1.5 text-cyan-400 font-mono uppercase tracking-wider">
          <Diamond size={ICON_SIZE} strokeWidth={ICON_STROKE} />
          Pipeline Active
        </span>
      </ChatArtifactCard.Header>

      <ChatArtifactCard.Body>
        <p className="text-neutral-300 mb-3" style={{ fontSize: 'var(--tmnl-text-sm, 14px)' }}>
          {summary}
        </p>
      </ChatArtifactCard.Body>

      {/* Remediation task pipeline */}
      <ChatMessageAttachmentLane.Root messageAnchorId={messageId}>
        <ChatMessageAttachmentLane.InlineTaskThread>
          <InlineTaskShell
            threadId={`remediation:${messageId}`}
            tasks={tasks}
            defaultExpanded={defaultExpanded}
          >
            <InlineTaskShell.ExpandBand label="Remediation Pipeline" />
            <InlineTaskShell.MetricsBand />
            <InlineTaskShell.ThreadBand estimatedRowHeight={44} overscan={8} />
            <InlineTaskShell.SearchBand placeholder="Filter remediation tasks…" />
          </InlineTaskShell>
        </ChatMessageAttachmentLane.InlineTaskThread>
      </ChatMessageAttachmentLane.Root>
    </ChatArtifactCard>
  )
}

RemediationCard.displayName = 'MorphChat.RemediationCard'

// =============================================================================
// Artifact Action Button — TMNL-styled
// =============================================================================

function ArtifactAction({
  children,
  icon,
  variant = 'default',
  onClick,
}: {
  children: React.ReactNode
  icon?: React.ReactNode
  variant?: 'default' | 'warn'
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded',
        'font-mono border transition-all duration-200',
        'active:scale-[0.97]',
        variant === 'warn'
          ? 'border-amber-800/30 text-amber-400 hover:border-amber-700 hover:bg-amber-500/5'
          : 'border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200',
      )}
      style={{ fontSize: 'var(--tmnl-text-xs, 12px)' }}
    >
      {icon}
      {children}
    </button>
  )
}
