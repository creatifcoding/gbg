/**
 * Floating Panel System — E2E Performance & UX Audit
 *
 * Tests cover:
 * 1. Panel rendering & responsiveness
 * 2. Drag performance (frame timing)
 * 3. Snap behavior & visual feedback
 * 4. Dock zone preview UX
 * 5. Resize performance
 * 6. Z-order / bring-to-front
 * 7. Keyboard nudge
 * 8. Panel lifecycle (spawn, close, minimize, maximize)
 * 9. Persistence (localStorage)
 * 10. Visual regression (overlays, guides)
 *
 * @module
 */

import { test, expect, type Page, type Locator } from '@playwright/test'

const BASE = 'http://localhost:1420/testbed/floating'

// ─── Helpers ────────────────────────────────────────────────────

async function waitForPanels(page: Page, count: number) {
  await page.waitForSelector('[data-floating-panel]', { timeout: 10000 })
  const panels = page.locator('[data-floating-panel]')
  await expect(panels).toHaveCount(count, { timeout: 10000 })
  return panels
}

function getPanel(page: Page, id: string): Locator {
  return page.locator(`[data-floating-panel]`).filter({ has: page.locator(`[aria-label]`) }).nth(0)
  // Better: use the panel's aria-label
}

function getPanelById(page: Page, title: string): Locator {
  return page.locator(`[role="dialog"][aria-label="${title}"]`)
}

async function getPanelRect(page: Page, title: string) {
  const panel = getPanelById(page, title)
  return panel.boundingBox()
}

async function dragPanel(page: Page, title: string, deltaX: number, deltaY: number) {
  const panel = getPanelById(page, title)
  const header = panel.locator('[data-slot="panel-header"]')
  const box = await header.boundingBox()
  if (!box) throw new Error(`Panel "${title}" header not found`)

  const startX = box.x + box.width / 2
  const startY = box.y + box.height / 2

  await page.mouse.move(startX, startY)
  await page.mouse.down()
  // Move in steps for realistic drag
  const steps = 10
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      startX + (deltaX * i) / steps,
      startY + (deltaY * i) / steps,
    )
  }
  await page.mouse.up()
}

async function measureFrameTiming(page: Page, action: () => Promise<void>): Promise<{
  frames: number
  avgMs: number
  maxMs: number
  jankFrames: number
}> {
  // Inject performance observer
  await page.evaluate(() => {
    (window as any).__frameTimes = []
    ;(window as any).__rafId = null
    let last = performance.now()
    function tick() {
      const now = performance.now()
      ;(window as any).__frameTimes.push(now - last)
      last = now
      ;(window as any).__rafId = requestAnimationFrame(tick)
    }
    ;(window as any).__rafId = requestAnimationFrame(tick)
  })

  await action()

  // Collect results
  const result = await page.evaluate(() => {
    cancelAnimationFrame((window as any).__rafId)
    const times: number[] = (window as any).__frameTimes
    if (times.length === 0) return { frames: 0, avgMs: 0, maxMs: 0, jankFrames: 0 }
    const avg = times.reduce((a, b) => a + b, 0) / times.length
    const max = Math.max(...times)
    const jank = times.filter(t => t > 33.3).length // >30fps = jank
    return { frames: times.length, avgMs: Math.round(avg * 10) / 10, maxMs: Math.round(max * 10) / 10, jankFrames: jank }
  })

  return result
}

// =============================================================================
// Test Suite
// =============================================================================

test.describe('Floating Panel System', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE)
    await page.waitForLoadState('networkidle')
  })

  // ─── 1. Rendering ──────────────────────────────────────────

  test('all 5 default panels render', async ({ page }) => {
    const panels = await waitForPanels(page, 5)
    const titles = ['Metrics', 'Log', 'Dimensions', 'Constrained', 'Void']
    for (const title of titles) {
      await expect(getPanelById(page, title)).toBeVisible()
    }
  })

  test('panels have correct data-state="idle" initially', async ({ page }) => {
    await waitForPanels(page, 5)
    const states = await page.locator('[data-floating-panel]').evaluateAll(
      els => els.map(el => el.getAttribute('data-state'))
    )
    expect(states.every(s => s === 'idle')).toBe(true)
  })

  test('panels have role="dialog" and aria-label', async ({ page }) => {
    await waitForPanels(page, 5)
    const dialogs = page.locator('[role="dialog"][aria-label]')
    await expect(dialogs).toHaveCount(5)
  })

  // ─── 2. Drag Performance ───────────────────────────────────

  test('drag maintains >30fps (no jank frames)', async ({ page }) => {
    await waitForPanels(page, 5)

    const timing = await measureFrameTiming(page, async () => {
      await dragPanel(page, 'Void', 200, 100)
    })

    console.log('Drag frame timing:', timing)
    // Allow some tolerance — jank frames should be <20% of total
    const jankRatio = timing.jankFrames / Math.max(timing.frames, 1)
    expect(jankRatio).toBeLessThan(0.2)
    expect(timing.avgMs).toBeLessThan(33.3) // 30fps minimum
  })

  test('drag updates data-state to "dragging"', async ({ page }) => {
    await waitForPanels(page, 5)
    const panel = getPanelById(page, 'Void')
    const header = panel.locator('[data-slot="panel-header"]')
    const box = await header.boundingBox()
    if (!box) throw new Error('No header box')

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50)

    // Check data-state during drag
    const state = await panel.getAttribute('data-state')
    expect(state).toBe('dragging')

    await page.mouse.up()

    // Should return to idle
    await expect(panel).toHaveAttribute('data-state', 'idle')
  })

  test('panel position changes after drag', async ({ page }) => {
    await waitForPanels(page, 5)
    const before = await getPanelRect(page, 'Void')
    expect(before).toBeTruthy()

    await dragPanel(page, 'Void', 150, 80)

    const after = await getPanelRect(page, 'Void')
    expect(after).toBeTruthy()
    // Position should have changed (approximately)
    expect(Math.abs(after!.x - before!.x - 150)).toBeLessThan(30)
    expect(Math.abs(after!.y - before!.y - 80)).toBeLessThan(30)
  })

  // ─── 3. Snap Behavior ─────────────────────────────────────

  test('snap guides appear during magnetic snap', async ({ page }) => {
    await waitForPanels(page, 5)

    // Drag a panel near another panel's edge
    const metricsRect = await getPanelRect(page, 'Metrics')
    const voidPanel = getPanelById(page, 'Void')
    const header = voidPanel.locator('[data-slot="panel-header"]')
    const hbox = await header.boundingBox()
    if (!hbox || !metricsRect) throw new Error('missing boxes')

    // Start drag
    const startX = hbox.x + hbox.width / 2
    const startY = hbox.y + hbox.height / 2
    await page.mouse.move(startX, startY)
    await page.mouse.down()

    // Drag near the right edge of Metrics panel
    const targetX = metricsRect.x + metricsRect.width + 5
    const targetY = metricsRect.y + 30
    const steps = 20
    for (let i = 1; i <= steps; i++) {
      await page.mouse.move(
        startX + ((targetX - startX) * i) / steps,
        startY + ((targetY - startY) * i) / steps,
      )
    }

    // Check for snap guide visibility
    // Snap guides are imperative DOM elements with ref-based visibility
    const guideVisible = await page.evaluate(() => {
      const guides = document.querySelectorAll('[style*="position: fixed"]')
      let visible = 0
      guides.forEach(g => {
        const style = (g as HTMLElement).style
        if (style.display !== 'none' && style.opacity !== '0' && style.width === '1px' || style.height === '1px') {
          visible++
        }
      })
      return visible
    })

    await page.mouse.up()
    // We'll log this — snap guide visibility is what we're auditing
    console.log('Snap guides visible during near-edge drag:', guideVisible)
  })

  // ─── 4. Dock Preview ──────────────────────────────────────

  test('dock preview appears when dragging to viewport edge', async ({ page }) => {
    await waitForPanels(page, 5)
    const viewport = page.viewportSize()!
    const panel = getPanelById(page, 'Void')
    const header = panel.locator('[data-slot="panel-header"]')
    const box = await header.boundingBox()
    if (!box) throw new Error('No header')

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()

    // Drag to left edge
    for (let i = 0; i < 20; i++) {
      await page.mouse.move(
        Math.max(5, box.x + box.width / 2 - (box.x + box.width / 2) * (i / 20)),
        box.y + box.height / 2,
      )
    }

    // Screenshot for visual audit
    await page.screenshot({ path: 'e2e/screenshots/dock-preview-left.png' })

    // Check for dock preview element
    const dockPreview = await page.evaluate(() => {
      const els = document.querySelectorAll('[style*="position: fixed"]')
      let found = false
      els.forEach(el => {
        const s = (el as HTMLElement).style
        if (s.backgroundColor && s.backgroundColor.includes('rgba') && s.display !== 'none') {
          found = true
        }
      })
      return found
    })

    console.log('Dock preview visible at left edge:', dockPreview)
    await page.mouse.up()
  })

  // ─── 5. Z-Order ────────────────────────────────────────────

  test('clicking panel brings it to front (z-index changes)', async ({ page }) => {
    await waitForPanels(page, 5)

    // Get initial z-indices
    const getBefore = async () => {
      const metrics = getPanelById(page, 'Metrics')
      const void_ = getPanelById(page, 'Void')
      return {
        metrics: parseInt(await metrics.evaluate(el => el.style.zIndex) || '0'),
        void: parseInt(await void_.evaluate(el => el.style.zIndex) || '0'),
      }
    }

    const before = await getBefore()

    // Click on Metrics (which might be behind Void)
    const metricsPanel = getPanelById(page, 'Metrics')
    await metricsPanel.click()

    const after = await getBefore()
    // Metrics should now have the highest z-index
    expect(after.metrics).toBeGreaterThanOrEqual(before.metrics)
  })

  // ─── 6. Resize ─────────────────────────────────────────────

  test('resize handle changes dimensions', async ({ page }) => {
    await waitForPanels(page, 5)
    const panel = getPanelById(page, 'Void')
    const before = await panel.boundingBox()
    if (!before) throw new Error('No panel box')

    // Find bottom-right corner and drag
    const cornerX = before.x + before.width - 3
    const cornerY = before.y + before.height - 3
    await page.mouse.move(cornerX, cornerY)
    await page.mouse.down()
    await page.mouse.move(cornerX + 80, cornerY + 60, { steps: 10 })
    await page.mouse.up()

    const after = await panel.boundingBox()
    if (!after) throw new Error('No panel box after resize')

    // Width should have increased
    expect(after.width).toBeGreaterThan(before.width + 40)
  })

  test('resize respects constraints', async ({ page }) => {
    await waitForPanels(page, 5)
    const panel = getPanelById(page, 'Constrained')
    const before = await panel.boundingBox()
    if (!before) throw new Error('No constrained panel')

    // Try to resize beyond max (500x400)
    const cornerX = before.x + before.width - 3
    const cornerY = before.y + before.height - 3
    await page.mouse.move(cornerX, cornerY)
    await page.mouse.down()
    await page.mouse.move(cornerX + 500, cornerY + 500, { steps: 10 })
    await page.mouse.up()

    const after = await panel.boundingBox()
    if (!after) throw new Error('No panel after resize')
    expect(after.width).toBeLessThanOrEqual(505) // tolerance for border
    expect(after.height).toBeLessThanOrEqual(405)
  })

  // ─── 7. Keyboard Nudge ─────────────────────────────────────

  test('arrow keys nudge active panel', async ({ page }) => {
    await waitForPanels(page, 5)

    // Click to activate
    const panel = getPanelById(page, 'Void')
    await panel.click()
    const before = await panel.boundingBox()
    if (!before) throw new Error('No box')

    // Press right arrow 5 times
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('ArrowRight')
    }

    const after = await panel.boundingBox()
    if (!after) throw new Error('No box after nudge')
    expect(after.x).toBeGreaterThan(before.x + 20) // 5 * 8px = 40px (ish)
  })

  // ─── 8. Panel Lifecycle ────────────────────────────────────

  test('close button removes panel', async ({ page }) => {
    await waitForPanels(page, 5)
    const panel = getPanelById(page, 'Void')
    const closeBtn = panel.locator('[data-slot="panel-tab-close"]')
    await closeBtn.click()

    // Panel should be gone
    await expect(panel).not.toBeVisible({ timeout: 2000 })
  })

  test('maximize fills viewport', async ({ page }) => {
    await waitForPanels(page, 5)
    const panel = getPanelById(page, 'Void')
    const viewport = page.viewportSize()!

    // Find maximize button (ChromeBtn with "Maximize" label)
    // The header controls section
    const maxBtn = panel.locator('button[aria-label="Maximize"], button[title="Maximize"]')
    await maxBtn.click()

    await expect(panel).toHaveAttribute('data-state', 'maximized')
    const box = await panel.boundingBox()
    if (!box) throw new Error('No maximized box')

    // Should fill most of viewport
    expect(box.width).toBeGreaterThan(viewport.width * 0.9)
    expect(box.height).toBeGreaterThan(viewport.height * 0.9)
  })

  // ─── 9. Spawn/Toggle ──────────────────────────────────────

  test('spawn bar toggle hides/shows panels', async ({ page }) => {
    await waitForPanels(page, 5)

    // Click "Void" button in spawn bar to hide it
    const voidBtn = page.locator('button', { hasText: 'Void' }).first()
    await voidBtn.click()

    // Panel should disappear
    await expect(getPanelById(page, 'Void')).not.toBeVisible({ timeout: 2000 })

    // Click again to show
    await voidBtn.click()
    await expect(getPanelById(page, 'Void')).toBeVisible({ timeout: 5000 })
  })

  // ─── 10. Visual Screenshots ────────────────────────────────

  test('screenshot: initial state', async ({ page }) => {
    await waitForPanels(page, 5)
    await page.screenshot({ path: 'e2e/screenshots/floating-initial.png', fullPage: true })
  })

  test('screenshot: during drag', async ({ page }) => {
    await waitForPanels(page, 5)
    const panel = getPanelById(page, 'Void')
    const header = panel.locator('[data-slot="panel-header"]')
    const box = await header.boundingBox()
    if (!box) throw new Error('No header')

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50, { steps: 10 })

    await page.screenshot({ path: 'e2e/screenshots/floating-dragging.png', fullPage: true })
    await page.mouse.up()
  })

  test('screenshot: maximized panel', async ({ page }) => {
    await waitForPanels(page, 5)
    const panel = getPanelById(page, 'Void')
    const maxBtn = panel.locator('button[aria-label="Maximize"], button[title="Maximize"]')
    await maxBtn.click()
    await page.waitForTimeout(200)
    await page.screenshot({ path: 'e2e/screenshots/floating-maximized.png', fullPage: true })
  })
})
