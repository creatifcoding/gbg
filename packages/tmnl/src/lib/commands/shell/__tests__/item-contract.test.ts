import { describe, expect, it, vi } from 'vitest'
import { Effect } from 'effect'
import {
  decodeItemModelUnknown,
  decodeItemModelsUnknown,
  shellRowToItemModel,
  type NuCmdkItemModel,
} from '../item-contract'
import type { NuCmdkShellRow } from '../types'

const makeValidItem = (overrides: Partial<NuCmdkItemModel> = {}): NuCmdkItemModel => ({
  version: 1,
  semantic: {
    itemId: 'item-1',
    label: 'Run Remediation Pipeline',
    description: 'Pipeline V-4821-A • Active',
    kind: 'pipeline',
    status: 'Active',
  },
  actions: [
    {
      actionId: 'item-1:execute',
      kind: 'execute',
      label: 'Execute',
      resolverIdentity: 'command:run.pipeline',
      payload: null,
    },
  ],
  display: {
    iconToken: 'pipeline',
    badges: [{ text: 'ACTIVE', tone: 'success' }],
    emphasis: 'accent',
    shortcuts: ['↵'],
  },
  layout: {
    sectionKey: 'suggested-actions',
    sectionPriority: 10,
    density: 'comfortable',
    compactMeta: false,
    pinTop: false,
  },
  telemetry: {
    providerId: 'commands',
    laneId: 'command-search',
    traceId: 'trace-1',
    impressionId: 'impression-1',
    attributes: {
      score: 0.91,
    },
  },
  extensions: {
    'commands.metadata': { source: 'fixture' },
  },
  ...overrides,
})

describe('item-contract decode boundary (#1025)', () => {
  it('decodes a valid provider item payload', async () => {
    const input = makeValidItem()
    const decoded = await Effect.runPromise(decodeItemModelUnknown(input))
    expect(decoded.semantic.itemId).toBe('item-1')
    expect(decoded.display.badges[0]?.text).toBe('ACTIVE')
  })

  it('rejects invalid extension key in strict decode', async () => {
    const input = {
      ...makeValidItem(),
      extensions: {
        badkey: { nope: true },
      },
    }

    await expect(Effect.runPromise(decodeItemModelUnknown(input))).rejects.toBeTruthy()
  })

  it('drop-invalid mode keeps valid items and emits violations', async () => {
    const onViolation = vi.fn((violation: unknown) => Effect.succeed(violation))

    const inputs: ReadonlyArray<unknown> = [
      makeValidItem({ semantic: { ...makeValidItem().semantic, itemId: 'ok-1' } }),
      {
        ...makeValidItem({ semantic: { ...makeValidItem().semantic, itemId: 'bad-1' } }),
        extensions: { badkey: { nope: true } },
      },
      makeValidItem({ semantic: { ...makeValidItem().semantic, itemId: 'ok-2' } }),
    ]

    const decoded = await Effect.runPromise(
      decodeItemModelsUnknown(inputs, {
        mode: 'drop-invalid',
        onViolation,
      }),
    )

    expect(decoded.map((item) => item.semantic.itemId)).toEqual(['ok-1', 'ok-2'])
    expect(onViolation).toHaveBeenCalledTimes(1)
  })

  it('strict mode fails fast when one payload is invalid', async () => {
    const inputs: ReadonlyArray<unknown> = [
      makeValidItem(),
      {
        ...makeValidItem(),
        extensions: { badkey: { nope: true } },
      },
    ]

    await expect(
      Effect.runPromise(
        decodeItemModelsUnknown(inputs, {
          mode: 'strict',
        }),
      ),
    ).rejects.toBeTruthy()
  })
})

describe('shellRowToItemModel compatibility mapper (#1026)', () => {
  it('maps NuCmdkShellRow into valid item contract', async () => {
    const row: NuCmdkShellRow = {
      rowId: 'row-1',
      label: 'View Datagrid Testbed',
      description: 'Monitoring • Variants',
      kind: 'action',
      score: 0.77,
      rendererToken: 'renderer.command.action',
      resolverIdentity: 'command:view.testbed',
      badges: [{ text: 'INFO', tone: 'info' }],
      shortcuts: ['G', 'T'],
      sectionKey: 'operations',
      sectionTitle: 'Operations',
      sectionPriority: 30,
    }

    const item = shellRowToItemModel(row, {
      providerId: 'commands',
      laneId: 'command-search',
    })

    const decoded = await Effect.runPromise(decodeItemModelUnknown(item))
    expect(decoded.semantic.itemId).toBe('row-1')
    expect(decoded.telemetry.providerId).toBe('commands')
    expect(decoded.layout.sectionKey).toBe('operations')
    expect(decoded.layout.sectionPriority).toBe(30)
    expect(decoded.actions[0]?.kind).toBe('execute')
  })
})
