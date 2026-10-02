import { describe, expect, it } from 'vitest';

import { noFetch, runCli } from './helpers.js';

const usage = async (argv: string[]) => {
  const r = await runCli(argv, noFetch);
  return r;
};

describe('usage errors are exit 2 and make no request', () => {
  const cases: [string[], string][] = [
    [['project'], 'missing_argument'],
    [['project', 'a', 'b'], 'unexpected_argument'],
    [['project', 'Not A Slug!'], 'invalid_slug'],
    [['token', '0x1234'], 'invalid_address'],
    [['token', '0x0000000000000000000000000000000000000000'], 'not_a_contract_identity'],
    [['scan', '0x000000000000000000000000000000000000dEaD'], 'not_a_contract_identity'],
    [['token', 'eip155:1:0x7e7154eb9dd81084625a7a2e9e731cadfddb9ab7'], 'unsupported_chain'],
    [['scan', 'eip155:8453:0x7e7154eb9dd81084625a7a2e9e731cadfddb9ab7'], 'unsupported_chain'],
    [['ships', '--chain', '1'], 'unsupported_chain'],
    [['project', 'x', '--network=base'], 'unsupported_chain'],
    [['evidence', 'notatype:123'], 'invalid_evidence_id'],
    [['evidence', 'ship:'], 'invalid_evidence_id'],
    [['search', 'x'], 'invalid_query'],
    [['search', 'musepass', '--limit', '3'], 'unsupported_option'],
    [['search', 'musepass', '--since', '2026-09-01'], 'unsupported_option'],
    [['builders', '--since', '2026-09-01'], 'unsupported_option'],
    [['pulse', '--limit', '3'], 'unsupported_option'],
    [['pulse', '--days', '401'], 'invalid_parameter'],
    [['this-week', '--limit', '1'], 'unsupported_option'],
    [['project', 'x', '--since', '2026-09-01'], 'unsupported_option'],
    [['ships', '--limit', '49'], 'invalid_parameter'],
    [['ships', '--limit', '0'], 'invalid_parameter'],
    [['ships', '--limit', '-3'], 'invalid_option'],
    [['changes', '--limit', '101'], 'invalid_parameter'],
    [['builders', '--limit', '201'], 'invalid_parameter'],
    [['ships', '--since', 'yesterday'], 'invalid_since'],
    [['ships', '--since', '2026-13-45'], 'invalid_since'],
    [['ships', '--since', '2026-09-01T10:00:00'], 'invalid_since'],
    [['ships', '--days', '3'], 'unsupported_option'],
    [['ships', '--type', 'a b'], 'invalid_parameter'],
    [['frobnicate'], 'unknown_command'],
    [['ships', '--bogus'], 'invalid_option'],
    [['project', 'x', '--base-url', 'http://heyresearch.xyz'], 'invalid_base_url'],
    [['project', 'x', '--base-url', 'https://user:pw@example.com'], 'invalid_base_url'],
    [['project', 'x', '--base-url', 'https://example.com/api'], 'invalid_base_url'],
  ];

  for (const [argv, code] of cases) {
    it(`${argv.join(' ')} → ${code}`, async () => {
      const r = await usage([...argv, '--json']);
      expect(r.code).toBe(2);
      const doc = JSON.parse(r.stdout) as { ok: boolean; error: { code: string }; source: unknown };
      expect(doc.ok).toBe(false);
      expect(doc.error.code).toBe(code);
      expect(doc.source).toBeNull();
    });
  }

  it('human usage errors go to stderr with a pointer to help', async () => {
    const r = await usage(['token', '0x1234']);
    expect(r.code).toBe(2);
    expect(r.stdout).toBe('');
    expect(r.stderr).toContain('(invalid_address)');
    expect(r.stderr).toContain('hey --help');
  });

  it('no command prints help to stderr with exit 2; --json gives one JSON document', async () => {
    const human = await usage([]);
    expect(human.code).toBe(2);
    expect(human.stderr).toContain('Usage: hey <command>');
    const json = await usage(['--json']);
    expect(json.code).toBe(2);
    expect((JSON.parse(json.stdout) as { error: { code: string } }).error.code).toBe(
      'missing_command',
    );
  });
});

describe('help and version', () => {
  it('--help lists every command and the exit codes, and hides --base-url', async () => {
    const r = await usage(['--help']);
    expect(r.code).toBe(0);
    for (const c of [
      'project',
      'research',
      'token',
      'scan',
      'search',
      'ships',
      'builders',
      'changes',
      'unknowns',
      'evidence',
      'pulse',
      'this-week',
    ]) {
      expect(r.stdout).toContain(`  ${c}`);
    }
    expect(r.stdout).toContain('5 rate limited');
    expect(r.stdout).not.toContain('base-url');
  });

  it('pulse help says it is an alias of /api/chain', async () => {
    const r = await usage(['help', 'pulse']);
    expect(r.stdout).toContain('An alias of GET /api/chain (HEY has no /api/pulse)');
    const flag = await usage(['pulse', '--help']);
    expect(flag.stdout).toBe(r.stdout);
  });

  it('every command help names its endpoint', async () => {
    const r = await usage(['help', 'scan']);
    expect(r.stdout).toContain('Reads: GET /api/v1/scan?chain=4663&token={address}');
  });

  it('--version prints the version', async () => {
    const r = await usage(['--version']);
    expect(r.code).toBe(0);
    expect(r.stdout.trim()).toMatch(/^\d+\.\d+\.\d+(-dev)?$/);
  });
});

describe('the base URL override', () => {
  it('accepts an https origin and never sends the API key there', async () => {
    const seen: { url: string; auth: string | null }[] = [];
    const r = await runCli(
      ['project', 'example-project', '--base-url', 'https://mock.example.org', '--json'],
      async (input, init) => {
        seen.push({ url: input, auth: new Headers(init?.headers).get('authorization') });
        return new Response(
          JSON.stringify({
            slug: 'example-project',
            url: 'https://heyresearch.xyz/project/example-project',
          }),
          { status: 200 },
        );
      },
      { env: { HEY_API_KEY: 'hey_test_key_value_for_fixtures_only_0000000' } },
    );
    expect(r.code).toBe(0);
    expect(seen[0]?.url).toBe('https://mock.example.org/api/projects/example-project');
    expect(seen[0]?.auth).toBeNull();
  });
});
