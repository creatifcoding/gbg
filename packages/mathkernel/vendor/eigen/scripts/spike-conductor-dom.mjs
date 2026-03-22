import { chromium } from 'playwright';

const baseURL = process.env.TMNL_BASE_URL ?? 'http://localhost:1420';
const url = new URL('/testbed/conductor', baseURL).toString();

const errors = [];
const warnings = [];

function record(kind, entry) {
  const msg = entry.text ?? entry.message ?? '';
  // eslint-disable-next-line no-console
  console.log(`[browser:${kind}] ${msg}`);
}

const browser = await chromium.launch();
const page = await browser.newPage();

page.on('console', (msg) => {
  const entry = {
    type: msg.type(),
    text: msg.text(),
    location: msg.location(),
  };
  if (entry.type === 'error') {
    errors.push(entry);
    record('console.error', entry);
  } else if (entry.type === 'warning') {
    warnings.push(entry);
    record('console.warn', entry);
  }
});

page.on('pageerror', (err) => {
  const entry = { message: err?.message ?? String(err), stack: err?.stack };
  errors.push(entry);
  record('pageerror', entry);
});

await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1500);

// Spawn a node via the tool rail (title="Spawn ...")
const spawnButtons = page.locator('button[title^="Spawn"]');
const spawnCount = await spawnButtons.count();
if (spawnCount > 0) {
  await spawnButtons.first().click();
  await page.waitForTimeout(800);
}

const domReport = await page.evaluate(() => {
  const cards = Array.from(document.querySelectorAll('[data-card-id]')).map((el) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return {
      id: el.getAttribute('data-card-id'),
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      style: {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        transform: style.transform,
        pointerEvents: style.pointerEvents,
      },
      isConnected: el.isConnected,
    };
  });

  const selectables = Array.from(document.querySelectorAll('[data-selectable-id]')).map((el) => {
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return {
      id: el.getAttribute('data-selectable-id'),
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      style: {
        display: style.display,
        visibility: style.visibility,
        opacity: style.opacity,
        transform: style.transform,
      },
      isConnected: el.isConnected,
    };
  });

  return { cards, selectables, viewport: { width: window.innerWidth, height: window.innerHeight } };
});

// eslint-disable-next-line no-console
console.log('\nDOM REPORT');
// eslint-disable-next-line no-console
console.log(JSON.stringify(domReport, null, 2));

await browser.close();

if (errors.length > 0) {
  // eslint-disable-next-line no-console
  console.error(`\nFAIL: saw ${errors.length} browser error(s) at ${url}`);
  // eslint-disable-next-line no-console
  console.error(JSON.stringify({ url, errors, warnings }, null, 2));
  process.exit(1);
}

// eslint-disable-next-line no-console
console.log(`\nOK: no browser errors at ${url}`);
process.exit(0);
