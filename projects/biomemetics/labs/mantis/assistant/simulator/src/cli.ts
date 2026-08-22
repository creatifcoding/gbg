import { explain } from './explain.ts';
import { loadCatalog, loadPlant } from './fixtures.ts';
import { inject, injectFault, injectStale } from './inject.ts';
import { formatPaint, paints } from './cli-format.ts';
import { refuseWrite } from './refuse-write.ts';
import { view } from './view.ts';
import type { ChannelId, FaultId } from './types.ts';

const flag = (args: readonly string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return args[index + 1];
};

const main = (argv: string[]): void => {
  const [, , command, ...rest] = argv;
  if (command === 'catalog') {
    process.stdout.write(`${JSON.stringify(loadCatalog(), null, 2)}\n`);
    return;
  }
  if (command === 'show') {
    const fixtureId = rest[0] ?? 'known-fresh';
    const painted = view(loadPlant(fixtureId));
    process.stdout.write(`${formatPaint(painted)}\n`);
    process.stdout.write(`${JSON.stringify({ paints: paints(painted), explanation: explain(painted) }, null, 2)}\n`);
    return;
  }
  if (command === 'inject') {
    const kind = rest[0];
    const fixtureId = flag(rest, '--fixture') ?? 'known-fresh';
    let plant = loadPlant(fixtureId);
    if (kind === 'stale') {
      const channel = (flag(rest, '--channel') ?? 'air.dry-bulb') as ChannelId;
      plant = injectStale(plant, channel);
    } else if (kind === 'fault') {
      const fault = (flag(rest, '--id') ?? 'pinch') as FaultId;
      plant = injectFault(plant, fault);
    } else if (kind === 'unavailable') {
      const channel = (flag(rest, '--channel') ?? 'enclosure.illuminance') as ChannelId;
      plant = inject(plant, { type: 'unavailable', channel });
    } else {
      throw new Error('inject stale|fault|unavailable');
    }
    const painted = view(plant);
    process.stdout.write(`${formatPaint(painted)}\n`);
    return;
  }
  if (command === 'refuse') {
    refuseWrite(JSON.parse(rest[0] ?? '{}'));
    process.stdout.write('no write keys\n');
    return;
  }
  process.stdout.write(
    'usage: cli.ts catalog | show [fixture] | inject stale|fault|unavailable [--fixture id] [--channel id] [--id pinch]\n',
  );
};

main(process.argv);
