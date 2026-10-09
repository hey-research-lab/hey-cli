import { EXIT } from '../exit-codes.js';
import { parseSlug } from '../input.js';
import { list, num, rec, str } from '../read.js';
import { fmtUsd } from '../text.js';
import { footer, link, nameWithSymbol, orUnknown, stateWithReason, when, word } from './shared.js';
import type { CommandSpec } from './types.js';

export const project: CommandSpec = {
  name: 'project',
  synopsis: 'hey project <slug>',
  summary: "A project's dossier: activity status, last ship, research level, token identity.",
  endpoint: 'GET /api/projects/{slug}',
  details: [
    'Activity status is a record of development, read from public sources; it is not a view on a token.',
    'Market figures, when HEY holds them, are printed as context with their source and reading time.',
  ],
  positionals: [{ name: 'slug' }],
  noLimit: 'one project is one record.',
  noSince: 'one project is one record; use `hey changes <slug> --since` for its history.',
  async run(ctx) {
    const slug = parseSlug(ctx.args[0] ?? '');
    const data = await ctx.client.projects.get(slug);
    const p = rec(data);
    const score = rec(p.score);
    return {
      data,
      exitCode: EXIT.OK,
      quiet(out) {
        out.line(`${str(p.slug) ?? slug} ${str(p.activityStatus) ?? 'UNKNOWN'}`);
      },
      render(out) {
        out.line(
          `${out.strong(nameWithSymbol(out, p))}  ${out.dim(out.text(str(p.slug) ?? slug, 120))}`,
        );
        const description = str(p.shortDescription);
        if (description) out.line(out.text(description, 240));
        out.line();
        out.kv('Activity', word(out, p.activityStatus));
        const ships = list(p.ships).map(rec);
        const latest = ships[0];
        const lastShipped = str(p.lastShippedAt);
        if (latest && str(latest.publishedAt) === lastShipped) {
          const title = out.text(str(latest.title) ?? 'untitled', 140);
          out.kv('Last ship', `${when(latest.publishedAt, latest.precision)} — ${title}`);
          out.kv(
            '',
            `${out.text(str(latest.eventType) ?? 'UNKNOWN', 40)} · verification ${word(out, latest.verification)}${
              link(latest.sourceUrl) ? ` · ${link(latest.sourceUrl)}` : ''
            }`,
          );
        } else {
          out.kv(
            'Last ship',
            lastShipped ? when(lastShipped) : 'unknown (HEY records no ship date)',
          );
        }
        out.kv(
          'Research level',
          `${word(out, p.researchLevel)} · catalogue ${word(out, p.catalogStatus)}`,
        );
        const narrative = str(rec(p.primaryNarrative).name);
        out.kv(
          'Kind',
          `${word(out, p.projectKind)}${narrative ? ` · ${out.text(narrative, 60)}` : ''}`,
        );
        out.kv(
          'Still Building',
          stateWithReason(
            out,
            p.stillBuildingState ?? score.stillBuildingState,
            score.stillBuildingWithheld,
          ),
        );
        const momentum = num(score.buildMomentum);
        out.kv(
          'Build Momentum',
          momentum === undefined
            ? orUnknown(undefined)
            : `${momentum}${str(score.scoringVersion) ? ` (${out.text(str(score.scoringVersion) ?? '', 30)})` : ''}`,
        );
        const token = rec(p.token);
        const address = str(token.contractAddress);
        const verification = rec(p.tokenVerification);
        if (address) {
          out.kv(
            'Token',
            `${out.text(address, 42)} on Robinhood Chain · verification ${stateWithReason(out, verification.status, verification.reason)}`,
          );
        } else {
          out.kv('Token', "none on HEY's record for this project");
        }
        const cap = rec(p.marketCap);
        const usd = num(cap.usd);
        const tokenMarket = rec(p.tokenMarket);
        const withheld = str(p.valuationWithheld);
        if (
          str(tokenMarket.status) === 'ACTIVE_MARKET' &&
          str(tokenMarket.reason) === 'launch_pool_trading'
        ) {
          // HEY 2026-10-02/09: a launch pool is not a measured market; every HEY surface prints
          // "Launch pool only" and no figure (its "liquidity" is the token's own supply).
          out.kv(
            'Market context',
            "Launch pool only — the token's only pool is the one it launched in; its liquidity is the token's own supply, so no valuation is printed (context only)",
          );
        } else if (usd !== undefined) {
          const kind = str(cap.kind) === 'fdv' ? 'FDV' : 'Market cap';
          const observed = when(cap.observedAt);
          out.kv(
            'Market context',
            `${kind} ${fmtUsd(usd)} · source ${out.text(str(cap.source) ?? 'unknown', 40)} · observed ${observed} (context only)`,
          );
          const disagree = rec(rec(p.market).sourcesDisagree);
          if (str(disagree.source)) {
            out.kv(
              '',
              `sources disagree: ${out.text(str(disagree.source) ?? '', 40)} prices it more than 2× away (observed ${when(disagree.observedAt)}); the figure is this reading's, not a settled fact`,
            );
          }
        } else if (withheld) {
          out.kv(
            'Market context',
            `valuation withheld — ${out.text(withheld, 60)} (HEY holds a reading it does not publish)`,
          );
        }
        const sources = list(p.sources).map(rec);
        if (sources.length) {
          const verified = sources.filter((s) => s.isVerified === true).length;
          out.kv('Sources', `${sources.length} listed, ${verified} verified`);
        }
        out.kv('Page', orUnknown(link(p.url)));
        footer(out, p.disclaimer);
      },
    };
  },
};
