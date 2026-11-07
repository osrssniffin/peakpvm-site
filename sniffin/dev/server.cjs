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
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
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
      if (!["state", "wom", "temple"].includes(route)) {
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
