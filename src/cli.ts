import { run } from './run.js';

const exitCode = await run(process.argv.slice(2), {
  fetchImpl: (input, init) => fetch(input, init),
  stdout: (text) => process.stdout.write(text),
  stderr: (text) => process.stderr.write(text),
  env: process.env,
  isTTY: process.stdout.isTTY === true,
  now: () => new Date(),
});
process.exitCode = exitCode;
