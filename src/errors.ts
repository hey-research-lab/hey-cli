import { HeyApiError } from '@hey-research-lab/sdk';

import { EXIT, type ExitCode } from './exit-codes.js';
import { isRec, num, rec, str, agentText, bool } from './read.js';
import { cleanText } from './text.js';

export type CliErrorDetails = {
  retryable?: boolean;
  requestId?: string;
  retryAfterSeconds?: number;
  status?: number;
};

/** Every failure the CLI reports: a stable code, a sentence, an exit code. */
export class CliError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly exitCode: ExitCode,
    readonly details: CliErrorDetails = {},
  ) {
    super(message);
    this.name = 'CliError';
  }
}

export const usageError = (code: string, message: string) =>
  new CliError(code, message, EXIT.USAGE, { retryable: false });

/** The API's own error word: `error` in the public envelope, `error.code` in the agent contract. */
function apiCode(body: unknown): string | undefined {
  if (!isRec(body)) return undefined;
  const word = str(body.error);
  if (word && /^[a-z0-9_]{1,64}$/.test(word)) return word;
  return str(rec(body.error).code);
}

function apiMessage(body: unknown): string | undefined {
  if (!isRec(body)) return undefined;
  return str(body.message) ?? agentText(rec(body.error).message);
}

const RETRYABLE_SDK_CODES = new Set(['rate_limited', 'quota', 'unavailable', 'network', 'timeout']);

/** Maps the SDK's HeyApiError (or anything thrown while asking HEY) to a CliError. */
export function fromRequestError(error: unknown, requestIdHeader?: string): CliError {
  if (error instanceof CliError) return error;
  if (error instanceof HeyApiError) {
    if (error.cause instanceof CliError) return error.cause;
    const body = error.body;
    const status = error.status;
    const code = apiCode(body) ?? error.code;
    const requestId = str(rec(body).requestId) ?? requestIdHeader;
    const retryAfterSeconds = error.retryAfterSeconds ?? num(rec(body).retryAfterSeconds);
    const retryable =
      bool(rec(body).retryable) ??
      (RETRYABLE_SDK_CODES.has(error.code) || (status !== undefined && status >= 500));
    let message = cleanText(apiMessage(body) ?? error.message, 300);
    let exitCode: ExitCode;
    if (code === 'unsupported_chain') exitCode = EXIT.USAGE;
    else if (status === 404) exitCode = EXIT.NOT_FOUND;
    else if (status === 429) {
      exitCode = EXIT.RATE_LIMITED;
      message +=
        retryAfterSeconds === undefined
          ? ' HEY sent no retry-after; wait a minute before asking again.'
          : ` Retry after ${retryAfterSeconds} second${retryAfterSeconds === 1 ? '' : 's'} (HEY's retry-after).`;
    } else if (status !== undefined && status >= 400 && status < 500) exitCode = EXIT.REFUSED;
    else exitCode = EXIT.NETWORK;
    const details: CliErrorDetails = { retryable };
    if (requestId) details.requestId = requestId;
    if (retryAfterSeconds !== undefined) details.retryAfterSeconds = retryAfterSeconds;
    if (status !== undefined) details.status = status;
    return new CliError(code, message, exitCode, details);
  }
  const reason = error instanceof Error ? error.message : String(error);
  return new CliError('network', cleanText(reason, 300), EXIT.NETWORK, { retryable: true });
}
