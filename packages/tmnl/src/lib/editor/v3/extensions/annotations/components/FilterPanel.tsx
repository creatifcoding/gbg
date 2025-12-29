/**
 * FilterPanel Component
 *
 * UI panel for filtering annotations by various criteria:
 * - Intent type (Hyperlink, Note, Citation, etc.)
 * - Visual style (highlight, pill, squiggle, etc.)
 * - Tags
 * - Created by (user, agent, system)
 *
 * @module editor/v3/extensions/annotations/components/FilterPanel
 */

import { useCallback, useMemo, useState } from 'react';
import { useAtomValue } from '@effect-atom/atom-react';
import {
  Filter,
  Eye,
  EyeOff,
  Tag,
  Palette,
  Zap,
  User,
  Bot,
  Settings,
  X,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import {
  markStatsAtom,
  markCountAtom,
  visibleMarkIdsAtom,
  activeQueryAtom,
  globalVisibilityAtom,
  queryOps,
  visibilityOps,
} from '../atoms';
import type { AnnotationQuery } from '../services';

// =============================================================================
// Types
// =============================================================================

export interface FilterPanelProps {
  /** Additional class names */
  className?: string;

  /** Whether panel is initially expanded */
  defaultExpanded?: boolean;

  /** Callback when filter changes */
  onFilterChange?: (query: AnnotationQuery | null) => void;

  /** Whether to show visibility controls */
  showVisibilityControls?: boolean;

  /** Whether to show stats */
  showStats?: boolean;
}

// =============================================================================
// Intent Type Options
// =============================================================================

const INTENT_TYPES = [
  { key: 'Hyperlink', label: 'Links', icon: '🔗' },
  { key: 'Ultralink', label: 'Docs', icon: '📄' },
  { key: 'Popover', label: 'Popovers', icon: '💬' },
  { key: 'Action', label: 'Actions', icon: '⚡' },
  { key: 'Citation', label: 'Citations', icon: '📚' },
  { key: 'Note', label: 'Notes', icon: '📝' },
] as const;

const VISUAL_STYLES = [
  { key: 'highlight', label: 'Highlight', color: 'bg-yellow-500/30' },
  { key: 'pill', label: 'Pill', color: 'bg-cyan-500/30' },
  { key: 'squiggle', label: 'Squiggle', color: 'bg-purple-500/30' },
  { key: 'underline', label: 'Underline', color: 'bg-blue-500/30' },
  { key: 'none', label: 'None', color: 'bg-gray-500/30' },
] as const;

const CREATED_BY = [
  { key: 'user', label: 'User', icon: User },
  { key: 'agent', label: 'Agent', icon: Bot },
  { key: 'system', label: 'System', icon: Settings },
] as const;

// =============================================================================
// Component
// =============================================================================

export function FilterPanel({
  className = '',
  defaultExpanded = false,
  onFilterChange,
  showVisibilityControls = true,
  showStats = true,
}: FilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [selectedIntentTypes, setSelectedIntentTypes] = useState<Set<string>>(new Set());
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set());
  const [selectedCreatedBy, setSelectedCreatedBy] = useState<Set<string>>(new Set());
  const [tagInput, setTagInput] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const stats = useAtomValue(markStatsAtom);
  const totalCount = useAtomValue(markCountAtom);
  const visibleIds = useAtomValue(visibleMarkIdsAtom);
  const activeQuery = useAtomValue(activeQueryAtom);
  const globalVisible = useAtomValue(globalVisibilityAtom);

  const visibleCount = visibleIds.size;
  const hiddenCount = totalCount - visibleCount;
  const hasActiveFilter = activeQuery !== null;

  // Build query from selections
  const buildQuery = useCallback((): AnnotationQuery | null => {
    const intentTypes = Array.from(selectedIntentTypes);
    const visualStyles = Array.from(selectedStyles);
    const createdBy = Array.from(selectedCreatedBy);

    if (
      intentTypes.length === 0 &&
      visualStyles.length === 0 &&
      createdBy.length === 0 &&
      selectedTags.length === 0
    ) {
      return null;
    }

    return {
      intentTypes: intentTypes.length > 0 ? intentTypes : undefined,
      visualStyles: visualStyles.length > 0 ? visualStyles : undefined,
      createdBy: createdBy.length > 0 ? (createdBy[0] as 'user' | 'agent' | 'system') : undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    };
  }, [selectedIntentTypes, selectedStyles, selectedCreatedBy, selectedTags]);

  // Apply filter
  const applyFilter = useCallback(async () => {
    const query = buildQuery();
    if (query) {
      await queryOps.applyFilter({ query });
    } else {
      await queryOps.clearFilter();
    }
    onFilterChange?.(query);
  }, [buildQuery, onFilterChange]);

  // Clear filter
  const clearFilter = useCallback(async () => {
    setSelectedIntentTypes(new Set());
    setSelectedStyles(new Set());
    setSelectedCreatedBy(new Set());
    setSelectedTags([]);
    await queryOps.clearFilter();
    onFilterChange?.(null);
  }, [onFilterChange]);

  // Toggle intent type
  const toggleIntentType = useCallback((type: string) => {
    setSelectedIntentTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  // Toggle visual style
  const toggleStyle = useCallback((style: string) => {
    setSelectedStyles((prev) => {
      const next = new Set(prev);
      if (next.has(style)) {
        next.delete(style);
      } else {
        next.add(style);
      }
      return next;
    });
  }, []);

  // Toggle created by
  const toggleCreatedBy = useCallback((source: string) => {
    setSelectedCreatedBy((prev) => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        // Single select for created by
        next.clear();
        next.add(source);
      }
      return next;
    });
  }, []);

  // Add tag
  const addTag = useCallback(() => {
    const tag = tagInput.trim();
    if (tag && !selectedTags.includes(tag)) {
      setSelectedTags((prev) => [...prev, tag]);
      setTagInput('');
    }
  }, [tagInput, selectedTags]);

  // Remove tag
  const removeTag = useCallback((tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  // Stats by intent type
  const intentStats = useMemo(() => {
    const result: Record<string, number> = {};
    for (const { key } of INTENT_TYPES) {
      result[key] = stats.byIntentType.get(key) ?? 0;
    }
    return result;
  }, [stats.byIntentType]);

  return (
    <div
      className={`rounded-lg border border-tmnl-border bg-tmnl-surface-1 ${className}`}
    >
      {/* Header */}
      <button
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-tmnl-text-primary hover:bg-tmnl-surface-2 transition-colors rounded-t-lg"
        onClick={() => setIsExpanded(!isExpanded)}
        type="button"
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-tmnl-accent-primary" />
          <span>Annotation Filters</span>
          {hasActiveFilter && (
            <span className="inline-flex items-center rounded-full bg-tmnl-accent-primary/20 px-2 py-0.5 text-xs text-tmnl-accent-primary">
              Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {showStats && (
            <span className="text-xs text-tmnl-text-muted">
              {visibleCount}/{totalCount}
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-tmnl-text-muted" />
          ) : (
            <ChevronDown className="h-4 w-4 text-tmnl-text-muted" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            animate={{ height: 'auto', opacity: 1 }}
            className="overflow-hidden"
            exit={{ height: 0, opacity: 0 }}
            initial={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="space-y-4 px-3 pb-3">
              {/* Visibility controls */}
              {showVisibilityControls && (
                <div className="flex items-center justify-between pt-2 border-t border-tmnl-border">
                  <span className="text-xs text-tmnl-text-muted">Global Visibility</span>
                  <button
                    className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors ${
                      globalVisible
                        ? 'bg-tmnl-accent-primary/20 text-tmnl-accent-primary'
                        : 'bg-tmnl-surface-2 text-tmnl-text-muted'
                    }`}
                    onClick={() => visibilityOps.toggleGlobal()}
                    type="button"
                  >
                    {globalVisible ? (
                      <>
                        <Eye className="h-3 w-3" />
                        <span>Visible</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3 w-3" />
                        <span>Hidden</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Intent Type Filter */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-tmnl-text-muted">
                  <Zap className="h-3 w-3" />
                  <span>Intent Type</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {INTENT_TYPES.map(({ key, label, icon }) => {
                    const count = intentStats[key];
                    const isSelected = selectedIntentTypes.has(key);
                    return (
                      <button
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs transition-colors ${
                          isSelected
                            ? 'bg-tmnl-accent-primary text-tmnl-surface-0'
                            : 'bg-tmnl-surface-2 text-tmnl-text-secondary hover:bg-tmnl-surface-3'
                        }`}
                        disabled={count === 0}
                        key={key}
                        onClick={() => toggleIntentType(key)}
                        type="button"
                      >
                        <span>{icon}</span>
                        <span>{label}</span>
                        <span className="opacity-60">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Visual Style Filter */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-tmnl-text-muted">
                  <Palette className="h-3 w-3" />
                  <span>Visual Style</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {VISUAL_STYLES.map(({ key, label, color }) => {
                    const count = stats.byVisualType.get(key) ?? 0;
                    const isSelected = selectedStyles.has(key);
                    return (
                      <button
                        className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs transition-colors ${
                          isSelected
                            ? 'bg-tmnl-accent-primary text-tmnl-surface-0'
                            : `${color} text-tmnl-text-secondary hover:brightness-110`
                        }`}
                        disabled={count === 0}
                        key={key}
                        onClick={() => toggleStyle(key)}
                        type="button"
                      >
                        <span>{label}</span>
                        <span className="opacity-60">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Created By Filter */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-tmnl-text-muted">
                  <User className="h-3 w-3" />
                  <span>Created By</span>
                </div>
                <div className="flex gap-2">
                  {CREATED_BY.map(({ key, label, icon: Icon }) => {
                    const count = stats.byCreatedBy.get(key) ?? 0;
                    const isSelected = selectedCreatedBy.has(key);
                    return (
                      <button
                        className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors ${
                          isSelected
                            ? 'bg-tmnl-accent-primary text-tmnl-surface-0'
                            : 'bg-tmnl-surface-2 text-tmnl-text-secondary hover:bg-tmnl-surface-3'
                        }`}
                        disabled={count === 0}
                        key={key}
                        onClick={() => toggleCreatedBy(key)}
                        type="button"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{label}</span>
                        <span className="opacity-60">({count})</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Tag Filter */}
              <div className="space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-tmnl-text-muted">
                  <Tag className="h-3 w-3" />
                  <span>Tags</span>
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-md border border-tmnl-border bg-tmnl-surface-0 px-2 py-1 text-xs text-tmnl-text-primary placeholder:text-tmnl-text-muted focus:border-tmnl-accent-primary focus:outline-none"
                    onKeyDown={(e) => e.key === 'Enter' && addTag()}
                    placeholder="Add tag..."
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                  />
                  <button
                    className="rounded-md bg-tmnl-surface-2 px-2 py-1 text-xs text-tmnl-text-secondary hover:bg-tmnl-surface-3 transition-colors"
                    onClick={addTag}
                    type="button"
                  >
                    Add
                  </button>
                </div>
                {selectedTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedTags.map((tag) => (
                      <span
                        className="inline-flex items-center gap-1 rounded-full bg-tmnl-accent-purple/20 px-2 py-0.5 text-xs text-tmnl-accent-purple"
                        key={tag}
                      >
                        <span>{tag}</span>
                        <button
                          className="hover:text-tmnl-text-primary transition-colors"
                          onClick={() => removeTag(tag)}
                          type="button"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-2 border-t border-tmnl-border">
                <button
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-tmnl-accent-primary px-3 py-1.5 text-xs font-medium text-tmnl-surface-0 hover:bg-tmnl-accent-primary/90 transition-colors"
                  onClick={applyFilter}
                  type="button"
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>Apply Filter</span>
                </button>
                <button
                  className="inline-flex items-center justify-center gap-1.5 rounded-md bg-tmnl-surface-2 px-3 py-1.5 text-xs text-tmnl-text-secondary hover:bg-tmnl-surface-3 transition-colors"
                  onClick={clearFilter}
                  type="button"
                >
                  <X className="h-3.5 w-3.5" />
                  <span>Clear</span>
                </button>
              </div>

              {/* Hidden count */}
              {hiddenCount > 0 && (
                <div className="text-center text-xs text-tmnl-text-muted">
                  {hiddenCount} annotation{hiddenCount !== 1 ? 's' : ''} hidden by filter
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default FilterPanel;
