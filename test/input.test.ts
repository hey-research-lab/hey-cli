import { describe, expect, it } from 'vitest';

import { assertChainId, CHAIN_ID, UnsupportedChainError } from '../src/chain.js';
import { checksumMatches, toChecksumAddress } from '../src/evm.js';
import { parseAddress, parseEvidenceId, parseSince, parseSlug } from '../src/input.js';
import { forbiddenKeyPath } from '../src/read.js';
import { cleanText } from '../src/text.js';

describe('chain', () => {
  it('accepts the integer 4663 only', () => {
    expect(() => assertChainId(CHAIN_ID)).not.toThrow();
    for (const v of ['4663', 4663.5, 1, 8453, null]) {
      expect(() => assertChainId(v)).toThrow(UnsupportedChainError);
    }
    expect(new UnsupportedChainError(1).message).toBe(
      'HEY supports Robinhood Chain (4663) only; chain 1 is not supported.',
    );
  });
});

describe('addresses', () => {
  it('normalises 0X and mixed case to lowercase', () => {
    expect(parseAddress('0X7E7154EB9DD81084625A7A2E9E731CADFDDB9AB7').address).toBe(
      '0x7e7154eb9dd81084625a7a2e9e731cadfddb9ab7',
    );
  });

  it('EIP-55: a correct checksum passes, a broken one is a warning, not an error', () => {
    // EIP-55 test vector.
    expect(toChecksumAddress('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed')).toBe(
      '0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed',
    );
    expect(checksumMatches('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed')).toBe(true);
    expect(parseAddress('0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed').warning).toBeUndefined();
    const broken = parseAddress('0x5AAeb6053F3E94C9b9A09f33669435E7Ef1BeAed');
    expect(broken.address).toBe('0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed');
    expect(broken.warning).toContain('EIP-55');
  });

  it('CAIP-10 on 4663 is accepted; leading zeros or another chain are not', () => {
    expect(parseAddress('eip155:4663:0x7e7154eb9dd81084625a7a2e9e731cadfddb9ab7').address).toBe(
      '0x7e7154eb9dd81084625a7a2e9e731cadfddb9ab7',
    );
    expect(() => parseAddress('eip155:04663:0x7e7154eb9dd81084625a7a2e9e731cadfddb9ab7')).toThrow(
      /Robinhood Chain \(4663\) only/,
    );
  });
});

describe('slugs, ids, dates', () => {
  it('slugs are lowercased and validated', () => {
    expect(parseSlug('MusePass-MusePass')).toBe('musepass-musepass');
    expect(() => parseSlug('-x')).toThrow();
    // HEY's request rule: 80 characters at most (OpenAPI).
    expect(parseSlug(`a${'b'.repeat(79)}`)).toHaveLength(80);
    expect(() => parseSlug(`a${'b'.repeat(80)}`)).toThrow();
    expect(() => parseSlug('../etc/passwd')).toThrow();
  });

  it('evidence ids are checked by family only', () => {
    expect(parseEvidenceId('lock:4663:12')).toBe('lock:4663:12');
    expect(parseEvidenceId('state:a:b:c')).toBe('state:a:b:c');
    expect(() => parseEvidenceId('ship:has space')).toThrow();
  });

  it('since accepts a date or a zoned instant', () => {
    expect(parseSince('2026-09-01')).toBe('2026-09-01T00:00:00.000Z');
    expect(parseSince('2026-09-01T12:30:00+02:00')).toBe('2026-09-01T10:30:00.000Z');
  });
});

describe('safety helpers', () => {
  it('finds forbidden keys at any depth', () => {
    expect(forbiddenKeyPath(JSON.parse('{"a":[{"b":{"__proto__":{}}}]}'))).toBe(
      '$.a[0].b.__proto__',
    );
    expect(forbiddenKeyPath(JSON.parse('{"constructor":1}'))).toBe('$.constructor');
    expect(forbiddenKeyPath({ a: [1, { b: 'constructor' }] })).toBeUndefined();
  });

  it('cleanText folds, strips and bounds', () => {
    expect(cleanText('a\u001b[2Jb\u200B\u202Ec\n d', 100)).toBe('a[2Jbc d');
    expect(cleanText('x'.repeat(10), 5)).toBe('xxxx…');
  });
});
