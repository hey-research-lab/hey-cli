import { CHAIN_ID, UnsupportedChainError } from './chain.js';
import { usageError } from './errors.js';
import { checksumMatches, DEAD_ADDRESS, ZERO_ADDRESS } from './evm.js';

const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,119}$/;
const CAIP10_RE = /^eip155:([^:]+):(.+)$/;
const LOOSE_ADDRESS_RE = /^0[xX][0-9a-fA-F]{40}$/;

export type AddressInput = { address: string; warning?: string };

/**
 * A contract address from the command line: `0x…` (a `0X` prefix is accepted and normalised),
 * or a CAIP-10 id `eip155:4663:0x…`. Another chain is `unsupported_chain`; the zero and burn
 * addresses are never a contract identity. Machine form is lowercase. A mixed-case address
 * whose EIP-55 checksum does not match is a warning, not an error (foreign input).
 */
export function parseAddress(raw: string): AddressInput {
  let value = raw.trim();
  const caip = CAIP10_RE.exec(value);
  if (caip) {
    const chain = caip[1] as string;
    if (!/^[1-9]\d*$/.test(chain) || Number(chain) !== CHAIN_ID) {
      const err = new UnsupportedChainError(chain);
      throw usageError(err.code, err.message);
    }
    value = caip[2] as string;
  }
  if (!LOOSE_ADDRESS_RE.test(value)) {
    throw usageError(
      'invalid_address',
      `Not a contract address: ${JSON.stringify(raw.slice(0, 80))}. Expected 0x followed by 40 hex characters.`,
    );
  }
  const prefixed = `0x${value.slice(2)}`;
  const address = prefixed.toLowerCase();
  if (address === ZERO_ADDRESS || address === DEAD_ADDRESS) {
    throw usageError(
      'not_a_contract_identity',
      `${address} is the zero or burn address: well-formed, and never a project's contract.`,
    );
  }
  const result: AddressInput = { address };
  if (!checksumMatches(prefixed)) {
    result.warning = `warning: ${prefixed} does not match its EIP-55 checksum; looking up ${address}.`;
  }
  return result;
}

export function parseSlug(raw: string): string {
  const slug = raw.trim().toLowerCase();
  if (!SLUG_RE.test(slug)) {
    throw usageError(
      'invalid_slug',
      `Not a project slug: ${JSON.stringify(raw.slice(0, 80))}. A slug is lowercase letters, digits and hyphens (e.g. "musepass-musepass").`,
    );
  }
  return slug;
}

export const EVIDENCE_PREFIXES = [
  'ship',
  'signal',
  'abi',
  'impl',
  'lock',
  'source',
  'claim',
  'state',
  'integrity',
  'narrative',
  'method',
  'sourcechange',
  'security',
  'v4hook',
] as const;

/** A typed evidence id: opaque, only its family prefix is checked here; HEY checks the rest. */
export function parseEvidenceId(raw: string): string {
  const id = raw.trim();
  const prefix = id.split(':', 1)[0] ?? '';
  const ok =
    id.length <= 240 &&
    /^[\x21-\x7e]+$/.test(id) &&
    (EVIDENCE_PREFIXES as readonly string[]).includes(prefix) &&
    id.length > prefix.length + 1;
  if (!ok) {
    throw usageError(
      'invalid_evidence_id',
      `Not a typed evidence id: ${JSON.stringify(raw.slice(0, 80))}. Expected <family>:<id> with family one of ${EVIDENCE_PREFIXES.join(', ')}.`,
    );
  }
  return id;
}

/** /api/search/suggest reads 2–64 characters. */
export function parseQuery(raw: string): string {
  const q = raw.trim();
  const length = [...q].length;
  if (length < 2 || length > 64) {
    throw usageError('invalid_query', 'A search query is 2 to 64 characters.');
  }
  return q;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/;

/**
 * `--since`: an ISO 8601 date (`2026-09-01`, read as 00:00 UTC) or an instant with a zone
 * (`2026-09-01T12:00:00Z`). Sent to HEY as a full UTC instant so the API reads one spelling.
 */
export function parseSince(raw: string): string {
  const value = raw.trim();
  const ms = DATE_RE.test(value) || INSTANT_RE.test(value) ? Date.parse(value) : Number.NaN;
  if (Number.isNaN(ms)) {
    throw usageError(
      'invalid_since',
      `--since takes an ISO 8601 date (2026-09-01) or an instant with a zone (2026-09-01T12:00:00Z); got ${JSON.stringify(raw.slice(0, 40))}.`,
    );
  }
  return new Date(ms).toISOString();
}

export function parseIntInRange(flag: string, raw: string, min: number, max: number): number {
  const value = raw.trim();
  const n = /^\d{1,6}$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isInteger(n) || n < min || n > max) {
    throw usageError('invalid_parameter', `--${flag} takes a whole number from ${min} to ${max}.`);
  }
  return n;
}
