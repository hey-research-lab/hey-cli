# Security policy

## Reporting a vulnerability

Please report privately through GitHub's "Report a vulnerability" (Security → Advisories) on this
repository, or email hi@heyresearch.xyz with "security" in the subject. Do not open a public issue.
We aim to acknowledge within 3 working days. There is no bug bounty for this repository.

## Scope

`hey` is a read-only client of HEY Research Lab's public API.

- **Network:** HTTPS GET requests to `https://heyresearch.xyz` only — one per command, no
  automatic retries. Redirects are not followed except a single one to HEY's own `/api/` path
  (the SDK's rule). A request is abandoned after 15 seconds and an answer larger than 4 MiB is
  not read. The CLI never calls `POST /api/scan`, an account route or a write route, and never
  fetches a URL found inside an answer.
- **Untrusted input:** command-line arguments are validated before any request (slug, address,
  CAIP-10 chain, evidence-id family, ISO date, numeric ranges). Answers are parsed as JSON and
  refused if they carry a `__proto__`, `constructor` or `prototype` key; nothing is merged into
  an existing object.
- **Untrusted output:** project names, release titles and other text from sources are data. In
  human output they are stripped of control characters (including terminal escape sequences),
  invisible and bidirectional-override characters, folded onto one line and bounded. `--json`
  relays the answer unchanged, JSON-encoded.
- **Local system:** the CLI reads and writes no files, spawns no processes and keeps no state.
- **Test-only override:** an undocumented base-URL option exists for tests and local mocks. It
  accepts an `https:` origin only (no credentials, path or query) and never receives an API key.

## Handling secrets

This project never needs HEY credentials. An optional `HEY_API_KEY` is read from the environment,
sent only to `https://heyresearch.xyz` as a bearer token, never logged, never written to disk,
and never placed in a URL. Never commit a `.env` with values.

## Supported versions

The latest 0.x minor receives fixes.
