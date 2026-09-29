(() => {
  'use strict';

  const PLAYER = 'all 420s';
  const API = `https://api.wiseoldman.net/v2/players/${encodeURIComponent(PLAYER)}`;
  const DEFAULT_TARGET = 420;
  const TARGETS = {
    tztok_jad: 20,
    tzkal_zuk: 4
  };

  const NAME_OVERRIDES = {
    abyssal_sire: 'Abyssal Sire',
    alchemical_hydra: 'Alchemical Hydra',
    amoxliatl: 'Amoxliatl',
    araxxor: 'Araxxor',
    artio: 'Artio',
    barrows_chests: 'Barrows Chests',
    bryophyta: 'Bryophyta',
    callisto: 'Callisto',
    calvarion: "Calvar'ion",
    cerberus: 'Cerberus',
    chambers_of_xeric: 'Chambers of Xeric',
    chambers_of_xeric_challenge_mode: 'Chambers of Xeric: Challenge Mode',
    chaos_elemental: 'Chaos Elemental',
    chaos_fanatic: 'Chaos Fanatic',
    commander_zilyana: 'Commander Zilyana',
    corporeal_beast: 'Corporeal Beast',
    crazy_archaeologist: 'Crazy Archaeologist',
    dagannoth_prime: 'Dagannoth Prime',
    dagannoth_rex: 'Dagannoth Rex',
    dagannoth_supreme: 'Dagannoth Supreme',
    deranged_archaeologist: 'Deranged Archaeologist',
    doom_of_mokhaiotl: 'Doom of Mokhaiotl',
    duke_sucellus: 'Duke Sucellus',
    general_graardor: 'General Graardor',
    giant_mole: 'Giant Mole',
    grotesque_guardians: 'Grotesque Guardians',
    hespori: 'Hespori',
    kalphite_queen: 'Kalphite Queen',
    king_black_dragon: 'King Black Dragon',
    kraken: 'Kraken',
    kreearra: "Kree'arra",
    kril_tsutsaroth: "K'ril Tsutsaroth",
    lunar_chests: 'Lunar Chests',
    mimic: 'The Mimic',
    nex: 'Nex',
    nightmare: 'The Nightmare',
    obor: 'Obor',
    phantom_muspah: 'Phantom Muspah',
    phosanis_nightmare: "Phosani's Nightmare",
    royal_titans: 'Royal Titans',
    sarachnis: 'Sarachnis',
    scorpia: 'Scorpia',
    scurrius: 'Scurrius',
    skotizo: 'Skotizo',
    sol_heredit: 'Sol Heredit',
    tempoross: 'Tempoross',
    the_gauntlet: 'The Gauntlet',
    the_corrupted_gauntlet: 'The Corrupted Gauntlet',
    theatre_of_blood: 'Theatre of Blood',
    theatre_of_blood_hard_mode: 'Theatre of Blood: Hard Mode',
    thermonuclear_smoke_devil: 'Thermonuclear Smoke Devil',
    tombs_of_amascut: 'Tombs of Amascut',
    tombs_of_amascut_expert: 'Tombs of Amascut: Expert Mode',
    tztok_jad: 'TzTok-Jad',
    tzkal_zuk: 'TzKal-Zuk',
    vardorvis: 'Vardorvis',
    venenatis: 'Venenatis',
    vetion: "Vet'ion",
    vorkath: 'Vorkath',
    wintertodt: 'Wintertodt',
    yama: 'Yama',
    zalcano: 'Zalcano',
    zulrah: 'Zulrah'
  };

  const els = {
    refreshBtn: document.getElementById('refreshBtn'),
    retryBtn: document.getElementById('retryBtn'),
    searchInput: document.getElementById('searchInput'),
    sortSelect: document.getElementById('sortSelect'),
    filters: Array.from(document.querySelectorAll('.filter')),
    bossGrid: document.getElementById('bossGrid'),
    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    errorText: document.getElementById('errorText'),
    overallPercent: document.getElementById('overallPercent'),
    overallRing: document.getElementById('overallRing'),
    overallBar: document.getElementById('overallBar'),
    overallKc: document.getElementById('overallKc'),
    bossesDone: document.getElementById('bossesDone'),
    bossesTotal: document.getElementById('bossesTotal'),
    remainingKc: document.getElementById('remainingKc'),
    lastUpdated: document.getElementById('lastUpdated'),
    syncStatus: document.getElementById('syncStatus'),
    resultsCount: document.getElementById('resultsCount')
  };

  let allBosses = [];
  let activeFilter = 'all';

  function prettify(metric) {
    if (NAME_OVERRIDES[metric]) return NAME_OVERRIDES[metric];
    return metric
      .split('_')
      .map(w => w ? w[0].toUpperCase() + w.slice(1) : '')
      .join(' ')
      .replace(/\bOf\b/g, 'of')
      .replace(/\bThe\b/g, 'The');
  }

  function targetFor(metric) {
    return TARGETS[metric] ?? DEFAULT_TARGET;
  }

  function safeKills(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  }

  function fmt(n) {
    return Math.round(n).toLocaleString('en-US');
  }

  function formatSnapshotTime(value) {
    if (!value) return 'UNKNOWN';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return 'UNKNOWN';
    return new Intl.DateTimeFormat(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    }).format(d).toUpperCase();
  }

  function buildBosses(snapshot) {
    const raw = snapshot?.data?.bosses;
    if (!raw || typeof raw !== 'object') throw new Error('WOM returned no boss snapshot for this player.');

    return Object.entries(raw).map(([metric, data]) => {
      const kills = safeKills(data?.kills);
      const target = targetFor(metric);
      const capped = Math.min(kills, target);
      const progress = target > 0 ? capped / target : 0;
      return {
        metric,
        name: prettify(metric),
        kills,
        target,
        capped,
        remaining: Math.max(0, target - kills),
        progress,
        complete: kills >= target
      };
    });
  }

  function updateSummary(snapshot) {
    const targetTotal = allBosses.reduce((s, b) => s + b.target, 0);
    const progressTotal = allBosses.reduce((s, b) => s + b.capped, 0);
    const actualTotal = allBosses.reduce((s, b) => s + b.kills, 0);
    const remaining = allBosses.reduce((s, b) => s + b.remaining, 0);
    const done = allBosses.filter(b => b.complete).length;
    const pct = targetTotal ? Math.min(100, (progressTotal / targetTotal) * 100) : 0;

    els.overallPercent.textContent = `${pct.toFixed(1)}%`;
    els.overallRing.style.setProperty('--progress', `${pct * 3.6}deg`);
    els.overallBar.style.width = `${pct}%`;
    els.overallKc.textContent = `${fmt(progressTotal)} / ${fmt(targetTotal)} TARGET KC`;
    els.overallKc.title = `${fmt(actualTotal)} total recorded KC across tracked metrics`;
    els.bossesDone.textContent = fmt(done);
    els.bossesTotal.textContent = `OUT OF ${fmt(allBosses.length)} TOTAL`;
    els.remainingKc.textContent = fmt(remaining);
    els.lastUpdated.textContent = formatSnapshotTime(snapshot?.createdAt);
    els.syncStatus.textContent = 'LIVE WOM SNAPSHOT';
  }

  function render() {
    const query = els.searchInput.value.trim().toLowerCase();
    let list = allBosses.filter(b => {
      const matchesSearch = !query || b.name.toLowerCase().includes(query) || b.metric.includes(query);
      const matchesFilter = activeFilter === 'all' ||
        (activeFilter === 'complete' && b.complete) ||
        (activeFilter === 'unfinished' && !b.complete);
      return matchesSearch && matchesFilter;
    });

    const sort = els.sortSelect.value;
    list.sort((a, b) => {
      if (sort === 'progress-asc') return a.progress - b.progress || a.name.localeCompare(b.name);
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (sort === 'kc-desc') return b.kills - a.kills || a.name.localeCompare(b.name);
      return b.progress - a.progress || a.name.localeCompare(b.name);
    });

    els.resultsCount.textContent = `${list.length} ${list.length === 1 ? 'BOSS' : 'BOSSES'}`;
    els.bossGrid.innerHTML = list.map(b => {
      const pct = Math.min(100, b.progress * 100);
      const over = Math.max(0, b.kills - b.target);
      const status = b.complete ? 'BLAZED ✓' : 'GROWING';
      const foot = b.complete
        ? (over > 0 ? `TARGET +${fmt(over)} KC` : 'TARGET CLEARED')
        : `${fmt(b.remaining)} KC LEFT`;

      return `
        <article class="boss-card ${b.complete ? 'complete' : ''}">
          <div class="card-top">
            <div class="boss-name">${escapeHtml(b.name)}</div>
            <span class="badge">${status}</span>
          </div>
          <div class="kc-row">
            <div class="kc-main"><strong>${fmt(b.kills)}</strong><span>/ ${fmt(b.target)} KC</span></div>
            <div class="percent">${pct.toFixed(pct >= 99.95 ? 0 : 1)}%</div>
          </div>
          <div class="progress-track"><span style="width:${pct}%"></span></div>
          <div class="card-foot">
            <span class="left">${foot}</span>
            <span>${b.target === 420 ? '<i class="mini-pot-leaf pot-leaf" aria-hidden="true"></i> 420' : '🔥 SPECIAL'}</span>
          </div>
        </article>`;
    }).join('');
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  }

  async function loadData() {
    setLoading(true);
    try {
      const response = await fetch(`${API}?_=${Date.now()}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`Wise Old Man returned HTTP ${response.status}.`);
      }

      const player = await response.json();
      const snapshot = player?.latestSnapshot;
      if (!snapshot) throw new Error('Wise Old Man has no latest snapshot for all 420s.');

      allBosses = buildBosses(snapshot);
      updateSummary(snapshot);
      render();

      els.loadingState.classList.add('hidden');
      els.errorState.classList.add('hidden');
      els.bossGrid.classList.remove('hidden');
    } catch (err) {
      console.error(err);
      els.errorText.textContent = `${err?.message || 'Wise Old Man could not be reached.'} If this is a browser CORS/network block, the Peak PvM site will need a tiny same-origin proxy.`;
      els.loadingState.classList.add('hidden');
      els.bossGrid.classList.add('hidden');
      els.errorState.classList.remove('hidden');
      els.syncStatus.textContent = 'SYNC FAILED';
    } finally {
      setLoading(false);
    }
  }

  function setLoading(on) {
    els.refreshBtn.classList.toggle('spinning', on);
    els.refreshBtn.textContent = on ? '↻ LOADING...' : '↻ BLAZE REFRESH';
  }

  function makeLeaves() {
    const field = document.getElementById('leafField');
    const count = window.matchMedia('(max-width: 700px)').matches ? 9 : 17;
    for (let i = 0; i < count; i++) {
      const leaf = document.createElement('span');
      leaf.className = 'floating-leaf pot-leaf';
      leaf.style.left = `${Math.random() * 100}%`;
      const size = 18 + Math.random() * 34;
      leaf.style.width = `${size}px`;
      leaf.style.height = `${size}px`;
      leaf.style.animationDuration = `${13 + Math.random() * 18}s`;
      leaf.style.animationDelay = `${-Math.random() * 25}s`;
      field.appendChild(leaf);
    }
  }

  els.refreshBtn.addEventListener('click', loadData);
  els.retryBtn.addEventListener('click', loadData);
  els.searchInput.addEventListener('input', render);
  els.sortSelect.addEventListener('change', render);
  els.filters.forEach(btn => btn.addEventListener('click', () => {
    activeFilter = btn.dataset.filter;
    els.filters.forEach(b => b.classList.toggle('active', b === btn));
    render();
  }));

  makeLeaves();
  loadData();
  setInterval(loadData, 5 * 60 * 1000);
})();
