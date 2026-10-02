import { CHAIN_ID } from '../chain.js';
import { EXIT } from '../exit-codes.js';
import { parseAddress } from '../input.js';
import { bool, num, rec, str } from '../read.js';
import { footer, link, nameWithSymbol, orUnknown, stateWithReason, when, word } from './shared.js';
import type { CommandSpec } from './types.js';

export const token: CommandSpec = {
  name: 'token',
  synopsis: 'hey token <address>',
  summary: 'The published project HEY records for a contract address, if any.',
  endpoint: 'GET /api/token/4663/{address}',
  details: [
    'Accepts 0x… (0X is normalised) or eip155:4663:0x…. Another chain is refused (unsupported_chain).',
    '"unknown" means HEY\'s published catalogue holds no project for the address: exit 4, not an error, and not a finding about the contract.',
    "On MISMATCH the project's own site names a different contract: the activity is the project's, never this token's.",
  ],
  positionals: [{ name: 'address' }],
  noLimit: 'one address is one record.',
  noSince: 'one address is one record.',
  async run(ctx) {
    const input = parseAddress(ctx.args[0] ?? '');
    if (input.warning) ctx.warn(input.warning);
    const data = await ctx.client.token.lookup(CHAIN_ID, input.address);
    const d = rec(data);
    const published = str(d.status) === 'published';
    const p = rec(d.project);
    return {
      data,
      exitCode: published ? EXIT.OK : EXIT.NOT_FOUND,
      quiet(out) {
        out.line(
          published
            ? `${str(p.slug) ?? 'unknown'} ${str(p.activityStatus) ?? 'UNKNOWN'}`
            : 'unknown',
        );
      },
      render(out) {
        const address = out.text(str(d.contractAddress) ?? input.address, 42);
        if (!published) {
          out.line(
            `HEY's published catalogue holds no project for ${address} on Robinhood Chain (status ${word(out, d.status)}).`,
          );
          out.line('That is not a finding about the contract: HEY does not know it as a project.');
          const scan = link(d.scanUrl);
          if (scan) out.kv('Scan on HEY', scan);
          footer(out, d.disclaimer);
          return;
        }
        out.line(
          `${out.strong(nameWithSymbol(out, p))}  ${out.dim(out.text(str(p.slug) ?? '', 120))}`,
        );
        out.line();
        const label = str(p.activityLabel);
        const help = str(p.activityHelp);
        out.kv(
          'Activity',
          `${label ? out.strong(out.text(label, 40)) : word(out, p.activityStatus)}${help ? ` — ${out.text(help, 200)}` : ''} (${out.text(str(p.activityStatus) ?? 'UNKNOWN', 20)})`,
        );
        const verification = rec(p.tokenVerification);
        out.kv(
          'Token',
          `${address} · verification ${stateWithReason(out, verification.status, verification.reason)}`,
        );
        if (bool(p.activityAppliesToToken) === false) {
          out.kv(
            '',
            "The project's own site names a different contract: this activity is the project's, not this token's.",
          );
        }
        out.kv('Research level', word(out, p.researchLevel));
        const measured = bool(p.activityMeasured);
        const ships = num(p.shipsLast30Days);
        const meaningful = num(p.meaningfulShipsLast30Days);
        const shipsText =
          ships === undefined
            ? orUnknown(undefined)
            : `${ships}${meaningful !== undefined ? ` (${meaningful} meaningful)` : ''}`;
        out.kv(
          'Ships (30d)',
          measured === false
            ? `${shipsText} — not a measurement: HEY has not measured this project's building`
            : shipsText,
        );
        const lastShip = rec(p.lastShip);
        if (str(lastShip.title)) {
          out.kv(
            'Last ship',
            `${when(lastShip.publishedAt)} — ${out.text(str(lastShip.title) ?? '', 140)}`,
          );
          const source = link(lastShip.sourceUrl);
          if (source) out.kv('', source);
        } else {
          out.kv('Last ship', str(p.lastShipAt) ? when(p.lastShipAt) : orUnknown(undefined));
        }
        if (str(p.deployedAt)) out.kv('Deployed', when(p.deployedAt));
        if (str(p.asOf)) out.kv('As of', when(p.asOf));
        out.kv('Page', orUnknown(link(p.url)));
        footer(out, d.disclaimer);
      },
    };
  },
};

export const scan: CommandSpec = {
  name: 'scan',
  synopsis: 'hey scan <address>',
  summary: "The partner card for a contract address: activity in HEY's words, with its coverage.",
  endpoint: 'GET /api/v1/scan?chain=4663&token={address}',
  details: [
    "A database read of HEY's published records. It never triggers the site's live scan; the card's scan_url opens that page in a browser.",
    'found: false (no published project) is exit 4, not an error.',
    'commits_30d is absent when HEY reads no repository for the project: that is "not measured", never 0.',
  ],
  positionals: [{ name: 'address' }],
  noLimit: 'one address is one card.',
  noSince: 'one address is one card.',
  async run(ctx) {
    const input = parseAddress(ctx.args[0] ?? '');
    if (input.warning) ctx.warn(input.warning);
    const data = await ctx.client.scanCard(CHAIN_ID, input.address);
    const d = rec(data);
    const found = d.found === true;
    const p = rec(d.project);
    return {
      data,
      exitCode: found ? EXIT.OK : EXIT.NOT_FOUND,
      quiet(out) {
        out.line(found ? `${str(p.slug) ?? 'unknown'} ${str(d.status) ?? 'unknown'}` : 'not_found');
      },
      render(out) {
        const address = out.text(str(d.contractAddress) ?? input.address, 42);
        if (!found) {
          const reason = str(d.reason);
          out.line(
            `HEY holds no published project for ${address} on Robinhood Chain${reason ? ` (reason: ${out.text(reason, 40)})` : ''}.`,
          );
          const message = str(d.message);
          if (message) out.line(out.text(message, 300));
          out.line('That is not a finding about the contract: HEY does not know it as a project.');
          const scanUrl = link(d.scan_url);
          if (scanUrl) out.kv('Scan on HEY', scanUrl);
          footer(out, d.disclaimer);
          return;
        }
        out.line(
          `${out.strong(nameWithSymbol(out, p))}  ${out.dim(out.text(str(p.slug) ?? '', 120))}`,
        );
        out.line();
        const label = str(d.status_label);
        const help = str(d.status_help);
        out.kv(
          'Status',
          `${label ? out.strong(out.text(label, 40)) : word(out, d.status)}${help ? ` — ${out.text(help, 200)}` : ''}`,
        );
        const vb = bool(d.verified_builder);
        out.kv(
          'Verified builder',
          vb === undefined ? 'unknown' : vb ? "yes (HEY's statement)" : 'no',
        );
        out.kv('Token verification', word(out, d.token_verification));
        if (bool(d.activity_applies_to_token) === false) {
          out.kv(
            '',
            "The project's own site names a different contract: this activity is the project's, not this token's.",
          );
        }
        out.kv('Research level', word(out, d.research_level));
        const measured = bool(d.activity_measured);
        out.kv(
          'Coverage',
          `${out.text(str(d.coverage) ?? 'unknown', 30)}${measured === false ? ' — the counts below are not measurements' : ''}`,
        );
        const a = rec(d.activity);
        const commits = num(a.commits_30d);
        out.kv(
          'Commits (30d)',
          commits === undefined
            ? 'not measured — HEY reads no repository for this project'
            : a.commits_30d_partial === true
              ? `${commits} or more (a commits page was cut inside the window)`
              : String(commits),
        );
        // The partner card sends 0 where nothing was measured (its fields never change meaning);
        // the CLI prints what that 0 is, as the bot does.
        const releases = num(a.releases_30d);
        out.kv(
          'Releases (30d)',
          measured === false
            ? 'not measured'
            : releases === undefined
              ? 'unknown'
              : String(releases),
        );
        const ships = num(a.ships_30d);
        const meaningful = num(a.meaningful_ships_30d);
        out.kv(
          'Ships (30d)',
          measured === false
            ? 'not measured'
            : ships === undefined
              ? 'unknown'
              : `${ships}${meaningful !== undefined ? ` (${meaningful} meaningful)` : ''}`,
        );
        const title = str(a.last_ship_title);
        out.kv(
          'Last ship',
          str(a.last_ship)
            ? `${when(a.last_ship)}${title ? ` — ${out.text(title, 140)}` : ''}`
            : 'unknown',
        );
        const source = link(a.last_ship_url);
        if (source) out.kv('', source);
        if (str(d.as_of)) out.kv('As of', when(d.as_of));
        out.kv('Project', orUnknown(link(d.project_url)));
        const scanUrl = link(d.scan_url);
        if (scanUrl) out.kv('Scan on HEY', scanUrl);
        footer(out, d.disclaimer);
      },
    };
  },
};
