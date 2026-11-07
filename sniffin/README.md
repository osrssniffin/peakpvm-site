# SNIFFIN // THE MENAGERIE — s niffin

## Redesign and local preview

This remains a buildless GitHub Pages page at `/sniffin/`. No production dependencies, bundler, 3D library, or changes to other PeakPvM pages are required. `styles.css` owns the centralized design tokens and responsive layouts; `app.js` retains the account adapters and protected owner editor; `menagerie.js` adds the collection details, category progress, trophies, history, planner and development-mode guard.

From the repository root, run `node sniffin/dev/server.cjs` (Node 22+), then open:

- Live read-only preview: `http://localhost:4173/sniffin/`
- Offline sample: `http://localhost:4173/sniffin/?mock=1`
- Unavailable-state sample: `http://localhost:4173/sniffin/?mock=1&scenario=offline`

The sample has an always-visible development banner. It is enabled only on localhost/loopback, does not read or write the live caches, and does not query external APIs. `?mock=1` cannot activate mock data on production hosts. Sample dates, drops and KC in `dev/fixture.json` are invented test fixtures. The local server proxies only three public GET endpoints; it cannot authenticate or save owner changes. Do not expose this development server publicly.

The portrait is served from a 124 KB local JPEG without cropping or stretching; its original 1.47 MB PNG is preserved separately. The character's Torva armour, rancour necklace and scythe are retained. The page has local fonts, local follower renders, a local Sarachnis boss render and an explicit unavailable-render fallback. Motion is limited to hover and short transitions; reduced-motion preferences disable these and smooth scrolling.

## New hunt planning and historical records

- A complete Temple response is required to call the entire collection known. Manual confirmations establish positive ownership only, never missing status for every other pet.
- The current hunt shows base-model chance of at least one drop, zero drops and a dryness percentile. This is hypothetical population probability at a given KC, never guaranteed progress or proof the player is dry.
- Enter sustainable kills/hour to estimate the next three 500-KC milestones. Pace is an explicit visitor estimate, stored only for the browser session. It is not measured account performance.
- The planner compares eight missing/unverified species per page, with search, probability targets, entered pace, and optional sorting by estimated hours. It never declares a globally fastest hunt.
- Explicit future-method selectors cover normal/corrupted Gauntlet, Wilderness alternatives, Araxxor harvest/destroy, Royal Titans loot/sacrifice, and Jad/Zuk task rates. Jad, Zuk and Sol kill-only methods exclude cape/quiver gambles. Selectors describe future methods, not inferred historical play.
- Team/contribution-based rewards, raids, reward pools, unknown rates, complex contracts and skilling methods do not receive a made-up KC forecast. Their source notes and Wiki links remain available. Known independent rolls can be evaluated separately in the calculator.
- The sum of reported WOM boss counters is labelled as a counter sum, not unique lifetime boss kills; mode counters can overlap.
- `curated.json` stores owner-curated milestone records separately from automated data. It starts empty. Existing manual acquisition KC can appear with an unknown date; Temple synchronization timestamps never become drop dates. Imported milestones also persist in protected Worker state.

### Owner-controlled JSON import

In the existing authenticated Owner Settings console, choose a JSON file in the import control. Only the exact username `s niffin` and known catalog IDs are accepted. Imports add confirmations without clearing existing records; inspect the staged checkboxes and use Save to publish. This is a documented interchange format, not a promise that arbitrary RuneLite plugin export formats work without conversion. No local RuneLite files are read automatically.

```json
{
  "username": "s niffin",
  "owned": { "baby-mole": { "kc": null } },
  "milestones": [
    {
      "petId": "baby-mole",
      "type": "drop",
      "title": "Owner-confirmed drop",
      "date": null,
      "kc": null,
      "note": "Replace with a confirmed record before importing."
    }
  ]
}
```

Unknown dates/KC must remain null. For achievements without a pet, use `type: "achievement"`, `petId: null`, and a confirmed title/note. Files are limited to 30 KB and 100 milestones. The import stages changes; protected server authentication is still required to save. To curate records in source instead, add entries of the same shape to `curated.json`'s `milestones` array.

### Validation and deployment

Run `node sniffin/test.cjs`, `node --check sniffin/app.js`, `node --check sniffin/menagerie.js`, `node --check sniffin/worker/index.js`, and `git diff --check`. The tests cover render assets and relative routes, exact account identity, complete/partial/failed logs, manual ownership preservation, categories/search/pagination, geometric target calculations, special future methods, import validation, production mock guards, stale WOM responses and the existing owner authentication boundaries.

Deploy the entire changed `sniffin/` folder through the existing repository's GitHub Pages publishing process; retain the rest of the repository and its `CNAME`. Also deploy `sniffin/worker/index.js` to the existing `peakpvm-sniffin-api` Worker in its configured account to enable milestone persistence and stale-response metadata. Preserve its KV binding, ADMIN_PIN and SESSION_SECRET. No data migration, DNS change, new service or new secret is needed. The frontend remains compatible with the old API for existing account reads; imported milestones require the updated Worker before saving.

Rate/model references: [OSRS Wiki pet table](https://oldschool.runescape.wiki/w/Pet), [Sraracha](https://oldschool.runescape.wiki/w/Sraracha), [Youngllef](https://oldschool.runescape.wiki/w/Youngllef), plus the per-species source links in `catalog.json`. Boss render provenance is in `curated.json`; the font's SIL Open Font License is in `media/FONT-LICENSE.txt`. New Worker cache behavior retains the existing [Fetch handler](https://developers.cloudflare.com/workers/runtime-apis/handlers/fetch/) and KV integration.

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
- Active pages poll every five minutes; public manual state checks every two minutes. Worker KV caches Temple for five minutes and WOM for four, with one-minute bounded refresh windows. Last known successful data is retained during outages; failed WOM refreshes explicitly mark retained data stale and retain its original retrieval timestamp.

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
