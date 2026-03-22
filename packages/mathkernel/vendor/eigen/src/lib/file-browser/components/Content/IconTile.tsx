/**
 * IconTile Component
 *
 * Level 3: Individual file/folder tile in icon view.
 *
 * @module file-browser/components/Content
 */

import { memo, useCallback, type MouseEvent } from 'react'
import {
  Folder,
  File,
  FileText,
  FileCode,
  FileImage,
  FileVideo,
  FileAudio,
  FileArchive,
  FileCog,
  FileJson,
  Link2,
} from 'lucide-react'

import { DARK_SIDE } from '../../tokens'
import type { FileEntry } from '../../schemas'

// =============================================================================
// Types
// =============================================================================

export interface IconTileProps {
  /** File entry */
  entry: FileEntry
  /** Is selected */
  isSelected?: boolean
  /** Is focused */
  isFocused?: boolean
  /** Icon size */
  iconSize?: 'sm' | 'md' | 'lg'
  /** Called on click */
  onClick?: (e: MouseEvent) => void
  /** Called on double-click */
  onDoubleClick?: () => void
  /** Additional CSS class */
  className?: string
}

// =============================================================================
// Icon Size Mapping
// =============================================================================

const ICON_SIZES = {
  sm: { icon: 32, tile: 80 },
  md: { icon: 48, tile: 100 },
  lg: { icon: 64, tile: 120 },
} as const

// =============================================================================
// File Type to Icon Mapping
// =============================================================================

function getFileIcon(entry: FileEntry, size: number) {
  if (entry.type === 'directory') {
    return <Folder size={size} color={DARK_SIDE.colors.fileType.directory} />
  }

  if (entry.type === 'symlink') {
    return <Link2 size={size} color={DARK_SIDE.colors.fileType.symlink} />
  }

  // Map by extension
  const ext = entry.extension?.toLowerCase()

  switch (ext) {
    // Code files
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'py':
    case 'rs':
    case 'go':
    case 'cpp':
    case 'c':
    case 'h':
    case 'java':
    case 'rb':
    case 'php':
    case 'sh':
    case 'bash':
    case 'zsh':
      return <FileCode size={size} color={DARK_SIDE.colors.fileType.executable} />

    // JSON/Config
    case 'json':
    case 'jsonc':
      return <FileJson size={size} color={DARK_SIDE.colors.accent.amber} />

    // Text/Markdown
    case 'txt':
    case 'md':
    case 'mdx':
    case 'rst':
      return <FileText size={size} color={DARK_SIDE.colors.text.secondary} />

    // Images
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
    case 'ico':
    case 'bmp':
      return <FileImage size={size} color={DARK_SIDE.colors.accent.cyan} />

    // Video
    case 'mp4':
    case 'mov':
    case 'avi':
    case 'mkv':
    case 'webm':
      return <FileVideo size={size} color={DARK_SIDE.colors.accent.red} />

    // Audio
    case 'mp3':
    case 'wav':
    case 'flac':
    case 'ogg':
    case 'm4a':
      return <FileAudio size={size} color={DARK_SIDE.colors.accent.amber} />

    // Archives
    case 'zip':
    case 'tar':
    case 'gz':
    case 'rar':
    case '7z':
    case 'bz2':
      return <FileArchive size={size} color={DARK_SIDE.colors.accent.amber} />

    // Config files
    case 'yml':
    case 'yaml':
    case 'toml':
    case 'ini':
    case 'env':
    case 'conf':
    case 'cfg':
      return <FileCog size={size} color={DARK_SIDE.colors.text.tertiary} />

    default:
      return <File size={size} color={DARK_SIDE.colors.fileType.file} />
  }
}

// =============================================================================
// Component
// =============================================================================

export const IconTile = memo(function IconTile({
  entry,
  isSelected = false,
  isFocused = false,
  iconSize = 'md',
  onClick,
  onDoubleClick,
  className = '',
}: IconTileProps) {
  const sizes = ICON_SIZES[iconSize]

  const handleClick = useCallback(
    (e: MouseEvent) => {
      onClick?.(e)
    },
    [onClick]
  )

  const handleDoubleClick = useCallback(() => {
    onDoubleClick?.()
  }, [onDoubleClick])

  // Determine colors based on state
  const bgColor = isSelected
    ? DARK_SIDE.colors.surfaceSelected
    : 'transparent'
  const borderColor = isFocused
    ? DARK_SIDE.colors.accent.green
    : isSelected
      ? DARK_SIDE.colors.accent.greenMuted
      : 'transparent'
  const textColor = entry.hidden
    ? DARK_SIDE.colors.text.tertiary
    : DARK_SIDE.colors.text.primary

  return (
    <div
      className={`icon-tile ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        width: sizes.tile,
        height: sizes.tile + 24, // Extra space for text
        padding: DARK_SIDE.spacing['2'],
        background: bgColor,
        border: `1px solid ${borderColor}`,
        cursor: 'pointer',
        transition: `all ${DARK_SIDE.animation.duration.fast} ${DARK_SIDE.animation.easing.easeOut}`,
        boxShadow: isFocused ? DARK_SIDE.shadows.glow.green : 'none',
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = DARK_SIDE.colors.surfaceHover
          e.currentTarget.style.borderColor = DARK_SIDE.colors.border.default
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = 'transparent'
          e.currentTarget.style.borderColor = 'transparent'
        }
      }}
      data-file-id={entry.id}
      data-file-type={entry.type}
    >
      {/* Icon */}
      <div
        style={{
          marginBottom: DARK_SIDE.spacing['2'],
          opacity: entry.hidden ? 0.5 : 1,
        }}
      >
        {getFileIcon(entry, sizes.icon)}
      </div>

      {/* Name */}
      <div
        style={{
          width: '100%',
          textAlign: 'center',
          fontSize: DARK_SIDE.typography.size.xs,
          fontFamily: DARK_SIDE.typography.family.mono,
          color: textColor,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          lineHeight: DARK_SIDE.typography.lineHeight.tight,
        }}
        title={entry.name}
      >
        {entry.name}
      </div>
    </div>
  )
})
