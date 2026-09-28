const SESSION_COOKIE = "peak_admin_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const LOGIN_WINDOW_SECONDS = 15 * 60;
const MAX_LOGIN_FAILURES = 8;
const CENTRAL_TZ = "America/Chicago";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return new Response("Not found", { status: 404 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: baseHeaders() });
    }

    try {
      if (url.pathname === "/api/health" && request.method === "GET") {
        return json({ ok: true, service: "peakpvm-analytics" });
      }

      if (url.pathname === "/api/track" && request.method === "POST") {
        return track(request, env);
      }

      if (url.pathname === "/api/login" && request.method === "POST") {
        return login(request, env);
      }

      if (url.pathname === "/api/logout" && request.method === "POST") {
        return json(
          { ok: true },
          200,
          { "Set-Cookie": clearSessionCookie() }
        );
      }

      if (url.pathname === "/api/analytics" && request.method === "GET") {
        const auth = await requireAdmin(request, env);
        if (!auth.ok) return auth.response;
        return analytics(request, env);
      }

      return json({ error: "Not found" }, 404);
    } catch (error) {
      console.error(error);
      return json({ error: "Internal server error" }, 500);
    }
  },
};

async function track(request, env) {
  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin)) {
    return json({ error: "Origin not allowed" }, 403);
  }

  const body = await readJson(request, 4096);
  if (!body) return json({ error: "Invalid request" }, 400);

  let path = cleanPath(body.path);
  if (!path || path.startsWith("/admin")) {
    return json({ ok: true, ignored: true });
  }

  const ua = request.headers.get("User-Agent") || "";
  if (looksLikeBot(ua)) {
    return json({ ok: true, ignored: true });
  }

  const visitorId = validOpaqueId(body.visitorId) ? body.visitorId : crypto.randomUUID();
  const sessionId = validOpaqueId(body.sessionId) ? body.sessionId : crypto.randomUUID();

  const visitorHash = await hmacHex(env.APP_SECRET, "visitor:" + visitorId);
  const sessionHash = await hmacHex(env.APP_SECRET, "session:" + sessionId);

  const now = Math.floor(Date.now() / 1000);
  const parts = centralParts(new Date(now * 1000));
  const referrer = cleanReferrer(body.referrer);
  const country = cleanText(request.cf?.country || "Unknown", 64);
  const colo = cleanText(request.cf?.colo || "Unknown", 32);
  const device = detectDevice(ua);
  const browser = detectBrowser(ua);
  const os = detectOS(ua);

  await env.DB.prepare(`
    INSERT INTO pageviews
      (ts, day, hour, path, referrer, visitor_hash, session_hash, country, colo, device, browser, os)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    now, parts.day, parts.hour, path, referrer, visitorHash, sessionHash,
    country, colo, device, browser, os
  ).run();

  return json({ ok: true });
}

async function login(request, env) {
  const origin = request.headers.get("Origin");
  if (origin && !isAllowedOrigin(origin)) {
    return json({ error: "Origin not allowed" }, 403);
  }

  const body = await readJson(request, 2048);
  if (!body) return json({ error: "Invalid request" }, 400);

  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const ipHash = await hmacHex(env.APP_SECRET, "login-ip:" + ip);
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - LOGIN_WINDOW_SECONDS;

  await env.DB.prepare(`DELETE FROM login_attempts WHERE ts < ?`)
    .bind(now - 86400)
    .run();

  const row = await env.DB.prepare(`
    SELECT COUNT(*) AS failures
    FROM login_attempts
    WHERE ip_hash = ? AND ts >= ?
  `).bind(ipHash, windowStart).first();

  if ((row?.failures || 0) >= MAX_LOGIN_FAILURES) {
    return json(
      { error: "Too many failed attempts. Try again later." },
      429,
      { "Retry-After": String(LOGIN_WINDOW_SECONDS) }
    );
  }

  const usernameOk = await constantTimeEqual(
    String(body.username || ""),
    "admin"
  );
  const passwordOk = await constantTimeEqual(
    String(body.password || ""),
    String(env.ADMIN_PASSWORD || "")
  );

  if (!usernameOk || !passwordOk) {
    await env.DB.prepare(`
      INSERT INTO login_attempts (ip_hash, ts) VALUES (?, ?)
    `).bind(ipHash, now).run();

    return json({ error: "Invalid username or password" }, 401);
  }

  await env.DB.prepare(`DELETE FROM login_attempts WHERE ip_hash = ?`)
    .bind(ipHash)
    .run();

  const token = await createSessionToken(env.APP_SECRET);
  return json(
    { ok: true },
    200,
    { "Set-Cookie": sessionCookie(token) }
  );
}

async function requireAdmin(request, env) {
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const token = cookies[SESSION_COOKIE];
  if (!token || !(await verifySessionToken(token, env.APP_SECRET))) {
    return {
      ok: false,
      response: json({ error: "Unauthorized" }, 401, {
        "Set-Cookie": clearSessionCookie(),
      }),
    };
  }
  return { ok: true };
}

async function analytics(request, env) {
  const url = new URL(request.url);
  const allowedRanges = new Set(["7", "30", "90", "365", "all"]);
  const range = allowedRanges.has(url.searchParams.get("range"))
    ? url.searchParams.get("range")
    : "30";

  const now = Math.floor(Date.now() / 1000);
  const today = centralParts(new Date()).day;
  const since = range === "all" ? 0 : now - Number(range) * 86400;

  const [
    summary,
    todaySummary,
    online,
    daily,
    topPages,
    referrers,
    countries,
    devices,
    browsers,
    operatingSystems,
    recent,
    hourly,
  ] = await Promise.all([
    env.DB.prepare(`
      SELECT
        COUNT(*) AS pageviews,
        COUNT(DISTINCT visitor_hash) AS visitors,
        COUNT(DISTINCT session_hash) AS sessions,
        MIN(ts) AS first_seen,
        MAX(ts) AS last_seen
      FROM pageviews
      WHERE ts >= ?
    `).bind(since).first(),

    env.DB.prepare(`
      SELECT
        COUNT(*) AS pageviews,
        COUNT(DISTINCT visitor_hash) AS visitors,
        COUNT(DISTINCT session_hash) AS sessions
      FROM pageviews
      WHERE day = ?
    `).bind(today).first(),

    env.DB.prepare(`
      SELECT COUNT(DISTINCT visitor_hash) AS visitors
      FROM pageviews
      WHERE ts >= ?
    `).bind(now - 300).first(),

    env.DB.prepare(`
      SELECT day,
             COUNT(*) AS pageviews,
             COUNT(DISTINCT visitor_hash) AS visitors,
             COUNT(DISTINCT session_hash) AS sessions
      FROM pageviews
      WHERE ts >= ?
      GROUP BY day
      ORDER BY day ASC
    `).bind(since).all(),

    env.DB.prepare(`
      SELECT path,
             COUNT(*) AS pageviews,
             COUNT(DISTINCT visitor_hash) AS visitors
      FROM pageviews
      WHERE ts >= ?
      GROUP BY path
      ORDER BY pageviews DESC
      LIMIT 15
    `).bind(since).all(),

    env.DB.prepare(`
      SELECT referrer,
             COUNT(*) AS pageviews
      FROM pageviews
      WHERE ts >= ? AND referrer <> ''
      GROUP BY referrer
      ORDER BY pageviews DESC
      LIMIT 12
    `).bind(since).all(),

    env.DB.prepare(`
      SELECT country,
             COUNT(*) AS pageviews,
             COUNT(DISTINCT visitor_hash) AS visitors
      FROM pageviews
      WHERE ts >= ?
      GROUP BY country
      ORDER BY pageviews DESC
      LIMIT 15
    `).bind(since).all(),

    env.DB.prepare(`
      SELECT device AS name, COUNT(*) AS pageviews
      FROM pageviews
      WHERE ts >= ?
      GROUP BY device
      ORDER BY pageviews DESC
    `).bind(since).all(),

    env.DB.prepare(`
      SELECT browser AS name, COUNT(*) AS pageviews
      FROM pageviews
      WHERE ts >= ?
      GROUP BY browser
      ORDER BY pageviews DESC
      LIMIT 10
    `).bind(since).all(),

    env.DB.prepare(`
      SELECT os AS name, COUNT(*) AS pageviews
      FROM pageviews
      WHERE ts >= ?
      GROUP BY os
      ORDER BY pageviews DESC
      LIMIT 10
    `).bind(since).all(),

    env.DB.prepare(`
      SELECT ts, path, referrer, country, device, browser, os
      FROM pageviews
      WHERE ts >= ?
      ORDER BY ts DESC
      LIMIT 50
    `).bind(since).all(),

    env.DB.prepare(`
      SELECT hour,
             COUNT(*) AS pageviews,
             COUNT(DISTINCT visitor_hash) AS visitors
      FROM pageviews
      WHERE day = ?
      GROUP BY hour
      ORDER BY hour ASC
    `).bind(today).all(),
  ]);

  return json({
    ok: true,
    generatedAt: now,
    timezone: CENTRAL_TZ,
    range,
    summary: normalizeRow(summary),
    today: normalizeRow(todaySummary),
    onlineNow: Number(online?.visitors || 0),
    daily: daily.results || [],
    topPages: topPages.results || [],
    referrers: referrers.results || [],
    countries: countries.results || [],
    devices: devices.results || [],
    browsers: browsers.results || [],
    operatingSystems: operatingSystems.results || [],
    recent: recent.results || [],
    hourly: hourly.results || [],
  });
}

function normalizeRow(row) {
  if (!row) return {};
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === "bigint" ? Number(v) : v;
  }
  return out;
}

function cleanPath(value) {
  try {
    let s = String(value || "/").trim();
    if (!s.startsWith("/")) s = "/" + s;
    s = s.split("#")[0].split("?")[0];
    return s.slice(0, 512) || "/";
  } catch {
    return "/";
  }
}

function cleanReferrer(value) {
  try {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const u = new URL(raw);
    if (u.hostname === "peakpvm.com" || u.hostname === "www.peakpvm.com") return "";
    return (u.hostname + u.pathname).slice(0, 512);
  } catch {
    return "";
  }
}

function cleanText(value, max) {
  return String(value || "").replace(/[^\p{L}\p{N} ._()/-]/gu, "").slice(0, max);
}

function validOpaqueId(value) {
  return typeof value === "string" &&
    value.length >= 16 &&
    value.length <= 128 &&
    /^[A-Za-z0-9._:-]+$/.test(value);
}

function looksLikeBot(ua) {
  return /bot|crawler|spider|slurp|bingpreview|facebookexternalhit|discordbot|curl|wget/i.test(ua);
}

function detectDevice(ua) {
  if (/tablet|ipad/i.test(ua)) return "Tablet";
  if (/mobi|android|iphone|ipod/i.test(ua)) return "Mobile";
  return "Desktop";
}

function detectBrowser(ua) {
  if (/Edg\//.test(ua)) return "Edge";
  if (/OPR\//.test(ua)) return "Opera";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/CriOS\//.test(ua)) return "Chrome iOS";
  if (/Chrome\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  return "Other";
}

function detectOS(ua) {
  if (/Windows NT/.test(ua)) return "Windows";
  if (/Android/.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/.test(ua)) return "iOS";
  if (/Mac OS X/.test(ua)) return "macOS";
  if (/Linux/.test(ua)) return "Linux";
  return "Other";
}

function centralParts(date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: CENTRAL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(date)
      .filter(p => p.type !== "literal")
      .map(p => [p.type, p.value])
  );

  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
  };
}

async function createSessionToken(secret) {
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({
    iat: now,
    exp: now + SESSION_TTL_SECONDS,
    nonce: crypto.randomUUID(),
  }));
  const signature = await hmacB64url(secret, payload);
  return `${payload}.${signature}`;
}

async function verifySessionToken(token, secret) {
  const [payload, signature, extra] = String(token || "").split(".");
  if (!payload || !signature || extra) return false;

  const expected = await hmacB64url(secret, payload);
  if (!(await constantTimeEqual(signature, expected))) return false;

  try {
    const data = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    const now = Math.floor(Date.now() / 1000);
    return Number.isFinite(data.exp) && data.exp > now && data.iat <= now + 60;
  } catch {
    return false;
  }
}

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(String(message))
  );
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function hmacB64url(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(secret)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(String(message))
  );
  return bytesToB64url(new Uint8Array(sig));
}

async function constantTimeEqual(a, b) {
  const ah = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(a))));
  const bh = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(b))));
  let diff = ah.length ^ bh.length;
  for (let i = 0; i < ah.length; i++) diff |= ah[i] ^ bh[i];
  return diff === 0;
}

function b64url(text) {
  return bytesToB64url(new TextEncoder().encode(text));
}

function bytesToB64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function b64urlDecode(value) {
  let s = value.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const binary = atob(s);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

function parseCookies(header) {
  const out = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  }
  return out;
}

function sessionCookie(token) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SECONDS}`;
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

async function readJson(request, maxBytes) {
  const length = Number(request.headers.get("Content-Length") || 0);
  if (length > maxBytes) return null;
  try {
    const text = await request.text();
    if (text.length > maxBytes) return null;
    return JSON.parse(text || "{}");
  } catch {
    return null;
  }
}

function isAllowedOrigin(origin) {
  return origin === "https://peakpvm.com" || origin === "https://www.peakpvm.com";
}

function baseHeaders(request) {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Access-Control-Allow-Origin": "https://peakpvm.com",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true"
  };
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...baseHeaders(), ...extraHeaders },
  });
}
