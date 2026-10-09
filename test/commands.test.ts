import { describe, expect, it } from 'vitest';

import { liveIndex, loadFixture, runCli, runFixture } from './helpers.js';

const ids = liveIndex();

type Envelope = {
  schema: string;
  command: string;
  ok: boolean;
  chain: { name: string; chainId: number; caip2: string };
  data: unknown;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    requestId?: string;
    retryAfterSeconds?: number;
  } | null;
  source: {
    url: string | null;
    requestId: string | null;
    apiVersion: string | null;
    fetchedAt: string;
  } | null;
};

const parse = (stdout: string) => JSON.parse(stdout) as Envelope;

describe('every command makes exactly one request and relays the API JSON unchanged', () => {
  const cases: [string, string[], string][] = [
    ['project', ['project', ids.slug], 'project'],
    ['research', ['research', ids.slug], 'research'],
    ['unknowns', ['unknowns', ids.slug], 'unknowns'],
    ['changes', ['changes', ids.slug, '--limit', '3'], 'changes'],
    ['token', ['token', ids.token], 'token'],
    ['scan', ['scan', ids.token], 'scan'],
    ['search', ['search', 'musepass'], 'search'],
    ['ships', ['ships', '--limit', '3'], 'ships'],
    ['builders', ['builders', '--limit', '3'], 'builders'],
    ['pulse', ['pulse', '--days', '3'], 'pulse'],
    ['this-week', ['this-week'], 'this-week'],
    ['evidence', ['evidence', ids.evidenceId], 'evidence'],
  ];

  for (const [name, argv, fixture] of cases) {
    it(`${name} --json`, async () => {
      const r = await runFixture([...argv, '--json'], fixture);
      expect(r.calls).toHaveLength(1);
      expect(r.code).toBe(0);
      expect(r.stderr).toBe('');
      const doc = parse(r.stdout);
      expect(doc.schema).toBe('hey.cli/v1');
      expect(doc.command).toBe(name);
      expect(doc.ok).toBe(true);
      expect(doc.chain).toEqual({ name: 'Robinhood Chain', chainId: 4663, caip2: 'eip155:4663' });
      expect(doc.error).toBeNull();
      expect(doc.data).toEqual(loadFixture(fixture).response.body);
      const recorded = loadFixture(fixture).response.headers;
      expect(doc.source?.requestId).toBe(recorded['x-request-id']);
      expect(doc.source?.apiVersion).toBe('1');
      expect(doc.source?.url?.startsWith('https://heyresearch.xyz/api/')).toBe(true);
      expect(doc.source?.fetchedAt).toBe('2026-10-02T12:00:00.000Z');
    });

    it(`${name} human output renders and carries no ANSI when not a terminal`, async () => {
      const r = await runFixture(argv, fixture);
      expect(r.code).toBe(0);
      expect(r.stdout.length).toBeGreaterThan(0);
      expect(r.stdout).not.toContain('\u001b[');
      expect(r.calls).toHaveLength(1);
    });

    it(`${name} --quiet prints only essential lines`, async () => {
      const r = await runFixture([...argv, '--quiet'], fixture);
      expect(r.code).toBe(0);
      expect(r.stdout).not.toContain('investment advice');
      expect(r.stdout.trim().length).toBeGreaterThan(0);
    });
  }
});

describe('request parameters', () => {
  it('sends the user agent and no key by default', async () => {
    const r = await runFixture(['project', ids.slug], 'project');
    const headers = new Headers(r.calls[0]?.init?.headers);
    expect(headers.get('user-agent')).toMatch(/^hey-cli\/\S+ hey-research-sdk\/0\.1\.1$/);
    expect(headers.get('authorization')).toBeNull();
    expect(r.calls[0]?.init?.redirect).toBe('manual');
  });

  it('sends HEY_API_KEY as a bearer token to HEY only, and never prints it', async () => {
    const key = 'hey_test_key_value_for_fixtures_only_0000000';
    const r = await runFixture(['project', ids.slug], 'project', { env: { HEY_API_KEY: key } });
    expect(new Headers(r.calls[0]?.init?.headers).get('authorization')).toBe(`Bearer ${key}`);
    expect(r.stdout + r.stderr).not.toContain(key);
  });

  it('ships: --since is sent as a full UTC instant', async () => {
    const calls: { url: URL }[] = [];
    const { runCli } = await import('./helpers.js');
    const r = await runCli(
      ['ships', '--since', '2026-09-01', '--limit', '3', '--json'],
      async (input) => {
        calls.push({ url: new URL(input) });
        return new Response(JSON.stringify(loadFixture('ships').response.body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    );
    expect(r.code).toBe(0);
    expect(calls[0]?.url.searchParams.get('since')).toBe('2026-09-01T00:00:00.000Z');
    expect(calls[0]?.url.searchParams.get('limit')).toBe('3');
  });

  it('unknowns accepts an address and sends it lowercase as address=', async () => {
    const calls: { url: URL }[] = [];
    const { runCli } = await import('./helpers.js');
    await runCli(
      ['unknowns', 'eip155:4663:0x7E7154EB9DD81084625A7A2E9E731CADFDDB9AB7', '--json'],
      async (input) => {
        calls.push({ url: new URL(input) });
        return new Response(JSON.stringify(loadFixture('unknowns').response.body), { status: 200 });
      },
    );
    expect(calls[0]?.url.pathname).toBe('/api/agent/unknowns');
    expect(calls[0]?.url.searchParams.get('address')).toBe(
      '0x7e7154eb9dd81084625a7a2e9e731cadfddb9ab7',
    );
  });
});

describe('human output prints the canonical words', () => {
  it('project prints the activity status and Still Building state verbatim with the reason', async () => {
    const r = await runFixture(['project', ids.slug], 'project');
    expect(r.stdout).toMatch(/Activity\s+SHIPPING/);
    expect(r.stdout).toMatch(/Still Building\s+NOT_MEASURED — not_scored/);
    expect(r.stdout).toMatch(/Token\s+none on HEY's record/);
    expect(r.stdout).toContain('https://heyresearch.xyz/project/musepass-musepass');
    expect(r.stdout).toContain('not investment advice');
  });

  it('research prints the answer, claim tags, unknown categories and do-not-conclude lines', async () => {
    const r = await runFixture(['research', ids.slug], 'research');
    expect(r.stdout).toContain('DERIVED');
    expect(r.stdout).toContain('NOT_VERIFIED');
    expect(r.stdout).toContain('NOT_MEASURED');
    expect(r.stdout).toContain('Do not conclude: HEY has not measured this.');
    expect(r.stdout).toContain('context only');
  });

  it('unknowns prints the five category counts, zeros included as HEY counted them', async () => {
    const r = await runFixture(['unknowns', ids.slug], 'unknowns');
    expect(r.stdout).toMatch(
      /UNKNOWN 0 · NOT_MEASURED 1 · NOT_VERIFIED 1 · STALE 0 · INSUFFICIENT_EVIDENCE 0/,
    );
    expect(r.stdout).toMatch(/Withheld\s+\(none listed by HEY\)/);
  });

  it('builders prints the method line', async () => {
    const r = await runFixture(['builders', '--limit', '3'], 'builders');
    expect(r.stdout).toContain('Method: overall = 0.65');
    expect(r.stdout).toContain('#1');
  });

  it('pulse says it reads /api/chain and labels provider aggregates as context', async () => {
    const r = await runFixture(['pulse', '--days', '3'], 'pulse');
    expect(r.stdout).toContain('hey pulse reads GET /api/chain');
    expect(r.stdout).toContain("HEY's own records");
    expect(r.stdout).toContain('Chain and market context');
    expect(r.stdout).toContain('never a builder input');
    expect(r.stdout).toContain('2026-10-09 partial');
  });

  it('this-week does not print the bare market figures', async () => {
    const r = await runFixture(['this-week'], 'this-week');
    expect(r.stdout).toContain('Shipped');
    expect(r.stdout).not.toContain('$');
  });

  it('search labels a launch record as not a reviewed project and makes links absolute', async () => {
    const r = await runFixture(['search', 'musepass'], 'search');
    expect(r.stdout).toContain('launch record, not a reviewed project');
    expect(r.stdout).toContain('https://heyresearch.xyz/project/musepass-musepass');
  });

  it("token prints HEY's own label and help sentence", async () => {
    const r = await runFixture(['token', ids.token], 'token');
    expect(r.stdout).toContain(
      'Shipping — Shipped something meaningful in the last 7 days. (SHIPPING)',
    );
    expect(r.stdout).toContain('verification UNVERIFIED — owner_has_not_published_contract');
  });

  it("scan prints the card in HEY's words", async () => {
    const r = await runFixture(['scan', ids.token], 'scan');
    expect(r.stdout).toMatch(/Status\s+Shipping — Shipped something meaningful/);
    expect(r.stdout).toMatch(/Commits \(30d\)\s+128 or more/);
  });

  it('evidence prints a standing record with its source and precision', async () => {
    const r = await runFixture(['evidence', ids.evidenceId], 'evidence');
    expect(r.stdout).toContain('CODE_ACTIVITY');
    expect(r.stdout).toContain('(WEEK)');
    expect(r.stdout).toContain('counts toward activity status');
  });

  it('project prints a launch pool as "Launch pool only", with no valuation', async () => {
    const r = await runFixture(['project', 'agentos'], 'project-launch-pool');
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/Market context\s+Launch pool only/);
    expect(r.stdout).not.toMatch(/FDV \$|Market cap \$/);
  });

  it('project says a withheld valuation is withheld, with its reason', async () => {
    const r = await runFixture(['project', 'priors-agents'], 'project-withheld');
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/Market context\s+valuation withheld — launch_pool_no_trades/);
  });

  it('project names a second source that disagrees beside the valuation', async () => {
    const body = structuredClone(loadFixture('project-launch-pool').response.body) as Record<
      string,
      Record<string, unknown>
    >;
    body.tokenMarket = { ...body.tokenMarket, reason: 'liquidity_and_volume' };
    body.market = {
      ...body.market,
      sourcesDisagree: {
        source: 'geckoterminal',
        priceUsd: 0.00002,
        observedAt: '2026-10-09T03:00:00.000Z',
      },
    };
    const r = await runCli(['project', 'agentos'], async () => new Response(JSON.stringify(body)));
    expect(r.stdout).toMatch(/Market context\s+FDV \$/);
    expect(r.stdout).toContain('sources disagree: geckoterminal prices it more than 2× away');
  });

  it('pulse prints a withheld DEX volume as withheld, never 0 or unknown', async () => {
    const body = structuredClone(loadFixture('pulse').response.body) as {
      days: Record<string, unknown>[];
    };
    const day = body.days[0] ?? {};
    delete day.dexVolumeUsd;
    day.dexVolumeWithheld = 'implausible_vs_trailing_median';
    const r = await runCli(
      ['pulse', '--days', '3'],
      async () => new Response(JSON.stringify(body)),
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/withheld/);
    expect(r.stdout).toContain('(implausible_vs_trailing_median)');
  });

  it('colour is used only on a terminal and NO_COLOR / --no-color turn it off', async () => {
    const tty = await runFixture(['project', ids.slug], 'project', { isTTY: true });
    expect(tty.stdout).toContain('\u001b[1m');
    const noColor = await runFixture(['project', ids.slug], 'project', {
      isTTY: true,
      env: { NO_COLOR: '1' },
    });
    expect(noColor.stdout).not.toContain('\u001b[');
    const flag = await runFixture(['project', ids.slug, '--no-color'], 'project', { isTTY: true });
    expect(flag.stdout).not.toContain('\u001b[');
  });
});
