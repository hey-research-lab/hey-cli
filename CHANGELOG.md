# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

## Unreleased

- A project slug is at most 80 characters, HEY's own request rule (OpenAPI, the agent contract's requests); a longer one is refused locally instead of reaching HEY for a 404.
- Depends on `@hey-research-lab/sdk` `^0.2.0` (published 2026-10-09), which types the API's additive fields since 0.1.2; a caret on 0.x does not cross a minor, so `^0.1.1` kept the older SDK.
- Development: vitest 4.1.11 / tsup 8.5.1, with esbuild held at ^0.28.1 by a pnpm override; clears dev-only advisories in the test and build toolchain. No runtime change.

## 0.1.3 — 2026-10-09

Kept in step with HEY's public API as of 2026-10-09. `--json` is unchanged: it relays HEY's answer as sent.

- `hey project`: a market that is only the token's launch pool (`launch_pool_trading`) prints "Launch pool only" and no valuation, as every HEY surface does; a valuation HEY withholds prints "valuation withheld — <reason>" instead of nothing; a second source pricing the token more than 2× away (`market.sourcesDisagree`) is named under the figure.
- `hey scan` on `found: false` prints the card's additive `indexed`, `research_state` and `launched_via`. `--quiet` is unchanged (`not_found`).
- `hey pulse` prints a day's DEX volume HEY withholds (`dexVolumeWithheld`) as "withheld" with its reason, never "unknown" or 0.
- `hey changes` help and README: HEY now refuses an unreadable filter value (`invalid_parameter`) instead of dropping it; the query-echo guard stays.
- Test fixtures re-recorded from production on 2026-10-09 (`scripts/record-fixtures.mjs` gains `HEY_RECORD_REUSE=1` to keep the same records, and records a launch-pool and a withheld-valuation dossier).

## 0.1.2 — 2026-10-03

- `hey token` on a Robinhood stock token prints HEY's sentence — "Robinhood stock token: NVIDIA (NVDA) — issued by Robinhood, not a project on HEY." — from the additive `issuer` field; `--quiet` prints `unknown issuer_token`. Exit 4 as before. `--json` relays the field as sent.
- `bin` paths written without `./`, as npm normalises them (publishing warned).

## 0.1.1 — 2026-10-02

- `hey scan`: when HEY has not measured a project's building (`activity_measured: false`), Releases and Ships (30d) print "not measured" instead of the card's 0, as the Telegram bot does. `--json` is unchanged.
- `hey help <command>`: option descriptions line up in one column however long the flag (`--project <slug>` ran into its text).
- Issue templates (bug, idea) with private security reporting and HEY corrections linked.

## 0.1.0 — 2026-10-02

Initial release.

### Added

- `hey` (alias `hey-research`), a read-only client of HEY Research Lab's public API over
  `@hey-research-lab/sdk` 0.1.1, for Robinhood Chain (4663) only.
- Commands, each one request to one public endpoint: `project`, `research`
  (`/api/agent/research_project`), `token`, `scan` (`/api/v1/scan`), `search`
  (`/api/search/suggest`), `ships`, `builders`, `changes`, `unknowns` (`/api/agent/unknowns`),
  `evidence`, `pulse` (an alias of `/api/chain`) and `this-week`.
- `--json` (the `hey.cli/v1` envelope around the unchanged API answer), `--quiet`, `--limit` and
  `--since` where the endpoint supports them (refused elsewhere), `--no-color` / `NO_COLOR`.
- Exit codes 0/2/3/4/5/6 for success, usage, refusal, not found, rate limit (with HEY's
  `retry-after` in the message) and network/5xx.
- Input validation before any request: slugs, addresses (`0X` and CAIP-10 `eip155:4663:` accepted,
  other chains refused as `unsupported_chain`, zero and burn addresses refused), evidence-id
  families, ISO dates, numeric ranges; an EIP-55 checksum mismatch is a warning.
- Terminal-safe rendering of source text, a 4 MiB answer cap, a prototype-key guard, and a check
  that HEY applied `--since` on `/api/changes`.
- Fixture-driven tests (answers recorded once from the live API, plus synthetic error cases) with
  the network blocked.
