# SNIFFIN // THE MENAGERIE — s niffin

## Redesign and local preview

This remains a buildless GitHub Pages page at `/sniffin/`. No production dependencies, bundler, 3D library, or changes to other PeakPvM pages are required. `styles.css` owns the centralized design tokens and responsive layouts; `app.js` retains the account adapters and protected owner editor; `menagerie.js` adds the collection, history and planner; `chase.js` integrates Temple character snapshots and the protected hunt lifecycle. The existing portrait, header identity, Residents default and gold trophy-card styling are preserved.

From the repository root, run `node sniffin/dev/server.cjs` (Node 22+), then open:

- Live read-only preview: `http://localhost:4173/sniffin/`
- Offline sample: `http://localhost:4173/sniffin/?mock=1`
- Unavailable-state sample: `http://localhost:4173/sniffin/?mock=1&scenario=offline`

The sample has an always-visible development banner. It is enabled only on localhost/loopback, does not read or write the live caches, and does not query external APIs. `?mock=1` cannot activate mock data on production hosts. Sample dates, drops and KC in `dev/fixture.json` are invented test fixtures. The local server proxies public GET endpoints only and cannot authenticate or save production owner changes. Do not expose this development server publicly.

For an isolated owner-console test, open `http://localhost:4173/sniffin/?mock=1&admin=1`, click Edit, and use the **preview-only PIN `123456`**. This invokes a local instance of the actual Worker with in-memory KV and stubbed Temple/WOM snapshots. It does not use production secrets or write production records. Its loopback-only transport cookie is separate from the real HTTPS owner console. Restarting the preview server resets all sample edits. The production hostname cannot activate this mode.

## Current chase and character data

- The compact header shows Temple's account-specific primary EHP/EHB values, confirmed pet count and a snapshot timestamp. It never substitutes an EHP ranking for a pet-hunting ranking.
- Verified endpoint: `player_stats.php?player=s%20niffin&bosses=1`. Identity comes from `data.info`; EHP/EHB keys come from `Primary_ehp`/`Primary_ehb`; explicit mappings normalize supported boss names. Unranked zero boss values are treated as unavailable.
- Temple is primary for supported KC. Wise Old Man remains the fallback for unsupported or unavailable Temple counters. The current chase labels its actual KC source. Cached character data is marked as cached; snapshot time is different from retrieval time.
- Verified ownership endpoint: the All Pets collection log already used by the site. Positive records are retained server-side across partial responses. No kill count ever establishes pet ownership.
- Verified pet-ranking endpoint: `pets/pet_count.php?player=s%20niffin`. It currently returns "No players found" for this account. [Temple's Petcord leaderboard](https://templeosrs.com/pets/count.php) requires verified membership and at least 30 pets. The header omits the rank until the endpoint returns a matching player and positive rank.
- Character and collection requests are cached for five minutes, forced refreshes have a one-minute minimum window, and failures back off for one minute. Last successful data survives transient errors. Polling occurs on open, visible pages, including returning to an overdue tab; this does not force Temple or OSRS hiscores to create a new snapshot.

The protected console now offers **Start / Change Chase**, **End Without Pet**, and **Pet Obtained / Complete Hunt**. Starting can take its baseline from Temple or an explicitly entered KC. Completion may record acquisition KC/date and select the next chase in one action. Unknown acquisition data remains null. A completion timestamp is a management record, never an inferred drop date. Existing hunts with no known start date retain that uncertainty.

Hunt buttons save independently from general owner edits. Completed and ended hunts persist in a bounded 100-entry archive. General saves cannot erase the hunt archive or silently change its target/baseline. Version and hunt-ID checks reject stale or replayed mutations. Server-side IP/PIN/signed-cookie authorization and cross-origin restrictions remain unchanged.

Owned-pet details show recorded acquisition KC, optional personal notes and base-model luck only when the rate is suitable. When a completed hunt has a known baseline, luck uses its recorded hunt kills; otherwise the text explicitly refers to the recorded total acquisition KC. No inferred acquisition statistics appear on unknown records.

Recent Progress reuses the existing compact feed. It records newly confirmed Temple species, owner-completed hunts, and the highest observed 500-KC hunt milestone crossed between successful snapshots. IDs deduplicate repeated reads. Initial syncs do not invent historical unlocks, every intermediate KC milestone is not backfilled, and "detected" dates are distinguished from acquisition dates. The feed is populated from actual observed snapshots while visitors use the page; it is not a continuous game-event recorder.

The portrait is served from a 124 KB local JPEG without cropping or stretching; its original 1.47 MB PNG is preserved separately. The character's Torva armour, rancour necklace and scythe are retained. The page has local fonts, local follower renders, a local Sarachnis boss render and an explicit unavailable-render fallback. Motion is limited to hover and short transitions; reduced-motion preferences disable these and smooth scrolling.

## New hunt planning and historical records

- A complete Temple response is required to call the entire collection known. Manual confirmations establish positive ownership only, never missing status for every other pet.
- The current hunt shows base-model chance of at least one drop, zero drops and a dryness percentile. This is hypothetical population probability at a given KC, never guaranteed progress or proof the player is dry.
- Enter sustainable kills/hour to estimate the next three 500-KC milestones. Pace is an explicit visitor estimate, stored only for the browser session. It is not measured account performance.
- The planner compares eight missing/unverified species per page, with search, probability targets, entered pace, and optional sorting by estimated hours. It never declares a globally fastest hunt.
- Explicit future-method selectors cover normal/corrupted Gauntlet, Wilderness alternatives, Araxxor harvest/destroy, Royal Titans loot/sacrifice, and Jad/Zuk task rates. Jad, Zuk and Sol kill-only methods exclude cape/quiver gambles. Selectors describe future methods, not inferred historical play.
- Team/contribution-based rewards, raids, reward pools, unknown rates, complex contracts and skilling methods do not receive a made-up KC forecast. Their source notes and Wiki links remain available. Known independent rolls can be evaluated separately in the calculator.
- The sum of reported boss counters is labelled as a counter sum, not unique lifetime boss kills; mode counters can overlap.
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

Run `node sniffin/test.cjs`, `node sniffin/test-chase.cjs`, syntax checks for the frontend scripts, Worker and preview server, and `git diff --check`. Tests cover assets/routes, exact identity, complete/partial/failed logs, retained manual ownership, Temple-over-WOM preference and fallback, EHP/EHB, current/new pet syncs, deduplicated events, initial sync behavior, rate-limit/error handling, protected hunt start/change/end/completion/next, preserved history/notes, unknown acquisition data, stale writes/replays, general-editor capture, categories, search, pagination, probabilities, imports, mock-production guards and existing authentication boundaries.

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
- Temple supplies primary supported boss KC; Wise Old Man supplies fallback counters, not pet ownership. Snapshot times and source labels are shown. Refresh does not force an in-game hiscores update.
- Temple requires collection-log uploads from the RuneLite Collection Log plugin. The public site reports missing sync data and links to Temple's setup guidance when needed.
- Active pages poll every five minutes and refresh on returning to an overdue tab; public manual state checks every two minutes. Worker KV caches Temple for five minutes and WOM for four, with one-minute bounded refresh windows. Last known successful data is retained during outages; failed WOM refreshes explicitly mark retained data stale and retain its original retrieval timestamp. New Temple-confirmed pets automatically receive the golden owned-card treatment after the next sync. Temple must first receive the player's RuneLite collection-log upload.

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

## Keeper upgrade

- See the [Temple API documentation](https://templeosrs.com/api_doc.php) for Player Stats, Player Datapoints, All Pets collection log, and Player Recent Collections. The latest snapshot comes from Player Stats; boss totals include reported Temple counters and exclude raid counters to avoid overlap. No boss rank or personal best is synthesized.
- The Grind shows true, dated XP/EHP/EHB and KC datapoints. The 7/30/90 day options filter the available snapshots; “All available” is bounded by Temple’s recent datapoint response. Temple does not expose past overall ranks in that feed, so the rank archive begins with our first observed snapshot. No values are filled between snapshots.
- The All Pets log retains positive item IDs in KV. The catalog maps each ID to a species, can list optional numeric templeAliases for alternate identifiers, and supplies follower art and drop provenance. To add a newly released species, add its catalog entry and render. The page does not require new markup, and already observed Temple IDs will resolve automatically; selectable hunt methods also need a verified metric in the Worker.
- Pet acquisition dates use the post-import Recent Collections feed or an owner record, never the initial log import timestamp. The Keeper verifies all 24 skill caps and 200M Cooking directly from Temple, and accepts a positive Inferno or Fortis item record for cape/quiver. For Quest/Diary capes, Combat Achievement tiers or other unsupported achievements, add a curated achievement with verified:true, title, optional date (ISO YYYY-MM-DD), note, local image and source. Only earned/verified records are displayed.
- The hunt-specific Edit Target button is shown only when the backend confirms the owner IP. It opens the existing authenticated origin. The editor stores the selected activity, baseline and notes in SNIFFIN_KV; normal and Corrupted Gauntlet retain separate counters and one Youngllef collection slot. The full owner console still handles ending a hunt, marking a drop, starting a fresh baseline and picking the next target.
- The existing Worker binding SNIFFIN_KV and secrets ADMIN_PIN and SESSION_SECRET must remain configured. No new environment variables, migration, or hosting change. Public pages refresh every five minutes while active. Worker caches regular stats and pet ownership for five minutes, and detailed dated receipts/history for fifteen. Browser pace estimates are private to that browser.
- Local artwork sources are recorded in bosses.json and curated.json. Art is © Jagex Ltd.
