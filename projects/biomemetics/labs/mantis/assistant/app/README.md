# A1 CopilotKit PWA

Installable offline keeper for a local `CareSubject`. Write-set leaf for [gbg#51](https://github.com/creatifcoding/gbg/issues/51).

- Mastra is consumed through A0 contracts. This package does not rewrite `assistant/contracts/**` or `tooling/typescript/mantis-assistant/**`.
- CopilotKit binds locally without a runtime URL. A missing URL still draws Ask chrome with a blank stream. No live model.
- Terrarium draws telemetry chrome with blank values. Service is hidden unless `?simulator=1`.
- No SpecimenDB, actuation, EVA, graph, or shop-release.

```bash
npm install
npm test
npm run build
```
