# ⏳ OSRS Time Machine

> **The Living Archive & Interactive History Codex for Old School RuneScape (2013 — Present)**

**OSRS Time Machine** is an interactive, zero-dependency Old School RuneScape history explorer. It allows players to search any item, boss, NPC, continent, quest, minigame, or combat mechanic and immediately explore how it changed over time — including stats before and after rebalances, drop table overhauls, patch notes, J-Mod commentary quotes, and historic controversies.

---

## 🌟 Key Features

1. **Chronological Timeline & Interactive Scrubber**:
   - Scrub through all 13+ years of OSRS history from Genesis Launch (2013) to the Modern Horizon (2026).
   - Filter by year, era, content category, or specific update tags.

2. **Gielinor Archive Codex**:
   - Deep database of 28+ iconic entities across weapons, bosses, raids, locations, and mechanics.
   - Filter by Items, Bosses, Continents, Combat Mechanics, Minigames, and "Most Reworked" volatility rankings.

3. **Before & After Visual Comparison Lab**:
   - Interactive side-by-side matrices comparing pre-nerf and post-rebalance stats (e.g. Toxic Blowpipe 2021 rebalance, Osmumten's Fang slash removal, Dinh's Bulwark offensive scaling, Elite Void 2017 damage reduction).
   - Visual drop table delta inspectors showing quantity slashes, economy rebalances, and resource impact.

4. **Curated Historical Museum Exhibits**:
   - *The Great Equipment Rebalance of 2021*
   - *The Infamous Day-1 Broken Drop Tables Vault*
   - *The 6-Hour Sleeping NMZ & Splashing Saga*
   - *The Metamorphosis of Great Kourend (GentleTractor Redesign)*
   - *The Legend of the TzHaar Inferno & Woox World-First*

5. **Deep Global Omnibar Search (`Ctrl + K`)**:
   - Fuzzy multi-category search across items, bosses, patch titles, and mechanics with keyboard navigation and instant previews.

6. **Audio & Nostalgia Engine**:
   - Built-in Web Audio synthesizer generating authentic retro UI click feedback, warp swooshes, and milestone fanfares without external audio file dependencies.
   - "Today in OSRS History" dynamic calendar banner.
   - "Random Nostalgia Warp" instant time-traveler.

---

## 🚀 Quick Start & Deployment

### Local Development / Double-Click
Because OSRS Time Machine uses standard ES6 `fetch` for local JSON datasets, it can be served using any static web server:

#### Option 1: Python
```bash
python -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

#### Option 2: Node.js (npx)
```bash
npx serve .
```

#### Option 3: VSCode Live Server
Right-click `index.html` and select **"Open with Live Server"**.

### Deploy to GitHub Pages
1. Push this repository to GitHub.
2. Go to **Settings > Pages**.
3. Set branch to `main` and folder to `/(root)`.
4. Your OSRS Time Machine will be live on `https://<your-username>.github.io/<repo-name>/`.

---

## 📁 Project Architecture

```
├── index.html                 # Main single-page application shell
├── README.md                  # Project documentation & guide
├── data/
│   ├── eras.json             # 7 defined historic eras & milestones
│   ├── entities.json         # 28+ cataloged items, bosses, and mechanics
│   ├── timeline-events.json  # 34+ chronological patch events with diffs
│   ├── comparisons.json      # Side-by-side before/after stat models
│   └── exhibits.json         # Curated museum showcases
├── css/
│   ├── main.css              # Typography, layout, variables, reset
│   ├── osrs-theme.css        # Stone textures, gold trims, runes, parchment
│   ├── timeline.css          # Scrubber, vertical branches, diff cards
│   ├── comparison.css        # Stat matrix tables, drop table visualizers
│   └── components.css        # Search modal, filter pills, toast, hero
└── js/
    ├── sound-fx.js           # Pure Web Audio synthesizer
    ├── data-store.js         # JSON database indexing & search engine
    ├── timeline-ui.js        # Timeline scrubber & vertical feed
    ├── comparison-ui.js      # Before/After comparison renderer
    ├── museum-ui.js          # Exhibits, eras, & today in history
    └── app.js                # App orchestrator, router & key shortcuts
```

---

## 🛠️ Adding New Entries
To add new historical entries:
1. **New Entity**: Add an entry into `data/entities.json` with an ID, name, category, release date, and tags.
2. **New Event**: Add the update into `data/timeline-events.json` referencing the `entityId`.
3. **New Stat Diff**: Add a before/after entry into `data/comparisons.json`.
The app will automatically index, search, and render the new content dynamically!
