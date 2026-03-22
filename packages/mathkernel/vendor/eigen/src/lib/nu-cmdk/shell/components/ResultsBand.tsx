import { createContext, useContext, useMemo } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Command as CommandPrimitive } from 'cmdk'
import { Effect } from 'effect'
import {
  decodeItemModelsUnknown,
  shellRowToItemModel,
  type NuCmdkItemActionIntent,
  type NuCmdkItemDecodeMode,
  type NuCmdkItemDecodeViolation,
  type NuCmdkItemDisplay,
  type NuCmdkItemLayoutHints,
  type NuCmdkItemModel,
  type NuCmdkItemSemantic,
  type NuCmdkItemTelemetry,
  type NuCmdkItemSection,
} from '../item-contract'
import type { NuCmdkShellRow } from '../types'
import { NU_CMDK_TOKENS } from '../tokens'

export interface ResultsBandSectionIdentity {
  readonly sectionId: string
  readonly title: string
  readonly order?: number
}

export interface ResultsBandSectionModel {
  readonly sectionId: string
  readonly title: string
  readonly order: number
  readonly hint: string | undefined
  readonly items: ReadonlyArray<NuCmdkItemModel>
}

export interface ResultsBandItemRenderContext {
  readonly item: NuCmdkItemModel
  readonly semantic: NuCmdkItemSemantic
  readonly display: NuCmdkItemDisplay
  readonly layout: NuCmdkItemLayoutHints
  readonly telemetry: NuCmdkItemTelemetry
  readonly select: () => void
  readonly runAction: (action: NuCmdkItemActionIntent) => void
}

export type ResultsBandItemSlotRenderer = (context: ResultsBandItemRenderContext) => ReactNode

export interface ResultsBandItemSlotOverrides {
  readonly icon?: ResultsBandItemSlotRenderer
  readonly content?: ResultsBandItemSlotRenderer
  readonly meta?: ResultsBandItemSlotRenderer
  readonly actions?: ResultsBandItemSlotRenderer
}

export interface ResultsBandProps {
  readonly items?: ReadonlyArray<NuCmdkItemModel>
  readonly rawItems?: ReadonlyArray<unknown>
  readonly rows?: ReadonlyArray<NuCmdkShellRow>
  readonly onSelectItem?: (item: NuCmdkItemModel) => void
  readonly onSelectRow?: (rowId: string) => void
  readonly onActionIntent?: (
    item: NuCmdkItemModel,
    action: NuCmdkItemActionIntent,
  ) => Effect.Effect<void, unknown, never>
  readonly onItemDecodeViolation?: (violation: NuCmdkItemDecodeViolation) => void
  readonly decodeMode?: NuCmdkItemDecodeMode
  readonly rowMapper?: (row: NuCmdkShellRow) => NuCmdkItemModel
  readonly sectionResolver?: (item: NuCmdkItemModel) => ResultsBandSectionIdentity
  readonly sectionHintResolver?: (section: ResultsBandSectionModel) => string | undefined
  readonly sections?: ReadonlyArray<NuCmdkItemSection>
  readonly itemSlots?: ResultsBandItemSlotOverrides
  readonly resolveItemSlots?: (
    context: ResultsBandItemRenderContext,
  ) => Partial<ResultsBandItemSlotOverrides> | undefined
}

export interface ResultsBandRootProps {
  readonly children: ReactNode
}

export interface ResultsBandEmptyProps {
  readonly children?: ReactNode
}

export interface ResultsBandSectionHeaderProps {
  readonly title?: string
  readonly hint?: string
}

export interface ResultsBandSectionProps {
  readonly section: ResultsBandSectionModel
  readonly children: ReactNode
}

export interface ResultsBandItemRootProps {
  readonly children: ReactNode
}

export interface ResultsBandItemLeftProps {
  readonly children: ReactNode
}

export interface ResultsBandItemRightProps {
  readonly children: ReactNode
}

export interface ResultsBandItemIconSlotProps {
  readonly children: ReactNode
}

export interface ResultsBandItemContentSlotProps {
  readonly children: ReactNode
}

export interface ResultsBandItemMetaSlotProps {
  readonly children: ReactNode
}

export interface ResultsBandItemActionsSlotProps {
  readonly children: ReactNode
}

export interface ResultsBandItemIconProps {
  readonly glyph?: string
}

export interface ResultsBandItemContentProps {
  readonly label?: string
  readonly description?: string | null
}

export interface ResultsBandBadgeProps {
  readonly text: string
}

export interface ResultsBandShortcutProps {
  readonly text: string
}

export interface ResultsBandItemMetaProps {
  readonly status?: string | null
  readonly shortcuts?: ReadonlyArray<string>
  readonly children?: ReactNode
}

export interface ResultsBandItemActionGroupProps {
  readonly actions?: ReadonlyArray<NuCmdkItemActionIntent>
  readonly children?: ReactNode
}

export interface ResultsBandItemActionButtonProps {
  readonly action?: NuCmdkItemActionIntent
  readonly actionId?: string
  readonly children?: ReactNode
}

export interface ResultsBandItemProps {
  readonly item: NuCmdkItemModel
  readonly onSelectItem: (item: NuCmdkItemModel) => void
  readonly slots?: ResultsBandItemSlotOverrides
  readonly resolveSlots?: (
    context: ResultsBandItemRenderContext,
  ) => Partial<ResultsBandItemSlotOverrides> | undefined
  readonly onActionIntent?: (
    item: NuCmdkItemModel,
    action: NuCmdkItemActionIntent,
  ) => Effect.Effect<void, unknown, never>
  readonly children?: ReactNode
}

interface ResultsBandSectionContextValue {
  readonly section: ResultsBandSectionModel
}

interface ResultsBandItemContextValue extends ResultsBandItemRenderContext {
  readonly status: string | null
  readonly glyph: string
}

const ResultsBandSectionContext = createContext<ResultsBandSectionContextValue | null>(null)
const ResultsBandItemContext = createContext<ResultsBandItemContextValue | null>(null)

const listStyle: CSSProperties = {
  padding: '6px',
  overflow: 'auto',
  flex: 1,
  background: NU_CMDK_TOKENS.surface.band,
}

const sectionTitleStyle: CSSProperties = {
  fontFamily: NU_CMDK_TOKENS.typography.family.heading,
  fontSize: NU_CMDK_TOKENS.typography.size.xs,
  letterSpacing: '0.08em',
  textTransform: 'none',
  color: NU_CMDK_TOKENS.text.tertiary,
  margin: '8px 4px 4px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
}

const itemStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '7px 8px',
  marginBottom: '4px',
  borderRadius: NU_CMDK_TOKENS.border.radius.row,
  borderLeft: '2px solid transparent',
  border: `1px solid ${NU_CMDK_TOKENS.border.subtle}`,
  backgroundColor: NU_CMDK_TOKENS.surface.row,
  cursor: 'pointer',
  minHeight: '44px',
}

const itemLeftStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  minWidth: 0,
  flex: 1,
}

const itemRightStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  justifyContent: 'flex-end',
  flexShrink: 0,
}

const iconEnvelopeStyle: CSSProperties = {
  width: '24px',
  height: '24px',
  minWidth: '24px',
  borderRadius: NU_CMDK_TOKENS.border.radius.row,
  overflow: 'hidden',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const iconTileStyle: CSSProperties = {
  ...iconEnvelopeStyle,
  border: `1px solid ${NU_CMDK_TOKENS.border.accent}`,
  backgroundColor: NU_CMDK_TOKENS.accent.cyanGlow,
  color: NU_CMDK_TOKENS.accent.cyan,
  fontFamily: NU_CMDK_TOKENS.typography.family.data,
  fontSize: NU_CMDK_TOKENS.typography.size.xs,
  fontWeight: 700,
}

const contentEnvelopeStyle: CSSProperties = {
  minWidth: 0,
  maxWidth: '100%',
  overflow: 'hidden',
}

const primaryTextStyle: CSSProperties = {
  fontFamily: NU_CMDK_TOKENS.typography.family.ui,
  fontSize: NU_CMDK_TOKENS.typography.size.sm,
  color: NU_CMDK_TOKENS.text.primary,
  lineHeight: 1.16,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const secondaryTextStyle: CSSProperties = {
  fontFamily: NU_CMDK_TOKENS.typography.family.ui,
  fontSize: NU_CMDK_TOKENS.typography.size.xs,
  color: NU_CMDK_TOKENS.text.tertiary,
  marginTop: '2px',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const rightMetaStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '4px',
  color: NU_CMDK_TOKENS.text.secondary,
  fontFamily: NU_CMDK_TOKENS.typography.family.data,
  fontSize: NU_CMDK_TOKENS.typography.size.xs,
}

const badgeStyle: CSSProperties = {
  border: `1px solid ${NU_CMDK_TOKENS.accent.warn}`,
  backgroundColor: NU_CMDK_TOKENS.surface.badgeWarn,
  color: NU_CMDK_TOKENS.accent.warn,
  borderRadius: NU_CMDK_TOKENS.border.radius.badge,
  padding: '1px 6px',
  fontFamily: NU_CMDK_TOKENS.typography.family.data,
  fontSize: NU_CMDK_TOKENS.typography.size.xs,
  letterSpacing: '0.03em',
  textTransform: 'none',
}

const shortcutStyle: CSSProperties = {
  border: `1px solid ${NU_CMDK_TOKENS.border.subtle}`,
  borderRadius: NU_CMDK_TOKENS.border.radius.row,
  minWidth: '20px',
  height: '20px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '0 5px',
  backgroundColor: NU_CMDK_TOKENS.surface.pill,
  fontFamily: NU_CMDK_TOKENS.typography.family.data,
  fontSize: NU_CMDK_TOKENS.typography.size.xs,
  color: NU_CMDK_TOKENS.text.secondary,
}

const actionsGroupStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
}

const actionButtonStyle: CSSProperties = {
  border: `1px solid ${NU_CMDK_TOKENS.border.subtle}`,
  borderRadius: NU_CMDK_TOKENS.border.radius.row,
  minHeight: '20px',
  padding: '1px 6px',
  backgroundColor: NU_CMDK_TOKENS.surface.pill,
  color: NU_CMDK_TOKENS.text.secondary,
  fontFamily: NU_CMDK_TOKENS.typography.family.data,
  fontSize: NU_CMDK_TOKENS.typography.size.xs,
  cursor: 'pointer',
}

const DEV_SECTION_HEURISTICS_FLAG =
  import.meta.env.DEV && import.meta.env.VITE_NU_CMDK_DEV_SECTION_HEURISTICS !== '0'

const fallbackResultsSection = (item: NuCmdkItemModel): ResultsBandSectionIdentity => ({
  sectionId: 'results',
  title: 'Results',
  order: item.layout.sectionPriority > 0 ? item.layout.sectionPriority : 99,
})

const heuristicSectionResolver = (item: NuCmdkItemModel): ResultsBandSectionIdentity => {
  switch (item.semantic.kind) {
    case 'pipeline':
      return { sectionId: 'suggested-actions', title: 'Suggested Actions', order: 10 }
    case 'entity':
      return { sectionId: 'entities', title: 'Entities', order: 20 }
    case 'action':
    case 'command':
      return { sectionId: 'operations', title: 'Operations', order: 30 }
    default:
      return fallbackResultsSection(item)
  }
}

const sectionFromLayout = (item: NuCmdkItemModel): ResultsBandSectionIdentity | undefined => {
  if (!item.layout.sectionKey) {
    return undefined
  }

  return {
    sectionId: item.layout.sectionKey,
    title: item.layout.sectionKey,
    order: item.layout.sectionPriority,
  }
}

export const defaultSectionResolver = (item: NuCmdkItemModel): ResultsBandSectionIdentity => {
  const explicit = sectionFromLayout(item)
  if (explicit) {
    return explicit
  }

  if (DEV_SECTION_HEURISTICS_FLAG) {
    return heuristicSectionResolver(item)
  }

  return fallbackResultsSection(item)
}

export const defaultSectionHintResolver = (
  section: ResultsBandSectionModel,
): string | undefined => {
  if (DEV_SECTION_HEURISTICS_FLAG && (section.sectionId === 'entities' || section.title === 'Entities')) {
    return `${section.items.length} detected`
  }
  return section.hint
}

const sectionCatalogResolver = (
  catalog: ReadonlyMap<string, NuCmdkItemSection>,
  item: NuCmdkItemModel,
): ResultsBandSectionIdentity | undefined => {
  if (!item.layout.sectionKey) {
    return undefined
  }

  const section = catalog.get(item.layout.sectionKey)
  if (!section) {
    return {
      sectionId: item.layout.sectionKey,
      title: item.layout.sectionKey,
      order: item.layout.sectionPriority,
    }
  }

  return {
    sectionId: section.sectionId,
    title: section.title,
    order: section.order,
  }
}

const sectionCatalogHintResolver = (
  catalog: ReadonlyMap<string, NuCmdkItemSection>,
  section: ResultsBandSectionModel,
): string | undefined => {
  const hinted = catalog.get(section.sectionId)?.hint
  if (hinted) {
    return hinted
  }

  return defaultSectionHintResolver(section)
}

const deriveStatus = (item: NuCmdkItemModel): string | null => {
  if (item.semantic.status) {
    return item.semantic.status
  }

  const warn = item.display.badges.find((badge) => badge.tone === 'warn' || badge.tone === 'error')
  if (warn) return warn.text

  const success = item.display.badges.find((badge) => badge.tone === 'success' || badge.tone === 'info')
  if (success) return success.text

  return null
}

export const groupItemsBySection = (
  items: ReadonlyArray<NuCmdkItemModel>,
  sectionResolver: (item: NuCmdkItemModel) => ResultsBandSectionIdentity = defaultSectionResolver,
  sectionHintResolver: (section: ResultsBandSectionModel) => string | undefined = defaultSectionHintResolver,
): ReadonlyArray<ResultsBandSectionModel> => {
  const map = new Map<string, { title: string; order: number; items: Array<NuCmdkItemModel> }>()

  for (const item of items) {
    const resolved = sectionResolver(item)
    const order = resolved.order ?? item.layout.sectionPriority
    const record = map.get(resolved.sectionId) ?? {
      title: resolved.title,
      order,
      items: [],
    }

    record.items.push(item)
    if (order < record.order) {
      record.order = order
    }

    map.set(resolved.sectionId, record)
  }

  const sections = Array.from(map.entries())
    .map(([sectionId, value]) => ({
      sectionId,
      title: value.title,
      order: value.order,
      hint: undefined as string | undefined,
      items: value.items,
    }))
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))

  return sections.map((section) => ({
    ...section,
    hint: sectionHintResolver(section),
  }))
}

function useResultsBandSectionContext(): ResultsBandSectionContextValue {
  const ctx = useContext(ResultsBandSectionContext)
  if (!ctx) {
    throw new Error('ResultsBand section components must be used inside ResultsBand.Section')
  }
  return ctx
}

function useResultsBandItemContext(): ResultsBandItemContextValue {
  const ctx = useContext(ResultsBandItemContext)
  if (!ctx) {
    throw new Error('ResultsBand item components must be used inside ResultsBand.Item')
  }
  return ctx
}

function ResultsBandRoot({ children }: ResultsBandRootProps) {
  return (
    <CommandPrimitive.List style={listStyle} data-band='results' data-slot='results-root'>
      {children}
    </CommandPrimitive.List>
  )
}

function ResultsBandEmpty({ children = 'No results' }: ResultsBandEmptyProps) {
  return (
    <CommandPrimitive.Empty style={secondaryTextStyle} data-slot='results-empty'>
      {children}
    </CommandPrimitive.Empty>
  )
}

function ResultsBandSectionHeader({ title, hint }: ResultsBandSectionHeaderProps) {
  const { section } = useResultsBandSectionContext()

  return (
    <div style={sectionTitleStyle} data-slot='results-section-header'>
      <span>{title ?? section.title}</span>
      {hint ?? section.hint ? <span>{hint ?? section.hint}</span> : null}
    </div>
  )
}

function ResultsBandSection({ section, children }: ResultsBandSectionProps) {
  const value = useMemo<ResultsBandSectionContextValue>(() => ({ section }), [section])

  return (
    <ResultsBandSectionContext.Provider value={value}>
      <section data-slot='results-section' data-section={section.sectionId}>
        {children}
      </section>
    </ResultsBandSectionContext.Provider>
  )
}

function ResultsBandItemRoot({ children }: ResultsBandItemRootProps) {
  const ctx = useResultsBandItemContext()

  return (
    <CommandPrimitive.Item
      value={ctx.semantic.itemId}
      onSelect={ctx.select}
      className='nu-cmdk-item'
      style={itemStyle}
      data-slot='results-item'
    >
      {children}
    </CommandPrimitive.Item>
  )
}

function ResultsBandItemLeft({ children }: ResultsBandItemLeftProps) {
  return (
    <div style={itemLeftStyle} data-slot='results-item-left'>
      {children}
    </div>
  )
}

function ResultsBandItemRight({ children }: ResultsBandItemRightProps) {
  return (
    <div style={itemRightStyle} data-slot='results-item-right'>
      {children}
    </div>
  )
}

function ResultsBandItemIconSlot({ children }: ResultsBandItemIconSlotProps) {
  return (
    <div style={iconEnvelopeStyle} data-slot='results-item-icon-slot'>
      {children}
    </div>
  )
}

function ResultsBandItemContentSlot({ children }: ResultsBandItemContentSlotProps) {
  return (
    <div style={contentEnvelopeStyle} data-slot='results-item-content-slot'>
      {children}
    </div>
  )
}

function ResultsBandItemMetaSlot({ children }: ResultsBandItemMetaSlotProps) {
  return (
    <div style={rightMetaStyle} data-slot='results-item-meta-slot'>
      {children}
    </div>
  )
}

function ResultsBandItemActionsSlot({ children }: ResultsBandItemActionsSlotProps) {
  return (
    <div style={actionsGroupStyle} data-slot='results-item-actions-slot'>
      {children}
    </div>
  )
}

function ResultsBandItemIcon({ glyph }: ResultsBandItemIconProps) {
  const ctx = useResultsBandItemContext()
  return (
    <span style={iconTileStyle} data-slot='results-item-icon'>
      {glyph ?? ctx.glyph}
    </span>
  )
}

function ResultsBandItemContent({ label, description }: ResultsBandItemContentProps) {
  const ctx = useResultsBandItemContext()
  const resolvedLabel = label ?? ctx.semantic.label
  const resolvedDescription = description ?? ctx.semantic.description

  return (
    <div data-slot='results-item-content'>
      <div style={primaryTextStyle}>{resolvedLabel}</div>
      {resolvedDescription ? <div style={secondaryTextStyle}>{resolvedDescription}</div> : null}
    </div>
  )
}

function ResultsBandBadge({ text }: ResultsBandBadgeProps) {
  return (
    <span style={badgeStyle} data-slot='results-item-badge'>
      {text}
    </span>
  )
}

function ResultsBandShortcut({ text }: ResultsBandShortcutProps) {
  return (
    <kbd style={shortcutStyle} data-slot='results-item-shortcut'>
      {text}
    </kbd>
  )
}

function ResultsBandItemMeta({ status, shortcuts, children }: ResultsBandItemMetaProps) {
  const ctx = useResultsBandItemContext()
  const resolvedStatus = status ?? ctx.status
  const resolvedShortcuts = shortcuts ?? ctx.display.shortcuts

  if (children) {
    return children
  }

  return (
    <>
      {resolvedStatus ? <ResultsBandBadge text={resolvedStatus} /> : null}
      {resolvedShortcuts.slice(0, 2).map((shortcut) => (
        <ResultsBandShortcut key={shortcut} text={shortcut} />
      ))}
    </>
  )
}

function ResultsBandItemActionButton({ action, actionId, children }: ResultsBandItemActionButtonProps) {
  const ctx = useResultsBandItemContext()
  const resolved =
    action ?? ctx.item.actions.find((candidate) => candidate.actionId === actionId) ?? null

  if (!resolved) return null

  return (
    <button
      type='button'
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        ctx.runAction(resolved)
      }}
      style={actionButtonStyle}
      data-slot='results-item-action-button'
      data-action-kind={resolved.kind}
    >
      {children ?? resolved.label}
    </button>
  )
}

function ResultsBandItemActionGroup({ actions, children }: ResultsBandItemActionGroupProps) {
  const ctx = useResultsBandItemContext()
  const resolved = actions ?? ctx.item.actions.filter((action) => action.kind !== 'execute')

  if (children) {
    return children
  }

  if (resolved.length === 0) {
    return null
  }

  return (
    <>
      {resolved.slice(0, 2).map((action) => (
        <ResultsBandItemActionButton key={action.actionId} action={action} />
      ))}
    </>
  )
}

function ResultsBandItem({
  item,
  onSelectItem,
  slots,
  resolveSlots,
  onActionIntent,
  children,
}: ResultsBandItemProps) {
  const select = () => onSelectItem(item)

  const runAction = (action: NuCmdkItemActionIntent) => {
    if (!onActionIntent) {
      return
    }

    void Effect.runPromise(
      onActionIntent(item, action).pipe(Effect.catchAll(() => Effect.void)),
    )
  }

  const value = useMemo<ResultsBandItemContextValue>(
    () => ({
      item,
      semantic: item.semantic,
      display: item.display,
      layout: item.layout,
      telemetry: item.telemetry,
      select,
      runAction,
      status: deriveStatus(item),
      glyph: item.display.iconToken ?? item.semantic.label.slice(0, 1).toUpperCase(),
    }),
    [item],
  )

  const localSlots = resolveSlots?.(value) ?? {}
  const resolvedSlots = {
    ...slots,
    ...localSlots,
  }

  const iconNode = resolvedSlots.icon ? resolvedSlots.icon(value) : <ResultsBandItemIcon />
  const contentNode = resolvedSlots.content ? resolvedSlots.content(value) : <ResultsBandItemContent />
  const metaNode = resolvedSlots.meta ? resolvedSlots.meta(value) : <ResultsBandItemMeta />
  const actionsNode = resolvedSlots.actions
    ? resolvedSlots.actions(value)
    : <ResultsBandItemActionGroup />

  return (
    <ResultsBandItemContext.Provider value={value}>
      <ResultsBandItemRoot>
        {children ?? (
          <>
            <ResultsBandItemLeft>
              <ResultsBandItemIconSlot>{iconNode}</ResultsBandItemIconSlot>
              <ResultsBandItemContentSlot>{contentNode}</ResultsBandItemContentSlot>
            </ResultsBandItemLeft>

            <ResultsBandItemRight>
              <ResultsBandItemMetaSlot>{metaNode}</ResultsBandItemMetaSlot>
              <ResultsBandItemActionsSlot>{actionsNode}</ResultsBandItemActionsSlot>
            </ResultsBandItemRight>
          </>
        )}
      </ResultsBandItemRoot>
    </ResultsBandItemContext.Provider>
  )
}

function ResultsBandBase({
  items,
  rawItems,
  rows,
  onSelectItem,
  onSelectRow,
  onActionIntent,
  onItemDecodeViolation,
  decodeMode = 'drop-invalid',
  rowMapper = shellRowToItemModel,
  sectionResolver,
  sectionHintResolver,
  sections,
  itemSlots,
  resolveItemSlots,
}: ResultsBandProps) {
  const mappedItems = useMemo(() => {
    if (items) {
      return items
    }

    if (rawItems) {
      return Effect.runSync(
        decodeItemModelsUnknown(rawItems, {
          mode: decodeMode,
          onViolation: onItemDecodeViolation
            ? (violation) => Effect.sync(() => onItemDecodeViolation(violation))
            : undefined,
        }).pipe(
          Effect.catchAll((error) => {
            if (onItemDecodeViolation) {
              onItemDecodeViolation({
                index: -1,
                input: rawItems,
                error,
              })
            }
            return Effect.succeed([] as ReadonlyArray<NuCmdkItemModel>)
          }),
        ),
      )
    }

    return rows?.map(rowMapper) ?? []
  }, [decodeMode, items, onItemDecodeViolation, rawItems, rowMapper, rows])

  const sectionCatalog = useMemo<ReadonlyMap<string, NuCmdkItemSection>>(
    () => new Map((sections ?? []).map((section) => [section.sectionId, section])),
    [sections],
  )

  const effectiveSectionResolver = useMemo(() => {
    if (sectionResolver) {
      return sectionResolver
    }

    return (item: NuCmdkItemModel): ResultsBandSectionIdentity =>
      sectionCatalogResolver(sectionCatalog, item) ?? defaultSectionResolver(item)
  }, [sectionCatalog, sectionResolver])

  const effectiveSectionHintResolver = useMemo(() => {
    if (sectionHintResolver) {
      return sectionHintResolver
    }

    return (section: ResultsBandSectionModel): string | undefined =>
      sectionCatalogHintResolver(sectionCatalog, section)
  }, [sectionCatalog, sectionHintResolver])

  const sectionModels = useMemo(
    () => groupItemsBySection(mappedItems, effectiveSectionResolver, effectiveSectionHintResolver),
    [effectiveSectionHintResolver, effectiveSectionResolver, mappedItems],
  )

  const handleSelectItem = (item: NuCmdkItemModel) => {
    onSelectItem?.(item)
    onSelectRow?.(item.semantic.itemId)
  }

  return (
    <ResultsBandRoot>
      <ResultsBandEmpty />

      {sectionModels.map((section) => (
        <ResultsBandSection key={section.sectionId} section={section}>
          <ResultsBandSectionHeader />
          {section.items.map((item) => (
            <ResultsBandItem
              key={item.semantic.itemId}
              item={item}
              onSelectItem={handleSelectItem}
              onActionIntent={onActionIntent}
              slots={itemSlots}
              resolveSlots={resolveItemSlots}
            />
          ))}
        </ResultsBandSection>
      ))}
    </ResultsBandRoot>
  )
}

type ResultsBandCompound = ((props: ResultsBandProps) => JSX.Element) & {
  Root: typeof ResultsBandRoot
  Empty: typeof ResultsBandEmpty
  Section: typeof ResultsBandSection
  SectionHeader: typeof ResultsBandSectionHeader
  Item: typeof ResultsBandItem
  ItemRoot: typeof ResultsBandItemRoot
  ItemLeft: typeof ResultsBandItemLeft
  ItemRight: typeof ResultsBandItemRight
  ItemIconSlot: typeof ResultsBandItemIconSlot
  ItemContentSlot: typeof ResultsBandItemContentSlot
  ItemMetaSlot: typeof ResultsBandItemMetaSlot
  ItemActionsSlot: typeof ResultsBandItemActionsSlot
  ItemIcon: typeof ResultsBandItemIcon
  ItemContent: typeof ResultsBandItemContent
  ItemMeta: typeof ResultsBandItemMeta
  ItemActionGroup: typeof ResultsBandItemActionGroup
  ItemActionButton: typeof ResultsBandItemActionButton
  Badge: typeof ResultsBandBadge
  Shortcut: typeof ResultsBandShortcut
  groupItemsBySection: typeof groupItemsBySection
  defaultSectionResolver: typeof defaultSectionResolver
  defaultSectionHintResolver: typeof defaultSectionHintResolver
}

export const ResultsBand = Object.assign(ResultsBandBase, {
  Root: ResultsBandRoot,
  Empty: ResultsBandEmpty,
  Section: ResultsBandSection,
  SectionHeader: ResultsBandSectionHeader,
  Item: ResultsBandItem,
  ItemRoot: ResultsBandItemRoot,
  ItemLeft: ResultsBandItemLeft,
  ItemRight: ResultsBandItemRight,
  ItemIconSlot: ResultsBandItemIconSlot,
  ItemContentSlot: ResultsBandItemContentSlot,
  ItemMetaSlot: ResultsBandItemMetaSlot,
  ItemActionsSlot: ResultsBandItemActionsSlot,
  ItemIcon: ResultsBandItemIcon,
  ItemContent: ResultsBandItemContent,
  ItemMeta: ResultsBandItemMeta,
  ItemActionGroup: ResultsBandItemActionGroup,
  ItemActionButton: ResultsBandItemActionButton,
  Badge: ResultsBandBadge,
  Shortcut: ResultsBandShortcut,
  groupItemsBySection,
  defaultSectionResolver,
  defaultSectionHintResolver,
}) as ResultsBandCompound
