(() => {
  'use strict';

  const API = 'https://prices.runescape.wiki/api/v1/osrs';
  const TRACKED = [
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
    'Divine bastion potion(4)'
  ];

  const $ = id => document.getElementById(id);
  const els = {
    bestDay: $('bestDay'), bestTime: $('bestTime'), currentStatus: $('currentStatus'),
    overallPrice: $('overallPrice'), bestBuy: $('bestBuy'), worstBuy: $('worstBuy'),
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
    const high = Number(p.avgHighPrice ?? p.highPrice);
    const low = Number(p.avgLowPrice ?? p.lowPrice);
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

      const byName = new Map(mapping.map(x => [x.name, x]));
      const missing = TRACKED.filter(name => !byName.has(name));
      if (missing.length) throw new Error(`Could not find: ${missing.join(', ')}`);

      const items = TRACKED.map(name => byName.get(name));
      const histories = await Promise.all(items.map(async item => {
        const result = await getJson(`${API}/timeseries?timestep=1h&id=${item.id}`);
        return { item, data: Array.isArray(result.data) ? result.data : [] };
      }));

      const analyses = histories.map(({ item, data }) => {
        const points = data.map(p => ({ ...p, price: pointPrice(p) })).filter(p => Number.isFinite(p.price) && p.price > 0);
        const normal = median(points.map(p => p.price));
        const current = latestPrice(latest.data?.[item.id]);
        const pct = Number.isFinite(current) && Number.isFinite(normal) ? ((current / normal) - 1) * 100 : NaN;

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

        return { item, points, normal, current, pct, signal: signal(pct), bestSlot };
      }).filter(x => Number.isFinite(x.current) && Number.isFinite(x.normal));

      if (!analyses.length) throw new Error('No usable market history was returned.');

      // Basket-level historical pattern. Each item is normalized to its own median first,
      // so expensive items do not dominate cheap items.
      const basketSlots = new Map();
      analyses.forEach(a => {
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
        if (vals.length < analyses.length * 2) continue;
        const score = mean(vals);
        if (!bestBasket || score < bestBasket.score) {
          const [day, start] = key.split('-').map(Number);
          bestBasket = { day, start, score, samples: vals.length };
        }
      }

      const basketPct = mean(analyses.map(a => a.pct));
      const bSignal = basketSignal(basketPct);
      const sorted = [...analyses].sort((a, b) => a.pct - b.pct);
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

      els.rows.innerHTML = analyses.map(a => {
        const cheapest = a.bestSlot ? `${dayName(a.bestSlot.day).slice(0,3)} ${timeLabel(a.bestSlot.start)}` : 'Not enough history';
        return `<tr>
          <td><span class="item-name">${escapeHtml(shortName(a.item.name))}</span><span class="item-sub">${escapeHtml(a.item.name)}</span></td>
          <td>${fmtGp(a.current)}</td>
          <td><span class="pill ${a.signal.cls}">${a.signal.label}</span></td>
          <td>${escapeHtml(cheapest)}</td>
        </tr>`;
      }).join('');
    } catch (err) {
      console.error(err);
      els.error.textContent = `Couldn’t load GE data right now. ${err.message || ''}`.trim();
      els.error.classList.remove('hidden');
      els.summary.textContent = 'Live GE data could not be loaded.';
      els.currentStatus.textContent = 'Unavailable';
      els.currentStatus.className = 'status neutral';
    } finally {
      els.refresh.disabled = false;
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[ch]));
  }

  els.refresh.addEventListener('click', load);
  load();
})();
