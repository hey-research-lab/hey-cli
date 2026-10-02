import { describe, expect, it } from 'vitest';

import { loadFixture, runFixture } from './helpers.js';

const parse = (s: string) =>
  JSON.parse(s) as {
    ok: boolean;
    data: unknown;
    error: {
      code: string;
      message: string;
      retryable: boolean;
      requestId?: string;
      retryAfterSeconds?: number;
    } | null;
  };

describe('not found is exit 4, and an answer is never an error', () => {
  it('token: status "unknown" is exit 4 with the answer relayed, ok true', async () => {
    const r = await runFixture(
      ['token', '0x0000000000000000000000000000000000000001', '--json'],
      'token-unknown',
    );
    expect(r.code).toBe(4);
    const doc = parse(r.stdout);
    expect(doc.ok).toBe(true);
    expect(doc.data).toEqual(loadFixture('token-unknown').response.body);
  });

  it('token: human output says unknown is not a finding', async () => {
    const r = await runFixture(
      ['token', '0x0000000000000000000000000000000000000001'],
      'token-unknown',
    );
    expect(r.code).toBe(4);
    expect(r.stdout).toContain('holds no project for 0x0000000000000000000000000000000000000001');
    expect(r.stdout).toContain('not a finding about the contract');
    expect(r.stdout).toContain(
      'https://heyresearch.xyz/scan/0x0000000000000000000000000000000000000001',
    );
  });

  it('scan: found false is exit 4', async () => {
    const r = await runFixture(
      ['scan', '0x0000000000000000000000000000000000000001'],
      'scan-not-found',
    );
    expect(r.code).toBe(4);
    expect(r.stdout).toContain('HEY holds no published project');
  });

  it('project: a 404 is exit 4 with the API code, message and request id', async () => {
    const r = await runFixture(
      ['project', 'hey-cli-no-such-project', '--json'],
      'project-not-found',
    );
    expect(r.code).toBe(4);
    const doc = parse(r.stdout);
    expect(doc.ok).toBe(false);
    expect(doc.data).toBeNull();
    expect(doc.error).toEqual({
      code: 'not_found',
      message: 'No published project has the slug "hey-cli-no-such-project".',
      retryable: false,
      requestId: 'd87bb5c8-722f-4d83-88e2-9d518ba6df08',
    });
  });

  it('agent refusal: the contract error code and message are relayed', async () => {
    const r = await runFixture(['unknowns', 'hey-cli-no-such-project'], 'unknowns-not-found');
    expect(r.code).toBe(4);
    expect(r.stdout).toBe('');
    expect(r.stderr).toContain(
      'HEY holds no published project with the slug "hey-cli-no-such-project". (not_found)',
    );
    expect(r.stderr).toContain('request id 6e8e1a52-7f03-41da-93be-da4ab38a2eb0');
  });

  it('evidence: a withdrawn record is an answer, exit 0', async () => {
    const r = await runFixture(
      ['evidence', 'ship:00000000-0000-4000-8000-000000000002'],
      'synthetic/evidence-withdrawn',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/Withdrawn\s+context_only/);
    expect(r.stdout).toMatch(/Context reason\s+shared_deployer/);
  });
});

describe('refusals, rate limits and failures', () => {
  it("a 400 invalid_parameter is exit 3 with HEY's code", async () => {
    const r = await runFixture(
      ['ships', '--type', 'banana', '--limit', '1', '--json'],
      'ships-invalid-type',
    );
    expect(r.code).toBe(3);
    const doc = parse(r.stdout);
    expect(doc.error?.code).toBe('invalid_parameter');
    expect(doc.error?.message).toContain('type=banana is not a value this API reads');
    expect(doc.error?.retryable).toBe(false);
  });

  it('429 is exit 5 and the message carries the retry-after delay', async () => {
    const r = await runFixture(['project', 'example-project'], 'synthetic/rate-limited');
    expect(r.code).toBe(5);
    expect(r.stderr).toContain('Retry after 12 seconds');
    expect(r.calls).toHaveLength(1);
  });

  it('429 in JSON carries retryAfterSeconds and retryable', async () => {
    const r = await runFixture(['project', 'example-project', '--json'], 'synthetic/rate-limited');
    expect(r.code).toBe(5);
    const doc = parse(r.stdout);
    expect(doc.error?.code).toBe('rate_limited');
    expect(doc.error?.retryAfterSeconds).toBe(12);
    expect(doc.error?.retryable).toBe(true);
  });

  it('a quota 429 is exit 5 and says no retry-after was sent', async () => {
    const r = await runFixture(['project', 'example-project'], 'synthetic/quota');
    expect(r.code).toBe(5);
    expect(r.stderr).toContain('(quota)');
    expect(r.stderr).toContain('HEY sent no retry-after');
  });

  it('a 500 is exit 6 and retryable, with the request id', async () => {
    const r = await runFixture(['ships', '--json'], 'synthetic/internal-error');
    expect(r.code).toBe(6);
    const doc = parse(r.stdout);
    expect(doc.error?.code).toBe('internal_error');
    expect(doc.error?.retryable).toBe(true);
    expect(doc.error?.requestId).toBe('00000000-0000-4000-8000-000000000500');
  });

  it('a network failure is exit 6 and is not retried', async () => {
    const { runCli } = await import('./helpers.js');
    let count = 0;
    const r = await runCli(['ships'], async () => {
      count += 1;
      throw new TypeError('fetch failed');
    });
    expect(r.code).toBe(6);
    expect(count).toBe(1);
    expect(r.stderr).toContain('(network)');
  });

  it('the global fetch is blocked in tests (sanity)', async () => {
    await expect(fetch('https://heyresearch.xyz/api/ships')).rejects.toThrow(
      /Network access is disabled/,
    );
  });
});

describe('unknown stays unknown', () => {
  it('scan: absent commits_30d is "not measured", unmeasured counts are labelled, MISMATCH is explained', async () => {
    const r = await runFixture(
      ['scan', '0x0000000000000000000000000000000000000002'],
      'synthetic/scan-unmeasured',
    );
    expect(r.code).toBe(0);
    expect(r.stdout).toMatch(/Commits \(30d\)\s+not measured — HEY reads no repository/);
    expect(r.stdout).toContain('the counts below are not measurements');
    expect(r.stdout).toContain("this activity is the project's, not this token's");
    expect(r.stdout).toMatch(/Last ship\s+unknown/);
    // The card's 0s are not measurements: printed as such, as the bot does (0.1.1).
    expect(r.stdout).toMatch(/Releases \(30d\)\s+not measured/);
    expect(r.stdout).toMatch(/Ships \(30d\)\s+not measured/);
  });

  it('scan --json keeps the absent field absent (no 0, no null filled in)', async () => {
    const r = await runFixture(
      ['scan', '0x0000000000000000000000000000000000000002', '--json'],
      'synthetic/scan-unmeasured',
    );
    const doc = parse(r.stdout) as { data: { activity: Record<string, unknown> } };
    expect('commits_30d' in doc.data.activity).toBe(false);
  });

  it('changes: an undated event says undated and a retraction prints only its id', async () => {
    const r = await runFixture(['changes', 'example-project'], 'synthetic/changes-mixed');
    expect(r.stdout).toContain('undated (OBSERVED; HEY detected it 2026-10-01 08:00 UTC)');
    expect(r.stdout).toContain('SHIPPING → ACTIVE');
    expect(r.stdout).toContain('retracted  ship:00000000-0000-4000-8000-000000000003');
  });

  it('changes: a --since HEY dropped is refused rather than printed as filtered', async () => {
    const r = await runFixture(
      ['changes', 'example-project', '--since', '2026-09-01', '--json'],
      'synthetic/changes-since-dropped',
    );
    expect(r.code).toBe(3);
    expect(parse(r.stdout).error?.code).toBe('filter_dropped');
  });
});

describe('untrusted text and payloads', () => {
  it('strips terminal escapes, bidi overrides and newlines from relayed text', async () => {
    const r = await runFixture(['project', 'example-project'], 'synthetic/control-chars', {
      isTTY: false,
    });
    expect(r.stdout).not.toContain('\u001b');
    expect(r.stdout).not.toContain('\u202E');
    expect(r.stdout).not.toContain('\u0007');
    expect(r.stdout).toContain('line one line two');
  });

  it('JSON mode relays the text unchanged (JSON escapes it)', async () => {
    const r = await runFixture(['project', 'example-project', '--json'], 'synthetic/control-chars');
    const doc = parse(r.stdout) as { data: { name: string } };
    expect(doc.data.name).toBe('Evil\u001b[31mRed\u001b[0m\u202EName');
  });

  it('refuses an answer with a __proto__ key', async () => {
    const r = await runFixture(['project', 'example-project', '--json'], 'synthetic/proto-key');
    expect(r.code).toBe(6);
    expect(parse(r.stdout).error?.code).toBe('invalid_response');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('refuses to render a document that is not the agent contract', async () => {
    const r = await runFixture(['research', 'example-project'], 'synthetic/not-agent');
    expect(r.code).toBe(6);
    expect(r.stderr).toContain('(invalid_response)');
  });

  it('refuses an oversized answer', async () => {
    const { runCli } = await import('./helpers.js');
    const big = 'x'.repeat(4 * 1024 * 1024 + 10);
    const r = await runCli(
      ['ships', '--json'],
      async () => new Response(JSON.stringify({ items: [], pad: big }), { status: 200 }),
    );
    expect(r.code).toBe(6);
    expect(parse(r.stdout).error?.code).toBe('response_too_large');
  });
});
