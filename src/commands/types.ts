import type { HeyClient } from '@hey-research-lab/sdk';

import type { ExitCode } from '../exit-codes.js';
import type { Out } from '../output.js';

export type Flags = {
  limit?: number;
  since?: string;
  project?: string;
  type?: string;
  days?: number;
};

export type CommandContext = {
  client: HeyClient;
  args: string[];
  flags: Flags;
  /** The origin the CLI reads (for turning HEY's relative links into absolute ones). */
  baseUrl: string;
  warn: (message: string) => void;
};

export type CommandOutcome = {
  /** The API's JSON, unchanged. */
  data: unknown;
  exitCode: ExitCode;
  render: (out: Out) => void;
  /** The terse form for `--quiet`: the essential line(s), no headers, no footer. */
  quiet: (out: Out) => void;
};

export type ExtraOption = {
  name: 'project' | 'type' | 'days';
  value: string;
  help: string;
};

export type CommandSpec = {
  name: string;
  synopsis: string;
  summary: string;
  /** The one HEY endpoint the command reads. */
  endpoint: string;
  details: string[];
  positionals: { name: string; optional?: boolean; variadic?: boolean }[];
  /** Present when the endpoint takes `limit`. */
  limit?: { max: number; note: string };
  /** Present when the endpoint takes `since`; the text says what it filters. */
  since?: string;
  /** Why `--limit`/`--since` are refused, when they are. */
  noLimit?: string;
  noSince?: string;
  extra?: ExtraOption[];
  run: (ctx: CommandContext) => Promise<CommandOutcome>;
};
