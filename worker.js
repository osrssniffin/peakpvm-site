const WOM = 'https://api.wiseoldman.net/v2';
const TEMPLE_HOSTS = ['https://templeosrs.com', 'https://www.templeosrs.com'];
const RUNE_PROFILE = 'https://api.runeprofile.com/v1';
const CML = 'https://crystalmathlabs.com/api.php';
const WIKISYNC = 'https://sync.runescape.wiki/runelite/player';
const JAGEX_LITE = 'https://secure.runescape.com/m=hiscore_oldschool/index_lite.ws';
const JAGEX_SKILLS = ['overall','attack','defence','strength','hitpoints','ranged','prayer','magic','cooking','woodcutting','fletching','fishing','firemaking','crafting','smithing','mining','herblore','agility','thieving','slayer','farming','runecrafting','hunter','construction','sailing'];

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'public, max-age=60',
  'x-content-type-options': 'nosniff'
};

function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body, null, 2), { status, headers: { ...JSON_HEADERS, ...extra } });
}

function validRSN(rsn) {
  return typeof rsn === 'string' && rsn.length >= 1 && rsn.length <= 12 && /^[A-Za-z0-9 _-]+$/.test(rsn);
}

async function upstream(url, { jsonExpected = true, timeout = 9000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeout);
  const started = Date.now();
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'accept': jsonExpected ? 'application/json,text/plain;q=0.9,*/*;q=0.5' : 'text/plain,*/*;q=0.5',
        'user-agent': 'OSRS-Omniscape/1.0 (public OSRS player dashboard)'
      }
    });
    const text = await response.text();
    let data = text;
    let parseError = null;
    if (jsonExpected) {
      try { data = text ? JSON.parse(text) : null; }
      catch (e) { parseError = 'Upstream returned non-JSON data'; }
    }
    return {
      ok: response.ok && (!jsonExpected || !parseError),
      status: response.status,
      ms: Date.now() - started,
      data: parseError ? null : data,
      error: response.ok ? parseError : `HTTP ${response.status}`,
      preview: parseError ? text.slice(0, 320) : undefined
    };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - started, data: null, error: e?.name === 'AbortError' ? 'Timed out' : String(e?.message || e) };
  } finally {
    clearTimeout(timer);
  }
}

async function temple(pathAndQuery) {
  let last = null;
  for (const host of TEMPLE_HOSTS) {
    const result = await upstream(`${host}${pathAndQuery}`, { jsonExpected: true, timeout: 11000 });
    result.host = host;
    if (result.ok) return result;
    last = result;
    // Try the www/non-www mirror for transport errors, 5xx, or malformed responses.
    if (result.status > 0 && result.status < 500 && result.error !== 'Upstream returned non-JSON data') break;
  }
  return last || { ok: false, status: 0, data: null, error: 'Temple request failed before dispatch' };
}


function parseJagexLite(text) {
  if (typeof text !== 'string') return null;
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < JAGEX_SKILLS.length) return null;
  const skills = {};
  for (let i = 0; i < JAGEX_SKILLS.length; i++) {
    const parts = lines[i].split(',').map(Number);
    if (parts.length < 3 || !parts.every(Number.isFinite)) continue;
    skills[JAGEX_SKILLS[i]] = { rank: parts[0], level: parts[1], experience: parts[2] };
  }
  return { skills };
}

function firstCmlLine(text) {
  if (typeof text !== 'string') return null;
  const line = text.split(/\r?\n/).map(s => s.trim()).find(Boolean);
  if (!line || /^-\d+$/.test(line)) return { raw: line, errorCode: Number(line) };
  const nums = line.split(/[;,\s]+/).map(Number).filter(Number.isFinite);
  return { raw: line, nums };
}

async function cmlBundle(rsn) {
  const q = encodeURIComponent(rsn);
  const [records, track, lastcheck, lastchange] = await Promise.all([
    upstream(`${CML}?type=recordsofplayer&player=${q}`, { jsonExpected: false }),
    upstream(`${CML}?type=track&player=${q}&time=31d`, { jsonExpected: false }),
    upstream(`${CML}?type=lastcheck&player=${q}`, { jsonExpected: false }),
    upstream(`${CML}?type=lastchange&player=${q}`, { jsonExpected: false })
  ]);
  const r = firstCmlLine(records.data);
  const t = firstCmlLine(track.data);
  return {
    ok: records.ok || track.ok || lastcheck.ok || lastchange.ok,
    records,
    track,
    lastcheck,
    lastchange,
    parsed: {
      // CML's recordsofplayer first row is Overall: day/week/month.
      overallRecords: r?.nums?.length >= 3 ? { day: r.nums[0], week: r.nums[1], month: r.nums[2] } : null,
      // CML track first row is Overall; preserve raw too because their legacy API is positional.
      overall31d: t?.nums?.length >= 6 ? {
        xp: t.nums[0], rank: t.nums[1], xpGained: t.nums[2], ranksGained: t.nums[3], levelsGained: t.nums[4], ehpGained: t.nums[5]
      } : null,
      secondsSinceCheck: Number.isFinite(Number(String(lastcheck.data).trim())) ? Number(String(lastcheck.data).trim()) : null,
      secondsSinceChange: Number.isFinite(Number(String(lastchange.data).trim())) ? Number(String(lastchange.data).trim()) : null
    }
  };
}

async function lookup(rsn) {
  const e = encodeURIComponent(rsn);
  const wikiName = encodeURIComponent(rsn.replace(/ /g, '_'));

  const womP = Promise.all([
    upstream(`${WOM}/players/${e}`),
    upstream(`${WOM}/players/${e}/achievements`),
    upstream(`${WOM}/players/${e}/groups`),
    upstream(`${WOM}/players/${e}/competitions`),
    upstream(`${WOM}/players/${e}/names`)
  ]).then(([player, achievements, groups, competitions, names]) => ({ player, achievements, groups, competitions, names }));

  // Temple deliberately owns only the collection/pet lane here. No stats/gains duplication.
  const templeP = Promise.all([
    temple(`/api/player_info.php?player=${e}&dateformat=unix&cloginfo=1&formattedrsn=1`),
    temple(`/api/pets/pet_count.php?player=${e}&count=1`),
    temple(`/api/collection-log/player_recent_items.php?player=${e}&count=25`)
  ]).then(([info, pets, recent]) => ({ info, pets, recent }));

  // RuneProfile owns account-progression data: quests, diaries, CAs and activity feed.
  const runeProfileP = Promise.all([
    upstream(`${RUNE_PROFILE}/accounts/${e}`),
    upstream(`${RUNE_PROFILE}/accounts/${e}/quests`),
    upstream(`${RUNE_PROFILE}/accounts/${e}/achievement-diaries`),
    upstream(`${RUNE_PROFILE}/accounts/${e}/combat-achievements`),
    upstream(`${RUNE_PROFILE}/accounts/${e}/activities?limit=25`)
  ]).then(([summary, quests, diaries, combatAchievements, activities]) => ({ summary, quests, diaries, combatAchievements, activities }));

  const cmlP = cmlBundle(rsn);
  const [wom, templeData, runeProfile, cml] = await Promise.all([womP, templeP, runeProfileP, cmlP]);

  let jagexFallback = null;
  if (!wom.player.ok) {
    const jr = await upstream(`${JAGEX_LITE}?player=${e}`, { jsonExpected: false, timeout: 9000 });
    jagexFallback = { ...jr, parsed: jr.ok ? parseJagexLite(jr.data) : null };
  }

  let wikiSync = null;
  if (!runeProfile.quests.ok) {
    wikiSync = await upstream(`${WIKISYNC}/${wikiName}/STANDARD`, { jsonExpected: true, timeout: 9000 });
  }

  return {
    rsn,
    generatedAt: new Date().toISOString(),
    lanes: {
      wiseOldMan: 'Current skills, bosses, EHP/EHB, achievements, groups, competitions, name history',
      temple: 'Collection log, EHC, pets, recent collection items',
      runeProfile: 'Quests, achievement diaries, Combat Achievements, activity feed, clan/profile progression',
      crystalMathLabs: 'Long-term XP records and 31-day account history',
      wikiSync: 'Quest/progression fallback only when RuneProfile quest data is unavailable',
      jagexFallback: 'Current skill fallback only when Wise Old Man has no player snapshot'
    },
    sources: { wom, temple: templeData, runeProfile, cml, wikiSync, jagexFallback }
  };
}

async function templeClog(rsn) {
  const e = encodeURIComponent(rsn);
  // The heavy endpoint is separate and only called by an explicit user click.
  // We request only the flat item list and names; no yearly gains or category-hour expansion.
  return temple(`/api/collection-log/player_collection_log.php?player=${e}&includenames=1&onlyitems=1&dateformat=unix`);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/lookup') {
      const rsn = (url.searchParams.get('rsn') || '').trim();
      if (!validRSN(rsn)) return json({ error: 'RSN must be 1–12 characters using letters, numbers, spaces, underscores or hyphens.' }, 400);
      const result = await lookup(rsn);
      return json(result, 200, { 'cache-control': 'public, max-age=60, s-maxage=60' });
    }
    if (url.pathname === '/api/temple-clog') {
      const rsn = (url.searchParams.get('rsn') || '').trim();
      if (!validRSN(rsn)) return json({ error: 'Invalid RSN.' }, 400);
      const result = await templeClog(rsn);
      return json({ rsn, generatedAt: new Date().toISOString(), temple: result }, result?.ok ? 200 : 502, { 'cache-control': 'public, max-age=120, s-maxage=120' });
    }
    if (url.pathname === '/api/health') {
      return json({ ok: true, app: 'OSRS Omniscape', version: '1.0.0', templeProxy: true });
    }
    return env.ASSETS.fetch(request);
  }
};
