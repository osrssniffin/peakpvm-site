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
function mergeBossMetrics() {
  metrics =
    characterState.stale && syncOk
      ? { ...templeMetrics, ...womMetrics }
      : { ...womMetrics, ...templeMetrics };
}
function kcSourceFor(p) {
  if (
    templeMetrics[p[3]] !== undefined &&
    (!characterState.stale || !syncOk || womMetrics[p[3]] === undefined)
  )
    return "TempleOSRS";
  if (womMetrics[p[3]] !== undefined) return "Wise Old Man fallback";
  return kcFor(p) !== null ? "Owner record" : null;
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
    p = pet(serverState.target),
    kc = kcFor(p),
    start = hunt.startKC;
  const gained =
    Number.isInteger(start) && kc !== null && kc >= start ? kc - start : null;
  $("huntStartKC").textContent = Number.isInteger(start) ? fmt(start) : "—";
  $("huntGainedKC").textContent = gained === null ? "—" : fmt(gained);
  $("huntSource").textContent = kcSourceFor(p)
    ? kcSourceFor(p) +
      (characterState.stale && kcSourceFor(p) === "TempleOSRS"
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
    $("targetPet").textContent = "LAST TARGET: " + p[2] + " // " + p[1];
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
function recordedLuck(p, kc) {
  if (!modelEligible(p)) return null;
  const chance = probability(kc, rateFor(p));
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
    luck = record ? recordedLuck(p, record.rolls ?? record.kc) : null;
  return luck?.label
    ? '<div class="pet-detail luck-label">' + luck.label + "</div>"
    : "";
}
function petRecordDetails(p) {
  if (!isOwned(p)) return "";
  const record = acquisitionFor(p),
    note = serverState.petNotes?.[p[0]] || serverState.owned?.[p[0]]?.note;
  const luck = record ? recordedLuck(p, record.rolls ?? record.kc) : null;
  return (
    (record
      ? `<p class="pet-acquisition">RECORDED ACQUISITION: <strong>${fmt(record.kc)} KC</strong>${luck ? `<br>${luck.label ? '<b class="luck-label">' + luck.label + "</b> · " : ""}${(luck.chance * 100).toFixed(2)}% base-model chance ${record.hunt ? "in " + fmt(record.rolls) + " recorded hunt kills" : "by this KC"}` : ""}</p>`
      : "") + (note ? `<p class="pet-personal-note">${escaped(note)}</p>` : "")
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
      return `<article class="hunt-history-row"><div><strong>${escaped(p[1])}</strong><small>${h.status === "completed" ? "COMPLETED" : "ENDED"}${h.acquisitionDate ? " · ACQUIRED " + escaped(h.acquisitionDate) : ""}</small></div><span>${Number.isInteger(h.startKC) ? fmt(h.startKC) : "—"} → ${Number.isInteger(end) ? fmt(end) : "—"} KC</span>${h.note ? `<p>${escaped(h.note)}</p>` : ""}</article>`;
    })
    .join("");
  $("historyItems").prepend(element);
  $("historyItems").querySelector(".empty")?.remove();
}
function renderRecentProgress() {
  const events = [
    ...progressEvents,
    ...templeRecent.map((r) => ({
      id: "local:" + r.id,
      type: "pet",
      petId: r.id,
      recordedAt: r.detectedAt,
    })),
    ...(serverState.hunts || [])
      .filter((h) => h.status === "completed")
      .map((h) => ({
        id: "complete:" + h.id,
        type: "completed",
        petId: h.petId,
        kc: h.acquisitionKC,
        recordedAt: h.endedAt,
        acquisitionDate: h.acquisitionDate,
      })),
  ];
  const seen = new Set();
  const rows = events
    .sort((a, b) => b.recordedAt - a.recordedAt)
    .filter((e) => {
      const id = e.type === "pet" ? "pet:" + e.petId : e.id;
      if (seen.has(id)) return false;
      seen.add(id);
      return CATALOG.some((p) => p[0] === e.petId);
    })
    .slice(0, 6);
  $("feedItems").innerHTML = rows.length
    ? '<div class="eyebrow progress-label">RECENT PROGRESS</div>' +
      rows
        .map((e) => {
          const p = pet(e.petId);
          const text =
            e.type === "pet"
              ? p[1] + " newly confirmed in Temple."
              : e.type === "completed"
                ? p[1] +
                  " hunt completed" +
                  (Number.isInteger(e.kc)
                    ? " at " + fmt(e.kc) + " acquisition KC."
                    : ".")
                : fmt(e.gained) + " KC gained chasing " + p[1] + ".";
          return `<div class="feed-item"><div class="feed-icon">✦</div><div class="feed-copy"><strong>${e.type === "pet" ? "TEMPLE SYNC" : e.type === "completed" ? "HUNT COMPLETED" : "KC MILESTONE"}</strong><p>${escaped(text)}</p><small>${e.type === "pet" ? "Detected" : "Recorded"} ${escaped(new Date(e.recordedAt).toLocaleString())}</small></div></div>`;
        })
        .join("")
    : "";
  const notes = (serverState.notes || []).slice(-2).reverse();
  $("feedItems").innerHTML += notes
    .map(
      (n) =>
        `<div class="feed-item"><div class="feed-copy"><strong>OWNER NOTE</strong><p>${escaped(n.body)}</p>${n.date ? "<small>" + escaped(n.date) + "</small>" : ""}</div></div>`,
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
      '<p id="editorHuntStatus" class="modal-help"></p><div class="chase-actions"><button id="useCurrentKC" class="secondary-button" type="button">USE CURRENT KC</button><button id="startChase" class="primary-button" type="button">START / CHANGE CHASE</button><button id="endChase" class="secondary-button" type="button">END WITHOUT PET</button></div><div class="edit-grid"><label class="form-label">ACQUISITION KC (IF KNOWN)<input id="acquisitionKC" type="number" min="0" step="1" placeholder="Leave unknown blank"></label><label class="form-label">ACQUISITION DATE (IF KNOWN)<input id="acquisitionDate" type="date"></label><label class="form-label">NEXT CHASE AFTER COMPLETION<select id="nextChase" aria-label="NEXT CHASE AFTER COMPLETION"></select></label></div><button id="completeChase" class="primary-button" type="button">PET OBTAINED · COMPLETE HUNT</button><p class="modal-help">Chase buttons save immediately. Save other owner edits separately below. Blank starting KC uses the latest Temple snapshot when available; acquisition KC and acquisition date are never inferred.</p><p id="chaseError" class="error" role="status"></p>';
    $("editPanel").querySelector(".edit-grid").after(section);
    const importer = $("editPanel").querySelector(".collection-import");
    if (importer) section.after(importer);
    $("useCurrentKC").onclick = () => {
      $("editStartKC").value = kcFor(pet($("editTarget").value)) ?? "";
    };
    $("editTarget").onchange = () => {
      $("editStartKC").value = kcFor(pet($("editTarget").value)) ?? "";
    };
    $("startChase").onclick = () => saveChase("start");
    $("endChase").onclick = () => saveChase("end");
    $("completeChase").onclick = () => saveChase("complete");
  }
  const hunt = activeHunt();
  $("editorHuntStatus").textContent =
    (hunt.status === "active" ? "Active: " : "Last chase: ") +
    pet(hunt.petId)[1] +
    (Number.isInteger(hunt.startKC)
      ? " · Starting KC " + fmt(hunt.startKC)
      : " · Starting KC unknown");
  $("nextChase").innerHTML =
    '<option value="">No next chase yet</option>' +
    CATALOG.filter((p) => p[0] !== hunt.petId)
      .map(
        (p) =>
          `<option value="${p[0]}">${escaped(p[1])} · ${escaped(p[2])}</option>`,
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
    input.petId = $("editTarget").value;
    input.startKC = start === "" ? null : Number(start);
  }
  if (action === "complete") {
    input.acquisitionKC = drop === "" ? null : Number(drop);
    input.acquisitionDate = $("acquisitionDate").value || null;
    input.nextPetId = $("nextChase").value || null;
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
    showEditor();
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
    if (activeHunt().status !== "active")
      $("endChase").disabled = $("completeChase").disabled = true;
  }
}
