#!/usr/bin/env node
// Records the test fixtures from HEY's live public API. Maintainers only; never run in CI.
//
//   HEY_LIVE=1 node scripts/record-fixtures.mjs
//
// Read-only GETs on the public routes the CLI uses, one at a time, at most one request per
// second, no API key. Each fixture keeps the status, a small header allowlist and the body,
// unchanged. Identifiers (a slug, a token, an evidence id) are taken from the first answers so
// the set stays consistent; the chosen ones are written to test/fixtures/live/index.json.
// HEY_RECORD_REUSE=1 keeps the identifiers already in index.json, so a refresh re-reads the same
// records and the tests' expectations move only where HEY's answer did.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

if (process.env.HEY_LIVE !== '1') {
  console.error('Refusing to call the live API without HEY_LIVE=1.');
  process.exit(2);
}

const BASE = 'https://heyresearch.xyz';
const OUT = join(import.meta.dirname, '..', 'test', 'fixtures', 'live');
const KEEP_HEADERS = ['content-type', 'x-request-id', 'x-hey-api-version', 'retry-after'];
const UA = 'hey-cli-fixture-recorder/0.1.0';
mkdirSync(OUT, { recursive: true });

let last = 0;
async function record(name, path, params = {}, keep = true) {
  const wait = last + 1100 - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  last = Date.now();
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, {
    redirect: 'manual',
    headers: { accept: 'application/json', 'user-agent': UA },
  });
  const headers = {};
  for (const h of KEEP_HEADERS) {
    const v = res.headers.get(h);
    if (v !== null) headers[h] = v;
  }
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  const fixture = { request: { path, params }, response: { status: res.status, headers, body } };
  if (keep) writeFileSync(join(OUT, `${name}.json`), `${JSON.stringify(fixture, null, 2)}\n`);
  console.log(`${res.status} ${url.pathname}${url.search} -> ${name}.json`);
  return body;
}

const only = process.env.HEY_RECORD_ONLY; // 'token' re-records the by-contract pair alone
const reuse = process.env.HEY_RECORD_REUSE === '1';
const ids = only || reuse ? JSON.parse(readFileSync(join(OUT, 'index.json'), 'utf8')) : {};
if (!only) {
  const ships = await record('ships', '/api/ships', { limit: 3 });
  const first = ships.items[0];
  if (!reuse) {
    ids.slug = first.project.slug;
    ids.evidenceId = first.evidenceId;
  }
  const project = await record('project', `/api/projects/${encodeURIComponent(ids.slug)}`);
  await record('research', '/api/agent/research_project', { project: ids.slug });
  await record('unknowns', '/api/agent/unknowns', { project: ids.slug });
  await record('changes', '/api/changes', { project: ids.slug, limit: 3 });
  await record('search', '/api/search/suggest', { q: project.name.slice(0, 12) });
  await record('builders', '/api/builders', { limit: 3 });
  await record('pulse', '/api/chain', { days: 3 });
  await record('this-week', '/api/this-week');
  await record('evidence', `/api/evidence/${encodeURIComponent(ids.evidenceId)}`);
  // Answers that are not a published record.
  const nobody = '0x0000000000000000000000000000000000000001';
  await record('project-not-found', '/api/projects/hey-cli-no-such-project');
  await record('token-unknown', `/api/token/4663/${nobody}`);
  await record('scan-not-found', '/api/v1/scan', { chain: 4663, token: nobody });
  await record('unknowns-not-found', '/api/agent/unknowns', { project: 'hey-cli-no-such-project' });
  await record('ships-invalid-type', '/api/ships', { type: 'banana', limit: 1 });
  // Market context HEY withholds or labels: a launch pool, and a withheld valuation.
  const market = await record('_market', '/api/projects', { has: 'token', limit: 100 }, false);
  const items = Array.isArray(market.items) ? market.items : [];
  const launchPool = items.find(
    (i) =>
      i.tokenMarket?.status === 'ACTIVE_MARKET' && i.tokenMarket?.reason === 'launch_pool_trading',
  );
  const withheld = items.find((i) => typeof i.valuationWithheld === 'string');
  ids.launchPoolSlug = launchPool?.slug ?? null;
  ids.withheldSlug = withheld?.slug ?? null;
  if (ids.launchPoolSlug) {
    await record('project-launch-pool', `/api/projects/${encodeURIComponent(ids.launchPoolSlug)}`);
  }
  if (ids.withheldSlug) {
    await record('project-withheld', `/api/projects/${encodeURIComponent(ids.withheldSlug)}`);
  }
}
if (!only || only === 'token') {
  // A published project's token, from the catalogue (not kept as a fixture).
  if (!reuse || !ids.token) {
    const listing = await record('_listing', '/api/projects', { has: 'token', limit: 1 }, false);
    ids.token = listing.items[0]?.token?.contractAddress ?? null;
  }
  if (ids.token) {
    await record('token', `/api/token/4663/${ids.token}`);
    await record('scan', '/api/v1/scan', { chain: 4663, token: ids.token });
  }
}

writeFileSync(
  join(OUT, 'index.json'),
  `${JSON.stringify({ ...ids, base: BASE, recordedAt: new Date().toISOString() }, null, 2)}\n`,
);
