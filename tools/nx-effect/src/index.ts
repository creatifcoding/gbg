/**
 * @gbg/nx-effect — NX plugin for Effect v4 migration
 *
 * Responsibilities:
 * 1. createNodesV2: Tag v4 projects with metadata for tooling/CI
 * 2. createDependencies: Future — validate v4 packages don't import v3-only code
 * 3. Generators: `effect-v4-lib` scaffolds new @tmnl/* packages
 *
 * Registration in nx.json:
 *   { "plugin": "./tools/nx-effect" }
 *
 * @module
 */

import {
  type CreateNodesV2,
  type CreateDependencies,
  createNodesFromFiles,
  readJsonFile,
  joinPathFragments,
} from "@nx/devkit"
import { existsSync } from "node:fs"

// ─── Constants ──────────────────────────────────────

export const EFFECT_V4_TAG = "effect:v4"
export const EFFECT_V4_ALIAS = "effect-v4"
export const EFFECT_V4_VERSION = "4.0.0-beta.23"

// ─── Plugin Options ─────────────────────────────────

export interface NxEffectPluginOptions {
  /** Additional tags to infer on v4 projects */
  readonly extraTags?: string[]
}

// ─── createNodesV2 ──────────────────────────────────

/**
 * Scan project.json files. If a project has the `effect:v4` tag,
 * attach metadata for downstream tooling (CI badges, Nx Console, etc.)
 */
export const createNodesV2: CreateNodesV2<NxEffectPluginOptions> = [
  "**/project.json",
  async (configFiles, options, context) => {
    return createNodesFromFiles(
      (configFile, opts, ctx) => {
        const projectRoot = configFile.replace("/project.json", "")
        const fullPath = joinPathFragments(ctx.workspaceRoot, configFile)

        if (!existsSync(fullPath)) {
          return {}
        }

        let projectJson: { tags?: string[] }
        try {
          projectJson = readJsonFile(fullPath)
        } catch {
          return {}
        }

        const tags: string[] = projectJson.tags ?? []
        if (!tags.includes(EFFECT_V4_TAG)) {
          return {}
        }

        // Attach metadata to v4-tagged projects
        return {
          projects: {
            [projectRoot]: {
              metadata: {
                effectVersion: "v4",
                aliasPackage: EFFECT_V4_ALIAS,
                effectNpmVersion: EFFECT_V4_VERSION,
                description: `Effect v4 package (${EFFECT_V4_ALIAS}@npm:effect@${EFFECT_V4_VERSION})`,
                ...(opts?.extraTags ? { extraTags: opts.extraTags } : {}),
              },
            },
          },
        }
      },
      configFiles,
      options,
      context,
    )
  },
]

// ─── createDependencies ─────────────────────────────

/**
 * Future: validate that `effect:v4` projects don't depend on v3-only packages.
 * For now, module boundary enforcement is handled by @nx/enforce-module-boundaries.
 */
export const createDependencies: CreateDependencies = (_options, _context) => {
  return []
}
