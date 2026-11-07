(() => {
  'use strict';

  const API = 'https://prices.runescape.wiki/api/v1/osrs';
  const BASKET = [
    'Shark',
    'Cooked karambwan',
    'Saradomin brew(4)',
    'Super restore(4)',
    'Prayer potion(4)',
    'Super combat potion(4)',
    'Ranging potion(4)',
    'Bastion potion(4)',
    'Antidote++(4)',
    'Sanfew serum(4)',
    'Extended anti-venom+(4)',
    'Anglerfish',
    'Divine super combat potion(4)',
    'Divine ranging potion(4)',
    'Divine bastion potion(4)',
    "Blood rune",
    "Death rune",
    "Chaos rune",
    "Soul rune",
    "Aether rune",
    "Wrath rune",
    "Astral rune",
    "Demon tear",
    "Zulrah's scales",
    "Amethyst arrow",
    "Dragon arrow",
    "Steel cannonball",
    "Manta ray"
  ];
  // IDs verified against the Wiki GE mapping; only tradeable supplies.
  const TRACKED = [
    [385, "Shark", "Food", ""],
    [13441, "Anglerfish", "Food", "anglers"],
    [391, "Manta ray", "Food", "mantas"],
    [3144, "Cooked karambwan", "Food", "karambwans bwans"],
    [11936, "Dark crab", "Food", ""],
    [7060, "Tuna potato", "Food", ""],
    [6705, "Potato with cheese", "Food", ""],
    [10476, "Purple sweets", "Food", ""],
    [29143, "Cooked moonlight antelope", "Food", ""],
    [2434, "Prayer potion(4)", "Potions", "ppot ppots prayer pots"],
    [3024, "Super restore(4)", "Potions", "restores"],
    [6685, "Saradomin brew(4)", "Potions", "brews sara"],
    [12695, "Super combat potion(4)", "Potions", "scb super combats"],
    [23685, "Divine super combat potion(4)", "Potions", "divine scb"],
    [2444, "Ranging potion(4)", "Potions", ""],
    [23733, "Divine ranging potion(4)", "Potions", ""],
    [22461, "Bastion potion(4)", "Potions", ""],
    [24635, "Divine bastion potion(4)", "Potions", ""],
    [3040, "Magic potion(4)", "Potions", ""],
    [23745, "Divine magic potion(4)", "Potions", ""],
    [27629, "Forgotten brew(4)", "Potions", ""],
    [12625, "Stamina potion(4)", "Potions", "stams"],
    [3016, "Super energy(4)", "Potions", ""],
    [5952, "Antidote++(4)", "Potions", ""],
    [12913, "Anti-venom+(4)", "Potions", "antivenom antivenoms"],
    [29824, "Extended anti-venom+(4)", "Potions", "antivenom antivenoms"],
    [2452, "Antifire potion(4)", "Potions", ""],
    [11951, "Extended antifire(4)", "Potions", ""],
    [21978, "Super antifire potion(4)", "Potions", ""],
    [22209, "Extended super antifire(4)", "Potions", ""],
    [10925, "Sanfew serum(4)", "Potions", "sanfews"],
    [27202, "Menaphite remedy(4)", "Potions", ""],
    [30125, "Prayer regeneration potion(4)", "Potions", ""],
    [30137, "Goading potion(4)", "Potions", ""],
    [556, "Air rune", "Runes", ""],
    [555, "Water rune", "Runes", ""],
    [557, "Earth rune", "Runes", ""],
    [554, "Fire rune", "Runes", ""],
    [558, "Mind rune", "Runes", ""],
    [562, "Chaos rune", "Runes", ""],
    [560, "Death rune", "Runes", ""],
    [565, "Blood rune", "Runes", ""],
    [566, "Soul rune", "Runes", ""],
    [21880, "Wrath rune", "Runes", ""],
    [9075, "Astral rune", "Runes", ""],
    [561, "Nature rune", "Runes", ""],
    [563, "Law rune", "Runes", ""],
    [564, "Cosmic rune", "Runes", ""],
    [4696, "Dust rune", "Runes", ""],
    [4699, "Lava rune", "Runes", ""],
    [4695, "Mist rune", "Runes", ""],
    [4694, "Steam rune", "Runes", ""],
    [4698, "Mud rune", "Runes", ""],
    [4697, "Smoke rune", "Runes", ""],
    [30843, "Aether rune", "Runes", ""],
    [21326, "Amethyst arrow", "Ammo", ""],
    [11212, "Dragon arrow", "Ammo", ""],
    [25849, "Amethyst dart", "Ammo", ""],
    [11230, "Dragon dart", "Ammo", ""],
    [9242, "Ruby bolts (e)", "Ammo", ""],
    [9243, "Diamond bolts (e)", "Ammo", ""],
    [21944, "Ruby dragon bolts (e)", "Ammo", ""],
    [21946, "Diamond dragon bolts (e)", "Ammo", ""],
    [21948, "Dragonstone dragon bolts (e)", "Ammo", ""],
    [21950, "Onyx dragon bolts (e)", "Ammo", ""],
    [19484, "Dragon javelin", "Ammo", ""],
    [2, "Steel cannonball", "Ammo", "cballs cannonballs"],
    [31914, "Rune cannonball", "Ammo", "cballs cannonballs"],
    [31916, "Dragon cannonball", "Ammo", "cballs cannonballs"],
    [10034, "Red chinchompa", "Ammo", ""],
    [11959, "Black chinchompa", "Ammo", ""],
    [12934, "Zulrah's scales", "Charges", ""],
    [24777, "Blood shard", "Charges", ""],
    [21820, "Revenant ether", "Charges", ""],
    [27616, "Ancient essence", "Charges", ""],
    [28924, "Sunfire splinters", "Charges", ""],
    [31111, "Demon tear", "Charges", ""],
    [26231, "Nihil shard", "Charges", ""],
  ].map(([id, name, category, aliases]) => ({ id, name, category, aliases }));

  const $ = id => document.getElementById(id);
  const els = {
    bestDay: $('bestDay'), bestTime: $('bestTime'), currentStatus: $('currentStatus'),
    overallPrice: $('overallPrice'), bestBuy: $('bestBuy'), worstBuy: $('worstBuy'),
    search: $('supplySearch'), category: $('categoryFilters'), favorites: $('favoritesFilter'), sort: $('sortOrder'), count: $('itemCount'), freshness: $('priceFreshness'), total: $('buyTotal'),
    rows: $('supplyRows'), summary: $('summaryText'), refresh: $('refreshBtn'), error: $('errorBox')
  };

  const fmtGp = n => Number.isFinite(n) ? `${Math.round(n).toLocaleString()} gp` : 'N/A';
  const fmtPct = n => `${Math.abs(n).toFixed(1)}% ${n < 0 ? 'below' : 'above'} normal`;
  const median = values => {
    const a = values.filter(Number.isFinite).sort((x, y) => x - y);
    if (!a.length) return NaN;
    const m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  };
  const mean = values => {
    const a = values.filter(Number.isFinite);
    return a.length ? a.reduce((s, v) => s + v, 0) / a.length : NaN;
  };

  function pointPrice(p) {
    const high = Number(p.highPriceVolume === 0 ? NaN : (p.avgHighPrice ?? p.highPrice));
    const low = Number(p.lowPriceVolume === 0 ? NaN : (p.avgLowPrice ?? p.lowPrice));
    if (Number.isFinite(high) && Number.isFinite(low) && high > 0 && low > 0) return (high + low) / 2;
    if (Number.isFinite(high) && high > 0) return high;
    if (Number.isFinite(low) && low > 0) return low;
    return NaN;
  }

  function latestPrice(p) {
    if (!p) return NaN;
    const high = Number(p.high);
    const low = Number(p.low);
    if (Number.isFinite(high) && Number.isFinite(low) && high > 0 && low > 0) return (high + low) / 2;
    if (Number.isFinite(high) && high > 0) return high;
    if (Number.isFinite(low) && low > 0) return low;
    return NaN;
  }

  function signal(pct) {
    if (!Number.isFinite(pct)) return { label: 'Not enough data', cls: 'neutral' };
    if (pct <= -7) return { label: 'Great buy', cls: 'great' };
    if (pct <= -3) return { label: 'Good buy', cls: 'good' };
    if (pct < 4) return { label: 'Average', cls: 'average' };
    if (pct < 8) return { label: 'Wait', cls: 'wait' };
    return { label: 'Expensive', cls: 'expensive' };
  }

  function basketSignal(pct) {
    if (pct <= -6) return { label: 'Great time to buy', cls: 'great' };
    if (pct <= -2.5) return { label: 'Good time to buy', cls: 'good' };
    if (pct < 3) return { label: 'Prices look normal', cls: 'average' };
    if (pct < 7) return { label: 'Probably worth waiting', cls: 'wait' };
    return { label: 'Expensive time to buy', cls: 'expensive' };
  }

  function shortName(name) {
    return name.replace('(4)', '').replace('Cooked karambwan', 'Karambwans').replace('Saradomin brew', 'Brews').replace('Super restore', 'Restores').replace('Prayer potion', 'Prayer pots').replace('Divine super combat potion', 'Divine super combats').replace('Divine ranging potion', 'Divine ranging pots').replace('Divine bastion potion', 'Divine bastions').replace('Super combat potion', 'Super combats').replace('Ranging potion', 'Ranging pots').replace('Bastion potion', 'Bastions').replace('Sanfew serum', 'Sanfews').replace('Extended anti-venom+', 'Extended anti-venom+').replace('Antidote++', 'Antidote++');
  }

  function localParts(timestamp) {
    const d = new Date(timestamp * 1000);
    return { day: d.getDay(), hour: d.getHours() };
  }

  function dayName(day) {
    return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][day];
  }

  function timeLabel(start) {
    const end = (start + 4) % 24;
    const f = h => {
      const suffix = h >= 12 ? 'PM' : 'AM';
      const hour = h % 12 || 12;
      return `${hour} ${suffix}`;
    };
    return `${f(start)} to ${f(end)}`;
  }

  function bucketStart(hour) { return Math.floor(hour / 4) * 4; }

  async function getJson(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Price API returned ${res.status}`);
    return res.json();
  }

  async function load() {
    els.refresh.disabled = true;
    els.error.classList.add('hidden');
    els.summary.textContent = 'Pulling recent Grand Exchange history…';

    try {
      const [mapping, latest] = await Promise.all([
        getJson(`${API}/mapping`),
        getJson(`${API}/latest`)
      ]);

      const byId = new Map(mapping.map(x => [x.id, x]));
      const items = TRACKED.map(config => ({ ...byId.get(config.id), ...config, available: byId.has(config.id) }));
      const histories = await Promise.all(items.map(async item => {
        // Reuse each hourly series on manual refresh; only current quotes need refreshing.
        let result = historyCache.get(item.id);
        if (!result || Date.now() - result.fetchedAt >= 3600000) {
          try {
            const response = item.available ? await getJson(`${API}/timeseries?timestep=1h&id=${item.id}`) : {};
            result = { ...response, fetchedAt: Date.now() };
            historyCache.set(item.id, result);
          } catch { result = result || {}; }
        }
        return { item, data: Array.isArray(result.data) ? result.data : [] };
      }));

      const analyses = histories.map(({ item, data }) => {
        const points = data.filter(p => Number(p.highPriceVolume) > 0 || Number(p.lowPriceVolume) > 0).map(p => ({ ...p, price: pointPrice(p) })).filter(p => Number.isFinite(p.price) && p.price > 0);
        const normal = points.length >= 24 ? median(points.map(p => p.price)) : NaN;
        const current = latestPrice(latest.data?.[item.id]);
        const quote = latest.data?.[item.id];
        const quoteTimes = [quote?.high > 0 ? quote.highTime || 0 : null, quote?.low > 0 ? quote.lowTime || 0 : null].filter(t => t !== null);
        const quoteTime = quoteTimes.length ? Math.min(...quoteTimes) : 0;
        const stale = !quoteTime || Date.now() / 1000 - quoteTime > 3600;
        const buyTime = Number(quote?.high) > 0 ? quote.highTime : quote?.lowTime;
        const buyStale = !buyTime || Date.now() / 1000 - buyTime > 3600;
        const pct = !stale && Number.isFinite(current) && Number.isFinite(normal) ? ((current / normal) - 1) * 100 : NaN;

        const slots = new Map();
        points.forEach(p => {
          const { day, hour } = localParts(p.timestamp);
          const start = bucketStart(hour);
          const key = `${day}-${start}`;
          if (!slots.has(key)) slots.set(key, []);
          slots.get(key).push(p.price / normal);
        });

        let bestSlot = null;
        for (const [key, vals] of slots) {
          if (vals.length < 2) continue;
          const score = mean(vals);
          if (!bestSlot || score < bestSlot.score) {
            const [day, start] = key.split('-').map(Number);
            bestSlot = { day, start, score, samples: vals.length };
          }
        }

        const buy = Number(quote?.high) > 0 ? Number(quote.high) : current;
        return { item, points, normal, current, buy, pct, stale, buyStale, quoteTime, signal: signal(pct), bestSlot: Number.isFinite(normal) ? bestSlot : null };
      });
      market = analyses;
      updatedAt = Date.now();
      render();
      const basket = analyses.filter(a => BASKET.includes(a.item.name) && Number.isFinite(a.pct));

      if (!basket.length) throw new Error('No usable market history was returned for the original basket.');

      // Basket-level historical pattern. Each item is normalized to its own median first,
      // so expensive items do not dominate cheap items.
      const basketSlots = new Map();
      basket.forEach(a => {
        a.points.forEach(p => {
          const { day, hour } = localParts(p.timestamp);
          const start = bucketStart(hour);
          const key = `${day}-${start}`;
          if (!basketSlots.has(key)) basketSlots.set(key, []);
          basketSlots.get(key).push(p.price / a.normal);
        });
      });

      let bestBasket = null;
      for (const [key, vals] of basketSlots) {
        // Require enough samples across the basket to avoid picking a thin/random slot.
        if (vals.length < basket.length * 2) continue;
        const score = mean(vals);
        if (!bestBasket || score < bestBasket.score) {
          const [day, start] = key.split('-').map(Number);
          bestBasket = { day, start, score, samples: vals.length };
        }
      }

      const basketPct = mean(basket.map(a => a.pct));
      const bSignal = basketSignal(basketPct);
      const sorted = [...basket].sort((a, b) => a.pct - b.pct);
      const best = sorted[0];
      const worst = sorted[sorted.length - 1];

      els.bestDay.textContent = bestBasket ? dayName(bestBasket.day) : 'Not enough history';
      els.bestTime.textContent = bestBasket ? timeLabel(bestBasket.start) : 'Not enough history';
      els.currentStatus.textContent = bSignal.label;
      els.currentStatus.className = `status ${bSignal.cls}`;
      els.overallPrice.textContent = Number.isFinite(basketPct) ? fmtPct(basketPct) : 'N/A';
      els.bestBuy.textContent = `${shortName(best.item.name)} (${fmtPct(best.pct)})`;
      els.worstBuy.textContent = `${shortName(worst.item.name)} (${fmtPct(worst.pct)})`;

      const days = Math.max(...analyses.map(a => a.points.length)) / 24;
      els.summary.textContent = `Live prices compared with roughly ${Math.max(1, Math.round(days))} days of hourly history. Times are shown in your local time.`;


    } catch (err) {
      console.error(err);
      els.error.textContent = `Couldn’t load GE data right now. ${err.message || ''}`.trim();
      els.error.classList.remove('hidden');
      els.summary.textContent = 'Live GE data could not be loaded.';
      els.currentStatus.textContent = 'Unavailable';
      els.currentStatus.className = 'status neutral';
      els.bestDay.textContent = els.bestTime.textContent = els.overallPrice.textContent = els.bestBuy.textContent = els.worstBuy.textContent = 'Unavailable';
    } finally {
      els.refresh.disabled = false;
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
  }

  const historyCache = new Map();
  let market = [], updatedAt = 0, category = 'All', favoritesOnly = false;
  const storageKey = 'peakpvm-ge-supplies-v1';
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { /* Storage may be blocked. */ }
  // Validate persisted fields before using them in markup or arithmetic.
  const preferences = new Map(TRACKED.map(item => {
    const value = saved[item.id] || {};
    return [item.id, { favorite: value.favorite === true, quantity: whole(value.quantity), target: whole(value.target) }];
  }));
  function whole(value) {
    const n = Number(value);
    return Number.isSafeInteger(n) && n > 0 ? Math.min(n, 2147483647) : 0;
  }
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(preferences))); } catch { /* The page still works without storage. */ }
  }
  function buyingPrice(a) { return !a.buyStale && Number.isFinite(a.buy) ? a.buy : NaN; }
  function reached(a) { const target = preferences.get(a.item.id).target; return target > 0 && buyingPrice(a) <= target; }
  function updateTotal() {
    let total = 0, selected = 0, missing = 0;
    for (const [id, pref] of preferences) {
      if (!pref.quantity) continue;
      selected++;
      const a = market.find(row => row.item.id === id);
      const price = a ? buyingPrice(a) : NaN;
      if (Number.isFinite(price)) total += pref.quantity * price;
      else missing++;
    }
    els.total.textContent = `${fmtGp(total)} estimated · ${selected} supplies${missing ? ` · ${missing} unpriced (excluded)` : ''}`;
  }
  function render() {
    const query = els.search.value.toLowerCase().trim();
    const visible = market.filter(a =>
      (category === 'All' || a.item.category === category) &&
      (!favoritesOnly || preferences.get(a.item.id).favorite) &&
      `${a.item.name} ${shortName(a.item.name)} ${a.item.aliases}`.toLowerCase().includes(query));
    const sort = els.sort.value;
    const numeric = (a, b) => Number.isFinite(a) ? (Number.isFinite(b) ? a - b : -1) : (Number.isFinite(b) ? 1 : 0);
    visible.sort((a, b) => {
      // Opportunity ranks fresh, sufficiently sampled discounts; targets that have fired come first.
      if (sort === 'opportunity' && reached(a) !== reached(b)) return reached(a) ? -1 : 1;
      const order = sort === 'price' ? numeric(a.current, b.current) : sort === 'name' ? 0 : numeric(a.pct, b.pct);
      return order || a.item.name.localeCompare(b.item.name);
    });
    els.count.textContent = `${visible.length} visible / ${TRACKED.length} tracked`;
    els.freshness.textContent = updatedAt ? `Prices fetched ${new Date(updatedAt).toLocaleString()}. Quotes over 1 hour old are marked stale.` : 'Prices not loaded yet.';
    els.rows.innerHTML = visible.map(a => {
      const pref = preferences.get(a.item.id);
      const name = escapeHtml(a.item.name);
      const cheapest = a.bestSlot ? `${dayName(a.bestSlot.day).slice(0,3)} ${timeLabel(a.bestSlot.start)}` : 'Not enough history';
      const hit = reached(a);
      return `<tr data-id="${a.item.id}" class="${hit ? 'target-hit' : ''}">
        <td><button type="button" class="star" data-favorite aria-label="Favorite ${name}" aria-pressed="${pref.favorite}">${pref.favorite ? '★' : '☆'}</button><span class="item-name">${escapeHtml(shortName(a.item.name))}</span><span class="item-sub">${name}</span></td>
        <td>${fmtGp(a.current)}${a.stale && Number.isFinite(a.current) ? '<span class="item-sub">Stale quote</span>' : ''}</td>
        <td><span class="pill ${a.signal.cls}">${a.signal.label}</span>${Number.isFinite(a.pct) ? `<span class="item-sub">${fmtPct(a.pct)}</span>` : ''}</td>
        <td>${escapeHtml(cheapest)}</td>
        <td><input type="number" min="0" max="2147483647" step="1" data-quantity aria-label="Quantity for ${name}" value="${pref.quantity || ''}" placeholder="0"></td>
        <td><input type="number" min="0" max="2147483647" step="1" data-target aria-label="Target buy price for ${name}" value="${pref.target || ''}" placeholder="gp"><span class="item-sub target-label">${hit ? 'Target reached' : ''}</span></td>
      </tr>`;
    }).join('') || '<tr><td colspan="6">No supplies match your filters.</td></tr>';
    updateTotal();
  }
  els.search.addEventListener('input', render);
  els.sort.addEventListener('change', render);
  els.category.addEventListener('click', event => {
    const button = event.target.closest('[data-category]');
    if (!button) return;
    category = button.dataset.category;
    els.category.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    render();
  });
  els.favorites.addEventListener('click', () => {
    favoritesOnly = !favoritesOnly;
    els.favorites.setAttribute('aria-pressed', String(favoritesOnly));
    render();
  });
  $('clearFilters').addEventListener('click', () => {
    els.search.value = ''; category = 'All'; favoritesOnly = false; els.sort.value = 'opportunity';
    els.favorites.setAttribute('aria-pressed', 'false');
    els.category.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.category === 'All')));
    render();
  });
  els.rows.addEventListener('click', event => {
    const button = event.target.closest('[data-favorite]');
    if (!button) return;
    const pref = preferences.get(Number(button.closest('tr').dataset.id));
    pref.favorite = !pref.favorite; persist(); render();
  });
  els.rows.addEventListener('input', event => {
    const input = event.target;
    if (!input.matches('[data-quantity], [data-target]')) return;
    const row = input.closest('tr'), id = Number(row.dataset.id);
    const value = whole(input.value);
    preferences.get(id)[input.hasAttribute('data-quantity') ? 'quantity' : 'target'] = value;
    persist(); updateTotal();
    const hit = reached(market.find(a => a.item.id === id));
    row.classList.toggle('target-hit', hit);
    row.querySelector('.target-label').textContent = hit ? 'Target reached' : '';
  });
  // Re-sort after editing, without interrupting typing/focus.
  els.rows.addEventListener('change', event => {
    if (event.target.matches('[data-quantity], [data-target]')) render();
  });
  $('restockPresets').addEventListener('click', event => {
    const button = event.target.closest('[data-quantity-preset]');
    if (!button) return;
    const quantity = whole(button.dataset.quantityPreset);
    els.rows.querySelectorAll('tr[data-id]').forEach(row => { preferences.get(Number(row.dataset.id)).quantity = quantity; });
    persist(); render();
  });
  $('clearList').addEventListener('click', () => {
    preferences.forEach(pref => { pref.quantity = 0; }); persist(); render();
  });
  els.refresh.addEventListener('click', load);
  render();
  load();
})();
