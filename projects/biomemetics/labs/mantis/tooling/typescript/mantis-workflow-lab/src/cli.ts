import { openLaboratory } from './laboratory.ts';

const lab = await openLaboratory();
const report = await lab.runCatalog();
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (!report.ok) {
  process.exitCode = 1;
}
