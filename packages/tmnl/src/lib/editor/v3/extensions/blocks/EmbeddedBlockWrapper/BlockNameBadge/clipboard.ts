/**
 * Clipboard Utilities
 *
 * Copy operations for block name and ID.
 * Uses navigator.clipboard API with fallback.
 *
 * @module editor/v3/extensions/blocks/BlockNameBadge/clipboard
 */

// =============================================================================
// Types
// =============================================================================

export interface CopyResult {
  success: boolean;
  error?: string;
}

// =============================================================================
// Copy Functions
// =============================================================================

/**
 * Copy text to clipboard using modern API with fallback.
 */
async function copyToClipboard(text: string): Promise<CopyResult> {
  // Try modern clipboard API first
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true };
    } catch (err) {
      // Fall through to fallback
      console.warn('Clipboard API failed, trying fallback:', err);
    }
  }

  // Fallback: execCommand (deprecated but widely supported)
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    if (successful) {
      return { success: true };
    } else {
      return { success: false, error: 'execCommand failed' };
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Copy failed',
    };
  }
}

/**
 * Copy block name to clipboard.
 *
 * @param name - The block name to copy (without @ prefix)
 */
export async function copyBlockName(name: string | null): Promise<void> {
  if (!name) {
    throw new Error('No block name to copy');
  }

  const result = await copyToClipboard(name);
  if (!result.success) {
    throw new Error(result.error ?? 'Failed to copy name');
  }
}

/**
 * Copy block ID to clipboard.
 *
 * @param blockId - The full block ID to copy
 */
export async function copyBlockId(blockId: string): Promise<void> {
  if (!blockId) {
    throw new Error('No block ID to copy');
  }

  const result = await copyToClipboard(blockId);
  if (!result.success) {
    throw new Error(result.error ?? 'Failed to copy ID');
  }
}

/**
 * Copy formatted block reference to clipboard.
 * Format: @name (blockId)
 *
 * @param name - The block name
 * @param blockId - The block ID
 */
export async function copyBlockReference(
  name: string | null,
  blockId: string
): Promise<void> {
  const displayName = name ?? 'untitled';
  const text = `@${displayName} (${blockId})`;

  const result = await copyToClipboard(text);
  if (!result.success) {
    throw new Error(result.error ?? 'Failed to copy reference');
  }
}
