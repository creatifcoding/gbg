/**
 * Content persistence — write-through localStorage ring for MorphChat messages.
 * @module morphchat/persistence
 */
export {
  ContentSnapshot,
  type ContentSnapshot as ContentSnapshotType,
  writeContent,
  readContent,
  clearContent,
  ContentStoreLive,
} from './content-store'
