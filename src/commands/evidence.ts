import { EXIT } from '../exit-codes.js';
import { parseEvidenceId } from '../input.js';
import { list, num, rec, str } from '../read.js';
import { footer, link, orUnknown, when, word } from './shared.js';
import type { CommandSpec } from './types.js';

export const evidence: CommandSpec = {
  name: 'evidence',
  synopsis: 'hey evidence <id>',
  summary: 'One published evidence record by its typed id (ship:, signal:, state:, lock: …).',
  endpoint: 'GET /api/evidence/{id}',
  details: [
    'A withdrawn record is an answer (withdrawn: true with its reason), not an error: exit 0.',
    'A malformed id is refused by HEY (invalid_evidence_id, exit 3); an unknown one is exit 4.',
  ],
  positionals: [{ name: 'id' }],
  noLimit: 'one id is one record.',
  noSince: 'one id is one record.',
  async run(ctx) {
    const id = parseEvidenceId(ctx.args[0] ?? '');
    const data = await ctx.client.evidence.get(id);
    const d = rec(data);
    const withdrawn = d.withdrawn === true;
    const project = rec(d.project);
    return {
      data,
      exitCode: EXIT.OK,
      quiet(out) {
        out.line(
          `${str(d.id) ?? id} ${withdrawn ? `withdrawn ${str(d.withdrawalReason) ?? 'unknown'}` : 'standing'}`,
        );
      },
      render(out) {
        out.line(`${out.strong(out.text(str(d.id) ?? id, 240))}`);
        out.line();
        if (withdrawn) {
          out.kv('Withdrawn', word(out, d.withdrawalReason));
          if (str(d.contextReason)) out.kv('Context reason', word(out, d.contextReason));
          if (str(project.slug)) {
            out.kv(
              'Project',
              `${out.text(str(project.name) ?? '', 80)}  ${orUnknown(link(project.url))}`,
            );
          }
          out.line('HEY no longer stands behind this record.');
          footer(out, d.disclaimer);
          return;
        }
        out.kv(
          'Project',
          `${out.text(str(project.name) ?? str(project.slug) ?? 'unknown', 80)}  ${orUnknown(link(project.url))}`,
        );
        out.kv(
          'Claim',
          `${word(out, d.claimType)} · domain ${out.text(str(d.domain) ?? 'unknown', 30)}`,
        );
        if (str(d.summary)) out.kv('Summary', out.text(str(d.summary) ?? '', 240));
        const sourceUrl = link(d.sourceUrl);
        out.kv(
          'Source',
          `${out.text(str(d.sourceType) ?? 'unknown', 40)}${sourceUrl ? `  ${sourceUrl}` : ''}`,
        );
        out.kv(
          'Published',
          str(d.publishedAt)
            ? when(d.publishedAt, d.precision)
            : "not dated by the source (only HEY's observation dates it)",
        );
        out.kv('Detected by HEY', when(d.detectedAt));
        out.kv('Verification', str(d.verification) ? word(out, d.verification) : 'none recorded');
        if (d.countsAsBuilding === true) out.kv('Activity status', 'counts toward activity status');
        const week = rec(d.codeWeek);
        if (str(week.title)) {
          const commits = num(week.commits);
          out.kv(
            'Code week',
            `${out.text(str(week.title) ?? '', 160)}${commits === undefined && 'commits' in week ? ' (commit count not held)' : ''}`,
          );
        }
        const rows = list(d.sources);
        if (rows.length) out.kv('Evidence rows', String(rows.length));
        footer(out, d.disclaimer);
      },
    };
  },
};
