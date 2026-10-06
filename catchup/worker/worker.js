var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// worker.js
var STATUS_URL = "https://secure.runescape.com/m=news/game-status-information-centre?oldschool=1";
var HOME_URL = "https://oldschool.runescape.com/";
var NEWS_RSS_URL = "https://secure.runescape.com/m=news/latest_news.rss?oldschool=true";
var POLLS_URL = "https://oldschool.runescape.com/polls/";
var REDDIT = "https://www.reddit.com/r/2007scape";
var RUNELITE_COMMITS = "https://api.github.com/repos/runelite/runelite/commits?per_page=15";
var WIKI_MAPPING = "https://prices.runescape.wiki/api/v1/osrs/mapping";
var WIKI_5M = "https://prices.runescape.wiki/api/v1/osrs/5m";
var WIKI_1H = "https://prices.runescape.wiki/api/v1/osrs/1h";
var UA = "PeakPvM Catch Up/1.0 (https://peakpvm.com/catchup/)";
var CACHE_SECONDS = {
  jagex: 300,
  reddit: 600,
  youtube: 10800,
  market: 900,
  runelite: 1800
};
var worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/catchup") return new Response("Not found", { status: 404 });
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
    const [jagex, reddit, youtube, market, runelite] = await Promise.all([
      cachedPart(url.origin, "jagex-v6", CACHE_SECONDS.jagex, getJagex),
      cachedPart(url.origin, "reddit-v9", CACHE_SECONDS.reddit, getReddit),
      cachedPart(url.origin, "youtube-v5", CACHE_SECONDS.youtube, () => getYouTube(env)),
      cachedPart(url.origin, "market-v5", CACHE_SECONDS.market, getMarket),
      cachedPart(url.origin, "runelite-v5", CACHE_SECONDS.runelite, getRuneLite)
    ]);
    const body = JSON.stringify({ generatedAt: (/* @__PURE__ */ new Date()).toISOString(), jagex, reddit, youtube, market, runelite });
    return new Response(body, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=60, stale-while-revalidate=120",
        "access-control-allow-origin": request.headers.get("origin") || "*",
        "x-content-type-options": "nosniff"
      }
    });
  }
};
async function cachedPart(origin, key, ttl, loader) {
  const cache = caches.default;
  const cacheUrl = new URL(`/__catchup_cache/${key}`, origin).toString();
  const cacheKey = new Request(cacheUrl);
  try {
    const hit = await cache.match(cacheKey);
    if (hit) return await hit.json();
  } catch {}
  let value;
  try {
    value = await loader();
  } catch (error) {
    value = { error: cleanError(error) };
  }
  const response = new Response(JSON.stringify(value), {
    headers: { "content-type": "application/json", "cache-control": `public, max-age=${value.error ? Math.min(ttl, 60) : ttl}` }
  });
  try { await cache.put(cacheKey, response); } catch {}
  return value;
}
__name(cachedPart, "cachedPart");
async function getJagex() {
  const [homeResult, rssResult, statusResult, pollsResult] = await Promise.allSettled([
    fetchText(HOME_URL),
    fetchText(NEWS_RSS_URL),
    fetchText(STATUS_URL),
    fetchText(`${POLLS_URL}${(/* @__PURE__ */ new Date()).getUTCFullYear()}`)
  ]);
  const homeHtml = fulfilled(homeResult, "");
  const rss = fulfilled(rssResult, "");
  const statusHtml = fulfilled(statusResult, "");
  const pollsHtml = fulfilled(pollsResult, "");
  const playerCount = homeHtml ? numberMatch(homeHtml, /There are currently\s+([\d,]+)\s+people playing/i) : null;
  const news = rss ? parseRss(rss).slice(0, 5) : parseHomeNews(homeHtml).slice(0, 5);
  if (news.length) {
    try {
      const latestHtml = await fetchText(news[0].url);
      news[0].image = metaContent(latestHtml, "property", "og:image") || metaContent(latestHtml, "name", "twitter:image");
      news[0].tldr = summarizeArticle(latestHtml, news[0].description, news[0].title);
    } catch {
      news[0].tldr = [news[0].description].filter(Boolean);
    }
  }
  return {
    playerCount,
    status: statusHtml ? parseStatus(statusHtml) : { value: "UNKNOWN", notices: [], source: STATUS_URL },
    news,
    polls: pollsHtml ? parsePolls(pollsHtml) : []
  };
}
__name(getJagex, "getJagex");
function parseHomeNews(html) {
  if (!html) return [];
  const anchors = extractAnchors(html).filter((a) => /m=news\//i.test(a.href) || /secure\.runescape\.com\/m=news/i.test(a.href));
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const a of anchors) {
    const title = cleanSpace(a.text);
    if (!title || /^(news|read more|status|roadmap)$/i.test(title)) continue;
    const url = absoluteUrl(a.href, HOME_URL);
    if (seen.has(url)) continue;
    seen.add(url);
    out.push({ title, url, description: "", category: "Official", publishedAt: "" });
    if (out.length >= 5) break;
  }
  return out;
}
__name(parseHomeNews, "parseHomeNews");
function parseRss(xml) {
  const items = [...xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)];
  return items.map((match) => {
    const block = match[1];
    const title = xmlTag(block, "title");
    const url = xmlTag(block, "link");
    const description = stripHtml(xmlTag(block, "description"));
    const category = xmlTag(block, "category") || "Official";
    const published = xmlTag(block, "pubDate");
    return {
      title,
      url,
      description,
      category,
      publishedAt: validDate(published)
    };
  }).filter((x) => x.title && x.url);
}
__name(parseRss, "parseRss");
function parseStatus(html) {
  const text = stripHtml(html, true);
  const status = text.match(/Current Status:\s*(ONLINE|OFFLINE|DEGRADED|MAINTENANCE|UNKNOWN)/i)?.[1]?.toUpperCase() || "UNKNOWN";
  const lines = htmlLines(html);
  const states = /* @__PURE__ */ new Set(["ongoing", "investigating", "monitoring", "resolved", "scheduled", "maintenance"]);
  const notices = [];
  for (let i = 0; i < lines.length; i++) {
    const current = lines[i].toLowerCase();
    if (!states.has(current)) continue;
    const title = findPreviousTitle(lines, i);
    if (!title || /^current status/i.test(title)) continue;
    let date = "";
    const body = [];
    for (let j = i + 1; j < Math.min(lines.length, i + 14); j++) {
      const line = lines[j];
      const low = line.toLowerCase();
      if (states.has(low)) break;
      if (/^(page settings|click each box|issues & psas|other notices|general information|game updates|weekly maintenance)$/i.test(line)) break;
      if (line === "true" || line === "false") continue;
      if (!date && (/(?:january|february|march|april|may|june|july|august|september|october|november|december)/i.test(line) || /\bUTC\b/.test(line))) {
        date = line;
        continue;
      }
      if (line.length >= 30) body.push(line);
      if (body.join(" ").length > 420) break;
    }
    const key = `${title}|${current}`;
    if (!notices.some((x) => x.key === key)) {
      notices.push({ key, title, status: titleCase(current), date, body: truncate(body.join(" "), 460), url: STATUS_URL });
    }
  }
  return { value: status, notices: notices.slice(0, 12), source: STATUS_URL };
}
__name(parseStatus, "parseStatus");
function findPreviousTitle(lines, index) {
  for (let i = index - 1; i >= Math.max(0, index - 5); i--) {
    const line = lines[i];
    if (!line || line.length > 120) continue;
    if (/\bUTC\b|^\d{1,2}\s+[A-Za-z]+(?:\s+\d{4})?$/.test(line)) continue;
    return line;
  }
  return "";
}
__name(findPreviousTitle, "findPreviousTitle");
function parsePolls(html) {
  const year = String((/* @__PURE__ */ new Date()).getUTCFullYear());
  const anchors = extractAnchors(html).filter((a) => new RegExp(`/polls/${year}/\\d+$`).test(absoluteUrl(a.href, POLLS_URL)));
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const a of anchors) {
    const url = absoluteUrl(a.href, POLLS_URL);
    if (!a.text || seen.has(url) || /^view results$/i.test(a.text)) continue;
    seen.add(url);
    const nearby = stripHtml(a.raw, true);
    const dates = nearby.match(/\d{1,2}\s+[A-Za-z]+\s+\d{4}\s*-\s*\d{1,2}\s+[A-Za-z]+\s+\d{4}/)?.[0] || "";
    const times = [...a.raw.matchAll(/<time\b[^>]*datetime=["']([^"']+)["']/gi)].map(m => Date.parse(m[1]));
    const status = times.length === 2 && times.every(Number.isFinite)
      ? Date.now() < times[0] ? "Upcoming" : Date.now() >= times[1] ? "Ended" : "Live"
      : pollStatus(dates, /\bLIVE\b/i.test(nearby));
    const title = stripHtml(a.raw.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] || a.text);
    out.push({ title, url, dates, status });
    if (out.length >= 8) break;
  }
  return out;
}
__name(parsePolls, "parsePolls");
function pollStatus(range, pageSaysLive) {
  const end = range.split("-")[1]?.trim();
  const endDate = end ? /* @__PURE__ */ new Date(`${end} 23:59:59 UTC`) : null;
  if (endDate && Number.isFinite(endDate.getTime())) return endDate >= /* @__PURE__ */ new Date() ? "Live" : "Ended";
  return pageSaysLive ? "Live" : "Latest";
}
__name(pollStatus, "pollStatus");
function summarizeArticle(html, fallback, title) {
  const lines = htmlLines(html).filter((line) => {
    if (line.length < 55 || line.length > 360) return false;
    if (line === title || line === fallback) return false;
    if (/^(old school runescape|news|community|game updates|share this|the old school team)/i.test(line)) return false;
    if (/cookie|privacy policy|terms & conditions|copyright|manage cookies|in-game purchases/i.test(line)) return false;
    return true;
  });
  const picked = [];
  for (const line of lines) {
    const sentence = line.split(/(?<=[.!?])\s+/).find((x) => x.length >= 55 && x.length <= 240) || truncate(line, 220);
    if (!sentence) continue;
    const normalized = sentence.toLowerCase().replace(/[^a-z0-9 ]/g, "");
    if (picked.some((x) => similarity(normalized, x.normalized) > 0.72)) continue;
    picked.push({ text: sentence, normalized });
    if (picked.length === 4) break;
  }
  const result = picked.map((x) => x.text);
  if (!result.length && fallback) result.push(fallback);
  return result;
}
__name(summarizeArticle, "summarizeArticle");
function similarity(a, b) {
  const aa = new Set(a.split(/\s+/).filter(Boolean));
  const bb = new Set(b.split(/\s+/).filter(Boolean));
  if (!aa.size || !bb.size) return 0;
  let both = 0;
  aa.forEach((x) => {
    if (bb.has(x)) both++;
  });
  return both / Math.min(aa.size, bb.size);
}
__name(similarity, "similarity");
async function getReddit() {
  const [hotResult] = await Promise.allSettled([fetchText(`${REDDIT}/hot.rss`)]);
  await new Promise(resolve => setTimeout(resolve, 1200));
  const [topResult] = await Promise.allSettled([fetchText(`${REDDIT}/top/.rss?t=day`)]);
  const hotXml = fulfilled(hotResult, "");
  const topXml = fulfilled(topResult, "");
  const hot = parseRedditRss(hotXml);
  const top = parseRedditRss(topXml);
  const error = hot.length && top.length ? "" : "Reddit feed unavailable on this refresh.";
  return { hot, rising: [], top, jmods: [], error };
}
__name(getReddit, "getReddit");
function parseRedditRss(xml) {
  if (!xml) return [];
  const entries = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)];
  return entries.map((match) => {
    const block = match[1];
    const title = xmlTag(block, "title");
    const linkMatch = block.match(/<link\b[^>]*href=["']([^"']+)["']/i);
    const url = linkMatch ? decodeEntities(linkMatch[1]) : "";
    const authorTag = xmlTag(block, "author");
    const author = xmlTag(authorTag, "name").replace(/^\/u\//, "");
    const published = xmlTag(block, "published") || xmlTag(block, "updated");
    const id = xmlTag(block, "id") || url;
    return {
      id,
      title,
      author: author || "r/2007scape",
      score: null,
      comments: null,
      flair: "",
      createdAt: validDate(published),
      url,
      outboundUrl: "",
      upvoteRatio: 0
    };
  }).filter((p) => p.title && p.url);
}
__name(parseRedditRss, "parseRedditRss");
var YOUTUBE_CHANNELS = [
  { name: "Behemeth", id: "UC04tiq0fOxT_ALRWz-iaNow", key: "behemeth" },
  { name: "Old School RuneScape", id: "UC0j1MpbiTFHYrUjOTwifW_w", key: "official" },
  { name: "Settled", id: "UCs-w7E2HZWwXmjt9RTvBB_A" },
  { name: "SoloMission", id: "UC2W-gFz7UfNVdx0N1bgTB4A" },
  { name: "EVScape", id: "UCTP6kt3N8UyBNO6RANr6AIg" },
  { name: "Torvesta", id: "UCL9E5fndNunI68TNadI8J8w" },
  { name: "SoupRS", id: "UCnJutVTtn3ZXyapoGUmuRTA" }
];
async function getYouTube() {
  const settled = await Promise.allSettled(
    YOUTUBE_CHANNELS.map(async (ch) => {
      const xml = await fetchText(`https://www.youtube.com/feeds/videos.xml?channel_id=${ch.id}`);
      return { channel: ch, videos: parseYouTubeRss(xml, ch.name) };
    })
  );
  let behemeth = null;
  let official = null;
  const allVideos = [];
  const cutoff = Date.now() - 7 * 864e5;
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    const { channel, videos } = r.value;
    if (channel.key === "behemeth" && videos.length) behemeth = videos[0];
    if (channel.key === "official" && videos.length) official = videos[0];
    for (const v of videos) {
      const t = new Date(v.publishedAt).getTime();
      if (t >= cutoff || !Number.isFinite(t)) {
        allVideos.push(v);
      }
    }
  }
  allVideos.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  return { configured: true, videos: allVideos, behemeth, official };
}
__name(getYouTube, "getYouTube");
function parseYouTubeRss(xml, defaultChannel) {
  if (!xml) return [];
  const entries = [...xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)];
  return entries.map((match) => {
    const block = match[1];
    const videoId = xmlTag(block, "yt:videoId") || (xmlTag(block, "id") || "").replace(/^yt:video:/, "");
    const title = xmlTag(block, "title");
    const authorTag = xmlTag(block, "author");
    const channel = xmlTag(authorTag, "name") || defaultChannel;
    const published = xmlTag(block, "published") || xmlTag(block, "updated");
    const thumbMatch = block.match(/<media:thumbnail\b[^>]*url=["']([^"']+)["']/i);
    const thumbnail = thumbMatch ? decodeEntities(thumbMatch[1]) : videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "";
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    return {
      id: videoId,
      title,
      description: "",
      channel,
      publishedAt: validDate(published),
      thumbnail,
      views: 0,
      likes: 0,
      comments: 0,
      duration: "",
      url
    };
  }).filter((v) => v.id && v.title);
}
__name(parseYouTubeRss, "parseYouTubeRss");
async function getMarket() {
  const headers = { "user-agent": UA };
  const [mapping, five, hour] = await Promise.all([
    fetchJson(WIKI_MAPPING, headers),
    fetchJson(WIKI_5M, headers),
    fetchJson(WIKI_1H, headers)
  ]);
  const byId = new Map((mapping || []).map((x) => [String(x.id), x]));
  const movers = [];
  for (const [id, f] of Object.entries(five?.data || {})) {
    const h = hour?.data?.[id];
    const item = byId.get(id);
    if (!h || !item) continue;
    const p5 = midpoint(f.avgHighPrice, f.avgLowPrice);
    const p1 = midpoint(h.avgHighPrice, h.avgLowPrice);
    const volume = Number(h.highPriceVolume || 0) + Number(h.lowPriceVolume || 0);
    if (!p5 || !p1 || p1 < 1e3 || volume < 75 || p1 * volume < 5e6) continue;
    const change = (p5 - p1) / p1 * 100;
    if (!Number.isFinite(change) || Math.abs(change) > 80 || Math.abs(change) < 0.35) continue;
    movers.push({
      id: Number(id),
      name: item.name,
      price: Math.round(p5),
      hourVolume: volume,
      change,
      url: `https://oldschool.runescape.wiki/w/Special:Lookup?type=item&id=${id}`
    });
  }
  movers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));
  return { movers: movers.slice(0, 16) };
}
__name(getMarket, "getMarket");
function midpoint(high, low) {
  high = Number(high || 0);
  low = Number(low || 0);
  if (high && low) return (high + low) / 2;
  return high || low || 0;
}
__name(midpoint, "midpoint");
async function getRuneLite() {
  const payload = await fetchJson(RUNELITE_COMMITS, {
    "accept": "application/vnd.github+json",
    "user-agent": UA,
    "x-github-api-version": "2022-11-28"
  });
  const items = (payload || []).map((x) => ({
    message: cleanSpace(x.commit?.message || "").split("\n")[0],
    author: x.commit?.author?.name || x.author?.login || "RuneLite",
    date: x.commit?.author?.date || "",
    url: x.html_url || "https://github.com/runelite/runelite/commits/master/"
  })).filter((x) => x.message);
  return { items };
}
__name(getRuneLite, "getRuneLite");
async function fetchText(url, headers = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { "user-agent": UA, "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", ...headers } });
  if (!res.ok) throw new Error(`${new URL(url).hostname} returned ${res.status}`);
  return res.text();
}
__name(fetchText, "fetchText");
async function fetchJson(url, headers = {}) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10000), headers: { "user-agent": UA, "accept": "application/json", ...headers } });
  if (!res.ok) throw new Error(`${new URL(url).hostname} returned ${res.status}`);
  return res.json();
}
__name(fetchJson, "fetchJson");
function xmlTag(block, name) {
  const match = block.match(new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return decodeEntities((match?.[1] || "").replace(/^<!\[CDATA\[|\]\]>$/g, "").trim());
}
__name(xmlTag, "xmlTag");
function extractAnchors(html) {
  return [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({ href: decodeEntities(m[1]), text: stripHtml(m[2]), raw: m[0] }));
}
__name(extractAnchors, "extractAnchors");
function metaContent(html, attr, value) {
  const re1 = new RegExp(`<meta\\b[^>]*${attr}=["']${escapeRegExp(value)}["'][^>]*content=["']([^"']+)["'][^>]*>`, "i");
  const re2 = new RegExp(`<meta\\b[^>]*content=["']([^"']+)["'][^>]*${attr}=["']${escapeRegExp(value)}["'][^>]*>`, "i");
  return decodeEntities(html.match(re1)?.[1] || html.match(re2)?.[1] || "");
}
__name(metaContent, "metaContent");
function htmlLines(html) {
  const cleaned = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>/gi, "\n").replace(/<\/(?:p|div|li|h1|h2|h3|h4|h5|section|article|tr|td|button)>/gi, "\n").replace(/<[^>]+>/g, " ");
  return decodeEntities(cleaned).split(/\n+/).map(cleanSpace).filter(Boolean);
}
__name(htmlLines, "htmlLines");
function stripHtml(html, preserveBreaks = false) {
  const replaced = String(html || "").replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<br\s*\/?>/gi, preserveBreaks ? "\n" : " ").replace(/<\/(?:p|div|li|h\d)>/gi, preserveBreaks ? "\n" : " ").replace(/<[^>]+>/g, " ");
  return preserveBreaks ? decodeEntities(replaced).replace(/[ \t]+/g, " ").trim() : cleanSpace(decodeEntities(replaced));
}
__name(stripHtml, "stripHtml");
function decodeEntities(value) {
  return String(value || "").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/&nbsp;/gi, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
}
__name(decodeEntities, "decodeEntities");
function numberMatch(text, regex) {
  const n = text.match(regex)?.[1];
  return n ? Number(n.replace(/,/g, "")) : null;
}
__name(numberMatch, "numberMatch");
function validDate(value) {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : value;
}
__name(validDate, "validDate");
function absoluteUrl(value, base) {
  try {
    return new URL(value, base).toString();
  } catch {
    return base;
  }
}
__name(absoluteUrl, "absoluteUrl");
function fulfilled(result, fallback) {
  return result && result.status === "fulfilled" ? result.value : fallback;
}
__name(fulfilled, "fulfilled");
function cleanSpace(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
__name(cleanSpace, "cleanSpace");
function truncate(value, max) {
  const x = cleanSpace(value);
  return x.length > max ? `${x.slice(0, max - 1).trim()}\u2026` : x;
}
__name(truncate, "truncate");
function titleCase(value) {
  return String(value || "").replace(/\b\w/g, (c) => c.toUpperCase());
}
__name(titleCase, "titleCase");
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
__name(escapeRegExp, "escapeRegExp");
function cleanError(error) {
  return truncate(error?.message || String(error) || "Unknown error", 180);
}
__name(cleanError, "cleanError");
export {
  worker_default as default
};

