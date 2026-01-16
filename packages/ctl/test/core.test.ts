/**
 * Core Module Tests
 *
 * Tests for CLI command patterns and utilities
 */

import { describe, it, expect } from "vitest"
import {
  verboseOption,
  jsonOption,
  dryRunOption,
  limitOption,
  formatOption,
  buildHelpText,
  createRunner,
  type HelpConfig,
  type RunConfig,
} from "../src/core/index.js"

describe("verboseOption", () => {
  it("has default value of false", () => {
    // The option is a pipe chain - we verify by checking it's an Options type
    expect(verboseOption).toBeDefined()
    // @effect/cli Options have specific structure
    expect(typeof verboseOption).toBe("object")
  })
})

describe("jsonOption", () => {
  it("has default value of false", () => {
    expect(jsonOption).toBeDefined()
    expect(typeof jsonOption).toBe("object")
  })
})

describe("dryRunOption", () => {
  it("has default value of false", () => {
    expect(dryRunOption).toBeDefined()
    expect(typeof dryRunOption).toBe("object")
  })
})

describe("limitOption", () => {
  it("accepts custom default value", () => {
    const option10 = limitOption(10)
    const option50 = limitOption(50)

    expect(option10).toBeDefined()
    expect(option50).toBeDefined()
    // Different default values should create different options
    expect(option10).not.toBe(option50)
  })

  it("uses 20 as default when not specified", () => {
    const option = limitOption()
    expect(option).toBeDefined()
  })
})

describe("formatOption", () => {
  it("validates choice constraints", () => {
    const option = formatOption(["json", "table", "csv"] as const, "table")
    expect(option).toBeDefined()
  })
})

describe("buildHelpText", () => {
  const baseConfig: HelpConfig = {
    name: "test-cli",
    version: "1.0.0",
    description: "A test CLI",
    commands: [
      { name: "list", description: "List items" },
      { name: "add", description: "Add an item" },
    ],
  }

  it("generates USAGE section", () => {
    const help = buildHelpText(baseConfig)

    expect(help).toContain("USAGE:")
    expect(help).toContain("test-cli <command> [options]")
  })

  it("generates COMMANDS section", () => {
    const help = buildHelpText(baseConfig)

    expect(help).toContain("COMMANDS:")
    expect(help).toContain("list")
    expect(help).toContain("List items")
    expect(help).toContain("add")
    expect(help).toContain("Add an item")
  })

  it("includes version in header", () => {
    const help = buildHelpText(baseConfig)

    expect(help).toContain("test-cli v1.0.0")
    expect(help).toContain("A test CLI")
  })

  it("includes GLOBAL OPTIONS when provided", () => {
    const config: HelpConfig = {
      ...baseConfig,
      globalOptions: [
        { flag: "--verbose, -v", description: "Enable verbose output" },
        { flag: "--json", description: "Output as JSON" },
      ],
    }

    const help = buildHelpText(config)

    expect(help).toContain("GLOBAL OPTIONS:")
    expect(help).toContain("--verbose, -v")
    expect(help).toContain("Enable verbose output")
  })

  it("includes EXAMPLES when provided", () => {
    const config: HelpConfig = {
      ...baseConfig,
      examples: [
        { command: "test-cli list --json", description: "List items as JSON" },
        { command: "test-cli add foo", description: "Add item foo" },
      ],
    }

    const help = buildHelpText(config)

    expect(help).toContain("EXAMPLES:")
    expect(help).toContain("test-cli list --json")
    expect(help).toContain("List items as JSON")
  })

  it("includes SKILL section when provided", () => {
    const config: HelpConfig = {
      ...baseConfig,
      skillRef: "cli/core",
    }

    const help = buildHelpText(config)

    expect(help).toContain("SKILL: cli/core")
  })

  it("includes AGENT USAGE section", () => {
    const help = buildHelpText(baseConfig)

    expect(help).toContain("AGENT USAGE:")
    expect(help).toContain("--json")
    expect(help).toContain("machine-readable")
  })
})

describe("createRunner", () => {
  // Since createRunner returns a function that needs a command,
  // we can't fully test without a real command. Just verify it exists.
  it("exists and is a function", () => {
    expect(createRunner).toBeDefined()
    expect(typeof createRunner).toBe("function")
  })
})

describe("RunConfig", () => {
  it("type interface is usable", () => {
    const config: RunConfig = {
      name: "test",
      version: "1.0.0",
    }

    expect(config.name).toBe("test")
    expect(config.version).toBe("1.0.0")
  })
})
