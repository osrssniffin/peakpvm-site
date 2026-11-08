/** PeakPvM SNIFFIN backend — Cloudflare Worker + KV.
 * Public API and IP-restricted owner-console origin for peakpvm.com/sniffin/.
 * Required secrets: ADMIN_PIN and SESSION_SECRET (see README).
 * Required KV binding: SNIFFIN_KV.
 */
const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};
const ID_RE = /^[a-z0-9-]{1,40}$/;
const ALLOWED_IP = "47.12.27.148";
const RSN = "s niffin";
const PUBLIC_ORIGINS = ["https://peakpvm.com", "https://www.peakpvm.com"];
const encoder = new TextEncoder();
const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: HEADERS });
const getIP = (req) => req.headers.get("CF-Connecting-IP") || "";
const owner = (req) => getIP(req) === ALLOWED_IP;
const cookieValue = (req, key) =>
  req.headers
    .get("Cookie")
    ?.split(";")
    .map((s) => s.trim())
    .find((s) => s.startsWith(key + "="))
    ?.slice(key.length + 1) || "";
const toHex = (b) =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
async function sign(secret, body) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
}
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const max = Math.max(a.length, b.length);
  let bad = a.length ^ b.length;
  for (let i = 0; i < max; i++)
    bad |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return bad === 0;
}
async function authorized(req, env) {
  if (!owner(req) || !env.SESSION_SECRET) return false;
  const token = cookieValue(req, "sniffin_admin");
  const [expiry, mac, extra] = token.split(".");
  if (
    extra ||
    !/^\d{10,13}$/.test(expiry) ||
    !mac ||
    Date.now() > Number(expiry)
  )
    return false;
  const expect = await sign(env.SESSION_SECRET, expiry + "|" + getIP(req));
  return safeEqual(mac, expect);
}

// Explicit mapping verified against Temple player_stats.php?bosses=1.
const TEMPLE_BOSSES = {
  abyssal_sire: "Abyssal Sire",
  alchemical_hydra: "Alchemical Hydra",
  amoxliatl: "Amoxliatl",
  araxxor: "Araxxor",
  artio: "Artio",
  barrows_chests: "Barrows Chests",
  brutus: "Brutus",
  bryophyta: "Bryophyta",
  callisto: "Callisto",
  calvarion: "Calvarion",
  cerberus: "Cerberus",
  chambers_of_xeric: "Chambers of Xeric",
  chambers_of_xeric_challenge_mode: "Chambers of Xeric Challenge Mode",
  chaos_elemental: "Chaos Elemental",
  chaos_fanatic: "Chaos Fanatic",
  commander_zilyana: "Commander Zilyana",
  corporeal_beast: "Corporeal Beast",
  crazy_archaeologist: "Crazy Archaeologist",
  dagannoth_prime: "Dagannoth Prime",
  dagannoth_rex: "Dagannoth Rex",
  dagannoth_supreme: "Dagannoth Supreme",
  deranged_archaeologist: "Deranged Archaeologist",
  doom_of_mokhaiotl: "Doom of Mokhaiotl",
  duke_sucellus: "Duke Sucellus",
  general_graardor: "General Graardor",
  giant_mole: "Giant Mole",
  grotesque_guardians: "Grotesque Guardians",
  hespori: "Hespori",
  kalphite_queen: "Kalphite Queen",
  king_black_dragon: "King Black Dragon",
  kraken: "Kraken",
  kreearra: "KreeArra",
  kril_tsutsaroth: "Kril Tsutsaroth",
  lunar_chests: "Lunar Chests",
  mad_angel: "Mad Angel",
  maggot_king: "Maggot King",
  mimic: "Mimic",
  nex: "Nex",
  nightmare: "The Nightmare",
  phosanis_nightmare: "Phosanis Nightmare",
  obor: "Obor",
  phantom_muspah: "Phantom Muspah",
  sarachnis: "Sarachnis",
  scorpia: "Scorpia",
  scurrius: "Scurrius",
  shellbane_gryphon: "Shellbane Gryphon",
  skotizo: "Skotizo",
  sol_heredit: "Sol Heredit",
  spindel: "Spindel",
  tempoross: "Tempoross",
  the_gauntlet: "The Gauntlet",
  the_corrupted_gauntlet: "The Corrupted Gauntlet",
  the_fractured_archive: "The Fractured Archive",
  the_hueycoatl: "Hueycoatl",
  the_leviathan: "The Leviathan",
  the_royal_titans: "The Royal Titans",
  the_whisperer: "The Whisperer",
  theatre_of_blood: "Theatre of Blood",
  theatre_of_blood_hard_mode: "Theatre of Blood Challenge Mode",
  thermonuclear_smoke_devil: "Thermonuclear Smoke Devil",
  tombs_of_amascut: "Tombs of Amascut",
  tombs_of_amascut_expert: "Tombs of Amascut Expert",
  tzkal_zuk: "TzKal-Zuk",
  tztok_jad: "TzTok-Jad",
  vardorvis: "Vardorvis",
  venenatis: "Venenatis",
  vetion: "Vetion",
  vorkath: "Vorkath",
  wintertodt: "Wintertodt",
  yama: "Yama",
  zalcano: "Zalcano",
  zulrah: "Zulrah",
};
const PET_METRICS = {
  "chaos-elemental": "chaos_elemental",
  "baby-mole": "giant_mole",
  scorpia: "scorpia",
  skotos: "skotizo",
  phoenix: "wintertodt",
  snakeling: "zulrah",
  "rock-golem": null,
  chompy: null,
  nid: "araxxor",
  beef: "brutus",
  sraracha: "sarachnis",
  vorki: "vorkath",
  hellpuppy: "cerberus",
  hydra: "alchemical_hydra",
  kraken: "kraken",
  thermy: "thermonuclear_smoke_devil",
  kq: "kalphite_queen",
  kbd: "king_black_dragon",
  jad: "tztok_jad",
  zuk: "tzkal_zuk",
  graardor: "general_graardor",
  kree: "kreearra",
  zilyana: "commander_zilyana",
  kril: "kril_tsutsaroth",
  sire: "abyssal_sire",
  corp: "corporeal_beast",
  muspah: "phantom_muspah",
  nex: "nex",
  nightmare: "nightmare",
  baron: "duke_sucellus",
  butch: "vardorvis",
  wisp: "the_whisperer",
  leviathan: "the_leviathan",
  scurry: "scurrius",
  venenatis: "venenatis",
  vetion: "vetion",
  callisto: "callisto",
  tempoross: "tempoross",
  guardians: null,
  heron: null,
  beaver: null,
  rocky: null,
  squirrel: null,
  rift: null,
  tangleroot: null,
  chinchompa: null,
  herbi: null,
  bloodhound: null,
  goa: "the_gauntlet",
  zalcano: "zalcano",
  tob: "theatre_of_blood",
  cox: "chambers_of_xeric",
  toa: "tombs_of_amascut",
  huey: "the_hueycoatl",
  moons: "amoxliatl",
  "giant-pet": "shellbane_gryphon",
  aggy: "mad_angel",
  bran: "the_royal_titans",
  dom: "doom_of_mokhaiotl",
  "maggot-marquess": "maggot_king",
  noon: "grotesque_guardians",
  orion: "the_fractured_archive",
  "pet-dagannoth-prime": "dagannoth_prime",
  "pet-dagannoth-rex": "dagannoth_rex",
  "pet-dagannoth-supreme": "dagannoth_supreme",
  "smol-heredit": "sol_heredit",
  yami: "yama",
  soup: null,
  "lil-creator": null,
  "mr-mcgroot": null,
  "pet-penance-queen": null,
  quetzin: null,
};

const INITIAL = {
  username: "s niffin",
  target: "sraracha",
  startKC: 0,
  huntNote: "",
  rates: {},
  owned: {
    "chaos-elemental": {},
    "baby-mole": {},
    scorpia: {},
    skotos: {},
    phoenix: {},
    snakeling: {},
    "rock-golem": {},
    chompy: {},
    nid: {},
    beef: {},
  },
  manualKC: {},
  notes: [],
};
async function state(env) {
  const saved = await env.SNIFFIN_KV.get("site-state", "json");
  return saved || INITIAL;
}
function validate(data) {
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw Error("Invalid state");
  const username = RSN;
  if (username.length > 40) throw Error("Username too long");
  const target = String(data.target || "");
  if (!ID_RE.test(target)) throw Error("Invalid target");
  const startKC = Number(data.startKC);
  if (!Number.isFinite(startKC) || startKC < 0) throw Error("Invalid start KC");
  const huntNote = String(data.huntNote || "").slice(0, 140);
  const owned = {};
  for (const [k, v] of Object.entries(data.owned || {})) {
    if (!ID_RE.test(k)) continue;
    const n = v?.kc === null || v?.kc === undefined ? null : Number(v.kc);
    if (n !== null && (!Number.isFinite(n) || n < 0)) continue;
    owned[k] = { kc: n, note: String(v?.note || "").slice(0, 300) };
    if (Object.keys(owned).length > 150) break;
  }
  const manualKC = {};
  for (const [k, v] of Object.entries(data.manualKC || {})) {
    if (!ID_RE.test(k)) continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0) manualKC[k] = Math.floor(n);
    if (Object.keys(manualKC).length > 150) break;
  }
  const rates = {};
  for (const [k, v] of Object.entries(data.rates || {})) {
    if (!ID_RE.test(k)) continue;
    const n = Number(v);
    if (Number.isFinite(n) && n >= 1 && n <= 100000000) rates[k] = n;
    if (Object.keys(rates).length > 150) break;
  }
  const notes = Array.isArray(data.notes)
    ? data.notes.slice(-30).map((n) => ({
        date: String(n.date || "").slice(0, 40),
        body: String(n.body || "").slice(0, 200),
        title: "FIELD REPORT",
      }))
    : [];
  return {
    username,
    target,
    startKC: Math.floor(startKC),
    huntNote,
    owned,
    manualKC,
    rates,
    notes,
    petNotes: Object.fromEntries(
      Object.entries(data.petNotes || {})
        .filter(
          ([id, note]) =>
            Object.hasOwn(PET_METRICS, id) && typeof note === "string",
        )
        .slice(0, 150)
        .map(([id, note]) => [id, note.slice(0, 300)]),
    ),
  };
}
function sameOrigin(req) {
  const origin = req.headers.get("Origin");
  return (
    !origin ||
    origin === new URL(req.url).origin ||
    (req.method === "GET" && PUBLIC_ORIGINS.includes(origin))
  );
}
async function handle(req, env, ctx) {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/sniffin/api/")) {
    if (!owner(req))
      return new Response("Owner console is restricted.", {
        status: 403,
        headers: { "Cache-Control": "no-store" },
      });
    if (
      !["GET", "HEAD"].includes(req.method) ||
      !url.pathname.startsWith("/sniffin/")
    )
      return json({ error: "Not found" }, 404);
    // The editor uses this same origin so its existing Strict, HttpOnly cookie stays first-party.
    const response = await fetch(
      "https://peakpvm.com" + url.pathname + url.search,
    );
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Frame-Options", "DENY");
    headers.set("Referrer-Policy", "no-referrer");
    return new Response(response.body, { status: response.status, headers });
  }
  const path = url.pathname.replace(/^\/sniffin\/api\/?/, "");
  if (!env.SNIFFIN_KV) return json({ error: "KV not configured" }, 503);
  if (!sameOrigin(req))
    return json({ error: "Cross-origin request blocked" }, 403);
  if (!env.ADMIN_PIN || !env.SESSION_SECRET)
    return json({ error: "Admin secrets not configured" }, 503);
  try {
    if (path === "state" && req.method === "GET") return json(await state(env));
    if (path === "character" && req.method === "GET")
      return json(await character(req, env, ctx));
    if (path === "progress" && req.method === "GET")
      return json({ events: await activity(env) });
    if (path === "hunt" && req.method === "POST") {
      if (!(await authorized(req, env)))
        return json({ error: "Not authorized" }, 403);
      const body = await req.text();
      if (body.length > 3000) return json({ error: "Payload too large" }, 413);
      let input;
      try {
        input = JSON.parse(body);
      } catch {
        return json({ error: "Malformed JSON" }, 400);
      }
      try {
        return json(await changeHunt(input, req, env, ctx));
      } catch (e) {
        return json({ error: e.message }, e.status || 400);
      }
    }
    if (path === "state" && req.method === "PUT") {
      if (!(await authorized(req, env)))
        return json({ error: "Not authorized" }, 403);
      if (Number(req.headers.get("Content-Length") || 0) > 200000)
        return json({ error: "Payload too large" }, 413);
      const raw = await req.text();
      if (raw.length > 200000) return json({ error: "Payload too large" }, 413);
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return json({ error: "Malformed JSON" }, 400);
      }
      let next;
      try {
        next = validate(parsed);
      } catch (e) {
        return json({ error: e.message }, 400);
      }
      if (
        !Array.isArray(parsed.milestones || []) ||
        (parsed.milestones || []).length > 100
      )
        return json({ error: "Invalid milestones" }, 400);
      try {
        next.milestones = (parsed.milestones || []).map((r) => {
          if (
            !r ||
            typeof r !== "object" ||
            (r.petId && !ID_RE.test(r.petId)) ||
            (r.kc !== undefined &&
              r.kc !== null &&
              (!Number.isInteger(r.kc) || r.kc < 0)) ||
            (r.date && !/^\d{4}-\d{2}-\d{2}$/.test(r.date))
          )
            throw Error("Invalid milestone");
          return {
            petId: r.petId || null,
            type: r.type === "achievement" ? "achievement" : "drop",
            title: String(r.title || "").slice(0, 100),
            date: r.date || null,
            kc: r.kc ?? null,
            note: String(r.note || "").slice(0, 300),
          };
        });
      } catch (e) {
        return json({ error: e.message }, 400);
      }
      const previous = await state(env);
      if (
        parsed.target !== previous.target ||
        Number(parsed.startKC) !== Number(previous.startKC)
      )
        return json(
          { error: "Use chase controls to change target or starting KC" },
          409,
        );
      if (
        parsed.updatedAt !== undefined &&
        Number(parsed.updatedAt) !== Number(previous.updatedAt || 0)
      )
        return json(
          { error: "State changed. Reopen the editor before saving." },
          409,
        );
      next.hunt = previous.hunt || null;
      next.hunts = previous.hunts || [];
      next.updatedAt = Math.max(
        Date.now(),
        Number(previous.updatedAt || 0) + 1,
      );
      await env.SNIFFIN_KV.put("site-state", JSON.stringify(next));
      return json(next);
    }
    if (path === "auth/status" && req.method === "GET")
      return json({
        allowed: owner(req),
        authenticated: await authorized(req, env),
      });
    if (path === "auth/login" && req.method === "POST") {
      if (!owner(req)) return json({ error: "Owner IP only" }, 403);
      const ip = getIP(req);
      const attemptsKey = "login:" + ip;
      const count = Number((await env.SNIFFIN_KV.get(attemptsKey)) || 0);
      if (count >= 6)
        return json(
          { error: "Too many failed attempts. Retry after 15 minutes." },
          429,
        );
      const body = await req.json().catch(() => ({}));
      if (!safeEqual(String(body.pin || ""), env.ADMIN_PIN)) {
        await env.SNIFFIN_KV.put(attemptsKey, String(count + 1), {
          expirationTtl: 900,
        });
        return json({ error: "Wrong PIN" }, 401);
      }
      await env.SNIFFIN_KV.delete(attemptsKey);
      const expiry = String(Date.now() + 45 * 60 * 1000),
        mac = await sign(env.SESSION_SECRET, expiry + "|" + ip);
      const response = json({ ok: true });
      response.headers.append(
        "Set-Cookie",
        `sniffin_admin=${expiry}.${mac}; Path=/sniffin/api/; Max-Age=2700; Secure; HttpOnly; SameSite=Strict`,
      );
      return response;
    }
    if (path === "auth/logout" && req.method === "POST") {
      const response = json({ ok: true });
      response.headers.append(
        "Set-Cookie",
        "sniffin_admin=; Path=/sniffin/api/; Max-Age=0; Secure; HttpOnly; SameSite=Strict",
      );
      return response;
    }
    if (path === "temple" && req.method === "GET") return temple(req, env, ctx);
    if (path === "wom" && req.method === "GET") {
      const username = (url.searchParams.get("username") || RSN).trim();
      if (username.toLowerCase() !== RSN)
        return json({ error: "This tracker is configured for s niffin" }, 400);
      const key = "wom:" + RSN;
      const cached = await env.SNIFFIN_KV.get(key, "json");
      if (
        cached &&
        Date.now() - cached.time <
          (url.searchParams.has("refresh") ? 60000 : 4 * 60 * 1000)
      )
        return json({ ...cached.data, fetchedAt: cached.time, stale: false });
      try {
        const upstream = await fetch(
          "https://api.wiseoldman.net/v2/players/" + encodeURIComponent(RSN),
          {
            headers: {
              "User-Agent": "PeakPvM-Sniffin/1.0 (peakpvm.com)",
              Accept: "application/json",
            },
            signal: AbortSignal.timeout(12000),
            cf: { cacheTtl: 180, cacheEverything: true },
          },
        );
        if (!upstream.ok)
          throw Error("Wise Old Man returned " + upstream.status);
        const data = await upstream.json();
        if (
          String(data.displayName || data.username || "").toLowerCase() !==
            RSN ||
          !data.latestSnapshot?.data?.bosses
        )
          throw Error("Unexpected WOM account or snapshot");
        const compact = {
            latestSnapshot: data.latestSnapshot,
            displayName: data.displayName,
            updatedAt: data.updatedAt,
          },
          time = Date.now();
        ctx.waitUntil(
          env.SNIFFIN_KV.put(key, JSON.stringify({ time, data: compact }), {
            expirationTtl: 86400,
          }),
        );
        return json({ ...compact, fetchedAt: time, stale: false });
      } catch (error) {
        if (cached)
          return json({ ...cached.data, fetchedAt: cached.time, stale: true });
        return json({ error: "Wise Old Man unavailable for s niffin" }, 503);
      }
    }
    return json({ error: "Not found" }, 404);
  } catch (err) {
    console.error(
      JSON.stringify({ event: "request-failed", path, message: err.message }),
    );
    return json({ error: "Server error; retry shortly" }, 500);
  }
}

async function temple(req, env, ctx) {
  const key = "temple:s niffin",
    cached = await env.SNIFFIN_KV.get(key, "json");
  // Seed durable confirmations when upgrading an existing successful cache.
  if (
    cached?.collection?.data?.items &&
    !Array.isArray(cached.confirmedPetIds)
  ) {
    cached.confirmedPetIds = await observePets(cached.collection, cached, env);
    await env.SNIFFIN_KV.put(key, JSON.stringify(cached), {
      expirationTtl: 86400,
    });
  }
  const age = cached ? Date.now() - cached.fetchedAt : Infinity;
  if (
    cached &&
    age < (new URL(req.url).searchParams.has("refresh") ? 60000 : 300000)
  )
    return json(cached);
  const retryAt = Number(
    (await env.SNIFFIN_KV.get("temple-retry:" + RSN)) || 0,
  );
  if (retryAt > Date.now())
    return cached
      ? json({ ...cached, stale: true })
      : json({ error: "Temple temporarily unavailable; retry shortly" }, 503);
  try {
    const get = async (path) => {
      const res = await fetch("https://templeosrs.com/api/" + path, {
        headers: {
          Accept: "application/json",
          "User-Agent": "PeakPvM-Sniffin/1.0 (peakpvm.com)",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw Error("Temple returned " + res.status);
      return res.json();
    };
    const [collection, count] = await Promise.allSettled([
      get(
        "collection-log/player_collection_log.php?player=s%20niffin&categories=all_pets&includenames=1&includemissingitems=1&onlyitems=1",
      ),
      get("pets/pet_count.php?player=s%20niffin"),
    ]);
    const log = collection.status === "fulfilled" ? collection.value : null;
    if (
      !log?.data?.last_checked ||
      !Array.isArray(log.data.items) ||
      String(
        log.data.player_name_with_capitalization || log.data.player || "",
      ).toLowerCase() !== RSN
    )
      throw Error("Temple collection log is not synced for this account");
    const result = {
      collection: log,
      count: count.status === "fulfilled" ? count.value : null,
      fetchedAt: Date.now(),
      stale: false,
    };
    result.confirmedPetIds = await observePets(log, cached, env);
    await env.SNIFFIN_KV.delete("temple-retry:" + RSN);
    ctx.waitUntil(
      env.SNIFFIN_KV.put(key, JSON.stringify(result), { expirationTtl: 86400 }),
    );
    return json(result);
  } catch (error) {
    await env.SNIFFIN_KV.put(
      "temple-retry:" + RSN,
      String(Date.now() + 60000),
      { expirationTtl: 60 },
    );
    if (cached) return json({ ...cached, stale: true });
    return json(
      {
        error:
          "Temple collection log unavailable. Sync it using the RuneLite Collection Log plugin.",
      },
      503,
    );
  }
}
const ITEM_PETS = {
  11995: "chaos-elemental",
  12643: "pet-dagannoth-supreme",
  12644: "pet-dagannoth-prime",
  12645: "pet-dagannoth-rex",
  12646: "baby-mole",
  12647: "kq",
  12648: "thermy",
  12649: "kree",
  12650: "graardor",
  12651: "zilyana",
  12652: "kril",
  12653: "kbd",
  12655: "kraken",
  12703: "pet-penance-queen",
  12816: "corp",
  12921: "snakeling",
  13071: "chompy",
  13177: "venenatis",
  13178: "callisto",
  13179: "vetion",
  13181: "scorpia",
  13225: "jad",
  13247: "hellpuppy",
  13262: "sire",
  13320: "heron",
  13321: "rock-golem",
  13322: "beaver",
  13324: "chinchompa",
  19730: "bloodhound",
  20659: "squirrel",
  20661: "tangleroot",
  20663: "rocky",
  20665: "rift",
  20693: "phoenix",
  20851: "cox",
  21273: "skotos",
  21291: "zuk",
  21509: "herbi",
  21748: "noon",
  21992: "vorki",
  22473: "tob",
  22746: "hydra",
  23495: "sraracha",
  23757: "goa",
  23760: "zalcano",
  24491: "nightmare",
  25348: "lil-creator",
  25602: "tempoross",
  26348: "nex",
  26901: "guardians",
  27352: "toa",
  27590: "muspah",
  28246: "wisp",
  28248: "butch",
  28250: "baron",
  28252: "leviathan",
  28801: "scurry",
  28960: "smol-heredit",
  28962: "quetzin",
  29836: "nid",
  30152: "huey",
  30154: "moons",
  30622: "bran",
  30888: "yami",
  31130: "dom",
  31283: "soup",
  31285: "giant-pet",
  33124: "beef",
  33642: "maggot-marquess",
  34040: "mr-mcgroot",
  34042: "aggy",
  34646: "orion",
};
// Progress is separate from curated owner state. IDs deduplicate repeated reads.
async function activity(env) {
  return (await env.SNIFFIN_KV.get("hunt-activity", "json")) || [];
}
async function recordEvent(env, event) {
  const events = await activity(env);
  if (events.some((e) => e.id === event.id)) return;
  await env.SNIFFIN_KV.put(
    "hunt-activity",
    JSON.stringify(
      [event, ...events]
        .sort((a, b) => b.recordedAt - a.recordedAt)
        .slice(0, 24),
    ),
  );
}
const validKC = (n) => Number.isInteger(n) && n >= 0 && n <= 1000000000;
function currentHunt(saved) {
  return (
    saved.hunt || {
      id: "legacy-" + saved.target,
      petId: saved.target,
      status: "active",
      startKC: saved.startKC ?? null,
      startedAt: null,
    }
  );
}
function normalizeCharacter(payload) {
  const d = payload?.data,
    info = d?.info;
  if (
    !info ||
    String(
      info.player_name_with_capitalization || info.Username || "",
    ).toLowerCase() !== RSN
  )
    throw Error("Temple returned a different player");
  const numeric = (value) =>
    typeof value === "number" && Number.isFinite(value) && value >= 0
      ? value
      : null;
  const ehpKey = info.Primary_ehp,
    ehbKey = info.Primary_ehb;
  const metrics = {};
  for (const [metric, field] of Object.entries(TEMPLE_BOSSES)) {
    const n = numeric(d[field]);
    if (n !== null && n > 0 && Number.isInteger(n)) metrics[metric] = n;
  }
  const snapshotAt = d.date || info["Last checked"];
  if (
    typeof snapshotAt !== "string" ||
    !Number.isFinite(Date.parse(snapshotAt.replace(" ", "T") + "Z"))
  )
    throw Error("Temple snapshot date missing");
  return {
    username: RSN,
    metrics,
    ehp: typeof ehpKey === "string" ? numeric(d[ehpKey]) : null,
    ehb: typeof ehbKey === "string" ? numeric(d[ehbKey]) : null,
    snapshotAt,
    fetchedAt: Date.now(),
    stale: false,
  };
}
async function character(req, env, ctx) {
  const key = "character:" + RSN,
    cached = await env.SNIFFIN_KV.get(key, "json"),
    now = Date.now();
  const window = new URL(req.url).searchParams.has("refresh") ? 60000 : 300000;
  if (cached && (now - cached.fetchedAt < window || cached.retryAt > now))
    return cached;
  try {
    const response = await fetch(
      "https://templeosrs.com/api/player_stats.php?player=s%20niffin&bosses=1",
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "PeakPvM-Sniffin/2.0 (peakpvm.com)",
        },
        signal: AbortSignal.timeout(12000),
      },
    );
    if (!response.ok) throw Error("Temple stats returned " + response.status);
    const result = normalizeCharacter(await response.json());
    await env.SNIFFIN_KV.put(key, JSON.stringify(result), {
      expirationTtl: 86400,
    });
    await observeKC(result, env);
    return result;
  } catch (error) {
    const result = cached
      ? { ...cached, stale: true, retryAt: now + 60000 }
      : {
          username: RSN,
          metrics: {},
          ehp: null,
          ehb: null,
          unavailable: true,
          stale: true,
          fetchedAt: now,
          retryAt: now + 60000,
        };
    await env.SNIFFIN_KV.put(key, JSON.stringify(result), {
      expirationTtl: 86400,
    });
    return result;
  }
}
async function observeKC(snapshot, env) {
  const saved = await state(env),
    hunt = currentHunt(saved),
    metric = PET_METRICS[hunt.petId],
    kc = snapshot.metrics[metric];
  if (
    hunt.status !== "active" ||
    !metric ||
    !validKC(kc) ||
    !validKC(hunt.startKC) ||
    kc < hunt.startKC
  )
    return;
  const key = "hunt-progress:" + hunt.id,
    previous = await env.SNIFFIN_KV.get(key, "json");
  const milestone = Math.floor((kc - hunt.startKC) / 500) * 500;
  if (
    previous &&
    kc > previous.kc &&
    milestone > previous.milestone &&
    milestone > 0
  )
    await recordEvent(env, {
      id: "kc:" + hunt.id + ":" + milestone,
      type: "kc",
      petId: hunt.petId,
      kc,
      gained: milestone,
      recordedAt: Date.now(),
      sourceAt: snapshot.snapshotAt,
    });
  await env.SNIFFIN_KV.put(key, JSON.stringify({ kc, milestone }));
}
async function observePets(log, oldCache, env) {
  const key = "temple-confirmed-pets";
  const prior = await env.SNIFFIN_KV.get(key, "json");
  const positives = (rows) =>
    (rows || [])
      .filter((i) => Number(i.count) > 0 && ITEM_PETS[i.id])
      .map((i) => Number(i.id));
  const baseline = prior?.ids || positives(oldCache?.collection?.data?.items),
    current = positives(log.data.items);
  const ids = [...new Set([...baseline, ...current])];
  if (prior || oldCache?.collection)
    for (const id of current.filter((id) => !baseline.includes(id)))
      await recordEvent(env, {
        id: "pet:" + id,
        type: "pet",
        petId: ITEM_PETS[id],
        recordedAt: Date.now(),
        sourceAt: log.data.last_checked,
      });
  await env.SNIFFIN_KV.put(key, JSON.stringify({ ids }));
  return ids;
}
async function changeHunt(input, req, env, ctx) {
  const saved = await state(env),
    hunt = currentHunt(saved),
    now = Date.now();
  if (Number(input.expectedUpdatedAt || 0) !== Number(saved.updatedAt || 0)) {
    const error = Error(
      "State changed. Reopen the editor before changing the hunt.",
    );
    error.status = 409;
    throw error;
  }
  if (!["start", "end", "complete"].includes(input.action))
    throw Error("Unknown chase action");
  if (input.huntId !== hunt.id) {
    const error = Error("This hunt has changed. Reopen the editor.");
    error.status = 409;
    throw error;
  }
  const next = structuredClone(saved);
  next.hunts = Array.isArray(saved.hunts) ? saved.hunts.slice() : [];
  const snapshot = await character(req, env, ctx);
  const fallback = await env.SNIFFIN_KV.get("wom:" + RSN, "json");
  const getKC = (id) => {
    const n = snapshot.metrics?.[PET_METRICS[id]];
    if (validKC(n)) return n;
    const wom = fallback?.data?.latestSnapshot?.data?.bosses?.[PET_METRICS[id]];
    if (validKC(wom?.kills) && !(wom.kills === 0 && wom.rank === -1))
      return wom.kills;
    return validKC(saved.manualKC?.[id]) ? saved.manualKC[id] : null;
  };
  function close(status) {
    if (hunt.status !== "active")
      throw Error("There is no active hunt to close");
    const acquisitionKC = input.acquisitionKC ?? null;
    if (
      acquisitionKC !== null &&
      (!validKC(acquisitionKC) ||
        (validKC(hunt.startKC) && acquisitionKC < hunt.startKC))
    )
      throw Error("Acquisition KC must be at least the recorded starting KC");
    if (
      input.acquisitionDate &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(input.acquisitionDate) ||
        new Date(input.acquisitionDate + "T00:00:00Z")
          .toISOString()
          .slice(0, 10) !== input.acquisitionDate)
    )
      throw Error("Invalid acquisition date");
    const record = {
      ...hunt,
      status,
      endedAt: now,
      endKC: getKC(hunt.petId),
      acquisitionKC: status === "completed" ? acquisitionKC : null,
      acquisitionDate:
        status === "completed" ? input.acquisitionDate || null : null,
      note: String(input.note || saved.huntNote || "").slice(0, 300),
    };
    if (!next.hunts.some((h) => h.id === record.id)) next.hunts.push(record);
    next.hunts = next.hunts.slice(-100);
    next.hunt = record;
    if (status === "completed") {
      next.owned = {
        ...next.owned,
        [hunt.petId]: {
          ...next.owned?.[hunt.petId],
          kc: acquisitionKC ?? next.owned?.[hunt.petId]?.kc ?? null,
          note: record.note,
        },
      };
    }
    return record;
  }
  const newTarget =
    input.action === "start"
      ? input.petId
      : input.action === "complete"
        ? input.nextPetId
        : null;
  if (
    (input.action === "start" && !newTarget) ||
    (newTarget && !Object.hasOwn(PET_METRICS, newTarget))
  )
    throw Error("Unknown target pet");
  let baseline = null;
  if (newTarget) {
    baseline =
      input.startKC === null || input.startKC === undefined
        ? getKC(newTarget)
        : input.startKC;
    if (baseline !== null && !validKC(baseline))
      throw Error("Invalid starting KC");
  }
  let closed;
  if (input.action === "end") closed = close("ended");
  if (input.action === "complete") closed = close("completed");
  if (input.action === "start" && hunt.status === "active") close("ended");
  if (newTarget) {
    next.hunt = {
      id: crypto.randomUUID(),
      petId: newTarget,
      status: "active",
      startKC: baseline,
      startedAt: now,
    };
    next.target = newTarget;
    next.startKC = baseline ?? 0;
    next.huntNote = String(input.note || "").slice(0, 140);
  }
  next.updatedAt = Math.max(now, Number(saved.updatedAt || 0) + 1);
  await env.SNIFFIN_KV.put("site-state", JSON.stringify(next));
  if (newTarget) {
    const kc = getKC(newTarget);
    if (kc !== null)
      await env.SNIFFIN_KV.put(
        "hunt-progress:" + next.hunt.id,
        JSON.stringify({
          kc,
          milestone: validKC(baseline)
            ? Math.floor(Math.max(0, kc - baseline) / 500) * 500
            : 0,
        }),
      );
  }
  if (closed?.status === "completed")
    await recordEvent(env, {
      id: "complete:" + closed.id,
      type: "completed",
      petId: closed.petId,
      kc: closed.acquisitionKC,
      recordedAt: now,
      acquisitionDate: closed.acquisitionDate,
    });
  return next;
}

export default {
  async fetch(req, env, ctx) {
    const origin = req.headers.get("Origin");
    if (req.method === "OPTIONS") {
      if (!PUBLIC_ORIGINS.includes(origin))
        return json({ error: "Cross-origin request blocked" }, 403);
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          Vary: "Origin",
        },
      });
    }
    const response = await handle(req, env, ctx);
    if (!PUBLIC_ORIGINS.includes(origin)) return response;
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Vary", "Origin");
    return new Response(response.body, { status: response.status, headers });
  },
};
