import { CliError } from '../errors.js';
import { EXIT } from '../exit-codes.js';
import { parseSlug } from '../input.js';
import type { Out } from '../output.js';
import { list, num, rec, str, type Rec } from '../read.js';
import { fmtCount, fmtInstant, fmtUsd } from '../text.js';
import { footer, link, nameWithSymbol, orUnknown, when, word } from './shared.js';
import type { CommandSpec } from './types.js';

const shown = (count: number, total: number | undefined, noun: string) =>
  total === undefined ? `${count} ${noun} shown` : `${count} of ${fmtCount(total)} ${noun}`;

export const ships: CommandSpec = {
  name: 'ships',
  synopsis: 'hey ships [--limit n] [--since date] [--project slug] [--type TYPE]',
  summary: 'The ship feed, newest first: what projects shipped, each with its source.',
  endpoint: 'GET /api/ships',
  details: [
    'A record of ships, not of projects: a project that shipped three times appears three times.',
    'verification says how each claim is backed; SELF_REPORTED and verified states stay distinct.',
    'An unknown --type value is refused by HEY (invalid_parameter, exit 3) with the allowed values.',
  ],
  positionals: [],
  limit: { max: 48, note: '1–48; HEY defaults to 24' },
  since: 'only ships published at or after it (filters publishedAt)',
  extra: [
    { name: 'project', value: 'slug', help: "one project's ships" },
    {
      name: 'type',
      value: 'TYPE',
      help: 'a ship type (GITHUB_RELEASE), a comma list, or "releases"',
    },
  ],
  async run(ctx) {
    const query: Record<string, string | number> = {};
    if (ctx.flags.limit !== undefined) query.limit = ctx.flags.limit;
    if (ctx.flags.since) query.since = ctx.flags.since;
    if (ctx.flags.project) query.project = parseSlug(ctx.flags.project);
    if (ctx.flags.type) query.type = ctx.flags.type;
    const data = await ctx.client.ships.list(query);
    const d = rec(data);
    const items = list(d.items).map(rec);
    return {
      data,
      exitCode: EXIT.OK,
      quiet(out) {
        for (const s of items) out.line(str(s.evidenceId) ?? str(s.id) ?? 'unknown');
      },
      render(out) {
        out.line(
          out.dim(
            `${shown(items.length, num(d.total), 'ships')}, newest first${ctx.flags.since ? `, published since ${fmtInstant(ctx.flags.since)}` : ''}`,
          ),
        );
        if (!items.length) {
          out.line("HEY's ship feed has no ship matching this query.");
        }
        for (const s of items) {
          const p = rec(s.project);
          out.line();
          out.line(
            `${when(s.publishedAt, s.precision)}  ${out.strong(nameWithSymbol(out, p))}  ${out.text(str(s.eventType) ?? 'UNKNOWN', 40)} · ${word(out, s.verification)}`,
          );
          out.line(`  ${out.text(str(s.title) ?? 'untitled', 200)}`);
          const source = link(s.sourceUrl);
          out.line(
            `  ${out.dim(`${out.text(str(s.evidenceId) ?? '', 120)}${source ? `  ${source}` : ''}`)}`,
          );
        }
        footer(out, d.disclaimer);
      },
    };
  },
};

export const builders: CommandSpec = {
  name: 'builders',
  synopsis: 'hey builders [--limit n]',
  summary: 'The Builder Radar: projects ranked by builder signals, market excluded.',
  endpoint: 'GET /api/builders',
  details: [
    "Ranked by HEY's builder signals (development, on-chain use, research standing); market cap, price and volume take no part. The method line is printed as HEY states it.",
    'On-chain use counts address-days of calls, not distinct addresses and not people.',
  ],
  positionals: [],
  limit: { max: 200, note: '1–200; HEY defaults to 25' },
  noSince: "/api/builders is today's ranking and has no date filter.",
  async run(ctx) {
    const query: Record<string, number> = {};
    if (ctx.flags.limit !== undefined) query.limit = ctx.flags.limit;
    const data = await ctx.client.builders.list(query);
    const d = rec(data);
    const items = list(d.items).map(rec);
    return {
      data,
      exitCode: EXIT.OK,
      quiet(out) {
        for (const b of items) out.line(str(b.slug) ?? 'unknown');
      },
      render(out) {
        out.line(
          `${out.strong('Builder Radar')}${str(d.day) ? `, ${out.text(str(d.day) ?? '', 10)}` : ''} — ${shown(items.length, num(d.ranked), 'ranked')}`,
        );
        const method = str(d.method);
        if (method) out.line(out.dim(`Method: ${out.text(method, 700)}`));
        if (!items.length) out.line('The Builder Radar lists no project for this query.');
        for (const b of items) {
          const s = rec(b.scores);
          const score = (k: string) => {
            const v = num(s[k]);
            return v === undefined ? 'unknown' : String(v);
          };
          out.line();
          out.line(
            `#${num(b.rank) ?? '?'}  ${out.strong(nameWithSymbol(out, b))}  ${word(out, b.activityStatus)}`,
          );
          out.line(
            `    overall ${score('overall')} · development ${score('development')} · on-chain ${score('onchain')} · research ${score('research')}`,
          );
          out.line(
            `    ${out.dim(`last ship ${str(b.lastShippedAt) ? when(b.lastShippedAt) : 'unknown'} · ${orUnknown(link(b.url))}`)}`,
          );
        }
        footer(out, d.disclaimer);
      },
    };
  },
};

const HEY_COLUMNS: [string, string][] = [
  ['launches', 'launches'],
  ['projectsPublished', 'published'],
  ['ships', 'ships'],
  ['buildersShipping', 'shipping'],
  ['buildersVerified', 'verified'],
];
const CHAIN_COLUMNS: [string, string, boolean][] = [
  ['transactions', 'transactions', false],
  ['transfers', 'transfers', false],
  ['dexTrades', 'dex trades', false],
  ['dexVolumeUsd', 'dex volume', true],
  ['tokensTraded', 'tokens', false],
  ['poolsTraded', 'pools', false],
];

function table(out: Out, header: string[], rows: string[][]): void {
  const widths = header.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const fmt = (cells: string[]) =>
    cells
      .map((c, i) => (i === 0 ? c.padEnd(widths[i] ?? 0) : c.padStart(widths[i] ?? 0)))
      .join('  ');
  out.line(out.dim(fmt(header)));
  for (const r of rows) out.line(fmt(r));
}

export const pulse: CommandSpec = {
  name: 'pulse',
  synopsis: 'hey pulse [--days n]',
  summary: 'Robinhood Chain day by day. An alias of GET /api/chain (HEY has no /api/pulse).',
  endpoint: 'GET /api/chain?days={n}',
  details: [
    'HEY has no pulse endpoint: this command reads /api/chain, the closest public read.',
    "HEY's own counts (launches recorded, projects published, ships, builders shipping, builders verified) are printed apart from the chain and market aggregates (transactions, transfers, DEX trades and volume), which come from providers and are context only — never a builder input.",
    'The day in progress is partial. A missing figure prints as unknown, never 0.',
  ],
  positionals: [],
  noLimit: '/api/chain takes --days (1–400), not a limit.',
  noSince: '/api/chain takes --days (1–400), not a date.',
  extra: [{ name: 'days', value: 'n', help: 'days to read, 1–400 (HEY defaults to 14)' }],
  async run(ctx) {
    const data = await ctx.client.chain(
      ctx.flags.days === undefined ? {} : { days: ctx.flags.days },
    );
    const d = rec(data);
    const days = list(d.days).map(rec);
    const today = str(d.today);
    const cell = (row: Rec, key: string, usd = false) => {
      const v = num(row[key]);
      return v === undefined ? 'unknown' : usd ? fmtUsd(v) : fmtCount(v);
    };
    return {
      data,
      exitCode: EXIT.OK,
      quiet(out) {
        for (const row of days) {
          out.line(
            `${str(row.day) ?? 'unknown'} ships=${cell(row, 'ships')} shipping=${cell(row, 'buildersShipping')}`,
          );
        }
      },
      render(out) {
        out.line(
          `${out.strong('Robinhood Chain, day by day')} ${out.dim('(hey pulse reads GET /api/chain)')}`,
        );
        out.line();
        out.line(out.strong("HEY's own records"));
        table(
          out,
          ['day', ...HEY_COLUMNS.map(([, label]) => label)],
          days.map((row) => {
            const day = out.text(str(row.day) ?? 'unknown', 10);
            const mark = `${day === today ? ' partial' : ''}${row.launchesBackfill === true ? ' backfill*' : ''}`;
            return [`${day}${mark}`, ...HEY_COLUMNS.map(([key]) => cell(row, key))];
          }),
        );
        if (days.some((row) => row.launchesBackfill === true)) {
          out.line(
            out.dim(
              "* launches on this day are mostly a first read of a discovery source (a backfill), not that day's launches.",
            ),
          );
        }
        out.line();
        const observed = days.map((row) => str(row.chainObservedAt)).find((v) => v !== undefined);
        out.line(
          `${out.strong('Chain and market context')} ${out.dim(`(provider aggregates${observed ? `, observed ${fmtInstant(observed)}` : ''}; context only, never a builder input)`)}`,
        );
        table(
          out,
          ['day', ...CHAIN_COLUMNS.map(([, label]) => label)],
          days.map((row) => [
            out.text(str(row.day) ?? 'unknown', 10),
            ...CHAIN_COLUMNS.map(([key, , usd]) => cell(row, key, usd)),
          ]),
        );
        for (const note of [d.volumeNote, d.launchesNote]) {
          const n = str(note);
          if (n) out.line(out.dim(out.text(n, 600)));
        }
        footer(out, d.disclaimer);
      },
    };
  },
};

export const thisWeek: CommandSpec = {
  name: 'this-week',
  synopsis: 'hey this-week',
  summary:
    'The weekly rollup: who shipped, newly verified builders, comebacks, Still Building, Under the Radar.',
  endpoint: 'GET /api/this-week',
  details: [
    'Totals are true totals; each list shows the rows HEY includes. Market figures in the JSON are bare list values and are not printed here.',
  ],
  positionals: [],
  noLimit: '/api/this-week has no limit parameter.',
  noSince: '/api/this-week is a fixed seven-day window.',
  async run(ctx) {
    const data = await ctx.client.thisWeek();
    const d = rec(data);
    return {
      data,
      exitCode: EXIT.OK,
      quiet(out) {
        out.line(out.text(str(d.summary) ?? 'unknown', 400));
      },
      render(out) {
        if (str(d.summary)) out.line(out.strong(out.text(str(d.summary) ?? '', 400)));
        const w = rec(d.window);
        out.line(
          out.dim(
            `${out.text(str(w.label) ?? 'window unknown', 60)} (${when(w.since)} → ${when(w.until)})`,
          ),
        );
        const section = (title: string, block: Rec, row: (item: Rec) => string) => {
          const items = list(block.items).map(rec);
          const total = num(block.total);
          out.line();
          out.line(
            `${out.strong(title)}  ${out.dim(total === undefined ? `${items.length} shown` : `${fmtCount(total)} in total, ${items.length} shown`)}`,
          );
          for (const item of items) out.line(`  ${row(item)}`);
        };
        const shipped = rec(d.shipped);
        out.line();
        out.line(
          `${out.strong('Shipped')}  ${out.dim(`${num(shipped.ships) === undefined ? 'unknown' : fmtCount(num(shipped.ships) ?? 0)} ships from ${num(shipped.projects) === undefined ? 'unknown' : fmtCount(num(shipped.projects) ?? 0)} projects`)}`,
        );
        for (const item of list(shipped.items).map(rec)) {
          const p = rec(item.project);
          const latest = rec(item.latest);
          out.line(
            `  ${nameWithSymbol(out, p)}  ${word(out, p.activityStatus)}  ${num(item.ships) ?? 'unknown'} ship(s) · latest ${when(latest.publishedAt)}: ${out.text(str(latest.title) ?? 'untitled', 120)} (${word(out, latest.verification)})`,
          );
        }
        section('Newly verified builders', rec(d.newBuilders), (item) => {
          const p = rec(item.project);
          return `${nameWithSymbol(out, p)}  ${word(out, p.activityStatus)}  verified ${when(item.verifiedAt)}`;
        });
        const back = rec(d.backToShipping);
        section('Back to shipping', back, (item) => {
          const p = rec(item.project);
          return `${nameWithSymbol(out, p)}  ${word(out, item.from)} → ${word(out, item.to)}  ${when(item.changedAt)}`;
        });
        section(
          'Still Building',
          rec(d.stillBuilding),
          (p) => `${nameWithSymbol(out, p)}  ${word(out, p.activityStatus)}`,
        );
        section(
          'Under the Radar',
          rec(d.underTheRadar),
          (p) => `${nameWithSymbol(out, p)}  ${word(out, p.activityStatus)}`,
        );
        const page = link(rec(d.links).page);
        if (page) {
          out.line();
          out.kv('Page', page);
        }
        footer(out, d.disclaimer);
      },
    };
  },
};

export const changes: CommandSpec = {
  name: 'changes',
  synopsis: 'hey changes [slug] [--limit n] [--since date]',
  summary: "The change ledger, newest first: chain-wide, or one project's.",
  endpoint: 'GET /api/changes?project={slug}',
  details: [
    "--since filters the event's own time (occurredAt). Events HEY could not date from a source (occurredAt null, precision OBSERVED) are left out by --since; without --since they are listed as undated.",
    'A retraction is a tombstone: it carries only its id.',
    "HEY drops an unreadable filter value silently; the CLI checks HEY's query echo and refuses an answer whose --since was dropped (filter_dropped, exit 3).",
  ],
  positionals: [{ name: 'slug', optional: true }],
  limit: { max: 100, note: '1–100; HEY defaults to 50' },
  since:
    'only events whose source dates them at or after it (filters occurredAt; undated events are left out)',
  async run(ctx) {
    const query: Record<string, string | number> = {};
    const slug = ctx.args[0] === undefined ? undefined : parseSlug(ctx.args[0]);
    if (slug) query.project = slug;
    if (ctx.flags.limit !== undefined) query.limit = ctx.flags.limit;
    if (ctx.flags.since) query.since = ctx.flags.since;
    const data = await ctx.client.changes.list(query);
    const d = rec(data);
    if (ctx.flags.since && str(rec(d.query).since) === undefined) {
      throw new CliError(
        'filter_dropped',
        `HEY did not apply since=${ctx.flags.since} (it is missing from the answer's query echo); refusing to print an unfiltered feed as a filtered one.`,
        EXIT.REFUSED,
        { retryable: false },
      );
    }
    const items = list(d.items).map(rec);
    return {
      data,
      exitCode: EXIT.OK,
      quiet(out) {
        for (const e of items) out.line(`${str(e.id) ?? 'unknown'} ${str(e.op) ?? 'unknown'}`);
      },
      render(out) {
        out.line(
          out.dim(
            `${slug ? `Changes for ${slug}` : 'Changes on Robinhood Chain'}, newest first — ${items.length} shown${d.hasMore === true ? ', more available' : ''}${
              ctx.flags.since
                ? `; dated by their source since ${fmtInstant(ctx.flags.since)} (undated events left out)`
                : ''
            }`,
          ),
        );
        if (!items.length) out.line("HEY's change ledger has no event matching this query.");
        for (const e of items) {
          out.line();
          if (str(e.op) === 'retract') {
            out.line(
              `${out.strong('retracted')}  ${out.text(str(e.id) ?? 'unknown', 240)}  ${out.dim(`recorded ${when(e.recordedAt)}`)}`,
            );
            continue;
          }
          const p = rec(e.project);
          const dated = str(e.occurredAt)
            ? when(e.occurredAt, e.precision)
            : `undated (${out.text(str(e.precision) ?? 'OBSERVED', 12)}; HEY detected it ${when(e.detectedAt)})`;
          const counts = e.countsAsBuilding === true ? ' · counts as building' : '';
          out.line(
            `${dated}  ${out.strong(out.text(str(e.type) ?? 'unknown', 60))}${counts} · rev ${num(e.revision) ?? '?'} · ${out.text(str(e.origin) ?? 'unknown', 12)}`,
          );
          out.line(
            `  ${out.text(str(p.name) ?? str(p.slug) ?? 'unknown', 80)}: ${out.text(str(e.summary) ?? '', 200)}`,
          );
          const before = e.before;
          const after = e.after;
          if (before !== undefined || after !== undefined) {
            out.line(
              `  ${out.text(String(before ?? 'unknown'), 40)} → ${out.text(String(after ?? 'unknown'), 40)}`,
            );
          }
          const ev = list(e.evidence).map(rec)[0];
          const evidenceLink = link(rec(e.links).evidence);
          out.line(
            `  ${out.dim(`${out.text(str(ev?.id) ?? str(e.id) ?? '', 160)}${evidenceLink ? `  ${evidenceLink}` : ''}`)}`,
          );
        }
        footer(out, d.disclaimer);
      },
    };
  },
};
