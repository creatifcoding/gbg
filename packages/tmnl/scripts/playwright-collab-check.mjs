import { chromium } from 'playwright';

const baseURL = process.env.TMNL_BASE_URL ?? 'http://localhost:1421';
const url = new URL('/testbed/collaboration', baseURL).toString();

const errors = [];
const warnings = [];
const logs = [];

function record(kind, entry) {
  const payload = { kind, ...entry };
  logs.push(payload);
  // Keep output short but high-signal
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
  } else {
    record('console', entry);
  }
});

page.on('pageerror', (err) => {
  const entry = { message: err?.message ?? String(err), stack: err?.stack };
  errors.push(entry);
  record('pageerror', entry);
});

page.on('requestfailed', (req) => {
  const failure = req.failure();
  const entry = {
    url: req.url(),
    method: req.method(),
    errorText: failure?.errorText,
  };
  warnings.push(entry);
  record('requestfailed', entry);
});

await page.goto(url, { waitUntil: 'domcontentloaded' });

// Give the app time to mount and for y-sweet/token fetch to run
await page.waitForTimeout(2500);

// Attempt a simple interaction to ensure editors mount
// (avoid depending on internal selectors; just click somewhere reasonable)
await page.mouse.click(200, 300);
await page.waitForTimeout(500);

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

