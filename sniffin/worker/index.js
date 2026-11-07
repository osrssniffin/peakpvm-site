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
    owned[k] = { kc: n };
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
    ? data.notes
        .slice(-30)
        .map((n) => ({
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
    if (path === "state" && req.method === "PUT") {
      if (!(await authorized(req, env)))
        return json({ error: "Not authorized" }, 403);
      if (Number(req.headers.get("Content-Length") || 0) > 30000)
        return json({ error: "Payload too large" }, 413);
      const raw = await req.text();
      if (raw.length > 30000) return json({ error: "Payload too large" }, 413);
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
      next.updatedAt = Date.now();
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
  const age = cached ? Date.now() - cached.fetchedAt : Infinity;
  if (
    cached &&
    age < (new URL(req.url).searchParams.has("refresh") ? 60000 : 300000)
  )
    return json(cached);
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
    ctx.waitUntil(
      env.SNIFFIN_KV.put(key, JSON.stringify(result), { expirationTtl: 86400 }),
    );
    return json(result);
  } catch (error) {
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
