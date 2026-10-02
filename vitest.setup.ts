/**
 * No test may touch the network. The CLI takes an injected `fetchImpl`; every test drives it
 * over saved fixtures, so any call reaching the real `fetch` is a mistake and fails loudly.
 */
const blocked = async (input: unknown): Promise<never> => {
  const target = typeof input === 'string' ? input : String(input);
  throw new Error(
    `Network access is disabled in tests. Something tried to fetch ${target}. ` +
      'Drive the CLI with a stubbed fetchImpl over saved fixtures.',
  );
};

globalThis.fetch = blocked as unknown as typeof fetch;
