"use strict";
// UI additions share the existing account adapters and owner editor in app.js.
const LOCAL_PREVIEW = ["localhost", "127.0.0.1", "[::1]"].includes(
  location.hostname,
);
const MOCK_REQUESTED = new URLSearchParams(location.search).get("mock") === "1";
const MOCK_MODE = LOCAL_PREVIEW && MOCK_REQUESTED;
const MOCK_OFFLINE =
  MOCK_MODE &&
  new URLSearchParams(location.search).get("scenario") === "offline";
let curated = { milestones: [] },
  mockFixture = null,
  category = "all",
  planTarget = 0.5,
  planSort = "name";
let paces = {},
  vaultLimit = 12,
  planPage = 0,
  planQuery = "";
const planMethods = {};
const METHODS = {
  "chaos-elemental": [
    ["Elemental", 300, "chaos_elemental"],
    ["Chaos Fanatic", 1000, "chaos_fanatic"],
  ],
  goa: [
    ["Normal", 2000, "the_gauntlet"],
    ["Corrupted", 800, "the_corrupted_gauntlet"],
  ],
  nid: [
    ["Harvest", 3000, "araxxor"],
    ["Destroy", 1500, "araxxor"],
  ],
  bran: [
    ["Loot", 3000, "the_royal_titans"],
    ["Sacrifice", 1500, "the_royal_titans"],
  ],
  jad: [
    ["Off task, kill only", 200, "tztok_jad"],
    ["On task, kill only", 100, "tztok_jad"],
  ],
  zuk: [
    ["Off task, kill only", 100, "tzkal_zuk"],
    ["On task, kill only", 75, "tzkal_zuk"],
  ],
  "smol-heredit": [["Kill only (no gamble)", 200, "sol_heredit"]],
  venenatis: [
    ["Venenatis", 1500, "venenatis"],
    ["Spindel", 2800, "spindel"],
  ],
  vetion: [
    ["Vet’ion", 1500, "vetion"],
    ["Calvar’ion", 2800, "calvarion"],
  ],
  callisto: [
    ["Callisto", 1500, "callisto"],
    ["Artio", 2800, "artio"],
  ],
};
function planModel(p) {
  const methods = METHODS[p[0]],
    index = Number(planMethods[p[0]] || 0);
  if (methods) {
    const method = methods[index] || methods[0];
    return {
      rate: method[1],
      metric: method[2],
      label: method[0],
      eligible: true,
    };
  }
  return {
    rate: rateFor(p),
    metric: p[3],
    label:
      serverState.rates?.[p[0]] !== undefined
        ? "Owner rate override"
        : "Base method",
    eligible: modelEligible(p),
  };
}
const SPECIAL_METHODS = new Set([
  "jad",
  "zuk",
  "nid",
  "bran",
  "maggot-marquess",
  "yami",
  "smol-heredit",
]);
function modelEligible(p) {
  return (
    !!meta(p).rollsPerKC &&
    !SPECIAL_METHODS.has(p[0]) &&
    Number.isFinite(rateFor(p))
  );
}
function killsForTarget(target, denominator) {
  if (!(target > 0 && target < 1) || !(denominator >= 1)) return null;
  return denominator === 1
    ? 1
    : Math.ceil(Math.log1p(-target) / Math.log1p(-1 / denominator));
}
function paceFor(id) {
  const n = Number(paces[id]);
  return Number.isFinite(n) && n > 0 && n <= 10000 ? n : null;
}
function hours(kills, pace) {
  return kills === null || !pace
    ? "Enter pace"
    : (kills / pace).toLocaleString("en-US", { maximumFractionDigits: 1 }) +
        " h";
}
function categoryFor(p) {
  if (["cox", "tob", "toa"].includes(p[0])) return "Raids";
  if (
    [
      "phoenix",
      "tempoross",
      "guardians",
      "lil-creator",
      "pet-penance-queen",
      "quetzin",
    ].includes(p[0])
  )
    return "Minigames";
  return meta(p).category === "Activity"
    ? "Activities"
    : meta(p).category === "Boss"
      ? "Bosses"
      : meta(p).category;
}
async function initMenagerie() {
  const response = await fetch("./curated.json");
  if (response.ok) curated = await response.json();
  if (curated.username !== RSN)
    throw Error("Curated records are for a different player");
  if (MOCK_MODE) {
    const fixture = await fetch("./dev/fixture.json");
    if (!fixture.ok) throw Error("Development fixture missing");
    mockFixture = await fixture.json();
  }
  if (MOCK_REQUESTED) {
    $("modeBanner").classList.remove("hidden");
    $("modeBanner").textContent = MOCK_MODE
      ? "DEVELOPMENT FIXTURE · SAMPLE DATA · NOT LIVE S NIFFIN" +
        (MOCK_OFFLINE ? " · SIMULATED OUTAGE" : "")
      : "Mock mode is disabled on this host. Showing live account data only.";
  }
  try {
    paces = JSON.parse(sessionStorage.getItem("sniffin:paces") || "{}");
  } catch {
    paces = {};
  }
  $("categoryPets").innerHTML =
    '<option value="all">All categories</option>' +
    [...new Set(CATALOG.map(categoryFor))]
      .sort()
      .map((c) => `<option value="${c}">${c}</option>`)
      .join("");
  $("categoryPets").onchange = (e) => {
    category = e.target.value;
    vaultLimit = 12;
    renderVault();
  };
  const more = document.createElement("button");
  more.id = "morePets";
  more.className = "secondary-button";
  more.textContent = "REVEAL MORE RESIDENTS & FUGITIVES ↓";
  $("petGrid").after(more);
  more.onclick = () => {
    vaultLimit += 12;
    renderVault();
  };
  const controls = document.createElement("div");
  controls.className = "planner-pagination";
  controls.innerHTML =
    '<input id="planSearch" type="search" placeholder="Find a future hunt…" aria-label="Search future hunts"><span id="planPageLabel" role="status"></span><button id="planPrev" class="secondary-button">← PREVIOUS</button><button id="planNext" class="secondary-button">NEXT →</button>';
  $("plannerBody").closest(".planner-scroll").before(controls);
  $("planSearch").oninput = (e) => {
    planQuery = e.target.value.toLowerCase();
    planPage = 0;
    renderPlanner();
  };
  $("planPrev").onclick = () => {
    planPage = Math.max(0, planPage - 1);
    renderPlanner();
  };
  $("planNext").onclick = () => {
    planPage++;
    renderPlanner();
  };
  $("huntKph").oninput = (e) => {
    setPace(serverState.target, e.target.value);
    renderHuntExtras();
    renderPlanner();
  };
  $("planTarget").onchange = (e) => {
    planTarget = Number(e.target.value);
    renderPlanner();
  };
  $("planSort").onchange = (e) => {
    planSort = e.target.value;
    planPage = 0;
    renderPlanner();
  };
  $("plannerBody").addEventListener("input", (e) => {
    const id = e.target.dataset.pace;
    if (!id) return;
    setPace(id, e.target.value);
    const row = e.target.closest("tr");
    if (row) {
      const p = pet(id),
        k = killsForTarget(planTarget, planModel(p).rate);
      row.querySelector("[data-hours]").textContent = hours(k, paceFor(id));
    }
    if (id === serverState.target) {
      $("huntKph").value = e.target.value;
      renderHuntExtras();
    }
  });
  $("plannerBody").addEventListener("change", (e) => {
    const id = e.target.dataset.method;
    if (id) planMethods[id] = e.target.value;
    if (id || planSort === "hours") renderPlanner();
  });
  $("petGrid").addEventListener("click", (e) => {
    const b = e.target.closest("[data-details]");
    if (b) showPetDetails(b.dataset.details);
  });
  $("closePetDialog").onclick = () => $("petDialog").close();
  document.addEventListener("error", imageFallback, true);
  $("portrait").addEventListener(
    "error",
    () => {
      $("portrait").src = "./media/portrait-original.png";
    },
    { once: true },
  );
  // Preserve the existing protected editor. Imports stage a change; Save is still required.
  const importer = document.createElement("div");
  importer.innerHTML =
    '<div class="edit-subhead">IMPORT CONFIRMED COLLECTION / MILESTONES</div><p class="modal-help">Choose a JSON export for s niffin (format in README). This stages manual confirmations; review them before saving. No RuneLite files are read automatically.</p><input id="collectionImport" type="file" accept="application/json,.json" aria-label="Import confirmed collection"><p id="importStatus" role="status"></p>';
  $("editPanel").insertBefore(importer, $("editPanel").firstChild);
  $("collectionImport").onchange = async (e) => {
    try {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 30000) throw Error("Import must be below 30 KB");
      const imported = validateImport(JSON.parse(await file.text()));
      captureEditor();
      editable.owned = { ...editable.owned, ...imported.owned };
      editable.milestones = [
        ...(editable.milestones || []),
        ...imported.milestones,
      ].slice(-100);
      renderEditPets();
      $("importStatus").textContent =
        Object.keys(imported.owned).length +
        " confirmations staged. Review and Save to publish.";
    } catch (error) {
      $("importStatus").textContent = error.message;
    } finally {
      e.target.value = "";
    }
  };
}
function setPace(id, value) {
  if (value === "") delete paces[id];
  else paces[id] = value;
  try {
    sessionStorage.setItem("sniffin:paces", JSON.stringify(paces));
  } catch {}
}
function imageFallback(e) {
  const img = e.target;
  if (img?.tagName !== "IMG" || img.dataset.fallback) return;
  img.dataset.fallback = "true";
  img.alt += " · render unavailable";
  img.src = "./media/unavailable.svg";
}
function renderMenagerie() {
  renderCategories();
  renderHuntExtras();
  renderTrophies();
  renderHistory();
  renderPlanner();
}
function renderCategories() {
  $("categoryProgress").innerHTML = [...new Set(CATALOG.map(categoryFor))]
    .sort()
    .map((c) => {
      const pets = CATALOG.filter((p) => categoryFor(p) === c),
        owned = pets.filter(isOwned).length;
      return `<span>${escaped(c)} <b>${ownershipKnown() ? "" : "≥"}${owned}/${pets.length}</b></span>`;
    })
    .join("");
}
function renderHuntExtras() {
  const p = pet(serverState.target),
    kc = kcFor(p),
    chance = chanceFor(p, kc),
    pace = paceFor(p[0]);
  const boss = $("bossImage");
  $("targetRateLabel").textContent = serverState.rates?.[p[0]] !== undefined ? 'OWNER RATE OVERRIDE' : 'BASE PET RATE';
  const src = p[0] === "sraracha" ? "./media/sarachnis.png" : meta(p).image;
  if (!boss.getAttribute("src")?.endsWith(src.replace("./", "")))
    boss.src = src;
  boss.alt =
    p[0] === "sraracha"
      ? "Sarachnis in-game boss model"
      : p[1] + " follower render (boss render unavailable)";
  $("huntKph").value = paces[p[0]] || "";
  $("heroHuntLabel").textContent =
    p[2] + " // " + (kc === null ? "KC UNAVAILABLE" : fmt(kc) + " KC");
  $("targetZero").textContent =
    chance === null ? "UNAVAILABLE" : ((1 - chance) * 100).toFixed(2) + "%";
  $("dryExplanation").textContent =
    chance === null
      ? kc === null
        ? "KC is unavailable. No dryness estimate can be calculated."
        : "This hunt needs an exact method or reward-roll count. See the rate notes below."
      : (chance * 100).toFixed(1) +
        "% would have received ≥1 drop by this many eligible kills under the base model; " +
        ((1 - chance) * 100).toFixed(1) +
        "% would still have none. This is a theoretical percentile, not guaranteed progress.";
  const next = kc === null ? null : (Math.floor(kc / 500) + 1) * 500;
  $("huntMilestones").innerHTML =
    next === null
      ? "<span>Milestones await a verified KC.</span>"
      : [next, next + 500, next + 1000]
          .map(
            (n) => `<span>${fmt(n)} KC<br><b>${hours(n - kc, pace)}</b></span>`,
          )
          .join("");
}
function renderPlanner() {
  const pets = CATALOG.filter(
    (p) => !isOwned(p) && (p[1] + " " + p[2]).toLowerCase().includes(planQuery),
  );
  pets.sort((a, b) =>
    planSort === "hours"
      ? planHours(a) - planHours(b) || a[1].localeCompare(b[1])
      : a[1].localeCompare(b[1]),
  );
  planPage = Math.max(0, Math.min(planPage, Math.ceil(pets.length / 8) - 1));
  $("planPageLabel").textContent = pets.length
    ? `${planPage * 8 + 1}–${Math.min((planPage + 1) * 8, pets.length)} OF ${pets.length} TARGETS`
    : "NO MATCHES";
  $("planPrev").disabled = planPage === 0;
  $("planNext").disabled = (planPage + 1) * 8 >= pets.length;
  $("plannerBody").innerHTML =
    pets
      .slice(planPage * 8, (planPage + 1) * 8)
      .map((p) => {
        const model = planModel(p),
          eligible = model.eligible,
          rate = model.rate,
          target = eligible ? killsForTarget(planTarget, rate) : null,
          kc =
            model.metric && Number.isFinite(metrics[model.metric])
              ? metrics[model.metric]
              : kcFor(p),
          methods = METHODS[p[0]],
          unit =
            categoryFor(p) === "Activities" || p[0] === "quetzin"
              ? "rolls"
              : "kills";
        return `<tr><td><img src="${meta(p).image}" alt="" width="45" height="50" loading="lazy"><strong>${escaped(p[1])}</strong><small>${escaped(p[2])} · ${ownershipKnown() ? "Unclaimed" : "Ownership unverified"}</small>${methods ? `<select data-method="${p[0]}" aria-label="Future method for ${escaped(p[1])}">${methods.map((m, i) => `<option value="${i}" ${Number(planMethods[p[0]] || 0) === i ? "selected" : ""}>${escaped(m[0])}</option>`).join("")}</select>` : ""}</td><td>${kc === null ? "—" : fmt(kc)}</td><td>${rate ? "1 / " + fmtRate(rate) : "Variable"}<small>${eligible ? escaped(model.label) : "Method required"}</small></td><td>${eligible ? `<input type="number" min="0.1" max="10000" step="0.1" data-pace="${p[0]}" aria-label="Kills per hour for ${escaped(p[1])}" value="${escaped(paces[p[0]] || "")}" placeholder="/ hour">` : "—"}</td><td>${eligible ? fmtRate(rate) + " " + unit : "—"}<small>${eligible ? "Geometric mean" : "Exact method required"}</small></td><td>${eligible ? `${fmt(target)} ${unit}<small data-hours>${hours(target, paceFor(p[0]))}</small>` : `<a href="${meta(p).wiki}" target="_blank" rel="noopener">METHOD &amp; RATES ↗</a>`}</td></tr>`;
      })
      .join("") ||
    '<tr><td colspan="6">No unclaimed pets match. Ownership is based only on confirmed records.</td></tr>';
}
function planHours(p) {
  const model = planModel(p);
  return model.eligible && paceFor(p[0])
    ? killsForTarget(planTarget, model.rate) / paceFor(p[0])
    : Infinity;
}
function records() {
  const rows = [
    ...(curated.milestones || []),
    ...(serverState.milestones || []),
  ];
  for (const [id, detail] of Object.entries(serverState.owned || {})) {
    if (
      CATALOG.some((p) => p[0] === id) &&
      Number.isInteger(detail?.kc) &&
      detail.kc >= 0 &&
      !rows.some((r) => r.petId === id && r.kc === detail.kc)
    )
      rows.push({
        petId: id,
        kc: detail.kc,
        title: pet(id)[1] + " obtained",
        note: "Manually confirmed drop KC. Acquisition date not recorded.",
      });
  }
  return rows;
}
function renderTrophies() {
  const owned = CATALOG.filter(isOwned),
    kcRecords = records().filter(
      (r) =>
        r.petId &&
        Number.isInteger(r.kc) &&
        r.kc >= 0 &&
        CATALOG.some((p) => p[0] === r.petId) &&
        isOwned(pet(r.petId)),
    );
  const spoon = kcRecords
    .filter((r) => modelEligible(pet(r.petId)))
    .sort(
      (a, b) => a.kc / rateFor(pet(a.petId)) - b.kc / rateFor(pet(b.petId)),
    )[0];
  const achieved = records().find((r) => r.type === "achievement"),
    longOdds = owned
      .filter(modelEligible)
      .sort((a, b) => rateFor(b) - rateFor(a))[0];
  $("trophyWall").innerHTML =
    `<article class="trophy"><div class="eyebrow">I / THE RESIDENTS</div>${owned.length ? `<img src="${meta(owned[0]).image}" alt="" width="80" height="80" loading="lazy">` : ""}<strong>${ownershipKnown() ? "" : "AT LEAST "}${owned.length} FOLLOWERS</strong><p>${ownershipKnown() ? "Temple log + manual confirmations." : "Confirmed residents only; the rest of the collection is unverified."} Acquisition order is unknown.</p></article><article class="trophy"><div class="eyebrow">II / THE SPOON CABINET</div><strong>${spoon ? escaped(pet(spoon.petId)[1]) : "AWAITING RECEIPTS"}</strong><p>${spoon ? fmt(spoon.kc) + " drop KC · " + (probability(spoon.kc, rateFor(pet(spoon.petId))) * 100).toFixed(2) + "% base-model chance by then. Owner-curated record." : "Low-KC drops need a confirmed acquisition KC. Current boss KC cannot prove a spoon."}</p></article><article class="trophy"><div class="eyebrow">III / THE PERSONAL RECORD</div><strong>${achieved ? escaped(achieved.title) : longOdds ? escaped(longOdds[1]) : "ROOM FOR LEGENDS"}</strong><p>${achieved ? escaped(achieved.note) : longOdds ? "1 / " + fmtRate(rateFor(longOdds)) + " per kill. Smallest base drop chance among confirmed fixed-rate boss pets; no acquisition luck is inferred." : "First pet, longest dry streak, and major achievements await curated records."}</p></article>`;
}
function renderHistory() {
  const rows = records();
  $("historyItems").innerHTML = rows.length
    ? rows
        .map(
          (r) =>
            `<article class="history-item"><small>${escaped(r.date || "DATE NOT RECORDED")} · OWNER-CURATED</small><strong>${escaped(r.title || CATALOG.find(p=>p[0]===r.petId)?.[1] || 'ARCHIVE RECORD')}</strong><p>${r.kc !== null && r.kc !== undefined ? fmt(r.kc) + " KC · " : ""}${escaped(r.note || "")}</p></article>`,
        )
        .join("")
    : '<div class="empty">The archive has residents, but no verified drop chronology yet. Confirmed drop dates, KC, and notes can be added by the owner without borrowing dates from a sync.</div>';
}
function showPetDetails(id) {
  const p = pet(id),
    kc = kcFor(p),
    chance = chanceFor(p, kc);
  $("petDialogContent").innerHTML =
    `<img src="${meta(p).image}" alt="${escaped(p[1])} follower render"><div class="eyebrow">${escaped(categoryFor(p))} / ${escaped(ownershipSource(p))}</div><h3 id="petDetailTitle">${escaped(p[1])}</h3><p>Source: ${escaped(p[2])}<br>Current KC: ${kc === null ? "Unavailable" : fmt(kc)}<br>Published rate: ${escaped(meta(p).rateText)}${serverState.rates?.[p[0]] !== undefined ? "<br>Owner rate override: 1 / " + fmtRate(rateFor(p)) : ""}</p><p>${chance === null ? "Method-dependent probability or KC unavailable. No estimate is inferred." : (chance * 100).toFixed(2) + "% chance of at least one drop by this KC under the independent base-rate model. Prior kills do not improve the next roll."}</p><p>${escaped(meta(p).note ? "Owner note: " + meta(p).note : "Ownership is never inferred from kills.")}</p><p>Follower render © Jagex via the OSRS Wiki.</p><a href="${meta(p).wiki}" target="_blank" rel="noopener">PET, METHODS &amp; DROP RATES ↗</a>`;
  $("petDialog").setAttribute("aria-labelledby", "petDetailTitle");
  $("petDialog").showModal();
}
function validateImport(data) {
  if (
    !data ||
    data.username !== RSN ||
    !data.owned ||
    typeof data.owned !== "object" ||
    Array.isArray(data.owned)
  )
    throw Error('Import requires username "s niffin" and an owned object.');
  const owned = {};
  for (const [id, record] of Object.entries(data.owned)) {
    if (!CATALOG.some((p) => p[0] === id)) throw Error("Unknown pet ID: " + id);
    const kc = record?.kc ?? null;
    if (kc !== null && (!Number.isInteger(kc) || kc < 0))
      throw Error("Drop KC must be a non-negative integer or null");
    owned[id] = { kc };
  }
  const milestones = validateMilestones(data.milestones || []);
  return { owned, milestones };
}
function validateMilestones(rows) {
  if (!Array.isArray(rows) || rows.length > 100)
    throw Error("At most 100 milestone records are supported");
  return rows.map((r) => {
    if (!r || typeof r !== "object") throw Error("Invalid milestone");
    if (r.petId && !CATALOG.some((p) => p[0] === r.petId))
      throw Error("Unknown milestone pet");
    if (
      r.kc !== undefined &&
      r.kc !== null &&
      (!Number.isInteger(r.kc) || r.kc < 0)
    )
      throw Error("Invalid milestone KC");
    if (r.date && !/^\d{4}-\d{2}-\d{2}$/.test(r.date))
      throw Error("Milestone date must be YYYY-MM-DD or omitted");
    return {
      petId: r.petId || null,
      type: r.type === "achievement" ? "achievement" : "drop",
      title: String(r.title || "").slice(0, 100),
      date: r.date || null,
      kc: r.kc ?? null,
      note: String(r.note || "").slice(0, 300),
    };
  });
}
