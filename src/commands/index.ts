import { research, unknowns } from './agent.js';
import { evidence } from './evidence.js';
import { builders, changes, pulse, ships, thisWeek } from './feeds.js';
import { project } from './project.js';
import { search } from './search.js';
import { scan, token } from './token.js';
import type { CommandSpec } from './types.js';

/** Every command, each backed by exactly one public HEY read route. */
export const COMMANDS: readonly CommandSpec[] = [
  project,
  research,
  token,
  scan,
  search,
  ships,
  builders,
  changes,
  unknowns,
  evidence,
  pulse,
  thisWeek,
];

export function findCommand(name: string): CommandSpec | undefined {
  return COMMANDS.find((c) => c.name === name);
}
