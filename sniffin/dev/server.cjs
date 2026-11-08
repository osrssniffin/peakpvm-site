// Dependency-free preview. Public read-only API proxy; no owner-console proxy.
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path");
const root = path.resolve(__dirname, "../..");
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};
const previewData = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixture.json"), "utf8"),
);
const previewKV = new Map([["site-state", JSON.stringify(previewData.state)]]);
const previewEnv = {
  ADMIN_PIN: "123456",
  SESSION_SECRET: "loopback-only-fixture-session",
  SNIFFIN_KV: {
    async get(k, t) {
      const value = previewKV.get(k);
      return t === "json" && value ? JSON.parse(value) : value || null;
    },
    async put(k, v) {
      previewKV.set(k, v);
    },
    async delete(k) {
      previewKV.delete(k);
    },
  },
};
const previewStats = {
  data: {
    info: { Username: "s niffin", Primary_ehp: "Ehp", Primary_ehb: "Ehb" },
    date: "2026-01-01 12:00:00",
    Ehp: previewData.character.ehp,
    Ehb: previewData.character.ehb,
    Sarachnis: 590,
    "Giant Mole": 120,
    Vorkath: 2500,
    Kraken: 3000,
  },
};
const previewWorkerSource =
  "const PREVIEW_STATS=" +
  JSON.stringify(previewStats) +
  ";const PREVIEW_TEMPLE=" +
  JSON.stringify(previewData.temple) +
  ";const PREVIEW_WOM=" +
  JSON.stringify(previewData.wom) +
  ';const fetch=async url=>Response.json(url.includes("player_stats.php")?PREVIEW_STATS:url.includes("player_collection_log.php")?PREVIEW_TEMPLE.collection:url.includes("pet_count.php")?{error:{message:"Fixture has no rank"}}:PREVIEW_WOM);\n' +
  fs.readFileSync(path.join(__dirname, "../worker/index.js"), "utf8");
const previewWorker = import(
  "data:text/javascript;base64," +
    Buffer.from(previewWorkerSource).toString("base64")
);
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname.startsWith("/sniffin/dev-api/")) {
      if (!["localhost:4173", "127.0.0.1:4173"].includes(req.headers.host)) {
        res.writeHead(403).end();
        return;
      }
      let body = "";
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 30000) {
          res.writeHead(413).end();
          return;
        }
      }
      const headers = new Headers();
      for (const name of ["origin", "cookie", "content-type"])
        if (req.headers[name]) headers.set(name, req.headers[name]);
      headers.set("CF-Connecting-IP", "47.12.27.148");
      const input = new Request(
        "http://" +
          req.headers.host +
          url.pathname.replace("/sniffin/dev-api/", "/sniffin/api/") +
          url.search,
        {
          method: req.method,
          headers,
          ...(!["GET", "HEAD"].includes(req.method) ? { body } : {}),
        },
      );
      const pending = [];
      const result = await (
        await previewWorker
      ).default.fetch(input, previewEnv, {
        waitUntil(p) {
          pending.push(p);
        },
      });
      await Promise.all(pending);
      res.statusCode = result.status;
      for (const [name, value] of result.headers)
        res.setHeader(
          name,
          name === "set-cookie"
            ? value
                .replace("; Secure", "")
                .replace("Path=/sniffin/api/", "Path=/sniffin/dev-api/")
            : value,
        );
      res.end(await result.text());
      return;
    }
    if (url.pathname.startsWith("/sniffin/api/")) {
      if (req.method !== "GET") {
        res.writeHead(403).end();
        return;
      }
      const route = url.pathname.slice("/sniffin/api/".length);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      if (route === "auth/status") {
        res.end('{"allowed":false,"authenticated":false}');
        return;
      }
      if (
        !["state", "wom", "temple", "character", "progress"].includes(route)
      ) {
        res.writeHead(404).end("{}");
        return;
      }
      try {
        const remote = await fetch(
          "https://peakpvm-sniffin-api.bells-pvm.workers.dev/sniffin/api/" +
            route +
            (route === "wom" ? "?username=s%20niffin" : ""),
          { signal: AbortSignal.timeout(18000) },
        );
        res.writeHead(remote.status);
        res.end(await remote.text());
      } catch {
        res.writeHead(503).end('{"error":"Public API unavailable"}');
      }
      return;
    }
    let file = path.resolve(root, "." + decodeURIComponent(url.pathname));
    if (file !== root && !file.startsWith(root + path.sep)) {
      res.writeHead(403).end();
      return;
    }
    if (fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
    res.writeHead(200, {
      "Content-Type": types[path.extname(file)] || "text/plain",
      "Cache-Control": "no-store",
    });
    fs.createReadStream(file).pipe(res);
  } catch {
    res.writeHead(404).end("Not found");
  }
});
server.listen(4173, "127.0.0.1", () =>
  console.log(
    "Preview: http://localhost:4173/sniffin/\nOffline fixture: http://localhost:4173/sniffin/?mock=1\nOffline failure: http://localhost:4173/sniffin/?mock=1&scenario=offline",
  ),
);
