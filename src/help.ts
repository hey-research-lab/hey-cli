import { COMMANDS } from './commands/index.js';
import type { CommandSpec } from './commands/types.js';
import { CLI_VERSION } from './version.js';

export function mainHelp(): string {
  const width = Math.max(...COMMANDS.map((c) => c.name.length));
  return [
    `hey ${CLI_VERSION} — HEY Research Lab's public API from the terminal (Robinhood Chain, 4663)`,
    '',
    'Usage: hey <command> [arguments] [options]',
    '',
    'Commands:',
    ...COMMANDS.map((c) => `  ${c.name.padEnd(width)}  ${c.summary}`),
    `  ${'help'.padEnd(width)}  Help for one command: hey help <command>`,
    '',
    'Options:',
    '  --json         One JSON document on stdout (schema hey.cli/v1); the API answer is in .data, unchanged',
    '  --quiet        The essential line(s) only: no headers, no notes, no footer',
    '  --limit <n>    Rows to read, where the endpoint takes a limit (ships, builders, changes)',
    '  --since <date> ISO 8601 date or instant, where the endpoint filters by date (ships, changes)',
    '  --no-color     No ANSI styling (also NO_COLOR=1, and whenever stdout is not a terminal)',
    '  -h, --help     Help',
    '  -v, --version  Version',
    '',
    'Robinhood Chain (chain id 4663, eip155:4663) is implicit; there is no network option.',
    'Each command makes one request to https://heyresearch.xyz and never retries on its own.',
    '',
    'Exit codes: 0 ok · 2 usage (incl. unsupported_chain) · 3 refused by HEY · 4 not found',
    '            5 rate limited (retry after the printed delay) · 6 network, timeout or HEY 5xx',
    '',
    'Docs: https://heyresearch.xyz/docs/public-api',
    'Not investment advice. An unknown value means HEY does not know it — not zero.',
  ].join('\n');
}

export function commandHelp(c: CommandSpec): string {
  const lines = [`Usage: ${c.synopsis}`, '', c.summary, '', `Reads: ${c.endpoint}`];
  // One column for every option, as wide as the longest flag plus two spaces.
  const rows: [string, string][] = [];
  if (c.limit) rows.push(['--limit <n>', c.limit.note]);
  if (c.since) rows.push(['--since <date>', c.since]);
  for (const e of c.extra ?? []) rows.push([`--${e.name} <${e.value}>`, e.help]);
  const width = Math.max(0, ...rows.map(([flag]) => flag.length)) + 2;
  const options = rows.map(([flag, help]) => `  ${flag.padEnd(width)}${help}`);
  options.push('  --json, --quiet, --no-color');
  lines.push('', 'Options:', ...options);
  if (c.noLimit) lines.push(`  (no --limit: ${c.noLimit})`);
  if (c.noSince) lines.push(`  (no --since: ${c.noSince})`);
  if (c.details.length) lines.push('', ...c.details);
  return lines.join('\n');
}
