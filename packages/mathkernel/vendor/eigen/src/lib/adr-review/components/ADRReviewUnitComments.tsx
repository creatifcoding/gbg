/**
 * ADRReviewUnitComments
 *
 * Comment thread for a review unit.
 */
import React, { useState } from 'react'
import { MessageCircle, Send, User } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Comment } from '../schemas/status'

// -----------------------------------------------------------------------------
// Props
// -----------------------------------------------------------------------------

export interface ADRReviewUnitCommentsProps {
  /**
   * List of comments.
   */
  comments: Comment[]

  /**
   * Callback when a new comment is added.
   */
  onAddComment: (content: string) => void

  /**
   * Current user name for new comments.
   */
  currentUser?: string

  /**
   * Whether the comment input is expanded by default.
   */
  defaultExpanded?: boolean

  /**
   * Optional className for the container.
   */
  className?: string
}

// -----------------------------------------------------------------------------
// Single Comment
// -----------------------------------------------------------------------------

interface CommentItemProps {
  comment: Comment
}

function CommentItem({ comment }: CommentItemProps) {
  const formattedDate =
    comment.timestamp instanceof Date
      ? comment.timestamp.toLocaleString()
      : new Date(comment.timestamp).toLocaleString()

  return (
    <div className="flex gap-3 p-3 bg-neutral-800/50 rounded-lg">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-neutral-700 flex items-center justify-center">
        <User className="w-4 h-4 text-neutral-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium text-neutral-200">{comment.author}</span>
          <span className="text-xs text-neutral-500">{formattedDate}</span>
        </div>
        <p className="text-sm text-neutral-300 whitespace-pre-wrap">{comment.content}</p>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Component
// -----------------------------------------------------------------------------

export function ADRReviewUnitComments({
  comments,
  onAddComment,
  currentUser = 'Val',
  defaultExpanded = false,
  className,
}: ADRReviewUnitCommentsProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || comments.length > 0)
  const [newComment, setNewComment] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (newComment.trim()) {
      onAddComment(newComment.trim())
      setNewComment('')
    }
  }

  return (
    <div className={cn('mt-3', className)}>
      {/* Toggle Button */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-2 text-sm text-neutral-400 hover:text-neutral-200 transition-colors"
      >
        <MessageCircle className="w-4 h-4" />
        <span>
          Comments ({comments.length})
          {!isExpanded && ' — Click to expand'}
        </span>
      </button>

      {/* Comments Section */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Existing Comments */}
          {comments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}

          {/* Add Comment Form */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={`Add a comment as ${currentUser}...`}
              className="flex-1 px-3 py-2 text-sm bg-neutral-800 border border-neutral-700 rounded-lg text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-neutral-700 disabled:text-neutral-500 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
