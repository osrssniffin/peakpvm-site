"use strict";
// Temple character data and the existing protected hunt console.
const MOCK_ADMIN =
  MOCK_MODE && new URLSearchParams(location.search).get("admin") === "1";
const CAN_EDIT_ORIGIN = ON_BACKEND_SAFE();
function ON_BACKEND_SAFE() {
  return (
    location.origin === "https://peakpvm-sniffin-api.bells-pvm.workers.dev" ||
    MOCK_ADMIN
  );
}
let characterState = {
    username: "s niffin",
    metrics: {},
    ehp: null,
    ehb: null,
    stale: true,
  },
  templeMetrics = {},
  womMetrics = {},
  progressEvents = [];
function activeHunt() {
  return (
    serverState.hunt || {
      id: "legacy-" + serverState.target,
      petId: serverState.target,
      status: "active",
      startKC: serverState.startKC ?? null,
      startedAt: null,
    }
  );
}
const CHASE_METHODS = {
  gauntlet: { metric: "the_gauntlet", name: "The Gauntlet", rate: 2000 },
  "corrupted-gauntlet": {
    metric: "the_corrupted_gauntlet",
    name: "Corrupted Gauntlet",
    rate: 800,
  },
};
let bossDirectory = { bosses: {}, art: {} };
async function loadBossDirectory() {
  try {
    const result = await fetch("./bosses.json?v=keeper-1");
    if (result.ok) bossDirectory = await result.json();
  } catch {}
}
function huntTarget(id = serverState.target, method = activeHunt().method) {
  const p = pet(id),
    variant = id === "goa" ? CHASE_METHODS[method] : null;
  const metric = variant?.metric || p[3],
    name = variant?.name || p[2];
  const kc = variant ? (metrics[metric] ?? null) : kcFor(p);
  const rate = variant?.rate ?? rateFor(p),
    eligible = !!variant || modelEligible(p);
  const boss = bossDirectory.art[metric];
  const builtIn =
    id === "sraracha"
      ? { file: "sarachnis.png", label: "Sarachnis" }
      : variant
        ? {
            file:
              method === "gauntlet"
                ? "crystalline-hunllef.png"
                : "corrupted-hunllef.png",
            label: name,
          }
        : null;
  const render = boss || builtIn;
  return {
    pet: p,
    method: variant ? method : null,
    metric,
    name,
    kc,
    rate,
    eligible,
    chance: eligible ? probability(kc, rate) : null,
    rateText: variant
      ? "1 in " + fmtRate(rate) + " per successful " + name + " completion"
      : meta(p).rateText,
    wiki: variant
      ? wiki(name === "Corrupted Gauntlet" ? "The Corrupted Gauntlet" : name)
      : meta(p).wiki || wiki(p[2]),
    image: render ? "./media/" + render.file : meta(p).image,
    imageLabel: render
      ? render.label + " in-game boss model"
      : p[1] + " follower render (boss artwork unavailable)",
    paceId: variant ? id + ":" + method : id,
  };
}
function chaseOptions() {
  return CATALOG.flatMap((p) =>
    p[0] === "goa"
      ? Object.keys(CHASE_METHODS).map((method) => ({
          id: p[0],
          method,
          value: p[0] + ":" + method,
          name: CHASE_METHODS[method].name + " — " + p[1],
        }))
      : [{ id: p[0], method: null, value: p[0], name: p[2] + " — " + p[1] }],
  ).sort((a, b) => a.name.localeCompare(b.name));
}
function parseChase(value) {
  const [id, method] = (value || "").split(":");
  return { id, method: method || null };
}
function selectedChase() {
  const { id, method } = parseChase($("editTarget").value);
  return id ? huntTarget(id, method) : null;
}
function showTargetPreview() {
  const target = selectedChase();
  $("targetPreview").innerHTML = target
    ? '<img alt="' +
      escaped(target.imageLabel) +
      '" src="' +
      escaped(target.image) +
      '"><div><strong>' +
      escaped(target.name) +
      "</strong><small>" +
      escaped(target.pet[1]) +
      " · " +
      (target.kc === null ? "KC unavailable" : fmt(target.kc) + " current KC") +
      "</small><small>" +
      escaped(target.rateText || "Rate depends on method") +
      "</small></div>"
    : "<p>No matching boss or pet.</p>";
  $("startChase").disabled = !target;
}
function fillTargetPicker(query = "", preferred = "") {
  const options = chaseOptions().filter((row) =>
    row.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  $("editTarget").innerHTML = options
    .map(
      (row) =>
        '<option value="' + row.value + '">' + escaped(row.name) + "</option>",
    )
    .join("");
  if (options.some((row) => row.value === preferred))
    $("editTarget").value = preferred;
  showTargetPreview();
}
function mergeBossMetrics() {
  metrics =
    characterState.stale && syncOk
      ? { ...templeMetrics, ...womMetrics }
      : { ...womMetrics, ...templeMetrics };
}
function kcSourceFor(p, metric = p[3], kc = kcFor(p)) {
  if (
    templeMetrics[metric] !== undefined &&
    (!characterState.stale || !syncOk || womMetrics[metric] === undefined)
  )
    return "TempleOSRS";
  if (womMetrics[metric] !== undefined) return "Wise Old Man fallback";
  return kc !== null ? "Owner record" : null;
}
async function syncCharacter(force = false) {
  try {
    const data = await api("character" + (force ? "?refresh=1" : ""));
    if (data.username !== RSN || !data.metrics || data.unavailable)
      throw Error("Temple character data unavailable");
    characterState = data;
    templeMetrics = Object.fromEntries(
      Object.entries(data.metrics).filter(
        ([, n]) => Number.isInteger(n) && n > 0,
      ),
    );
    writeCache("character", data);
  } catch {
    characterState = { ...characterState, stale: true };
  }
  mergeBossMetrics();
}
async function syncKC(force = false) {
  await Promise.allSettled([syncCharacter(force), syncWOM(force)]);
  mergeBossMetrics();
  if (Object.keys(templeMetrics).length && !characterState.stale) {
    setSyncLabel(RSN.toUpperCase() + " · TEMPLE SYNCED", true);
    $("syncLabel").title =
      "Temple snapshot: " + dateLabel(characterState.snapshotAt);
    $("lastRefresh").textContent =
      "Temple snapshot: " +
      (dateLabel(characterState.snapshotAt) || "date unavailable");
  } else if (syncOk && Object.keys(womMetrics).length)
    setSyncLabel(RSN.toUpperCase() + " · WOM FALLBACK", true);
  else if (Object.keys(templeMetrics).length)
    setSyncLabel("TEMPLE UNAVAILABLE · CACHED KC");
  render();
}
async function syncProgress() {
  try {
    const data = await api("progress");
    progressEvents = Array.isArray(data.events) ? data.events : [];
    writeCache("progress", progressEvents);
  } catch {}
  renderRecentProgress();
}
function restoreChaseCache() {
  if (MOCK_MODE) return;
  const cached = readCache("character");
  if (cached?.username === RSN && cached.metrics) {
    characterState = { ...cached, stale: true };
    templeMetrics = cached.metrics;
  }
  progressEvents = readCache("progress") || [];
}
function renderCharacterHeader() {
  const number = (n) =>
    typeof n === "number" && Number.isFinite(n)
      ? n.toLocaleString("en-US", { maximumFractionDigits: 1 })
      : "—";
  $("headerEhp").textContent = number(characterState.ehp);
  $("headerEhb").textContent = number(characterState.ehb);
  const owned = CATALOG.filter(isOwned).length;
  $("headerPets").textContent =
    (ownershipKnown() ? "" : owned ? "≥" : "") +
    (ownershipKnown() || owned ? owned : "—");
  const rank = templePetRank();
  $("headerRankItem").classList.toggle("hidden", rank === null);
  $("headerPetRank").textContent = rank === null ? "—" : "#" + fmt(rank);
  $("characterUpdated").textContent = characterState.snapshotAt
    ? (characterState.stale ? "CACHED · " : "") +
      "TEMPLE " +
      dateLabel(characterState.snapshotAt)
    : "TEMPLE STATS UNAVAILABLE";
  $("characterUpdated").title =
    "Temple snapshot time, not a live game connection. Pet rank is shown only when Temple’s Petcord leaderboard supplies it.";
}
let verifiedPetRank = null;
function templePetRank() {
  return Number.isInteger(verifiedPetRank) && verifiedPetRank > 0
    ? verifiedPetRank
    : null;
}
function renderChase() {
  renderCharacterHeader();
  const hunt = activeHunt(),
    target = huntTarget(),
    p = target.pet,
    kc = target.kc,
    start = hunt.startKC;
  const gained =
    Number.isInteger(start) && kc !== null && kc >= start ? kc - start : null;
  $("huntStartKC").textContent = Number.isInteger(start) ? fmt(start) : "—";
  $("huntGainedKC").textContent = gained === null ? "—" : fmt(gained);
  $("huntSource").textContent = kcSourceFor(p, target.metric, kc)
    ? kcSourceFor(p, target.metric, kc) +
      (characterState.stale &&
      kcSourceFor(p, target.metric, kc) === "TempleOSRS"
        ? " · cached"
        : "")
    : "";
  $("huntStatus").textContent =
    hunt.status === "active"
      ? isOwned(p)
        ? "PET CONFIRMED · AWAITING OWNER COMPLETION"
        : "ACTIVE CHASE"
      : hunt.status === "completed"
        ? "CHASE COMPLETED"
        : "NO ACTIVE CHASE";
  if (hunt.status !== "active") {
    $("targetName").textContent = "NO ACTIVE CHASE";
    $("targetPet").textContent = "LAST TARGET: " + target.name + " // " + p[1];
    $("heroHuntLabel").textContent = "NO ACTIVE CHASE";
    $("targetSummary").textContent =
      "Last hunt " +
      (hunt.status === "completed" ? "completed" : "ended") +
      ". The owner can select the next chase.";
  } else
    $("targetSummary").textContent =
      (gained === null
        ? "HUNT GAIN UNAVAILABLE"
        : "THIS GRIND: " + fmt(gained) + " KC") +
      (Number.isInteger(start) ? " · STARTED AT " + fmt(start) + " KC" : "");
  renderHuntArchive();
  renderRecentProgress();
}
function acquisitionFor(p) {
  const own = serverState.owned?.[p[0]];
  const completed = (serverState.hunts || [])
    .slice()
    .reverse()
    .find(
      (h) =>
        h.petId === p[0] &&
        h.status === "completed" &&
        Number.isInteger(h.acquisitionKC) &&
        (!Number.isInteger(own?.kc) || own.kc === h.acquisitionKC),
    );
  if (completed)
    return {
      method: completed.method,
      kc: completed.acquisitionKC,
      rolls:
        Number.isInteger(completed.startKC) &&
        completed.acquisitionKC >= completed.startKC
          ? completed.acquisitionKC - completed.startKC
          : completed.acquisitionKC,
      hunt: Number.isInteger(completed.startKC),
    };
  if (Number.isInteger(own?.kc)) return { kc: own.kc };
  const record = records().find(
    (r) => r.petId === p[0] && Number.isInteger(r.kc),
  );
  if (record) return { kc: record.kc };
  return null;
}
function recordedLuck(p, kc, method = null) {
  const target = huntTarget(p[0], method);
  if (!target.eligible) return null;
  const chance = probability(kc, target.rate);
  if (chance === null) return null;
  const label =
    chance <= 0.01
      ? "EXCEPTIONAL SPOON"
      : chance <= 0.1
        ? "SPOON"
        : chance >= 0.99
          ? "EXTREMELY LONG GRIND"
          : chance >= 0.9
            ? "LONG GRIND"
            : null;
  return { chance, label };
}
function petLuckBadge(p) {
  const record = isOwned(p) ? acquisitionFor(p) : null,
    luck = record
      ? recordedLuck(p, record.rolls ?? record.kc, record.method)
      : null;
  return luck?.label
    ? '<div class="pet-detail luck-label">' + luck.label + "</div>"
    : "";
}
function petRecordDetails(p) {
  if (!isOwned(p)) return "";
  const record = acquisitionFor(p),
    note = serverState.petNotes?.[p[0]] || serverState.owned?.[p[0]]?.note;
  const luck = record
    ? recordedLuck(p, record.rolls ?? record.kc, record.method)
    : null;
  const date =
    typeof confirmedPetDates === "function"
      ? confirmedPetDates().get(p[0])
      : null;
  return (
    (record
      ? `<p class="pet-acquisition">RECORDED ACQUISITION: <strong>${fmt(record.kc)} KC</strong>${luck ? `<br>${luck.label ? '<b class="luck-label">' + luck.label + "</b> · " : ""}${(luck.chance * 100).toFixed(2)}% base-model chance ${record.hunt ? "in " + fmt(record.rolls) + " recorded hunt kills" : "by this KC"}` : ""}</p>`
      : "") +
    (date
      ? "<p>Temple acquisition record: " + escaped(snapshotDate(date)) + "</p>"
      : "") +
    (note ? `<p class="pet-personal-note">${escaped(note)}</p>` : "")
  );
}
function renderHuntArchive() {
  const hunts = (serverState.hunts || []).slice().reverse().slice(0, 8);
  const previous = $("completedHunts");
  if (previous) previous.remove();
  if (!hunts.length) return;
  const element = document.createElement("div");
  element.id = "completedHunts";
  element.className = "completed-hunts";
  element.innerHTML = hunts
    .map((h) => {
      const p = CATALOG.find((p) => p[0] === h.petId);
      if (!p) return "";
      const end = h.status === "completed" ? h.acquisitionKC : h.endKC;
      return `<article class="hunt-history-row"><div><strong>${escaped(huntTarget(p[0], h.method || null).name)} · ${escaped(p[1])}</strong><small>${h.status === "completed" ? "COMPLETED" : "ENDED"}${h.acquisitionDate ? " · ACQUIRED " + escaped(h.acquisitionDate) : ""}</small></div><span>${Number.isInteger(h.startKC) ? fmt(h.startKC) : "—"} → ${Number.isInteger(end) ? fmt(end) : "—"} KC</span>${h.note ? `<p>${escaped(h.note)}</p>` : ""}</article>`;
    })
    .join("");
  $("historyItems").prepend(element);
  $("historyItems").querySelector(".empty")?.remove();
}
function renderRecentProgress() {
  const dates =
    typeof confirmedPetDates === "function" ? confirmedPetDates() : new Map();
  const dateText = (t) =>
    typeof snapshotDate === "function"
      ? snapshotDate(t)
      : new Date(t).toLocaleString();
  const hunts = (serverState.hunts || []).filter(
    (h) => h.status === "completed",
  );
  const completed = new Set(hunts.map((h) => h.petId));
  const events = [
    ...progressEvents,
    ...templeRecent.map((r) => ({
      id: "pet:" + r.id,
      type: "pet",
      petId: r.id,
      recordedAt: r.detectedAt,
    })),
    ...[...dates].map(([id, at]) => ({
      id: "pet:" + id,
      type: "pet",
      petId: id,
      recordedAt: at,
      acquired: true,
    })),
    ...hunts.map((h) => ({
      id: "complete:" + h.id,
      type: "completed",
      petId: h.petId,
      kc: h.acquisitionKC,
      recordedAt: h.acquisitionDate
        ? stamp(h.acquisitionDate)?.getTime()
        : h.endedAt,
      acquisitionDate: h.acquisitionDate,
    })),
    ...(typeof earnedTrophies === "function" ? earnedTrophies() : [])
      .filter((t) => t.recordedAt)
      .map((t) => ({
        id: "achievement:" + t.id,
        type: "achievement",
        title: t.title,
        source: t.provenance,
        recordedAt: t.recordedAt,
      })),
  ];
  const unique = new Map();
  for (const event of events) {
    const petId =
      event.petId ||
      (event.templeItemId && petForTempleId(event.templeItemId)?.[0]);
    const e = { ...event, petId };
    if (!Number.isFinite(e.recordedAt)) continue;
    if (e.type === "pet") {
      if (!petId || completed.has(petId)) continue;
      if (dates.has(petId)) {
        e.recordedAt = dates.get(petId);
        e.acquired = true;
      }
    }
    if (
      ["pet", "completed", "kc"].includes(e.type) &&
      !CATALOG.some((p) => p[0] === petId)
    )
      continue;
    const key = e.type === "pet" ? "pet:" + petId : e.id;
    if (!unique.has(key) || e.acquired || e.acquisitionDate) unique.set(key, e);
  }
  const rows = [...unique.values()]
    .sort((a, b) => b.recordedAt - a.recordedAt)
    .slice(0, 8);
  $("feedItems").innerHTML = rows.length
    ? rows
        .map((e) => {
          const p = e.petId ? pet(e.petId) : null;
          let label, text, date;
          switch (e.type) {
            case "pet":
              label = e.acquired
                ? "PET ACQUIRED · TEMPLE"
                : "PET CONFIRMED · TEMPLE";
              text = p[1];
              date =
                (e.acquired ? "Acquired " : "Detected ") +
                dateText(e.recordedAt);
              break;
            case "completed":
              label = "HUNT COMPLETED · OWNER";
              text =
                p[1] +
                (Number.isInteger(e.kc)
                  ? " · " + fmt(e.kc) + " acquisition KC"
                  : "");
              date = e.acquisitionDate
                ? "Acquired " + e.acquisitionDate
                : "Recorded " + dateText(e.recordedAt);
              break;
            case "kc":
              label = "HUNT MILESTONE · TEMPLE";
              text = fmt(e.gained) + " KC gained chasing " + p[1];
              date = "Recorded " + dateText(e.recordedAt);
              break;
            case "xp":
              label = "XP MILESTONE · TEMPLE";
              text = fmt(e.value) + " total XP";
              date = "Observed " + dateText(e.recordedAt);
              break;
            case "skill":
            case "cooking":
              label = "SKILL MILESTONE · TEMPLE";
              text = "200M " + (e.skill || "Cooking") + " XP";
              date = "Observed " + dateText(e.recordedAt);
              break;
            case "achievement":
              label = e.source;
              text = e.title;
              date = dateText(e.recordedAt);
              break;
            default:
              return "";
          }
          return (
            '<div class="feed-item"><div class="feed-icon" aria-hidden="true">✦</div><div class="feed-copy"><small>' +
            escaped(label) +
            "</small><strong>" +
            escaped(text) +
            "</strong><small>" +
            escaped(date) +
            "</small></div></div>"
          );
        })
        .join("")
    : '<p class="fineprint">No dated milestones recorded yet. Confirmed residents are listed in the collection.</p>';
  $("feedItems").innerHTML += (serverState.notes || [])
    .slice(-2)
    .reverse()
    .map(
      (n) =>
        '<div class="feed-item"><div class="feed-copy"><strong>OWNER NOTE</strong><p>' +
        escaped(n.body) +
        "</p>" +
        (n.date ? "<small>" + escaped(n.date) + "</small>" : "") +
        "</div></div>",
    )
    .join("");
}
function setupChaseEditor() {
  if (!adminAllowed || !CAN_EDIT_ORIGIN) return;
  if (!$("chaseControls")) {
    const section = document.createElement("section");
    section.id = "chaseControls";
    section.className = "chase-controls";
    section.innerHTML =
      '<p id="editorHuntStatus" class="modal-help"></p><div class="chase-actions"><button id="useCurrentKC" class="secondary-button" type="button">USE CURRENT KC</button><button id="startChase" class="primary-button" type="button">START / CHANGE CHASE</button><button id="endChase" class="secondary-button" type="button">END WITHOUT PET</button></div><div class="edit-grid"><label class="form-label">ACQUISITION KC (IF KNOWN)<input id="acquisitionKC" type="number" min="0" step="1" placeholder="Leave unknown blank"></label><label class="form-label">ACQUISITION DATE (IF KNOWN)<input id="acquisitionDate" type="date"></label><label class="form-label">NEXT CHASE AFTER COMPLETION<select id="nextChase" aria-label="NEXT CHASE AFTER COMPLETION"></select></label></div><button id="completeChase" class="primary-button" type="button">PET OBTAINED · COMPLETE HUNT</button><p class="modal-help">Chase buttons save immediately. Save other owner edits separately below. Blank starting KC uses the latest Temple snapshot when available; acquisition KC and acquisition date are never inferred.</p><button id="cancelTarget" class="secondary-button" type="button">CANCEL</button><p id="chaseError" class="error" role="status"></p>';
    $("editPanel").querySelector(".edit-grid").after(section);
    const importer = $("editPanel").querySelector(".collection-import");
    if (importer) section.after(importer);
    const useCurrent = () =>
      ($("editStartKC").value = selectedChase()?.kc ?? "");
    $("useCurrentKC").onclick = useCurrent;
    $("editTarget").onchange = () => {
      showTargetPreview();
      useCurrent();
    };
    $("targetSearch").oninput = () => {
      const before = $("editTarget").value;
      fillTargetPicker($("targetSearch").value, before);
      if ($("editTarget").value !== before) useCurrent();
    };
    $("cancelTarget").onclick = closeModal;
    $("startChase").onclick = () => saveChase("start");
    $("endChase").onclick = () => saveChase("end");
    $("completeChase").onclick = () => saveChase("complete");
  }
  const hunt = activeHunt();
  $("targetSearch").value = "";
  fillTargetPicker(
    "",
    hunt.petId === "goa" ? "goa:" + (hunt.method || "gauntlet") : hunt.petId,
  );
  $("editStartKC").value = hunt.startKC ?? "";
  $("startChase").textContent =
    editorMode === "target" ? "SAVE TARGET" : "START / CHANGE CHASE";
  $("editorHuntStatus").textContent =
    (hunt.status === "active" ? "Active: " : "Last chase: ") +
    huntTarget().name +
    (Number.isInteger(hunt.startKC)
      ? " · Starting KC " + fmt(hunt.startKC)
      : " · Starting KC unknown");
  $("nextChase").innerHTML =
    '<option value="">No next chase yet</option>' +
    chaseOptions()
      .filter((row) => row.id !== hunt.petId)
      .map(
        (row) =>
          '<option value="' +
          row.value +
          '">' +
          escaped(row.name) +
          "</option>",
      )
      .join("");
  $("acquisitionKC").value = "";
  $("acquisitionDate").value = "";
  $("endChase").disabled = $("completeChase").disabled =
    hunt.status !== "active";
  $("chaseError").textContent = "";
}
async function saveChase(action) {
  if (!adminAllowed || !CAN_EDIT_ORIGIN) return;
  const hunt = activeHunt(),
    start = $("editStartKC").value,
    drop = $("acquisitionKC").value;
  const input = {
    action,
    huntId: editable?.hunt?.id || "legacy-" + editable?.target,
    expectedUpdatedAt: editable?.updatedAt || 0,
    note: $("editHuntNote").value,
  };
  if (action === "start") {
    const selected = selectedChase();
    if (!selected) return;
    input.petId = selected.pet[0];
    input.method = selected.method;
    input.restart = editorMode !== "target";
    input.startKC = start === "" ? null : Number(start);
  }
  if (action === "complete") {
    input.acquisitionKC = drop === "" ? null : Number(drop);
    input.acquisitionDate = $("acquisitionDate").value || null;
    const next = parseChase($("nextChase").value);
    input.nextPetId = next.id || null;
    input.nextMethod = next.method;
  }
  $("chaseError").textContent = "";
  const buttons = ["startChase", "endChase", "completeChase"];
  buttons.forEach((id) => ($(id).disabled = true));
  try {
    serverState = await api("hunt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    writeCache("manual", serverState);
    render();
    if (editorMode === "target" && action === "start") closeModal();
    else showEditor();
    await syncProgress();
    toast(
      action === "complete"
        ? "HUNT COMPLETED · RECORD SAVED"
        : action === "end"
          ? "HUNT ENDED"
          : "CHASE UPDATED",
    );
  } catch (error) {
    $("chaseError").textContent = error.message;
  } finally {
    buttons.forEach((id) => ($(id).disabled = false));
    if (editable) showTargetPreview();
    if (activeHunt().status !== "active")
      $("endChase").disabled = $("completeChase").disabled = true;
  }
}
