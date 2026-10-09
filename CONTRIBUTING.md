# Contributing

Thank you for helping. `hey` is a thin, read-only client of HEY Research Lab's public API; changes
that keep it that way are welcome.

## Setup

```sh
corepack enable
pnpm install
pnpm scan          # leak and attribution scan (scripts/scan.mjs)
pnpm lint
pnpm typecheck
pnpm test          # offline: fixtures only, the network is blocked
pnpm build
```

Node.js 22+, pnpm 9.15.1.

## Rules

- **One command, one public endpoint, one request.** Only routes documented at
  <https://heyresearch.xyz/docs/public-api> may be read. Never an account, write or partner route,
  and never `POST /api/scan`. No hidden fan-out, no automatic retries.
- **Use the published SDK** (`@hey-research-lab/sdk`); for a route it has no method for yet, its
  public `client.get()`. Never fork or vendor it.
- **Relay, never reshape.** `--json` carries the API JSON unchanged. Human output prints HEY's own
  words and state values verbatim; an absent value prints as "unknown" (or "not measured — reason"),
  never `0`, `false`, a blank or "none".
- **Refuse what the endpoint cannot do.** A flag an endpoint does not support is a usage error, not
  a client-side filter.
- **Robinhood Chain only** (4663). No network, chain or RPC options.
- **Wording:** no investment advice, no safety verdicts, no buy/sell language, no "users" for
  addresses. Activity status is a record of development.
- **Tests:** every behaviour is tested against fixtures in `test/fixtures`. `live/` holds answers
  recorded once from the live API; `synthetic/` holds hand-written answers for paths the live API
  cannot be asked for politely (rate limits, 5xx, malformed payloads).
- **No secrets** in code, fixtures, commits or logs; no `.env` with values.
- Conventional commit messages (`feat:`, `fix:`, `test:`, `docs:`, `chore:`, `ci:`).

## Re-recording fixtures (maintainers)

```sh
HEY_LIVE=1 node scripts/record-fixtures.mjs
# keep the same slug, token and evidence id as test/fixtures/live/index.json:
HEY_LIVE=1 HEY_RECORD_REUSE=1 node scripts/record-fixtures.mjs
```

About twenty read-only GETs on public routes, at most one per second, no API key. Never run it in
CI. Review the diff before committing: the fixtures are public data, but check that nothing
unexpected was captured, and run `pnpm scan`. Replace personal account handles and any
offensive or wallet-flavoured project names with neutral placeholders (`builder-one`,
`sample-meme`) before you commit; keep the structure exactly as recorded.

## Parity

The chain constants (`src/chain.ts`), the address rules (`src/evm.ts`), the exit codes and the
`hey.cli/v1` envelope follow the HEY Research Lab ecosystem conventions shared by every repository
in the organisation. The command-to-endpoint map, the error envelope and the state vocabularies
were last checked against HEY Research Lab's public contract — the OpenAPI document at
https://heyresearch.xyz/openapi.json and the reference at https://heyresearch.xyz/docs/public-api —
on 2026-10-09; the fixtures were re-recorded from the live API the same day.
