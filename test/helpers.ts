import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { run, type RunEnvironment } from '../src/run.js';
import type { FetchLike } from '../src/http.js';

export type Fixture = {
  request: { path: string; params: Record<string, string | number> };
  response: { status: number; headers: Record<string, string>; body: unknown };
};

const FIXTURES = join(import.meta.dirname, 'fixtures');

export function loadFixture(name: string): Fixture {
  const dir = name.startsWith('synthetic/') ? '' : 'live/';
  return JSON.parse(readFileSync(join(FIXTURES, `${dir}${name}.json`), 'utf8')) as Fixture;
}

export function liveIndex(): { slug: string; token: string; evidenceId: string } {
  return JSON.parse(readFileSync(join(FIXTURES, 'live', 'index.json'), 'utf8')) as {
    slug: string;
    token: string;
    evidenceId: string;
  };
}

export type Call = { url: URL; init: RequestInit | undefined };

/**
 * A fetch that answers from one saved fixture and fails the test on any other request:
 * the path and every query parameter must match what the fixture recorded.
 */
export function fixtureFetch(name: string, calls: Call[] = []): FetchLike {
  const fixture = loadFixture(name);
  return async (input, init) => {
    const url = new URL(input);
    calls.push({ url, init });
    const expected = new URL(fixture.request.path, 'https://heyresearch.xyz');
    for (const [k, v] of Object.entries(fixture.request.params)) {
      expected.searchParams.set(k, String(v));
    }
    expected.searchParams.sort();
    const actual = new URL(url);
    actual.searchParams.sort();
    if (actual.pathname !== expected.pathname || actual.search !== expected.search) {
      throw new Error(
        `Unexpected request ${url.pathname}${url.search}; fixture ${name} recorded ${expected.pathname}${expected.search}`,
      );
    }
    const body =
      typeof fixture.response.body === 'string'
        ? fixture.response.body
        : JSON.stringify(fixture.response.body);
    return new Response(body, {
      status: fixture.response.status,
      headers: fixture.response.headers,
    });
  };
}

export type RunResult = { code: number; stdout: string; stderr: string; calls: Call[] };

export async function runCli(
  argv: string[],
  fetchImpl: FetchLike,
  overrides: Partial<RunEnvironment> = {},
  calls: Call[] = [],
): Promise<RunResult> {
  let stdout = '';
  let stderr = '';
  const code = await run(argv, {
    fetchImpl,
    stdout: (t) => {
      stdout += t;
    },
    stderr: (t) => {
      stderr += t;
    },
    env: {},
    isTTY: false,
    now: () => new Date('2026-10-02T12:00:00.000Z'),
    ...overrides,
  });
  return { code, stdout, stderr, calls };
}

export async function runFixture(
  argv: string[],
  fixture: string,
  overrides: Partial<RunEnvironment> = {},
): Promise<RunResult> {
  const calls: Call[] = [];
  return runCli(argv, fixtureFetch(fixture, calls), overrides, calls);
}

/** A fetch that must never be called (usage errors are decided before any request). */
export const noFetch: FetchLike = async (input) => {
  throw new Error(`No request expected, got ${input}`);
};
