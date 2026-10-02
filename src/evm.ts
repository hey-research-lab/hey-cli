// src/evm.ts — identical in every repo that handles addresses (plus the EIP-55 check below)
import { keccak_256 } from '@noble/hashes/sha3';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils';

export const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/; // input: either case, "0x" prefix lowercase
export const TX_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
export const DEAD_ADDRESS = '0x000000000000000000000000000000000000dead';

export const isAddress = (v: unknown): v is string => typeof v === 'string' && ADDRESS_RE.test(v);
/** Canonical form for keys, comparison, dedupe, URLs and machine output: lowercase. */
export const normalizeAddress = (v: string): string => {
  if (!isAddress(v))
    throw Object.assign(new Error(`not an EVM address: ${JSON.stringify(v).slice(0, 80)}`), {
      code: 'invalid_address',
    });
  return v.toLowerCase();
};
export const isTxHash = (v: unknown): v is string => typeof v === 'string' && TX_HASH_RE.test(v);
export const normalizeTxHash = (v: string): string => {
  if (!isTxHash(v))
    throw Object.assign(new Error('not a transaction hash'), { code: 'invalid_tx_hash' });
  return v.toLowerCase();
};

/** EIP-55 mixed-case checksum of a 0x address (keccak-256 from @noble/hashes). */
export function toChecksumAddress(address: string): string {
  const lower = normalizeAddress(address).slice(2);
  const hash = bytesToHex(keccak_256(utf8ToBytes(lower)));
  let out = '0x';
  for (let i = 0; i < lower.length; i += 1) {
    const ch = lower[i] as string;
    out += Number.parseInt(hash[i] as string, 16) >= 8 ? ch.toUpperCase() : ch;
  }
  return out;
}

/**
 * The checksum rule: an all-lowercase or all-uppercase address carries no checksum and is
 * accepted; a mixed-case one must match EIP-55. HEY production does not validate checksums;
 * the CLI reports a mismatch as a warning on foreign input and continues with the lowercase form.
 */
export function checksumMatches(address: string): boolean {
  const body = address.slice(2);
  if (body === body.toLowerCase() || body === body.toUpperCase()) return true;
  return toChecksumAddress(address) === address;
}
