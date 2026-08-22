# A4a simulated terrarium

This is a **read-only simulator**. It is not a live terrarium, not a Tachyon gateway, and not an actuator.

## Run

```sh
cd projects/biomemetics/labs/mantis/assistant/simulator
npm install
npm test
npm run sim -- show known-fresh
npm run sim -- inject stale --fixture known-fresh --channel air.dry-bulb
npm run sim -- inject fault --fixture known-fresh --id pinch
```

Every value is `sourceClass: simulated`. Calibration is `cal.sim.a4a-unverified`. Video is availability metadata only (`stream=none`).

The CopilotKit card lives in `../ui/terrarium`. Missing `runtimeUrl` does not block the card. In-process bind is `MastraAgent.getLocalAgents` plus `CopilotRuntime`. `registerCopilotKit` is the HTTP route construction.
