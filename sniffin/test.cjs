const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const root = __dirname,
  catalog = JSON.parse(
    fs.readFileSync(path.join(root, "catalog.json"), "utf8"),
  );
const nodes = new Map();
const element = (id) => {
  if (!nodes.has(id))
    nodes.set(id, {
      style: {},
      classList: {
        add() {},
        remove() {},
        toggle() {},
        contains() {
          return true;
        },
      },
      value: "",
      textContent: "",
      innerHTML: "",
      getAttribute() {
        return "";
      },
      setAttribute() {},
      addEventListener() {},
    });
  return nodes.get(id);
};
const storage = new Map(),
  requests = [];
const collection = {
  data: {
    player: "S Niffin",
    player_name_with_capitalization: "s niffin",
    last_checked: "2026-11-07 13:52:11",
    items: catalog.map((p, i) => ({
      id: p.templeId,
      count: i < 2 ? 1 : 0,
      date: i < 2 ? "2026-07-14 21:47:30" : null,
    })),
  },
};
const wom = {
  displayName: "s niffin",
  latestSnapshot: {
    createdAt: "2026-11-07T13:50:00Z",
    data: {
      bosses: {
        sarachnis: { kills: 590 },
        brutus: { kills: 2512 },
        kreearra: { kills: 11 },
        tztok_jad: { kills: 31 },
        tzkal_zuk: { kills: 1 },
        wintertodt: { kills: 600 },
      },
    },
  },
};
const manual = {
  username: "s niffin",
  target: "sraracha",
  startKC: 500,
  owned: { kraken: { kc: 17 } },
  manualKC: { herbi: 600 },
  rates: {},
  notes: [{ body: "Retained field note" }],
};
const context = vm.createContext({
  console,
  Date,
  Math,
  Number,
  String,
  Object,
  Array,
  JSON,
  URLSearchParams,
  AbortSignal,
  location: { origin: "https://peakpvm.com", search: "" },
  localStorage: {
    getItem: (k) => storage.get(k),
    setItem: (k, v) => storage.set(k, v),
  },
  setTimeout() {},
  document: {
    getElementById: element,
    querySelector: element,
    addEventListener() {},
  },
  fetch: async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      json: async () =>
        url.startsWith("./catalog")
          ? catalog
          : url.includes("/wom")
            ? wom
            : url.includes("/temple")
              ? { collection, fetchedAt: Date.now() }
              : manual,
    };
  },
});
vm.runInContext(
  fs.readFileSync(path.join(root, "menagerie.js"), "utf8"),
  context,
);
vm.runInContext(fs.readFileSync(path.join(root, "app.js"), "utf8"), context);
const run = (s) => vm.runInContext(s, context);
(async () => {
  assert.equal(catalog.length, 72);
  assert.equal(new Set(catalog.map((p) => p.templeId)).size, 72);
  for (const p of catalog) {
    const data = fs.readFileSync(path.join(root, p.image.replace("./", "")));
    assert.equal(data.subarray(1, 4).toString(), "PNG");
    assert.ok(data.readUInt32BE(16) > 50 && data.readUInt32BE(20) > 50);
    assert.ok(p.modelFile && !p.modelFile.includes("detail"));
  }
  await context.loadCatalog();
  await context.loadState();
  await context.syncPets();
  await context.syncKC();
  assert.ok(requests.some((r) => r.url.includes("username=s%20niffin")));
  assert.equal(element("targetKC").textContent, "590");
  assert.equal(element("targetChance").textContent, "17.9%");
  assert.match(element("targetSummary").textContent, /THIS GRIND: 90 KC/);
  assert.equal(run("isOwned(pet('kraken'))"), true);
  assert.equal(run("templeState.complete"), true);
  const positives = run("Object.keys(templeState.owned).length");
  assert.equal(positives, 2);
  assert.throws(() =>
    context.applyTemple({ collection: { error: { message: "not synced" } } }),
  );
  assert.equal(run("Object.keys(templeState.owned).length"), 2);
  context.applyTemple({
    collection: {
      data: {
        ...collection.data,
        items: [{ id: catalog[0].templeId, count: 0 }],
      },
    },
  });
  assert.equal(run("templeState.complete"), false);
  assert.equal(run("Object.keys(templeState.owned).length"), 2);
  assert.equal(run("isOwned(pet('kraken'))"), true);
  assert.throws(() =>
    context.applyTemple({
      collection: { data: { ...collection.data, items: [] } },
    }),
  );
  assert.equal(run("Object.keys(templeState.owned).length"), 2);
  assert.equal(context.probability(0, 1), 0);
  assert.equal(context.probability(1, 1), 1);
  assert.equal(context.probability(2, 2), 0.75);
  assert.equal(context.probability(null, 3000), null);
  assert.equal(run("chanceFor(pet('phoenix'),600)"), null);
  run("filter='owned';search='';sort='name';renderVault();");
  assert.ok(element("petGrid").innerHTML.includes("kraken"));
  run("filter='all';search='sarachnis';renderVault();");
  assert.match(element("petGrid").innerHTML, /data-pet-id="sraracha"/);
  assert.ok(!element("petGrid").innerHTML.includes('data-pet-id="kraken"'));
  run("filter='all';search='';category='Raids';renderVault();");
  assert.equal(
    (element("petGrid").innerHTML.match(/data-pet-id=/g) || []).length,
    3,
  );
  run("category='all';vaultLimit=12;renderVault();");
  assert.equal(
    (element("petGrid").innerHTML.match(/data-pet-id=/g) || []).length,
    12,
  );
  run("vaultLimit=24;renderVault();");
  assert.equal(
    (element("petGrid").innerHTML.match(/data-pet-id=/g) || []).length,
    24,
  );
  assert.equal(context.killsForTarget(0.5, 3000), 2080);
  assert.equal(context.killsForTarget(0.9, 3000), 6907);
  assert.equal(context.killsForTarget(0.99, 1), 1);
  assert.equal(context.killsForTarget(1, 3000), null);
  assert.ok(context.probability(1000000, 3000) > 0.9999);
  assert.equal(context.probability(-1, 3000), null);
  assert.equal(run("modelEligible(pet('jad'))"), false);
  assert.equal(run("modelEligible(pet('toa'))"), false);
  assert.equal(run("planModel(pet('goa')).rate"), 2000);
  run("planMethods.goa=1");
  assert.equal(run("planModel(pet('goa')).rate"), 800);
  assert.equal(run("planModel(pet('goa')).metric"), "the_corrupted_gauntlet");
  assert.equal(run("planModel(pet('nid')).rate"), 3000);
  run("planMethods.nid=1");
  assert.equal(run("planModel(pet('nid')).rate"), 1500);
  const futureKills = context.killsForTarget(0.9, 3000);
  run("metrics.sarachnis=100000");
  assert.equal(
    context.killsForTarget(0.9, 3000),
    futureKills,
    "past dry kills never reduce future target rolls",
  );
  assert.throws(() =>
    context.validateImport({ username: "another player", owned: {} }),
  );
  assert.throws(() =>
    context.validateImport({ username: "s niffin", owned: { invented: {} } }),
  );
  const imported = context.validateImport({
    username: "s niffin",
    owned: { kraken: { kc: 17 } },
    milestones: [{ petId: "kraken", kc: 17, title: "Confirmed drop" }],
  });
  assert.equal(imported.owned.kraken.kc, 17);
  assert.equal(imported.milestones[0].date, null);
  assert.throws(() =>
    context.validateImport({
      username: "s niffin",
      owned: { kraken: { kc: -1 } },
    }),
  );
  run("templeState.complete=false;savedStateReady=true");
  assert.equal(
    run("ownershipKnown()"),
    false,
    "manual positives do not establish a complete log",
  );
  const goodFetch = context.fetch;
  context.fetch = async () => ({
    ok: true,
    json: async () => ({ ...manual, username: "wrong player" }),
  });
  await context.loadState();
  assert.equal(run("serverState.username"), "s niffin");
  context.fetch = goodFetch;
  const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
  assert.ok(!/all420s|all%20420s/i.test(html));
  for (const match of html.matchAll(
    /(?:src|href)="(\.[^"?#]*)(?:[?#][^"]*)?"/g,
  )) {
    const target = path.resolve(root, match[1]);
    assert.ok(fs.existsSync(target), "missing route/asset " + match[1]);
  }
  assert.ok(fs.statSync(path.join(root, "media/portrait.jpg")).size < 150000);
  assert.ok(
    fs.statSync(path.join(root, "media/portrait-original.png")).size > 1000000,
  );
  const fixture = JSON.parse(
    fs.readFileSync(path.join(root, "dev/fixture.json"), "utf8"),
  );
  const demo = vm.createContext({
    ...context,
    structuredClone,
    location: {
      hostname: "localhost",
      origin: "http://localhost:4173",
      search: "?mock=1",
    },
    fetch: async () => {
      throw Error("Mock mode attempted network");
    },
  });
  vm.runInContext(
    fs.readFileSync(path.join(root, "menagerie.js"), "utf8"),
    demo,
  );
  vm.runInContext(fs.readFileSync(path.join(root, "app.js"), "utf8"), demo);
  vm.runInContext("mockFixture=" + JSON.stringify(fixture), demo);
  assert.equal((await demo.api("state")).username, "s niffin");
  assert.equal((await demo.api("wom")).displayName, "s niffin");
  assert.equal((await demo.api("auth/status")).allowed, false);
  const production = vm.createContext({
    ...context,
    location: {
      hostname: "peakpvm.com",
      origin: "https://peakpvm.com",
      search: "?mock=1",
    },
  });
  vm.runInContext(
    fs.readFileSync(path.join(root, "menagerie.js"), "utf8"),
    production,
  );
  assert.equal(
    vm.runInContext("MOCK_MODE", production),
    false,
    "mock mode cannot activate in production",
  );
  const worker = (
    await import(
      "data:text/javascript;base64," +
        Buffer.from(
          fs.readFileSync(path.join(root, "worker/index.js"), "utf8"),
        ).toString("base64")
    )
  ).default;
  const kv = new Map(),
    env = {
      ADMIN_PIN: "local-test-pin",
      SESSION_SECRET: "local-test-only-not-a-production-secret",
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
  const request = (
    p,
    method = "GET",
    body,
    ip = "47.12.27.148",
    cookie,
    origin = "https://backend.example",
  ) =>
    new Request("https://backend.example/sniffin/api/" + p, {
      method,
      headers: {
        "CF-Connecting-IP": ip,
        Origin: origin,
        "Content-Type": "application/json",
        ...(cookie ? { Cookie: cookie } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  const send = (req) => worker.fetch(req, env, { waitUntil() {} });
  assert.equal(
    (
      await send(
        request("state", "GET", null, "1.2.3.4", null, "https://peakpvm.com"),
      )
    ).status,
    200,
  );
  assert.equal(
    (await send(request("state", "PUT", manual, "1.2.3.4"))).status,
    403,
  );
  assert.equal(
    (
      await send(
        request("auth/login", "POST", { pin: "local-test-pin" }, "1.2.3.4"),
      )
    ).status,
    403,
  );
  assert.equal(
    (await send(request("auth/login", "POST", { pin: "wrong-test-pin" })))
      .status,
    401,
  );
  const login = await send(
    request("auth/login", "POST", { pin: "local-test-pin" }),
  );
  assert.equal(login.status, 200);
  const cookie = login.headers.get("Set-Cookie");
  assert.match(cookie, /Max-Age=2700; Secure; HttpOnly; SameSite=Strict/);
  assert.equal(
    (
      await send(
        request(
          "state",
          "PUT",
          manual,
          "47.12.27.148",
          cookie,
          "https://peakpvm.com",
        ),
      )
    ).status,
    403,
    "public cross-origin writes stay blocked",
  );
  assert.equal(
    (await send(request("state", "PUT", manual, "47.12.27.148", cookie)))
      .status,
    200,
  );
  const persisted = await (
    await send(request("state", "GET", null, "1.2.3.4"))
  ).json();
  assert.equal(persisted.notes[0].body, "Retained field note");
  assert.equal(persisted.manualKC.herbi, 600);
  assert.equal(persisted.owned.kraken.kc, 17);
  assert.ok(persisted.updatedAt);
  const milestoneState = {
    ...manual,
    milestones: [
      {
        petId: "kraken",
        title: "Confirmed record",
        kc: 17,
        date: null,
        note: "Date unknown",
      },
    ],
  };
  assert.equal(
    (
      await send(
        request("state", "PUT", milestoneState, "47.12.27.148", cookie),
      )
    ).status,
    200,
  );
  const withMilestones = await (await send(request("state"))).json();
  assert.equal(withMilestones.milestones[0].kc, 17);
  assert.equal(withMilestones.milestones[0].date, null);
  assert.equal(
    (
      await send(
        request(
          "state",
          "PUT",
          { ...manual, milestones: [{ kc: -1 }] },
          "47.12.27.148",
          cookie,
        ),
      )
    ).status,
    400,
  );
  assert.equal(
    (await send(request("wom?username=another%20player"))).status,
    400,
  );
  const originalFetch = global.fetch;
  try {
    global.fetch = async () => {
      throw Error("Upstream timed out");
    };
    kv.set(
      "wom:s niffin",
      JSON.stringify({ time: Date.now() - 600000, data: wom }),
    );
    const stale = await (await send(request("wom"))).json();
    assert.equal(stale.stale, true);
    assert.equal(stale.displayName, "s niffin");
    kv.delete("wom:s niffin");
    assert.equal((await send(request("wom"))).status, 503);
    global.fetch = async () =>
      new Response(JSON.stringify({ ...wom, displayName: "wrong player" }));
    assert.equal((await send(request("wom"))).status, 503);
  } finally {
    global.fetch = originalFetch;
  }
  assert.equal(
    (await send(request("state", "PUT", manual, "1.2.3.4", cookie))).status,
    403,
  );
  assert.equal(
    (
      await worker.fetch(
        new Request("https://backend.example/sniffin/", {
          headers: { "CF-Connecting-IP": "1.2.3.4" },
        }),
        env,
        {},
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await send(
        request(
          "state",
          "GET",
          null,
          "47.12.27.148",
          null,
          "https://evil.example",
        ),
      )
    ).status,
    403,
  );
  console.log(
    "PASS: 72 unique follower PNGs; exact RSN; live KC and hunt baseline; Temple complete/partial/empty/failure handling; manual preservation; filters; RNG; IP/PIN/cookie/CSRF restrictions; persistent public state.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
