/**
 * Skills Module Tests
 *
 * Tests for skill reference system - no external dependencies
 */

import { describe, it, expect } from "vitest"
import {
  skillRef,
  CTL_SKILLS,
  createManifest,
  generateSkillMd,
  generateSkillRule,
  formatSkillRef,
  formatSkillRefs,
  generateScaffold,
  DEFAULT_DISCIPLINE,
  type SkillRef,
  type SkillManifest,
  type SkillRuleEntry,
} from "../src/skills/index.js"

describe("skillRef", () => {
  it("creates SkillRef with name and trigger", () => {
    const ref = skillRef("cli/core", "CLI patterns")

    expect(ref.name).toBe("cli/core")
    expect(ref.trigger).toBe("CLI patterns")
    expect(ref.path).toBeUndefined()
  })

  it("includes optional path", () => {
    const ref = skillRef("cli/core", "CLI patterns", "skills/core/SKILL.md")

    expect(ref.name).toBe("cli/core")
    expect(ref.trigger).toBe("CLI patterns")
    expect(ref.path).toBe("skills/core/SKILL.md")
  })
})

describe("CTL_SKILLS", () => {
  it("has all required skill refs", () => {
    expect(CTL_SKILLS.core).toBeDefined()
    expect(CTL_SKILLS.persistence).toBeDefined()
    expect(CTL_SKILLS.messaging).toBeDefined()
    expect(CTL_SKILLS.services).toBeDefined()
    expect(CTL_SKILLS.config).toBeDefined()
  })

  it("each skill has name, trigger, and path", () => {
    for (const [key, skill] of Object.entries(CTL_SKILLS)) {
      expect(skill.name).toContain("cli/")
      expect(skill.trigger).toBeTruthy()
      expect(skill.path).toContain("SKILL.md")
    }
  })
})

describe("createManifest", () => {
  it("returns correct structure", () => {
    const manifest = createManifest("my-cli", "1.0.0")

    expect(manifest.name).toBe("my-cli")
    expect(manifest.version).toBe("1.0.0")
    expect(manifest.skills).toBeDefined()
    expect(Array.isArray(manifest.skills)).toBe(true)
    expect(manifest.dependencies).toBeDefined()
  })

  it("includes default core skill entry", () => {
    const manifest = createManifest("my-cli", "1.0.0")

    expect(manifest.skills.length).toBeGreaterThanOrEqual(1)
    const coreSkill = manifest.skills.find((s) => s.name.includes("core"))
    expect(coreSkill).toBeDefined()
    expect(coreSkill?.path).toContain("SKILL.md")
  })

  it("includes ctl dependencies", () => {
    const manifest = createManifest("my-cli", "1.0.0")

    expect(manifest.dependencies).toContain("cli/core")
    expect(manifest.dependencies).toContain("cli/messaging")
  })
})

describe("generateSkillMd", () => {
  it("includes frontmatter with name and description", () => {
    const md = generateSkillMd({
      name: "my-cli/core",
      description: "Core patterns for my-cli",
    })

    expect(md).toContain("---")
    expect(md).toContain("name: my-cli/core")
    expect(md).toContain("description: Core patterns for my-cli")
  })

  it("has When to Use and Instructions sections", () => {
    const md = generateSkillMd({
      name: "test",
      description: "test skill",
    })

    expect(md).toContain("## When to Use")
    expect(md).toContain("## Instructions")
  })

  it("includes allowed-tools when provided", () => {
    const md = generateSkillMd({
      name: "test",
      description: "test skill",
      allowedTools: ["Bash", "Read", "Write"],
    })

    expect(md).toContain("allowed-tools: [Bash, Read, Write]")
  })

  it("includes triggers in When to Use section", () => {
    const md = generateSkillMd({
      name: "test",
      description: "test skill",
      triggers: ["help me", "how to"],
    })

    expect(md).toContain('"help me"')
    expect(md).toContain('"how to"')
  })
})

describe("generateSkillRule", () => {
  it("returns correct structure", () => {
    const rule = generateSkillRule("my-skill", "Description", ["keyword1", "keyword2"])

    expect(rule.type).toBe("domain")
    expect(rule.enforcement).toBe("suggest")
    expect(rule.priority).toBe("medium")
    expect(rule.description).toBe("Description")
    expect(rule.promptTriggers.keywords).toContain("keyword1")
    expect(rule.promptTriggers.keywords).toContain("keyword2")
  })

  it("includes intent patterns when provided", () => {
    const rule = generateSkillRule("my-skill", "Description", ["keyword"], ["pattern.*match"])

    expect(rule.promptTriggers.intentPatterns).toContain("pattern.*match")
  })
})

describe("formatSkillRef", () => {
  it("formats basic skill reference", () => {
    const ref = skillRef("cli/core", "CLI patterns")
    const formatted = formatSkillRef(ref)

    expect(formatted).toContain("SKILL: cli/core")
    expect(formatted).toContain('Trigger: "CLI patterns"')
  })

  it("includes path when provided", () => {
    const ref = skillRef("cli/core", "CLI patterns", "skills/core/SKILL.md")
    const formatted = formatSkillRef(ref)

    expect(formatted).toContain("Path: skills/core/SKILL.md")
  })
})

describe("formatSkillRefs", () => {
  it("joins multiple refs with double newlines", () => {
    const refs = [
      skillRef("cli/core", "CLI patterns"),
      skillRef("cli/messaging", "error messages"),
    ]
    const formatted = formatSkillRefs(refs)

    expect(formatted).toContain("SKILL: cli/core")
    expect(formatted).toContain("SKILL: cli/messaging")
    expect(formatted).toContain("\n\n")
  })
})

describe("generateScaffold", () => {
  it("creates all scaffold files", () => {
    const files = generateScaffold("my-cli", "1.0.0")

    expect(Object.keys(files)).toContain("skills/core/SKILL.md")
    expect(Object.keys(files)).toContain("skills/errors/SKILL.md")
    expect(Object.keys(files)).toContain("skills/MANIFEST.json")
  })

  it("generates valid SKILL.md content", () => {
    const files = generateScaffold("my-cli", "1.0.0")
    const coreMd = files["skills/core/SKILL.md"]

    expect(coreMd).toContain("my-cli/core")
    expect(coreMd).toContain("---")
  })

  it("generates valid JSON manifest", () => {
    const files = generateScaffold("my-cli", "1.0.0")
    const manifestJson = files["skills/MANIFEST.json"]

    const manifest = JSON.parse(manifestJson)
    expect(manifest.name).toBe("my-cli")
    expect(manifest.version).toBe("1.0.0")
  })
})

describe("DEFAULT_DISCIPLINE", () => {
  it("has correct default values", () => {
    expect(DEFAULT_DISCIPLINE.level).toBe("warning")
    expect(DEFAULT_DISCIPLINE.requiredSkills).toContain("cli/core")
    expect(DEFAULT_DISCIPLINE.requiredSkills).toContain("cli/messaging")
    expect(DEFAULT_DISCIPLINE.skillsPath).toBe("skills/")
  })
})
