PEAK PVM - /ge/

Upload this entire ge folder to the root of the peakpvm.com GitHub Pages repo.
It should then be available at:
https://peakpvm.com/ge/

No Cloudflare Worker, database, API key, build step, or package install is required.

The page reads live/current and recent hourly OSRS Grand Exchange data directly from the RuneScape Wiki real-time prices API. It calculates:
- best recent weekday for the tracked PvM supply basket
- best recent 4-hour buying window
- whether current supply prices are cheap/normal/expensive versus recent history
- best and worst current buys
- a simple status for every tracked supply

The analysis is historical. It does not claim to predict future prices.

Expanded supply controls:
- 78 curated GE supplies, verified against the Wiki /mapping endpoint.
- Client-side search (including aliases), category/favorites filters and sorting.
- Favorites, restock quantities and target prices saved in localStorage.
- Quick Buy List uses current instant-buy prices, falling back to the available
  side when necessary. Missing or stale quotes are explicitly excluded.
- Price alerts highlight reached targets on load/manual refresh; no monitoring.
- Successful hourly histories are reused for one hour during the current visit.
- Overall market indicators retain the original basket. Signals require at least
  24 traded hourly samples and fresh quotes; failed item histories are isolated.
- Granite cannonballs are excluded because they are not GE tradeable.

Run dependency-free regression checks from the repository root:
  node ge/app.test.cjs
No Node runtime is needed by the deployed page.
