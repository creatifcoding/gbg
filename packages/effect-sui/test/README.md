# Effect-Sui Test Tiers

| Tier | Directory | Runtime |
|---|---|---|
| Unit | `src/**/*.test.ts`, `test/unit/**/*.test.ts` | No network |
| Property | `test/property/**/*.test.ts` | No network |
| Integration | `test/integration/**/*.test.ts` | Fake client / local process only |
| E2E | `test/e2e/**/*.test.ts` | Docker Testcontainers Sui localnet |

The e2e harness should follow Mysten's own TS SDK pattern in `../../submodules/ts-sdks/packages/sui/test/e2e/utils/globalSetup.ts`.
