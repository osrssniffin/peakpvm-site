"use strict";
// Each chart mark represents a real Temple snapshot, never an interpolated value.
const grindCache = new Map();
const grindPending = new Set();
let grindOptions = new Map(),
  grindSelected = "xp",
  grindPoints = [],
  grindRank = false,
  grindSelectedPoint = 0;
let receiptsState = { datedItems: {}, unlocks: {} };
const SHOWCASE_SKILLS =
  "Attack Defence Strength Hitpoints Ranged Prayer Magic Cooking Woodcutting Fletching Fishing Firemaking Crafting Smithing Mining Herblore Agility Thieving Slayer Farming Runecraft Hunter Construction Sailing".split(
    " ",
  );
const archiveNumber = (n) =>
  Number.isFinite(n)
    ? n.toLocaleString("en-US", { maximumFractionDigits: 2 })
    : "—";
const shortDate = (t) =>
  new Date(t).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
const snapshotDate = (t) =>
  new Date(t).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "UTC",
  }) + " UTC";
function grindMetrics() {
  return new Map([
    ["xp", ["Total XP", "skills", "Overall"]],
    ["ehp", ["EHP", "skills", characterState.ehpKey || "Ehp"]],
    ["ehb", ["EHB", "bosses", characterState.ehbKey || "Ehb"]],
    ["rank", ["Overall rank", "rank", "Rank"]],
    ...SHOWCASE_SKILLS.map((n) => ["skill:" + n, [n + " XP", "skills", n]]),
    ...Object.entries(bossDirectory.bosses)
      .filter(([id]) => Number.isInteger(templeMetrics[id]))
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, n]) => ["boss:" + id, [n + " KC", "bosses", n]]),
  ]);
}
function setupShowcase() {
  if (!MOCK_MODE) receiptsState = readCache("receipts") || receiptsState;
  const input = $("grindMetric");
  input.onchange = () => {
    grindSelected = input.value;
    renderGrind();
    syncGrind();
  };
  $("grindRange").onchange = renderGrind;
  $("grindPoint").oninput = (e) => showGrindPoint(Number(e.target.value));
  $("grindPlot").onclick = (e) => {
    if (e.target.dataset.point !== undefined)
      showGrindPoint(Number(e.target.dataset.point));
  };
  $("ledgerSearch").oninput = renderLedger;
  $("ledgerSort").onchange = renderLedger;
  $("ledgerBody")
    .closest("details")
    .addEventListener("toggle", (e) => {
      if (e.currentTarget.open) syncGrind("bosses");
    });
  $("ledgerBody").onclick = (e) => {
    const b = e.target.closest("[data-grind-boss]");
    if (!b || !grindOptions.has(b.dataset.grindBoss)) return;
    grindSelected = b.dataset.grindBoss;
    input.value = grindSelected;
    renderGrind();
    syncGrind();
    input.focus({ preventScroll: true });
    $("grindSection").scrollIntoView();
  };
  if (["#nextVictim", "#rngRate", "#rngKills"].includes(location.hash))
    $("plannerSection").open = true;
}
async function syncGrind(
  kind = grindOptions.get(grindSelected)?.[1] || "skills",
) {
  const old = grindCache.get(kind);
  if (grindPending.has(kind) || (old && Date.now() - old.loadedAt < 240000))
    return;
  grindPending.add(kind);
  try {
    const response = await api("history?kind=" + kind);
    if (!Array.isArray(response.rows)) throw Error("No history");
    grindCache.set(kind, { ...response, loadedAt: Date.now() });
  } catch {
    grindCache.set(kind, {
      ...(old || { rows: [], unavailable: true }),
      stale: true,
      loadedAt: Date.now(),
    });
  } finally {
    grindPending.delete(kind);
  }
  if (grindOptions.get(grindSelected)?.[1] === kind) renderGrind();
  if (kind === "bosses") renderLedger();
}
function showGrindPoint(index) {
  const point = grindPoints[index];
  if (!point) return;
  $("grindPlot")
    .querySelector("[data-point].selected")
    ?.classList.remove("selected");
  $("grindPlot")
    .querySelector('[data-point="' + index + '"]')
    ?.classList.add("selected");
  grindSelectedPoint = index;
  $("grindPoint").value = index;
  $("grindReading").textContent =
    snapshotDate(point[0]) +
    " · " +
    (grindRank ? "#" : "") +
    archiveNumber(point[1]);
}
function renderGrind() {
  const selected = grindOptions.get(grindSelected);
  if (!selected) return;
  const [, kind, field] = selected,
    response = grindCache.get(kind);
  const days = Number($("grindRange").value);
  const previousAt = grindPoints[grindSelectedPoint]?.[0];
  grindRank = kind === "rank";
  const all = (response?.rows || []).filter(
    (row) =>
      Number.isFinite(row?.[0]) &&
      Number.isFinite(row?.[1]?.[field]) &&
      (!grindSelected.startsWith("boss:") || row[1][field] > 0),
  );
  const cutoff = Date.now() - days * 86400000;
  grindPoints = all
    .filter((row) => !days || row[0] >= cutoff)
    .map((row) => [row[0], row[1][field]]);
  const count = grindPoints.length;
  $("grindPicker").hidden = count < 2;
  $("grindReading").textContent = "";
  $("grindPlot").replaceChildren();
  const summary = $("grindSummary");
  if (!response) {
    summary.textContent = "Waiting for Temple history…";
    return;
  }
  if (!count) {
    summary.textContent = response.unavailable
      ? "Temple history is temporarily unavailable."
      : grindRank
        ? "Temple does not publish historical rank datapoints. The archive records ranks from now on."
        : "No Temple snapshots in this window. Try a wider range.";
    return;
  }
  const first = grindPoints[0],
    last = grindPoints.at(-1),
    diff = grindRank ? first[1] - last[1] : last[1] - first[1];
  summary.textContent =
    (response.stale ? "Cached · " : "") +
    count +
    (count === 1
      ? " snapshot"
      : " snapshots · " +
        (diff > 0 ? "+" : "") +
        archiveNumber(diff) +
        (grindRank ? " places" : "") +
        " between first and last") +
    " · " +
    (grindRank
      ? "Ranks recorded by the archive"
      : "Temple’s available snapshots");
  if (count < 2) {
    showGrindPoint(0);
    return;
  }
  const values = grindPoints.map((p) => p[1]),
    min = Math.min(...values),
    max = Math.max(...values);
  const x = (t) => 20 + ((t - first[0]) / (last[0] - first[0] || 1)) * 560;
  const y = (v) =>
    max === min
      ? 80
      : 15 + ((grindRank ? v - min : max - v) / (max - min)) * 130;
  const marks = grindPoints
    .map(
      ([t, v], i) =>
        '<circle data-point="' +
        i +
        '" cx="' +
        x(t).toFixed(2) +
        '" cy="' +
        y(v).toFixed(2) +
        '" r="4"><title>' +
        escaped(snapshotDate(t) + " · " + archiveNumber(v)) +
        "</title></circle>",
    )
    .join("");
  $("grindPlot").innerHTML =
    '<svg viewBox="0 0 600 160" role="img" aria-label="Dated observations. Use the snapshot slider for exact values."><path d="M20 15H580 M20 80H580 M20 145H580"/>' +
    marks +
    '</svg><div class="grind-dates"><span>' +
    shortDate(first[0]) +
    "</span><span>" +
    shortDate(last[0]) +
    "</span></div>";
  $("grindPoint").max = count - 1;
  const samePoint = grindPoints.findIndex((row) => row[0] === previousAt);
  showGrindPoint(samePoint < 0 ? count - 1 : samePoint);
}
function ledgerRows() {
  return Object.entries(templeMetrics)
    .filter(
      ([id, n]) => bossDirectory.bosses[id] && Number.isInteger(n) && n > 0,
    )
    .map(([id, kc]) => ({ id, kc, name: bossDirectory.bosses[id] }));
}
function ledgerGain(field) {
  const cutoff = Date.now() - 30 * 86400000;
  const rows = (grindCache.get("bosses")?.rows || []).filter(
    ([at, values]) =>
      at >= cutoff && Number.isInteger(values[field]) && values[field] > 0,
  );
  if (rows.length < 2) return "—";
  const delta = rows.at(-1)[1][field] - rows[0][1][field];
  return delta >= 0 ? "+" + fmt(delta) : "—";
}
function renderLedger() {
  const rows = ledgerRows().sort(
    (a, b) => b.kc - a.kc || a.name.localeCompare(b.name),
  );
  $("ledgerFeatured").innerHTML = rows.length
    ? rows
        .slice(0, 3)
        .map((row) => {
          const art = bossDirectory.art[row.id];
          return (
            '<article class="ledger-counter">' +
            (art
              ? '<img loading="lazy" src="./media/' +
                escaped(art.file) +
                '" alt="">'
              : "") +
            "<div><small>" +
            escaped(row.name) +
            "</small><strong>" +
            fmt(row.kc) +
            "</strong><span> TEMPLE KC</span></div></article>"
          );
        })
        .join("")
    : '<p class="fineprint">No verified Temple boss counters available.</p>';
  const query = $("ledgerSearch").value.trim().toLowerCase();
  const filtered = rows.filter((row) => row.name.toLowerCase().includes(query));
  if ($("ledgerSort").value === "name")
    filtered.sort((a, b) => a.name.localeCompare(b.name));
  $("ledgerBody").innerHTML = filtered.length
    ? filtered
        .map(
          (row) =>
            '<tr><th scope="row">' +
            escaped(row.name) +
            "</th><td>" +
            fmt(row.kc) +
            '</td><td title="Change between first and last available snapshots in the past 30 days">' +
            ledgerGain(row.name) +
            '</td><td><button class="ledger-link" data-grind-boss="boss:' +
            escaped(row.id) +
            '">View history</button></td></tr>',
        )
        .join("")
    : '<tr><td colspan="4">' +
      (query ? "No matching counters." : "Temple KC unavailable.") +
      "</td></tr>";
}
async function syncReceipts() {
  try {
    const response = await api("receipts");
    if (response?.datedItems && response?.unlocks) {
      receiptsState = response;
      writeCache("receipts", response);
    }
  } catch {}
  render();
}
function earnedTrophies() {
  const skills = characterState.skills || {};
  const auto = {
    max: SHOWCASE_SKILLS.every((name) => skills[name]?.level === 99),
    cooking: skills.Cooking?.xp === 200000000,
    ...receiptsState.unlocks,
  };
  return (curated.achievements || [])
    .filter((a) => auto[a.id] || a.verified === true)
    .map((a) => ({
      ...a,
      provenance: auto[a.id]
        ? a.id === "max" || a.id === "cooking"
          ? "Temple skill stats"
          : "Temple collection log"
        : "Owner verified",
      recordedAt: a.date
        ? stamp(a.date)?.getTime()
        : a.id === "quiver"
          ? receiptsState.datedItems[28947]
          : a.id === "infernal"
            ? receiptsState.datedItems[21295]
            : null,
    }));
}
function renderKeeperTrophies() {
  const rows = earnedTrophies();
  const trophies = $("trophyWall");
  if (rows.length)
    trophies.insertAdjacentHTML(
      "afterbegin",
      rows
        .map(
          (a) =>
            '<article class="trophy keeper-trophy"><div class="eyebrow">' +
            escaped(a.provenance) +
            "</div>" +
            (a.image
              ? '<img loading="lazy" width="96" height="96" src="./media/' +
                escaped(a.image) +
                '" alt="">'
              : "") +
            "<strong>" +
            escaped(a.title) +
            "</strong>" +
            (a.note ? "<p>" + escaped(a.note) + "</p>" : "") +
            "</article>",
        )
        .join(""),
    );
}
function confirmedPetDates() {
  const rows = new Map();
  for (const [id, at] of Object.entries(receiptsState.datedItems)) {
    const p = petForTempleId(id);
    if (
      p &&
      isOwned(p) &&
      Number.isFinite(at) &&
      (!rows.has(p[0]) || rows.get(p[0]) > at)
    )
      rows.set(p[0], at);
  }
  return rows;
}
function renderShowcase() {
  $("keeperLevel").textContent = archiveNumber(characterState.totalLevel);
  $("keeperXP").textContent = archiveNumber(characterState.totalXP);
  $("keeperRank").textContent = Number.isInteger(characterState.overallRank)
    ? "#" + fmt(characterState.overallRank)
    : "—";
  const updated = grindMetrics();
  if (JSON.stringify([...updated]) !== JSON.stringify([...grindOptions])) {
    grindOptions = updated;
    if (!updated.has(grindSelected)) grindSelected = "xp";
    $("grindMetric").innerHTML = [...updated]
      .map(
        ([id, [label]]) =>
          '<option value="' + escaped(id) + '">' + escaped(label) + "</option>",
      )
      .join("");
    $("grindMetric").value = grindSelected;
  }
  renderGrind();
  renderLedger();
  renderKeeperTrophies();
}
