import { cleanText, type Style } from './text.js';

/** Collects human output lines. Every value passed in is cleaned before it is printed. */
export class Out {
  readonly lines: string[] = [];
  constructor(readonly style: Style) {}

  line(text = ''): void {
    this.lines.push(text);
  }

  /** A label/value row; the value is already cleaned or composed from cleaned parts. */
  kv(label: string, value: string, width = 20): void {
    this.lines.push(`${this.style.dim(label.padEnd(width))}${value}`);
  }

  /** Text from a source or from HEY: cleaned and bounded. */
  text(value: string, max = 280): string {
    return cleanText(value, max);
  }

  strong(value: string): string {
    return this.style.strong(value);
  }

  dim(value: string): string {
    return this.style.dim(value);
  }
}
