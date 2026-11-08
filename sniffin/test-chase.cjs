const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  path = require("node:path");
const root = __dirname,
  catalog = JSON.parse(
    fs.readFileSync(path.join(root, "catalog.json"), "utf8"),
  );
const minimalStats = {
  data: {
    info: {
      Username: "S Niffin",
      player_name_with_capitalization: "s niffin",
      Primary_ehp: "Ehp",
      Primary_ehb: "Ehb",
    },
    date: "2026-11-08 14:31:48",
    Ehp: 1404.4026,
    Ehb: 409.3358,
    Sarachnis: 590,
    "Giant Mole": 2211,
    Vorkath: 1172,
    Kraken: 1783,
    "Maggot King": 0,
  },
};
let stats = structuredClone(minimalStats),
  items = catalog.map((p, i) => ({ id: p.templeId, count: i < 2 ? 1 : 0 })),
  collectionFailure = false,
  statsFailure = false;
const kv = new Map(),
  env = {
    ADMIN_PIN: "test-only",
    SESSION_SECRET: "test-session-only",
    SNIFFIN_KV: {
      async get(k, t) {
        const v = kv.get(k);
        return t === "json" && v ? JSON.parse(v) : v || null;
      },
      async put(k, v) {
        kv.set(k, v);
      },
      async delete(k) {
        kv.delete(k);
      },
    },
  };
const pending = [],
  ctx = {
    waitUntil(p) {
      pending.push(p);
    },
  };
const originalFetch = global.fetch;
global.fetch = async (url) => {
  assert.ok(
    String(url).includes("s%20niffin"),
    "every upstream request uses the exact encoded account",
  );
  if (String(url).includes("player_stats.php"))
    return statsFailure
      ? new Response("rate limited", { status: 429 })
      : Response.json(stats);
  if (String(url).includes("player_collection_log.php"))
    return collectionFailure
      ? new Response("unavailable", { status: 503 })
      : Response.json({
          data: {
            player: "s niffin",
            last_checked: "2026-11-08 14:31:48",
            items,
          },
        });
  if (String(url).includes("pet_count.php"))
    return Response.json({
      error: { Code: "403", Message: "No players found." },
    });
  throw Error("Unexpected upstream URL");
};
(async () => {
  const worker = (
    await import(
      "data:text/javascript;base64," +
        Buffer.from(
          fs.readFileSync(path.join(root, "worker/index.js"), "utf8"),
        ).toString("base64")
    )
  ).default;
  const request = (
    route,
    {
      method = "GET",
      body,
      cookie,
      owner = true,
      origin = "https://backend.example",
    } = {},
  ) =>
    new Request("https://backend.example/sniffin/api/" + route, {
      method,
      headers: {
        Origin: origin,
        "CF-Connecting-IP": owner ? "47.12.27.148" : "1.2.3.4",
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const send = async (route, options) => {
    const response = await worker.fetch(request(route, options), env, ctx);
    await Promise.all(pending.splice(0));
    return response;
  };
  const get = async (route) => {
    const response = await send(route);
    assert.equal(response.status, 200);
    return response.json();
  };
  const first = await get("character");
  assert.equal(first.username, "s niffin");
  assert.equal(first.ehp, 1404.4026);
  assert.equal(first.ehb, 409.3358);
  assert.equal(first.metrics.sarachnis, 590);
  assert.equal(
    first.metrics.maggot_king,
    undefined,
    "unranked zeros remain unavailable",
  );
  kv.set(
    "temple:s niffin",
    JSON.stringify({
      collection: {
        data: {
          player: "s niffin",
          last_checked: "2026-11-08 14:31:48",
          items,
        },
      },
      fetchedAt: Date.now(),
      stale: false,
    }),
  );
  const migrated = await get("temple");
  assert.equal(
    migrated.confirmedPetIds.length,
    2,
    "an older cached collection seeds durable confirmations without another upstream call",
  );
  assert.equal(
    (await get("progress")).events.length,
    0,
    "initial snapshots do not invent historical activity",
  );
  assert.equal(
    (
      await send("hunt", {
        method: "POST",
        body: { action: "start" },
        owner: false,
      })
    ).status,
    403,
  );
  const login = await send("auth/login", {
    method: "POST",
    body: { pin: "test-only" },
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.get("Set-Cookie");
  let saved = await get("state");
  const act = async (action, extra = {}) => {
    const hunt = saved.hunt || { id: "legacy-" + saved.target };
    const response = await send("hunt", {
      method: "POST",
      cookie,
      body: {
        action,
        huntId: hunt.id,
        expectedUpdatedAt: saved.updatedAt || 0,
        ...extra,
      },
    });
    return response;
  };
  assert.equal((await act("start", { petId: "not-a-pet" })).status, 400);
  saved = await (
    await act("start", { petId: "sraracha", startKC: null })
  ).json();
  assert.equal(saved.hunt.status, "active");
  assert.equal(
    saved.hunt.startKC,
    590,
    "new baseline is retrieved from Temple",
  );
  assert.ok(saved.hunt.startedAt);
  const firstHuntId = saved.hunt.id;
  stats.data.Sarachnis = 1100;
  kv.delete("character:s niffin");
  await get("character");
  const kcEvents = (await get("progress")).events.filter(
    (e) => e.type === "kc",
  );
  assert.equal(kcEvents.length, 1);
  assert.equal(kcEvents[0].gained, 500);
  await get("character");
  assert.equal(
    (await get("progress")).events.filter((e) => e.type === "kc").length,
    1,
  );
  items = items.map((i) => (i.id === 23495 ? { ...i, count: 1 } : i));
  kv.delete("temple:s niffin");
  const newLog = await get("temple");
  assert.ok(newLog.confirmedPetIds.includes(23495));
  assert.equal(
    (await get("progress")).events.filter((e) => e.type === "pet").length,
    1,
  );
  kv.delete("temple:s niffin");
  await get("temple");
  assert.equal(
    (await get("progress")).events.filter((e) => e.type === "pet").length,
    1,
    "repeated syncs deduplicate new-pet events",
  );
  const cached = JSON.parse(kv.get("temple:s niffin"));
  cached.fetchedAt = Date.now() - 600000;
  kv.set("temple:s niffin", JSON.stringify(cached));
  collectionFailure = true;
  const outage = await get("temple");
  assert.equal(outage.stale, true);
  assert.ok(outage.confirmedPetIds.includes(23495));
  collectionFailure = false;
  const characterCached = JSON.parse(kv.get("character:s niffin"));
  characterCached.fetchedAt = Date.now() - 600000;
  kv.set("character:s niffin", JSON.stringify(characterCached));
  statsFailure = true;
  const staleStats = await get("character");
  assert.equal(staleStats.stale, true);
  assert.equal(staleStats.ehp, 1404.4026);
  statsFailure = false;
  kv.delete("character:s niffin");
  const wrong = structuredClone(stats);
  stats = {
    ...wrong,
    data: {
      ...wrong.data,
      info: {
        ...wrong.data.info,
        Username: "wrong",
        player_name_with_capitalization: "wrong",
      },
    },
  };
  const rejected = await get("character");
  assert.equal(rejected.unavailable, true);
  assert.deepEqual(rejected.metrics, {});
  stats = wrong;
  kv.delete("character:s niffin");
  await get("character");
  assert.equal(
    (await act("complete", { acquisitionKC: 100 })).status,
    400,
    "acquisition cannot predate the starting KC",
  );
  const completedResponse = await act("complete", {
    acquisitionKC: 1000,
    nextPetId: "vorki",
    note: "Owner-recorded drop",
  });
  assert.equal(completedResponse.status, 200);
  saved = await completedResponse.json();
  assert.equal(saved.owned.sraracha.kc, 1000);
  assert.equal(saved.hunt.petId, "vorki");
  assert.equal(saved.hunt.startKC, 1172);
  const completed = saved.hunts.find((h) => h.id === firstHuntId);
  assert.equal(completed.status, "completed");
  assert.equal(completed.acquisitionKC, 1000);
  assert.equal(
    completed.acquisitionDate,
    null,
    "completion time does not invent an acquisition date",
  );
  assert.equal(
    (
      await send("hunt", {
        method: "POST",
        cookie,
        body: {
          action: "complete",
          huntId: firstHuntId,
          expectedUpdatedAt: saved.updatedAt,
        },
      })
    ).status,
    409,
    "repeated completion cannot duplicate a hunt",
  );
  assert.equal(
    (
      await send("hunt", {
        method: "POST",
        cookie,
        origin: "https://peakpvm.com",
        body: { action: "end" },
      })
    ).status,
    403,
    "cross-origin writes stay blocked",
  );
  const general = await send("state", {
    method: "PUT",
    cookie,
    body: {
      ...saved,
      petNotes: { sraracha: "One actual recorded note" },
      hunt: { status: "completed" },
      hunts: [],
    },
  });
  assert.equal(general.status, 200);
  saved = await general.json();
  assert.equal(saved.hunt.petId, "vorki");
  assert.ok(saved.hunts.some((h) => h.id === firstHuntId));
  assert.equal(saved.petNotes.sraracha, "One actual recorded note");
  const ended = await act("end");
  assert.equal(ended.status, 200);
  saved = await ended.json();
  assert.equal(saved.hunt.status, "ended");
  assert.equal(
    saved.owned.vorki,
    undefined,
    "ending a hunt never infers ownership",
  );
  const restarted = await act("start", { petId: "kraken", startKC: 1700 });
  assert.equal(restarted.status, 200);
  saved = await restarted.json();
  saved = await (await act("complete", {})).json();
  assert.equal(
    saved.owned.kraken.kc,
    null,
    "unknown acquisition KC remains unknown",
  );
  assert.equal(saved.hunt.status, "completed");
  assert.equal(
    (await get("progress")).events.filter((e) => e.type === "completed").length,
    2,
  );
  console.log(
    "PASS: Temple primary stats and exact identity; unranked zeros; initial/changed/duplicate/failed pet syncs; significant KC events; rate-limit/stale/wrong-player fallback; protected hunt start/change/end/complete/next; preserved history and notes; unknown acquisition data; replay and cross-origin restrictions.",
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    global.fetch = originalFetch;
  });
