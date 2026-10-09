# hey-cli

A terminal client for HEY Research Lab's public API: look up Robinhood Chain projects, ships,
changes, evidence and unknowns from the command line, with JSON output for scripts and agents.

[![CI](https://github.com/hey-research-lab/hey-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/hey-research-lab/hey-cli/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node >= 22](https://img.shields.io/badge/node-%3E%3D22-informational.svg)](package.json)
[![Robinhood Chain 4663](https://img.shields.io/badge/Robinhood%20Chain-4663-black.svg)](https://heyresearch.xyz)

## Why it exists

HEY Research Lab records which projects on Robinhood Chain are still building, what they shipped
and where each fact came from. `hey` puts those public records one command away, prints them in
HEY's own words, and gives scripts and AI agents the same answers as stable JSON — without
anyone having to read API docs first. It is a thin client: every command is one read of one
public endpoint, through the published [`@hey-research-lab/sdk`](https://www.npmjs.com/package/@hey-research-lab/sdk).

## Why Robinhood Chain only

HEY researches one chain: Robinhood Chain, chain id `4663` (`eip155:4663`). It is implicit in
every command; there is no network, chain or RPC option. A CAIP-10 address on another chain
(`eip155:1:0x…`), or a `--chain`/`--network` flag, is refused with `unsupported_chain` (exit 2).

## Install

```sh
npm install --global @hey-research-lab/cli   # installs the `hey` command (alias: `hey-research`)
# or, without installing:
npx @hey-research-lab/cli --help
```

Node.js 22 or later. No API key is needed.

## Smallest working example

```sh
hey project hey-research-lab
```

```text
<name> (<symbol>)  hey-research-lab
<one-line description>

Activity            <SHIPPING | ACTIVE | QUIET | DORMANT | RESUMED | UNKNOWN>
Last ship           <date> — <title>
                    <ship type> · verification <state> · <source URL>
Research level      <INDEXED | RESEARCHED | VERIFIED_BUILDER> · catalogue <state>
Still Building      <HELD | NOT_HELD | NOT_MEASURED — reason>
…
Page                https://heyresearch.xyz/project/hey-research-lab

<HEY's disclaimer, as the API sends it>
```

(HEY's own project is researched by the same rules as every other one; it is used here only
because it is a stable example.) The test suite runs offline against recorded answers:
`pnpm test`.

## Commands

Every command makes **one** GET request to `https://heyresearch.xyz` and never retries on its
own. Nothing here calls the site's live scan (`POST /api/scan`), an account route or a write
route.

| Command                        | Reads                                              | `--limit` | `--since`   | Other options                       |
| ------------------------------ | -------------------------------------------------- | --------- | ----------- | ----------------------------------- |
| `hey project <slug>`           | `GET /api/projects/{slug}`                         | –         | –           |                                     |
| `hey research <slug>`          | `GET /api/agent/research_project?project=`         | –         | –           |                                     |
| `hey token <address>`          | `GET /api/token/4663/{address}`                    | –         | –           |                                     |
| `hey scan <address>`           | `GET /api/v1/scan?chain=4663&token=`               | –         | –           |                                     |
| `hey search <query>`           | `GET /api/search/suggest?q=`                       | –         | –           |                                     |
| `hey ships`                    | `GET /api/ships`                                   | 1–48      | publishedAt | `--project <slug>`, `--type <TYPE>` |
| `hey builders`                 | `GET /api/builders`                                | 1–200     | –           |                                     |
| `hey changes [slug]`           | `GET /api/changes`                                 | 1–100     | occurredAt  |                                     |
| `hey unknowns <slug\|address>` | `GET /api/agent/unknowns?project=` (or `address=`) | –         | –           |                                     |
| `hey evidence <id>`            | `GET /api/evidence/{id}`                           | –         | –           |                                     |
| `hey pulse`                    | `GET /api/chain` (alias: HEY has no `/api/pulse`)  | –         | –           | `--days <1–400>`                    |
| `hey this-week`                | `GET /api/this-week`                               | –         | –           |                                     |

A flag the endpoint does not support is refused with a usage error (exit 2) that says why — the
CLI never trims or filters an answer on the client to fake a parameter. `hey help <command>`
prints each command's endpoint, options and caveats.

### `hey project <slug>`

The project dossier: activity status, last ship with its source and verification state, research
level, Still Building state with its reason, Build Momentum, the token identity and its
verification. A market figure is printed only when HEY holds one, labelled as context with its
source and reading time. A market that is only the token's launch pool prints "Launch pool only"
and no figure, as every HEY surface does; a valuation HEY withholds prints "valuation withheld"
with HEY's reason code (`launch_pool_no_trades`, `valuation_over_liquidity`,
`chain_evidence_contradicts`, `sources_disagree`, …); and when a second source prices the token
more than 2× away, the line under the figure says so.

```sh
hey project hey-research-lab
```

### `hey research <slug>`

HEY's current research view as the agent contract (AgentIntelligenceResponse v1) answers it: the
answer first, then each claim tagged `FACT`, `DERIVED` or `UNKNOWN`, what HEY does not know with
what not to conclude from it, and freshness per data family. Market and usage claims are marked
"context only".

```sh
hey research hey-research-lab
```

### `hey token <address>`

The published project HEY records for a contract, in HEY's own words (`activityLabel`,
`activityHelp`). `status: "unknown"` means HEY's published catalogue has no project for the
address: exit 4, and not a finding about the contract. On `MISMATCH` the project's own site names
another contract, so the activity is the project's, never this token's.

```sh
hey token 0x…                      # 0X… is accepted and normalised to lowercase
hey token eip155:4663:0x…          # CAIP-10 on Robinhood Chain
```

### `hey scan <address>`

The partner card for a contract: status in HEY's words, verified builder, token verification,
coverage, 30-day commits/releases/ships and the last ship. It is a read of HEY's published
records; the card's `scan_url` opens the site's scan page in a browser. `commits_30d` is absent
when HEY reads no repository for the project, and `hey` prints that as "not measured", never 0.
On `found: false` it also prints what HEY holds for the token — `indexed`, `research_state`
(`not_researched`, `not_published`, `not_indexed`) and `launched_via` when HEY sends them — which
is never a verdict on the token.

```sh
hey scan 0x…
```

### `hey search <query>`

Identity rows (at most eight) over names, symbols, contracts, old slugs, verified domains and
repositories. A `launch` row is a launch record HEY indexed, not a reviewed project.

```sh
hey search hey research
```

### `hey ships`

The ship feed, newest first. `--since` filters `publishedAt` (inclusive). An unknown `--type`
is refused by HEY with the allowed values (exit 3).

```sh
hey ships --limit 10
hey ships --since 2026-09-01 --type releases
hey ships --project hey-research-lab --limit 5
```

### `hey builders`

The Builder Radar: ranked by builder signals (development, on-chain use, research standing);
market cap, price and volume take no part. `hey` prints HEY's own method line with the ranking.

```sh
hey builders --limit 20
```

### `hey changes [slug]`

The change ledger, newest first — chain-wide, or one project's. `--since` filters the event's own
time (`occurredAt`): events HEY could not date from a source (`occurredAt: null`, precision
`OBSERVED`) are left out by `--since`. HEY refuses a filter value it cannot read
(`invalid_parameter`, exit 3); `hey` also checks the answer's query echo and refuses (exit 3,
`filter_dropped`) rather than ever print an unfiltered feed as a filtered one.

```sh
hey changes hey-research-lab --limit 20
hey changes --since 2026-10-01T00:00:00Z
```

### `hey unknowns <slug|address>`

What HEY does not know, by category — `UNKNOWN`, `NOT_MEASURED`, `NOT_VERIFIED`, `STALE`,
`INSUFFICIENT_EVIDENCE` — each with its dimension, reason code and what not to conclude from it,
plus the coverage dimensions HEY measured, found not applicable or withheld.

```sh
hey unknowns hey-research-lab
hey unknowns 0x…
```

### `hey evidence <id>`

One published evidence record by its typed id (`ship:`, `signal:`, `abi:`, `impl:`, `lock:`,
`source:`, `claim:`, `state:`, `integrity:`, `narrative:`, `method:`, `sourcechange:`,
`security:`, `v4hook:`). A withdrawn record is an answer (`withdrawn: true` with its reason),
not an error.

```sh
hey evidence ship:<uuid>
```

### `hey pulse`

Robinhood Chain day by day. **An alias of `GET /api/chain`** — HEY has no pulse endpoint. HEY's
own counts (launches recorded, projects published, ships, builders shipping, builders verified)
are printed apart from the chain and market aggregates (transactions, transfers, DEX trades and
volume), which come from providers and are context only. The day in progress is marked partial,
and a day's DEX volume HEY withholds as implausible prints "withheld", never 0.

```sh
hey pulse --days 7
```

### `hey this-week`

The weekly rollup: who shipped, newly verified builders, projects back to shipping, Still
Building and Under the Radar, with true totals. The bare market figures on its list items are
left out of the human output.

```sh
hey this-week
```

## Options

| Option            | Meaning                                                                                                                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--json`          | Print exactly one JSON document on stdout (below).                                                                                                                                                                  |
| `--quiet`         | Print only the essential line(s) — one id or slug per row for lists, one status line for a record — with no headers, notes or disclaimer footer. For pipelines; the disclaimer still travels in `--json`.           |
| `--limit <n>`     | Rows to read, where the endpoint takes a limit (`ships` 1–48, `builders` 1–200, `changes` 1–100). Elsewhere: usage error.                                                                                           |
| `--since <date>`  | An ISO 8601 date (`2026-09-01`, read as 00:00 UTC) or an instant with a zone (`2026-09-01T12:00:00Z`), where the endpoint filters by date (`ships`, `changes`). Sent as a full UTC instant. Elsewhere: usage error. |
| `--no-color`      | No ANSI styling. Also `NO_COLOR=1`, and whenever stdout is not a terminal. Colour is emphasis only; it never carries meaning on its own.                                                                            |
| `-h`, `--help`    | Help (`hey help <command>` for one command).                                                                                                                                                                        |
| `-v`, `--version` | Version.                                                                                                                                                                                                            |

`HEY_API_KEY` (optional) is sent as a bearer token to `https://heyresearch.xyz` only; it reads the
same public data on your key's tier. It is never printed or logged.

## JSON output

`--json` wraps the API's answer, **unchanged**, in a small envelope (`hey.cli/v1`):

```json
{
  "schema": "hey.cli/v1",
  "command": "token",
  "ok": true,
  "chain": { "name": "Robinhood Chain", "chainId": 4663, "caip2": "eip155:4663" },
  "data": {
    "chainId": 4663,
    "contractAddress": "0x…",
    "status": "published",
    "project": { "…": "…" },
    "disclaimer": "…"
  },
  "error": null,
  "source": {
    "url": "https://heyresearch.xyz/api/token/4663/0x…",
    "requestId": "6b2d6fcc-…",
    "apiVersion": "1",
    "fetchedAt": "2026-10-02T12:00:00.000Z"
  }
}
```

- `data` is the API JSON as HEY sent it: no field is renamed, dropped or filled in. State words
  pass through verbatim (`UNKNOWN`, `NOT_MEASURED`, `NOT_VERIFIED`, `STALE`,
  `INSUFFICIENT_EVIDENCE`, `WITHHELD`, `NOT_HELD`, `MISMATCH` …). An absent field means HEY does
  not know it; it is never turned into `0`, `false` or `null`.
- `ok` says whether HEY answered. A lookup that answered "no published record" (`hey token`
  `status: "unknown"`, `hey scan` `found: false`) is `ok: true` with the answer in `data`, and
  exit code 4.
- On failure: `ok: false`, `data: null`, and `error: { code, message, retryable, requestId?,
retryAfterSeconds? }` with HEY's own error code when it sent one (`not_found`,
  `invalid_parameter`, `rate_limited`, `quota`, `internal_error` …) or the CLI's
  (`invalid_address`, `unsupported_chain`, `unsupported_option`, `filter_dropped`, `network` …).
  `source` is `null` when no request was made.

## Exit codes

| Code | Meaning                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0    | Success (a withdrawn evidence record is a success: it is an answer).                                                                                                                 |
| 2    | Usage error: unknown command or option, a flag the endpoint does not take, a malformed slug, address, id or date, `unsupported_chain`, the zero or burn address. No request is made. |
| 3    | HEY refused the request (a 4xx other than 404/429, e.g. `invalid_parameter`), or `filter_dropped`.                                                                                   |
| 4    | Not found: a 404, `status: "unknown"` from `hey token`, `found: false` from `hey scan`.                                                                                              |
| 5    | Rate limited or out of quota (429). The message carries HEY's `retry-after` delay; wait that long. The CLI does not retry.                                                           |
| 6    | Network failure, timeout, an unreadable or oversized answer, or a HEY 5xx (retryable).                                                                                               |

## Scripting

```sh
# The activity status of a contract's project; exit 4 when HEY has no published project for it.
hey token "$CA" --json | jq -r '.data.project.activityStatus // "UNKNOWN"'

# Slugs of the 20 newest ships' projects, one per line.
hey ships --limit 20 --json | jq -r '.data.items[].project.slug' | sort -u

# Evidence ids only (quiet mode prints one per line).
hey ships --limit 10 --quiet

# Every gap HEY lists for a project, with what not to conclude from it.
hey unknowns hey-research-lab --json \
  | jq -r '.data.unknowns[] | "\(.category)\t\(.dimension)\t\(.doNotConclude.text)"'

# Count unknowns per category (zeros are HEY's own counts).
hey unknowns hey-research-lab --json | jq '.data.data.counts'

# Changes dated since a day, building events only.
hey changes --since 2026-10-01 --limit 100 --json \
  | jq -r '.data.items[] | select(.countsAsBuilding == true) | "\(.occurredAt)\t\(.project.slug)\t\(.type)"'

# HEY's own daily counts, without the provider aggregates.
hey pulse --days 7 --json | jq -r '.data.days[] | [.day, .ships, .buildersShipping] | @tsv'

# Branch on the exit code, and honour a rate limit.
hey scan "$CA" --json > card.json
case $? in
  0) jq -r '.data.status_label' card.json ;;
  4) echo "HEY has no published project for $CA" ;;
  5) sleep "$(jq -r '.error.retryAfterSeconds // 60' card.json)" ;;
  *) jq -r '.error.message' card.json >&2 ;;
esac
```

## How it relates to HEY Research Lab

`hey` reads HEY's public API through the published `@hey-research-lab/sdk`. Routes the SDK 0.1.1
does not have methods for yet (`/api/agent/research_project`, `/api/agent/unknowns`) are read
through the SDK's public `client.get()`. The CLI computes nothing of its own: activity status,
research level, verification and every other state are HEY's, decided by HEY's private quality
gate and relayed with their source. Public API docs: <https://heyresearch.xyz/docs/public-api>.
The hosted MCP server (<https://heyresearch.xyz/mcp>) serves the same answers to agents.

## What it does NOT prove

The CLI prints what HEY's public API returns, with its sources. Activity status is a record of development, not a view on a token. Nothing it prints is investment advice, a safety verdict or a recommendation, and an unknown value means HEY does not know — not zero.

HEY Research Lab is an independent research project and is not affiliated with, endorsed by or partnered with Robinhood Markets, Inc. or Robinhood Chain.

## Security

See [SECURITY.md](SECURITY.md). The CLI makes HTTPS GET requests to `https://heyresearch.xyz`
only (one per command), follows no redirect except one to HEY's own `/api/` path (the SDK's
rule), reads at most 4 MiB of an answer, and refuses an answer carrying a `__proto__`,
`constructor` or `prototype` key. Text relayed from sources (project names, release titles) is
stripped of control, escape, invisible and bidirectional-override characters before it reaches
your terminal. It reads and writes no files, runs no child processes, and stores nothing.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). `pnpm install && pnpm scan && pnpm lint && pnpm typecheck
&& pnpm test && pnpm build`; tests run against saved fixtures with the network blocked. Never
commit a secret or a `.env` with values.

Runtime dependencies: `@hey-research-lab/sdk` (the API client) and `@noble/hashes` (keccak-256
for the EIP-55 checksum warning on mixed-case addresses).

## Licence

MIT © 2026 HEY Research Lab. See [LICENSE](LICENSE).
