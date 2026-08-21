import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { createRequire } from "node:module";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.resolve(here, "..");
const require = createRequire(import.meta.url);

describe("isolation", () => {
  it("package.json has no @mastra/core or @tmnl/mantis-assistant", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(pkgRoot, "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = {
      ...pkg.dependencies,
      ...pkg.devDependencies,
    };
    assert.equal(deps["@mastra/core"], undefined);
    assert.equal(deps["@tmnl/mantis-assistant"], undefined);
  });

  it("source does not import @mastra/core or @tmnl/mantis-assistant", () => {
    const srcDir = path.join(pkgRoot, "src");
    const { readdirSync } = require("node:fs") as typeof import("node:fs");
    for (const name of readdirSync(srcDir)) {
      if (!name.endsWith(".ts")) continue;
      const text = readFileSync(path.join(srcDir, name), "utf8");
      assert.equal(
        text.includes("@mastra/core"),
        false,
        `${name} imports @mastra/core`,
      );
      assert.equal(
        text.includes("@tmnl/mantis-assistant"),
        false,
        `${name} imports @tmnl/mantis-assistant`,
      );
    }
  });

  it("research-summary.v1 is not present on this branch", () => {
    const def = path.resolve(
      pkgRoot,
      "../../../assistant/workflows/definitions/research-summary.v1.json",
    );
    const adm = path.resolve(
      pkgRoot,
      "../../../assistant/workflows/admissions/research-summary.v1.json",
    );
    assert.equal(existsSync(def), false, "definitions/research-summary.v1.json must not exist");
    assert.equal(existsSync(adm), false, "admissions/research-summary.v1.json must not exist");
  });
});
