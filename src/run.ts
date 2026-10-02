import { parseArgs } from 'node:util';

import { CAIP2, CHAIN_ID, CHAIN_NAME } from './chain.js';
import { findCommand } from './commands/index.js';
import type { CommandSpec, Flags } from './commands/types.js';
import { CliError, fromRequestError, usageError } from './errors.js';
import { EXIT, type ExitCode } from './exit-codes.js';
import { commandHelp, mainHelp } from './help.js';
import {
  createClient,
  DEFAULT_BASE_URL,
  parseBaseUrl,
  type FetchLike,
  type RequestRecord,
} from './http.js';
import { parseIntInRange, parseSince } from './input.js';
import { Out } from './output.js';
import { forbiddenKeyPath } from './read.js';
import { ansiStyle, plainStyle } from './text.js';
import { CLI_VERSION } from './version.js';

export type RunEnvironment = {
  fetchImpl: FetchLike;
  stdout: (text: string) => void;
  stderr: (text: string) => void;
  env: Record<string, string | undefined>;
  /** Whether stdout is a terminal (colour is off otherwise). */
  isTTY: boolean;
  now: () => Date;
};

export const JSON_SCHEMA = 'hey.cli/v1';

const OPTIONS = {
  json: { type: 'boolean' },
  quiet: { type: 'boolean' },
  'no-color': { type: 'boolean' },
  limit: { type: 'string' },
  since: { type: 'string' },
  project: { type: 'string' },
  type: { type: 'string' },
  days: { type: 'string' },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  // Tests and local mocks only; not shown in help. It is not network switching.
  'base-url': { type: 'string' },
} as const;

const NETWORK_FLAGS = /^--(chain|chain-id|chainid|network|net|rpc|rpc-url)(=|$)/i;

type Envelope = {
  schema: typeof JSON_SCHEMA;
  command: string | null;
  ok: boolean;
  chain: { name: string; chainId: number; caip2: string };
  data: unknown;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    requestId?: string;
    retryAfterSeconds?: number;
  } | null;
  source: {
    url: string | null;
    requestId: string | null;
    apiVersion: string | null;
    fetchedAt: string;
  } | null;
};

function envelope(command: string | null, now: Date, record: RequestRecord | undefined): Envelope {
  return {
    schema: JSON_SCHEMA,
    command,
    ok: false,
    chain: { name: CHAIN_NAME, chainId: CHAIN_ID, caip2: CAIP2 },
    data: null,
    error: null,
    source:
      record && record.count > 0
        ? {
            url: record.url ?? null,
            requestId: record.requestId ?? null,
            apiVersion: record.apiVersion ?? null,
            fetchedAt: now.toISOString(),
          }
        : null,
  };
}

function flagsFor(spec: CommandSpec, values: Record<string, string | boolean | undefined>): Flags {
  const flags: Flags = {};
  const has = (k: string) => values[k] !== undefined;
  if (has('limit')) {
    if (!spec.limit)
      throw usageError(
        'unsupported_option',
        `hey ${spec.name} does not take --limit: ${spec.noLimit ?? 'the endpoint has no limit.'}`,
      );
    flags.limit = parseIntInRange('limit', String(values.limit), 1, spec.limit.max);
  }
  if (has('since')) {
    if (!spec.since)
      throw usageError(
        'unsupported_option',
        `hey ${spec.name} does not take --since: ${spec.noSince ?? 'the endpoint has no date filter.'}`,
      );
    flags.since = parseSince(String(values.since));
  }
  for (const name of ['project', 'type', 'days'] as const) {
    if (!has(name)) continue;
    if (!spec.extra?.some((e) => e.name === name)) {
      throw usageError('unsupported_option', `hey ${spec.name} does not take --${name}.`);
    }
    const raw = String(values[name]);
    if (name === 'days') flags.days = parseIntInRange('days', raw, 1, 400);
    else if (name === 'type') {
      if (!/^[A-Za-z_,]{1,400}$/.test(raw))
        throw usageError(
          'invalid_parameter',
          '--type takes a ship type such as GITHUB_RELEASE, a comma list, or "releases".',
        );
      flags.type = raw;
    } else flags.project = raw;
  }
  return flags;
}

function checkPositionals(spec: CommandSpec, args: string[]): void {
  const required = spec.positionals.filter((p) => !p.optional).length;
  const variadic = spec.positionals.some((p) => p.variadic);
  if (args.length < required) {
    const missing = spec.positionals[args.length]?.name ?? 'argument';
    throw usageError(
      'missing_argument',
      `hey ${spec.name} needs <${missing}>. Usage: ${spec.synopsis}`,
    );
  }
  if (!variadic && args.length > spec.positionals.length) {
    throw usageError(
      'unexpected_argument',
      `hey ${spec.name} takes ${spec.positionals.length || 'no'} argument${spec.positionals.length === 1 ? '' : 's'}. Usage: ${spec.synopsis}`,
    );
  }
}

/** Runs one CLI invocation and returns its exit code. Never throws. */
export async function run(argv: readonly string[], io: RunEnvironment): Promise<ExitCode> {
  const wantsJson = argv.includes('--json');
  let commandName: string | null = null;
  let record: RequestRecord | undefined;

  const fail = (error: CliError): ExitCode => {
    if (wantsJson) {
      const doc = envelope(commandName, io.now(), record);
      doc.error = {
        code: error.code,
        message: error.message,
        retryable: error.details.retryable ?? false,
      };
      if (error.details.requestId) doc.error.requestId = error.details.requestId;
      if (error.details.retryAfterSeconds !== undefined)
        doc.error.retryAfterSeconds = error.details.retryAfterSeconds;
      io.stdout(`${JSON.stringify(doc, null, 2)}\n`);
    } else {
      io.stderr(`hey: ${error.message} (${error.code})\n`);
      if (error.details.requestId) io.stderr(`hey: request id ${error.details.requestId}\n`);
      if (error.exitCode === EXIT.USAGE) io.stderr('hey: see `hey --help`\n');
    }
    return error.exitCode;
  };

  try {
    const networkFlag = argv.find((a) => NETWORK_FLAGS.test(a));
    if (networkFlag) {
      throw usageError(
        'unsupported_chain',
        'HEY supports Robinhood Chain (4663) only, and it is implicit: hey takes no chain or network option.',
      );
    }
    let parsed;
    try {
      parsed = parseArgs({
        args: [...argv],
        options: OPTIONS,
        allowPositionals: true,
        strict: true,
      });
    } catch (error) {
      throw usageError('invalid_option', error instanceof Error ? error.message : String(error));
    }
    const { values, positionals } = parsed;

    if (values.version) {
      io.stdout(`${CLI_VERSION}\n`);
      return EXIT.OK;
    }
    const [first, ...rest] = positionals;
    if (first === undefined || (first === 'help' && rest.length === 0)) {
      if (values.help || first === 'help') {
        io.stdout(`${mainHelp()}\n`);
        return EXIT.OK;
      }
      if (wantsJson) throw usageError('missing_command', 'No command given; see `hey --help`.');
      io.stderr(`${mainHelp()}\n`);
      return EXIT.USAGE;
    }
    if (first === 'help') {
      const target = findCommand(rest[0] ?? '');
      if (!target)
        throw usageError('unknown_command', `No command named ${JSON.stringify(rest[0])}.`);
      io.stdout(`${commandHelp(target)}\n`);
      return EXIT.OK;
    }
    const spec = findCommand(first);
    if (!spec)
      throw usageError(
        'unknown_command',
        `No command named ${JSON.stringify(first.slice(0, 40))}.`,
      );
    commandName = spec.name;
    if (values.help) {
      io.stdout(`${commandHelp(spec)}\n`);
      return EXIT.OK;
    }
    checkPositionals(spec, rest);
    const flags = flagsFor(spec, values);
    const baseUrl =
      values['base-url'] === undefined ? DEFAULT_BASE_URL : parseBaseUrl(values['base-url']);
    const apiKey = io.env.HEY_API_KEY?.trim() || undefined;

    record = { count: 0 };
    const client = createClient(
      { fetchImpl: io.fetchImpl, baseUrl, ...(apiKey ? { apiKey } : {}) },
      record,
    );
    const warnings: string[] = [];
    let outcome;
    try {
      outcome = await spec.run({
        client,
        args: rest,
        flags,
        baseUrl,
        warn: (m) => warnings.push(m),
      });
    } catch (error) {
      throw fromRequestError(error, record.requestId);
    } finally {
      for (const w of warnings) io.stderr(`hey: ${w}\n`);
    }
    const badKey = forbiddenKeyPath(outcome.data);
    if (badKey) {
      throw new CliError(
        'invalid_response',
        `HEY's answer carries a forbidden key at ${badKey}; the CLI does not relay it.`,
        EXIT.NETWORK,
        { retryable: false },
      );
    }

    if (values.json) {
      const doc = envelope(spec.name, io.now(), record);
      doc.ok = true;
      doc.data = outcome.data;
      io.stdout(`${JSON.stringify(doc, null, 2)}\n`);
      return outcome.exitCode;
    }
    const colour =
      io.isTTY && !values['no-color'] && !(io.env.NO_COLOR !== undefined && io.env.NO_COLOR !== '');
    const out = new Out(colour ? ansiStyle : plainStyle);
    if (values.quiet) outcome.quiet(out);
    else outcome.render(out);
    io.stdout(out.lines.length ? `${out.lines.join('\n')}\n` : '');
    return outcome.exitCode;
  } catch (error) {
    return fail(error instanceof CliError ? error : fromRequestError(error, record?.requestId));
  }
}
