import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { nanoid } from "nanoid";
import type { IdGeneratorConfig as IdGeneratorConfigType, IdStrategy } from "../types";

/**
 * IdGeneratorConfig Tag - Configuration for ID generation strategy
 * Must be defined BEFORE IdGenerator to avoid circular dependency
 */
export class IdGeneratorConfig extends Context.Tag("app/layers/IdGeneratorConfig")<
  IdGeneratorConfig,
  IdGeneratorConfigType
>() {
  static Default = Layer.succeed(
    this,
    this.of({
      strategy: "nanoid" as IdStrategy,
    })
  );

  static Custom = (config: IdGeneratorConfigType) =>
    Layer.succeed(this, this.of(config));
}

/**
 * IdGenerator Service - Configurable ID generation for layers
 *
 * Supports multiple strategies:
 * - nanoid: Fast, URL-safe IDs (default)
 * - uuid: Standard UUIDs
 * - custom: User-provided generator function
 */
export class IdGenerator extends Effect.Service<IdGenerator>()("app/layers/IdGenerator", {
  effect: Effect.gen(function* () {
    const config = yield* IdGeneratorConfig;

    const generate = (): string => {
      switch (config.strategy) {
        case "nanoid":
          return nanoid();
        case "uuid":
          return crypto.randomUUID();
        case "custom":
          return config.customGenerator?.() ?? nanoid();
        default:
          return nanoid();
      }
    };

    return {
      generate,
    } as const;
  }),
  dependencies: [IdGeneratorConfig.Default],
}) {}
