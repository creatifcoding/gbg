/**
 * @module plugins/metaskill-services/skill-config
 *
 * SkillConfig — pure configuration service.
 * Provides resolved paths for skill discovery.
 *
 * No deps. Leaf service. Created via Layer.succeed.
 */

import * as Layer from "effect-v4/Layer"
import * as Context from "effect-v4/Context"
import { join } from "node:path"

// ── Shape ────────────────────────────────────────────────────────

export interface SkillConfigShape {
  readonly cwd: string
  readonly skillsDir: string
  readonly metaskillDir: string
}

// ── Service ──────────────────────────────────────────────────────

export class SkillConfig extends Context.Service<SkillConfig, SkillConfigShape>()(
  "@gbg/codemode-metaskill/SkillConfig"
) {}

// ── Layer Factory ────────────────────────────────────────────────

export function makeSkillConfigLayer(cwd: string) {
  return Layer.succeed(
    SkillConfig,
    SkillConfig.of({
      cwd,
      skillsDir: join(cwd, ".pi", "skills"),
      metaskillDir: join(cwd, ".pi", "skills", "metaskill"),
    }),
  )
}
