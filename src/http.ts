import { HeyClient } from '@hey-research-lab/sdk';

import { CliError } from './errors.js';
import { EXIT } from './exit-codes.js';
import { CLI_VERSION } from './version.js';

export const DEFAULT_BASE_URL = 'https://heyresearch.xyz';
/** The largest answer the CLI reads; HEY's agent answers are bounded at 64 KB. */
export const MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
export const TIMEOUT_MS = 15_000;

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

/** What the one request a command made looked like: for `source` in JSON and for errors. */
export type RequestRecord = {
  url?: string;
  status?: number;
  requestId?: string;
  apiVersion?: string;
  count: number;
};

const NULL_BODY_STATUS = new Set([101, 103, 204, 205, 304]);

async function readCapped(response: Response, max: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) throw tooLarge(max);
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => undefined);
      throw tooLarge(max);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

const tooLarge = (max: number) =>
  new CliError(
    'response_too_large',
    `HEY's answer was larger than ${max} bytes; the CLI does not read it.`,
    EXIT.NETWORK,
    { retryable: false },
  );

/**
 * Wraps fetch so the CLI can report the request it made (URL, status, `x-request-id`,
 * `x-hey-api-version`) and cap the body it reads. Redirects are never followed here; the SDK
 * follows at most one, to HEY's own /api/ path.
 */
export function recordingFetch(base: FetchLike, record: RequestRecord): FetchLike {
  return async (input, init) => {
    record.count += 1;
    const response = await base(input, init);
    record.url = input;
    record.status = response.status;
    record.requestId = response.headers.get('x-request-id') ?? undefined;
    record.apiVersion = response.headers.get('x-hey-api-version') ?? undefined;
    if (response.status < 200 || response.status > 599) return response;
    const body = NULL_BODY_STATUS.has(response.status)
      ? null
      : await readCapped(response, MAX_RESPONSE_BYTES);
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  };
}

/**
 * The base URL override exists for tests and local mocks only, and is not documented in
 * user help: it is not network switching. https only, an origin with no credentials, path,
 * query or fragment.
 */
export function parseBaseUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CliError('invalid_base_url', 'The base URL is not a URL.', EXIT.USAGE);
  }
  const bare = url.pathname === '/' && !url.search && !url.hash && !raw.includes('#');
  if (url.protocol !== 'https:' || url.username || url.password || !bare) {
    throw new CliError(
      'invalid_base_url',
      'The base URL must be an https origin with no credentials, path or query.',
      EXIT.USAGE,
    );
  }
  return url.origin;
}

export type ClientSetup = {
  fetchImpl: FetchLike;
  baseUrl: string;
  apiKey?: string;
};

export function createClient(setup: ClientSetup, record: RequestRecord): HeyClient {
  // A key only ever travels to HEY's own origin, never to an overridden base URL.
  const apiKey = setup.baseUrl === DEFAULT_BASE_URL ? setup.apiKey : undefined;
  return new HeyClient({
    baseUrl: setup.baseUrl,
    fetchImpl: recordingFetch(setup.fetchImpl, record),
    timeoutMs: TIMEOUT_MS,
    userAgent: `hey-cli/${CLI_VERSION}`,
    ...(apiKey ? { apiKey } : {}),
  });
}
