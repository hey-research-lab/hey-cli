# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project uses
[Semantic Versioning](https://semver.org/).

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
