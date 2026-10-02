import { EXIT } from '../exit-codes.js';
import { parseQuery } from '../input.js';
import { list, rec, str } from '../read.js';
import { absolute, UNKNOWN } from './shared.js';
import type { CommandSpec } from './types.js';

export const search: CommandSpec = {
  name: 'search',
  synopsis: 'hey search <query>',
  summary: 'Identity search over names, symbols, contracts, old slugs, domains and repositories.',
  endpoint: 'GET /api/search/suggest?q={query}',
  details: [
    "Identity rows only (at most eight), the same matcher as the site's search field. There is no full-text search endpoint.",
    'A "launch" row is a launch record HEY indexed, not a reviewed project.',
  ],
  positionals: [{ name: 'query', variadic: true }],
  noLimit: '/api/search/suggest has no limit parameter; it returns at most eight rows.',
  noSince: '/api/search/suggest has no date filter.',
  async run(ctx) {
    const q = parseQuery(ctx.args.join(' '));
    const data = await ctx.client.search.suggest(q);
    const d = rec(data);
    const rows = list(d.suggestions).map(rec);
    const target = (row: Record<string, unknown>) => absolute(ctx.baseUrl, row.target);
    return {
      data,
      exitCode: EXIT.OK,
      quiet(out) {
        for (const row of rows) {
          const slugMatch = /^\/project\/([a-z0-9-]+)$/.exec(str(row.target) ?? '');
          out.line(slugMatch?.[1] ?? str(row.contract) ?? str(row.target) ?? UNKNOWN);
        }
      },
      render(out) {
        if (!rows.length) {
          out.line(
            `HEY's search index has no identity row for ${JSON.stringify(out.text(q, 64))}.`,
          );
          return;
        }
        for (const row of rows) {
          const type = str(row.type) ?? 'unknown';
          const name = out.text(str(row.name) ?? UNKNOWN, 80);
          const symbol = str(row.symbol);
          const contract = str(row.contract);
          const head = `${out.strong(type.padEnd(8))}${name}${symbol ? ` (${out.text(symbol, 24)})` : ''}${
            contract ? `  ${out.text(contract, 42)}` : ''
          }`;
          out.line(head);
          if (type === 'launch') {
            const via = str(row.launchedVia);
            out.line(
              `        ${out.dim(`launch record, not a reviewed project${via ? ` · launched via ${out.text(via, 40)}` : ''}`)}`,
            );
          }
          const url = target(row);
          if (url) out.line(`        ${url}`);
        }
        if (d.moreLaunchRecords === true) {
          out.line(out.dim('HEY holds more launch records for this query than it lists here.'));
        }
      },
    };
  },
};
