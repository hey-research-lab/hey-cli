/**
 * Defensive readers over API JSON. Rendering never assumes a field is present: an absent
 * value stays absent (`undefined`) and the renderer prints "unknown" or leaves the line out.
 * Nothing here turns an absent value into 0, false or an empty string.
 */
export type Rec = Record<string, unknown>;

export const isRec = (v: unknown): v is Rec =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
export const rec = (v: unknown): Rec => (isRec(v) ? v : {});
export const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
export const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v !== '' ? v : undefined;
export const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
export const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
/** The text of an agent-contract `{ text, contentOrigin }` field. */
export const agentText = (v: unknown): string | undefined => str(rec(v).text);

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * The prototype-pollution guard on parsed JSON: an answer carrying a `__proto__`,
 * `constructor` or `prototype` key is refused rather than relayed. Returns the offending
 * path, or undefined when the value is clean. Depth is bounded.
 */
export function forbiddenKeyPath(value: unknown, path = '$', depth = 0): string | undefined {
  if (depth > 64) return `${path} (nesting deeper than 64)`;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const hit = forbiddenKeyPath(value[i], `${path}[${i}]`, depth + 1);
      if (hit) return hit;
    }
    return undefined;
  }
  if (isRec(value)) {
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) return `${path}.${key}`;
      const hit = forbiddenKeyPath(value[key], `${path}.${key}`, depth + 1);
      if (hit) return hit;
    }
  }
  return undefined;
}
