/**
 * Terminal-safe text. Everything HEY relays from a source (a project name, a release title)
 * is data from that source, so before it reaches a terminal it is stripped of control
 * characters (which also removes ANSI escape sequences' ESC), invisible and bidirectional
 * override characters and the Unicode tag block, folded onto one line and bounded.
 * JSON mode never passes through here: it relays the API's bytes unchanged.
 */
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F]/g;
/* eslint-disable no-misleading-character-class -- variation selectors are matched alone, on purpose */
const INVISIBLE =
  /[\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\u3164\uFE00-\uFE0F\uFEFF\uFFA0\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu;
/* eslint-enable no-misleading-character-class */
const WHITESPACE = /\s+/g;

export function cleanText(value: string, max = 280): string {
  const folded = value
    .replace(/[\t\n\r]/g, ' ')
    .replace(CONTROL, '')
    .replace(INVISIBLE, '')
    .replace(WHITESPACE, ' ')
    .trim();
  const chars = [...folded];
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : folded;
}

/** A URL printed for a reader to open: https/http only, cleaned, else left out. */
export function cleanUrl(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const cleaned = cleanText(value, 600);
  return /^https?:\/\/\S+$/.test(cleaned) ? cleaned : undefined;
}

export type Style = {
  strong: (s: string) => string;
  dim: (s: string) => string;
};

export const plainStyle: Style = { strong: (s) => s, dim: (s) => s };
export const ansiStyle: Style = {
  strong: (s) => `\u001b[1m${s}\u001b[22m`,
  dim: (s) => `\u001b[2m${s}\u001b[22m`,
};

const instantRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** `2026-10-02 10:58 UTC` for an ISO instant; a date-only value stays a date. */
export function fmtInstant(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (!instantRe.test(value)) return cleanText(value, 40);
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) return cleanText(value, 40);
  const iso = new Date(ms).toISOString();
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

export function fmtDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? cleanText(value, 40) : new Date(ms).toISOString().slice(0, 10);
}

const intl = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
export const fmtCount = (n: number) => intl.format(n);
export const fmtUsd = (n: number) => `$${intl.format(n)}`;
