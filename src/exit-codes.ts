/** Exit codes shared by every HEY Research Lab CLI. */
export const EXIT = {
  /** Success, including a lookup that answered "unknown" in a non-lookup command. */
  OK: 0,
  /** An input document or check failed (unused by this CLI; reserved for parity). */
  INVALID: 1,
  /** Usage error: bad flag or argument, `unsupported_chain`, a malformed address. */
  USAGE: 2,
  /** HEY's API refused the request (a 4xx other than 404 and 429). */
  REFUSED: 3,
  /** Not found: a 404, `status: "unknown"` from /api/token, `found: false` from /api/v1/scan. */
  NOT_FOUND: 4,
  /** Rate limited or quota (429): retry after the printed delay. */
  RATE_LIMITED: 5,
  /** Network failure, timeout, an unreadable answer or a HEY 5xx (retryable). */
  NETWORK: 6,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];
