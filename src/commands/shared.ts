import type { Out } from '../output.js';
import { list, str, type Rec } from '../read.js';
import { cleanUrl, fmtInstant } from '../text.js';

export const UNKNOWN = 'unknown';

/** An absent value prints as "unknown", never as a blank, 0 or "none". */
export const orUnknown = (value: string | undefined): string => value ?? UNKNOWN;

/** A canonical state word (SHIPPING, NOT_MEASURED, VERIFIED…), verbatim and emphasised. */
export function word(out: Out, value: unknown): string {
  const w = str(value);
  return w ? out.strong(out.text(w, 60)) : UNKNOWN;
}

/** `NOT_MEASURED — no_token`: a state with its reason code, when HEY gave one. */
export function stateWithReason(out: Out, state: unknown, reason: unknown): string {
  const r = str(reason);
  return r ? `${word(out, state)} — ${out.text(r, 80)}` : word(out, state);
}

export function link(value: unknown): string | undefined {
  return cleanUrl(str(value));
}

/** Relative HEY links (`/project/x`) become absolute on the origin the CLI reads. */
export function absolute(baseUrl: string, value: unknown): string | undefined {
  const v = str(value);
  if (!v) return undefined;
  return v.startsWith('/') && !v.startsWith('//') ? cleanUrl(`${baseUrl}${v}`) : cleanUrl(v);
}

export function nameWithSymbol(out: Out, project: Rec): string {
  const name = out.text(str(project.name) ?? str(project.slug) ?? UNKNOWN, 80);
  const symbol = str(project.symbol);
  return symbol ? `${name} (${out.text(symbol, 24)})` : name;
}

/** When a dated fact happened, at the precision HEY knows it. */
export function when(value: unknown, precision?: unknown): string {
  const at = fmtInstant(str(value));
  if (!at) return UNKNOWN;
  const p = str(precision);
  if (p === 'DATE' || p === 'WEEK') return `${at.slice(0, 10)} (${p})`;
  return p && p !== 'EXACT' ? `${at} (${p})` : at;
}

export function footer(out: Out, disclaimer: unknown): void {
  const d = str(disclaimer);
  if (d) {
    out.line();
    out.line(out.dim(out.text(d, 600)));
  }
}

export function joinCodes(out: Out, values: unknown): string {
  const codes = list(values)
    .map((v) => str(v))
    .filter((v): v is string => v !== undefined)
    .map((v) => out.text(v, 60));
  return codes.length ? codes.join(', ') : '(none listed by HEY)';
}
