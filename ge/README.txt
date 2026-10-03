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
