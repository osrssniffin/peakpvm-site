# SNIFFIN — s niffin

Public page: https://peakpvm.com/sniffin/
Backend and private owner-console origin: https://peakpvm-sniffin-api.bells-pvm.workers.dev

## Tracking

- The exact RSN is `s niffin` for both TempleOSRS and Wise Old Man.
- Temple's All Pets collection-log category identifies individual owned pets by item ID. A valid matching player and a successful collection-log sync timestamp are required.
- The separate pet-count endpoint is checked but is not treated as proof of zero ownership when it returns an error or unranked response.
- A complete All Pets response must cover the catalog before its missing entries are considered unclaimed. Partial or failed responses retain previously confirmed ownership. Manual confirmations are always additive.
- Temple collection-log dates may be initial synchronization dates, so the site does not claim they are original drop dates. Newly synced trophies are detected by comparing successful snapshots; first sync does not invent unlock events.
- Wise Old Man supplies boss KC, not pet ownership. Its snapshot time is shown in the sync tooltip. Refresh does not force an in-game hiscores update.
- Temple requires collection-log uploads from the RuneLite Collection Log plugin. The public site reports missing sync data and links to Temple's setup guidance when needed.
- Active pages poll every five minutes; public manual state checks every two minutes. Worker KV caches Temple for five minutes and WOM for four, with shorter bounded refresh windows. Last known successful data is retained during outages.

## Pet models and rates

`catalog.json` contains the 72 currently available collection-log species, IDs, Wiki references, rate notes, and image provenance checked on 2026-11-07. Generic quest/event companions and alternate forms do not inflate the trophy count.

Every file in `pets/` is a transparent follower render resolved from the Wiki NPC infobox, not an inventory sprite. The local files were decoded and verified before deployment. Art copyright Jagex; source pages are listed per file in the catalog.

Variable and contribution-dependent rates retain their source notes. Reward rolls are not inferred from game-completion KC for activities such as Wintertodt, Tempoross, and raids where the applicable unit differs. Use the independent RNG calculator for a known roll count. Owner rate overrides explicitly apply to displayed KC.

## Owner editing and persistence

The public page requires no authentication. Only the server sees the actual Cloudflare connecting IP. It returns the Edit button eligibility for `47.12.27.148` only. Clicking Edit opens the private backend origin so the original signed cookie stays first-party.

The private origin also checks the IP before serving the console. The original PIN check, 45-minute IP-bound signed session, Secure/HttpOnly/SameSite=Strict cookie, failed-attempt limit, and per-mutation checks remain enforced server-side. Cross-origin writes are rejected. PIN and signing secret are deployed as Worker secrets, never committed.

All original editor fields remain: manual ownership, drop KC, manual activity KC, rate overrides, hunt target/start/note, and field notes. Saved state is held in `SNIFFIN_KV` under `site-state` and read by every public visitor; automatic tracking does not overwrite it. KV is eventually consistent, so propagation can take a short time. Update timestamps prevent stale reads from undoing a fresh local save.

The Worker is deployed in Cloudflare account `6b7e4b442028b0406660b625de88e494` with KV namespace `8d5bbc4aa8434f8282f93ad4747cfcee`. No nameserver changes are required. Use the authorized account when deploying; unrelated local Wrangler credentials must not be used.

Checks: `node sniffin/test.cjs`, `node --check sniffin/app.js`, `node --check sniffin/worker/index.js`.
