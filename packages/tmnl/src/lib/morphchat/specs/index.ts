export { Conductor } from './conductor'
export { Dock } from './dock'
export { Dialog } from './dialog'
export { Widget } from './widget'
export { Spotlight } from './spotlight'
export { Embed } from './embed'
export { Monitor } from './monitor'
export { Card } from './card'

import { Conductor } from './conductor'
import { Dock } from './dock'
import { Dialog } from './dialog'
import { Widget } from './widget'
import { Spotlight } from './spotlight'
import { Embed } from './embed'
import { Monitor } from './monitor'
import { Card } from './card'
import type { ChatSurfaceSpec } from '../schemas/surface-spec'

/** All preset specs, keyed by _tag. */
export const ALL_PRESETS: Record<string, ChatSurfaceSpec> = {
  Conductor, Dock, Dialog, Widget, Spotlight, Embed, Monitor, Card,
}

/** Ordered array for UI enumeration. */
export const PRESET_LIST: ReadonlyArray<ChatSurfaceSpec> = [
  Conductor, Dock, Dialog, Widget, Spotlight, Embed, Monitor, Card,
]
