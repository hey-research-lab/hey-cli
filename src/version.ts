declare const __CLI_VERSION__: string | undefined;

/** Stamped by tsup at build time; tests and `tsx` runs see the development marker. */
export const CLI_VERSION: string =
  typeof __CLI_VERSION__ === 'string' && __CLI_VERSION__ !== '' ? __CLI_VERSION__ : '0.0.0-dev';
