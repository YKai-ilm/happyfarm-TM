const SAVE_KEY = "happy-farm-browser-game-v2";
const PLOT_COUNT = 16;
// 原版開墾：最初 6 格，之後依序解鎖（金幣 / 需求等級）
const PLOT_UNLOCKS = [
  { cost: 2000, level: 2 },
  { cost: 5000, level: 3 },
  { cost: 10000, level: 5 },
  { cost: 20000, level: 7 },
  { cost: 30000, level: 9 },
  { cost: 50000, level: 11 },
  { cost: 70000, level: 13 },
  { cost: 90000, level: 15 },
  { cost: 120000, level: 17 },
  { cost: 150000, level: 19 },
  { cost: 180000, level: 21 },
  { cost: 230000, level: 23 },
];

// 各田標桿位置（GM 校正匯出；% 為標桿中心相對該田）
const STAKE_POS = {
  0: [20.8, 61.2], 1: [21.2, 63.5], 2: [22.4, 63.5], 3: [23.4, 63.5],
  4: [15.9, 39.7], 5: [15.5, 34.9], 6: [19.8, 34.9], 7: [24.9, 30.1],
  8: [16.1, 45.9], 9: [17.3, 44.6], 10: [20.9, 42.0], 11: [23.6, 43.3],
  12: [13.6, 47.2], 13: [3.1, 48.2], 14: [21.5, 49.2], 15: [26.0, 49.2],
};

const CLOUD_POS = { 0: [51.4, 6.3], 1: [35.1, 10.9] };
const BUILDING_POS = { windmill: [53.6, 25.0], doghouse: [65.1, 31.1], fishing: [15.2, 24.3], pond: [11.7, 37.2] };

function applyClouds() {
  const fx = document.querySelector("#weatherFx");
  if (!fx) return;
  if (!Object.keys(gmCloudPos).length) {
    try { gmCloudPos = JSON.parse(localStorage.getItem("gm-cloud-pos") || "{}") || {}; } catch (e) { gmCloudPos = {}; }
  }
  fx.querySelectorAll(".wfx-cloud-img").forEach((img) => {
    const k = img.dataset.cloud;
    const pos = gmCloudPos[k] || CLOUD_POS[k];
    if (pos) { img.style.left = pos[0] + "%"; img.style.top = pos[1] + "%"; }
    img.style.pointerEvents = state.gm ? "auto" : "none";
    img.style.cursor = state.gm ? "grab" : "default";
  });
}

function setupCloudDrag() {
  const fx = document.querySelector("#weatherFx");
  if (!fx) return;
  fx.querySelectorAll(".wfx-cloud-img").forEach((img) => {
    if (img.dataset.dragReady) return;
    img.dataset.dragReady = "1";
    const key = img.dataset.cloud;
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    img.addEventListener("pointerdown", (e) => {
      if (!state.gm) return;
      dragging = true;
      const r = fx.getBoundingClientRect(), ir = img.getBoundingClientRect();
      ox = ir.left - r.left; oy = ir.top - r.top; sx = e.clientX; sy = e.clientY;
      e.preventDefault();
      try { img.setPointerCapture(e.pointerId); } catch (err) {}
    });
    img.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const r = fx.getBoundingClientRect();
      let x = Math.max(0, Math.min(100, (ox + (e.clientX - sx)) / r.width * 100));
      let y = Math.max(0, Math.min(100, (oy + (e.clientY - sy)) / r.height * 100));
      img.style.left = x.toFixed(1) + "%"; img.style.top = y.toFixed(1) + "%";
      gmCloudPos[key] = [Number(x.toFixed(1)), Number(y.toFixed(1))];
      const readout = document.querySelector("#gmStakeReadout");
      if (readout) readout.textContent = `雲#${Number(key) + 1}｜left ${x.toFixed(1)}%　top ${y.toFixed(1)}%`;
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      try { img.releasePointerCapture(e.pointerId); } catch (err) {}
      try { localStorage.setItem("gm-cloud-pos", JSON.stringify(gmCloudPos)); } catch (err) {}
    };
    img.addEventListener("pointerup", end);
    img.addEventListener("pointercancel", end);
  });
}

let gmDogOverride = "";   // GM 狗窩狀態測試覆蓋
let dogBarkUntil = 0;     // 趕走小偷後維持「敵人(吠叫)」圖到此時間
let visitDogBarkUntil = 0;   // 參觀好友時被狗趕，狗窩顯示敵人圖到此時間
const DOG_SAT_MS = 6 * 3600 * 1000;     // 飽食度 6 小時歸零
const DOG_HAPPY_MS = 8 * 3600 * 1000;   // 開心度 8 小時歸零
function dogSatiety() { if (!state.dog) return 0; return Math.max(0, Math.min(100, 100 - (Date.now() - (state.dog.fedAt || 0)) / DOG_SAT_MS * 100)); }
function dogHappiness() { if (!state.dog) return 0; return Math.max(0, Math.min(100, 100 - (Date.now() - (state.dog.happyAt || 0)) / DOG_HAPPY_MS * 100)); }
function dogWorking() { return !!(state.dog && state.dog.guardOn !== false && dogSatiety() > 0); }   // 防盜開+飽食度>0 才工作(顧家趕小偷)
function dogStateForProfile() { if (!state.doghouseBought) return "none"; if (!state.dog) return "empty"; if (state.dog.guardOn === false) return "guardoff"; return dogSatiety() > 0 ? "wait" : "sleep"; }
const DOG_CATCH = 0.9;
const DOG_IMG = {
  empty: "./assets/decor/doghouse.png",
  wait: "./assets/decor/doghouse-wait.png",
  sleep: "./assets/decor/doghouse-sleep.png",
  enemy: "./assets/decor/doghouse-enemy.png",
  walk: "./assets/decor/dog.png",
  guardoff: "./assets/decor/doghouse-guardoff.png",
};
function doghouseImg() {
  if (gmDogOverride) return DOG_IMG[gmDogOverride] || DOG_IMG.empty;
  if (!state.dog) return DOG_IMG.empty;
  if (state.dog.guardOn === false) return DOG_IMG.guardoff;
  const sat = dogSatiety();
  const thief = (state.plots || []).some((p) => p.thief);
  if (sat > 0 && (thief || Date.now() < dogBarkUntil)) return DOG_IMG.enemy;
  if (sat <= 0) return DOG_IMG.sleep;
  return DOG_IMG.wait;
}

function applyBuildings() {
  const fx = document.querySelector("#weatherFx");
  if (!fx) return;
  if (!Object.keys(gmBuildingPos).length) {
    try { gmBuildingPos = JSON.parse(localStorage.getItem("gm-building-pos") || "{}") || {}; } catch (e) { gmBuildingPos = {}; }
    let cleaned = false;
    Object.keys(gmBuildingPos).forEach((k) => {
      const p = gmBuildingPos[k];
      if (!(Array.isArray(p) && p.length >= 2 && typeof p[0] === "number" && typeof p[1] === "number" && isFinite(p[0]) && isFinite(p[1]))) { delete gmBuildingPos[k]; cleaned = true; }
    });
    if (cleaned) { try { localStorage.setItem("gm-building-pos", JSON.stringify(gmBuildingPos)); } catch (e2) {} }
    // 一次性修復：把曾被拖壞(卡左上角)的狗窩座標清回預設，僅執行一次
    try {
      if (!localStorage.getItem("dogpos-fix2")) {
        delete gmBuildingPos.doghouse;
        localStorage.setItem("gm-building-pos", JSON.stringify(gmBuildingPos));
        localStorage.setItem("dogpos-fix2", "1");
      }
    } catch (e3) {}
  }
  const wm = fx.querySelector("#bld-windmill");
  if (wm) {
    let active;
    if (visiting) active = visiting.kind === "cloud" && visitScene !== "ranch" && (visiting.windmill || 0) >= 1;
    else active = (state.upgrades && state.upgrades.windmill || 0) >= 1 && state.scene !== "ranch";
    wm.style.display = active ? "block" : "none";
    if (active) {
      const pos = visiting ? BUILDING_POS.windmill : (gmBuildingPos.windmill || BUILDING_POS.windmill);
      if (pos) { wm.style.left = pos[0] + "%"; wm.style.top = pos[1] + "%"; }
      wm.style.pointerEvents = (!visiting && state.gm) ? "auto" : "none";
      wm.style.cursor = (!visiting && state.gm) ? "grab" : "default";
    }
  }
  const dh = fx.querySelector("#bld-doghouse");
  if (dh) {
    try {
      let active = false, imgKey = null;
      if (visiting) {
        // 參觀好友農場：顯示好友的狗窩(依公開檔 dogState)，只在農場場景
        if (visiting.kind === "cloud" && visitScene !== "ranch" && visiting.dogState && visiting.dogState !== "none") {
          active = true; imgKey = (Date.now() < visitDogBarkUntil) ? "enemy" : visiting.dogState;
        }
      } else {
        active = gmDogOverride !== "none" && state.scene !== "ranch" && (state.doghouseBought || !!gmDogOverride || state.gm);
      }
      dh.style.display = active ? "block" : "none";
      if (active) {
        const want = imgKey ? (DOG_IMG[imgKey] || DOG_IMG.empty) : doghouseImg();
        if (dh.getAttribute("src") !== want) dh.setAttribute("src", want);
        let dp = visiting ? null : gmBuildingPos.doghouse;
        if (!(dp && (dp[0] > 2 || dp[1] > 8))) dp = BUILDING_POS.doghouse;
        dh.style.left = dp[0] + "%"; dh.style.top = dp[1] + "%";
        dh.style.pointerEvents = "auto";
        dh.style.cursor = visiting ? "pointer" : ((state.gm && !visiting) ? "grab" : "default");
      }
    } catch (e) { console.error("doghouse render err", e); }
  }
  const fs = fx.querySelector("#bld-fishing");
  if (fs) {
    // 只在自家農場、且天氣為 晴/多雲/微風/烈日 時出現
    const okWx = ["sun", "cloud", "breeze", "scorch", "fog"].includes(state.weather);
    const active = !visiting && state.scene !== "ranch" && okWx;
    fs.style.display = active ? "block" : "none";
    if (active) {
      const pos = gmBuildingPos.fishing || BUILDING_POS.fishing;
      fs.style.left = pos[0] + "%"; fs.style.top = pos[1] + "%";
      fs.style.transform = "scale(" + (gmBuildingScale.fishing || 0.75) + ")";
      fs.style.pointerEvents = (state.gm && !visiting) ? "auto" : "none";
      fs.style.cursor = (state.gm && !visiting) ? "grab" : "default";
    }
    updateBuildingScaleSlider("#bld-fishing", "fishing", 14);
  }
  const pond = fx.querySelector("#bld-pond");
  if (pond) {
    const active = !visiting && state.scene !== "ranch";   // 水池區一直可點(所有天氣)
    pond.style.display = active ? "block" : "none";
    if (active) {
      const e = gmPondEllipse;
      pond.style.left = (e.cx - e.rx) + "%"; pond.style.top = (e.cy - e.ry) + "%";
      pond.style.width = (e.rx * 2) + "%"; pond.style.height = (e.ry * 2) + "%";
      pond.style.transform = "none"; pond.style.borderRadius = "50%";
      pond.style.pointerEvents = "auto";
      pond.style.cursor = (state.gm && !visiting) ? "move" : "pointer";
    }
    updatePondHandles(active && state.gm && !visiting);
  }
}

function updatePondHandles(show) {
  const fx = document.querySelector("#weatherFx");
  if (!fx) return;
  let wrap = fx.querySelector("#pondHandles");
  if (!show) { if (wrap) wrap.style.display = "none"; return; }
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "pondHandles";
    ["t", "b", "l", "r"].forEach((d) => {
      const h = document.createElement("div");
      h.className = "pond-handle pond-h-" + d; h.dataset.dir = d;
      wrap.appendChild(h);
    });
    fx.appendChild(wrap);
    setupPondHandles(wrap);
  }
  wrap.style.display = "block";
  const e = gmPondEllipse;
  const set = (sel, x, y) => { const h = wrap.querySelector(sel); if (h) { h.style.left = x + "%"; h.style.top = y + "%"; } };
  set(".pond-h-t", e.cx, e.cy - e.ry);
  set(".pond-h-b", e.cx, e.cy + e.ry);
  set(".pond-h-l", e.cx - e.rx, e.cy);
  set(".pond-h-r", e.cx + e.rx, e.cy);
}

function savePondEllipse() {
  try { localStorage.setItem("gm-pond-ellipse", JSON.stringify(gmPondEllipse)); } catch (e) {}
}

function refreshPondEllipseUI() {
  const e = gmPondEllipse;
  const pond = document.querySelector("#bld-pond");
  if (pond) {
    pond.style.left = (e.cx - e.rx) + "%"; pond.style.top = (e.cy - e.ry) + "%";
    pond.style.width = (e.rx * 2) + "%"; pond.style.height = (e.ry * 2) + "%";
  }
  updatePondHandles(true);
  const ro = document.querySelector("#gmStakeReadout");
  if (ro) ro.textContent = "水池橢圓｜中心 " + e.cx.toFixed(1) + "," + e.cy.toFixed(1) + "　半徑 " + e.rx.toFixed(1) + "×" + e.ry.toFixed(1);
}

function setupPondHandles(wrap) {
  let dir = "", sx = 0, sy = 0, e0 = null;
  wrap.querySelectorAll(".pond-handle").forEach((h) => {
    h.addEventListener("pointerdown", (ev) => {
      dir = h.dataset.dir; sx = ev.clientX; sy = ev.clientY; e0 = { ...gmPondEllipse };
      ev.preventDefault(); ev.stopPropagation();
      try { h.setPointerCapture(ev.pointerId); } catch (e) {}
    });
    h.addEventListener("pointermove", (ev) => {
      if (!dir) return;
      const fx = document.querySelector("#weatherFx"); const fr = fx.getBoundingClientRect();
      if (!fr.width || !fr.height) return;
      const dx = (ev.clientX - sx) / fr.width * 100, dy = (ev.clientY - sy) / fr.height * 100;
      const e = gmPondEllipse;
      if (dir === "r") { const L = e0.cx - e0.rx, R = e0.cx + e0.rx + dx; e.rx = Math.max(2, (R - L) / 2); e.cx = L + e.rx; }
      else if (dir === "l") { const R = e0.cx + e0.rx, L = e0.cx - e0.rx + dx; e.rx = Math.max(2, (R - L) / 2); e.cx = R - e.rx; }
      else if (dir === "b") { const T = e0.cy - e0.ry, B = e0.cy + e0.ry + dy; e.ry = Math.max(1.5, (B - T) / 2); e.cy = T + e.ry; }
      else if (dir === "t") { const B = e0.cy + e0.ry, T = e0.cy - e0.ry + dy; e.ry = Math.max(1.5, (B - T) / 2); e.cy = B - e.ry; }
      refreshPondEllipseUI();
    });
    const end = () => { if (dir) { dir = ""; savePondEllipse(); } };
    h.addEventListener("pointerup", end);
    h.addEventListener("pointercancel", end);
  });
}

function setupPondBodyDrag() {
  const pond = document.querySelector("#bld-pond");
  if (!pond || pond.dataset.ellReady) return;
  pond.dataset.ellReady = "1";
  let sx = 0, sy = 0, c0 = null, moving = false;
  pond.addEventListener("pointerdown", (ev) => {
    if (!state.gm || visiting) return;
    if (ev.target !== pond) return;   // 點在把手上不算移動
    sx = ev.clientX; sy = ev.clientY; c0 = { cx: gmPondEllipse.cx, cy: gmPondEllipse.cy }; moving = true;
    ev.preventDefault();
    try { pond.setPointerCapture(ev.pointerId); } catch (e) {}
  });
  pond.addEventListener("pointermove", (ev) => {
    if (!moving) return;
    const fx = document.querySelector("#weatherFx"); const fr = fx.getBoundingClientRect();
    if (!fr.width || !fr.height) return;
    gmPondEllipse.cx = c0.cx + (ev.clientX - sx) / fr.width * 100;
    gmPondEllipse.cy = c0.cy + (ev.clientY - sy) / fr.height * 100;
    refreshPondEllipseUI();
  });
  const end = () => { if (moving) { moving = false; savePondEllipse(); } };
  pond.addEventListener("pointerup", end);
  pond.addEventListener("pointercancel", end);
}

function updateBuildingScaleSlider(sel, key, baseW) {
  const fx = document.querySelector("#weatherFx");
  if (!fx) return;
  const el = fx.querySelector(sel);
  const id = "scale_" + key;
  let sl = fx.querySelector("#" + id);
  const show = el && el.style.display !== "none" && state.gm && !visiting;
  if (!show) { if (sl) sl.remove(); return; }
  const def = key === "fishing" ? 0.75 : (key === "pond" ? 0.7 : 1);
  if (!sl) {
    sl = document.createElement("input");
    sl.id = id; sl.type = "range"; sl.min = "0.4"; sl.max = "2.5"; sl.step = "0.05";
    sl.className = "fish-scale"; sl.value = String(gmBuildingScale[key] || def);
    sl.addEventListener("input", () => {
      gmBuildingScale[key] = parseFloat(sl.value) || def;
      try { localStorage.setItem("gm-building-scale", JSON.stringify(gmBuildingScale)); } catch (e) {}
      const t = document.querySelector(sel); if (t) t.style.transform = "scale(" + gmBuildingScale[key] + ")";
      const ro = document.querySelector("#gmStakeReadout"); if (ro) ro.textContent = key + " 縮放 " + gmBuildingScale[key].toFixed(2) + "x";
      updateBuildingScaleSlider(sel, key, baseW);
    });
    fx.appendChild(sl);
  }
  const pos = gmBuildingPos[key] || BUILDING_POS[key];
  sl.style.left = (pos[0] + baseW * (gmBuildingScale[key] || def) + 0.5) + "%";
  sl.style.top = pos[1] + "%";
}

const FISH_TRASH = ["水草", "垃圾", "破鞋子"];
const FISH_NAMES = ["吳郭魚", "鯽魚", "溪哥", "苦花", "香魚", "泥鰍", "馬口魚", "石賓", "羅漢魚", "大肚魚"];
const FISH_SELL_RATE = 0.8;   // 賣價＝買價 8 折
const FISH_MARKET = [
  { k: "大肚魚", fry: 4,  fish: 40 },
  { k: "羅漢魚", fry: 5,  fish: 55 },
  { k: "溪哥",   fry: 8,  fish: 90 },
  { k: "馬口魚", fry: 10, fish: 110 },
  { k: "泥鰍",   fry: 12, fish: 130 },
  { k: "鯽魚",   fry: 13, fish: 150 },
  { k: "吳郭魚", fry: 15, fish: 180 },
  { k: "苦花",   fry: 22, fish: 260 },
  { k: "石賓",   fry: 26, fish: 300 },
  { k: "香魚",   fry: 32, fish: 360 },
];
function fishSellPrice(p) { return Math.round(p * FISH_SELL_RATE); }
let pondDialogOpen = false;   // 視窗內容在開啟當下就固定，天氣照常變化但視窗不重繪
let fishSpeedLevel = 0, fishRAF = 0, fishPos = 0, fishDir = 1, fishZones = [], fishRunning = false, fishResumeTimer = 0;
function openPondDialog() {
  if (visiting || state.scene === "ranch") return;
  pondDialogOpen = true;
  fishSpeedLevel = 0; fishRunning = false;
  if (fishRAF) { cancelAnimationFrame(fishRAF); fishRAF = 0; }
  if (fishResumeTimer) { clearTimeout(fishResumeTimer); fishResumeTimer = 0; }
  const good = ["sun", "cloud", "breeze", "scorch", "fog"].includes(state.weather);
  let box = document.querySelector("#pondBox");
  if (!box) {
    box = document.createElement("div"); box.id = "pondBox"; box.className = "gift-box";
    document.body.appendChild(box);
    box.addEventListener("click", (e) => { if (e.target === box) closePondDialog(); });
  }
  box.innerHTML = '<div class="gift-card pond-card" role="dialog" aria-modal="true" aria-label="水池">' +
    '<div class="pond-row">' +
      '<div class="pond-msg" id="pondMsg">' + (good ? "水面泛起漣漪，適合下竿。" : "天氣不佳，水面平靜無波。") + '</div>' +
      '<div class="pond-center">' +
        '<img class="pond-img" id="pondImg" src="./assets/decor/pond-empty.png" alt="" />' +
        '<div class="pond-spacer" id="pondSpacer"></div>' +
      '</div>' +
      '<div class="pond-actions">' +
        '<button type="button" class="pond-btn" data-pond="raise">🐟 養魚</button>' +
        (good ? '<button type="button" class="pond-btn" id="pondFishBtn">🎣 釣魚</button>' : '') +
        '<button type="button" id="pondClose" class="pond-btn pond-close-btn">關閉</button>' +
      '</div>' +
    '</div></div>';
  box.querySelector("#pondClose").addEventListener("click", closePondDialog);
  box.querySelectorAll("[data-pond]").forEach((b) => b.addEventListener("click", () => { pondMsg("🐟 養魚功能開發中。"); }));
  const fb = box.querySelector("#pondFishBtn");
  if (fb) fb.addEventListener("click", onFishClick);
}

function pondConfirm(text, onOk) {
  const ov = document.createElement("div");
  ov.className = "gift-box"; ov.style.zIndex = "90";
  ov.innerHTML = '<div class="gift-card pond-confirm"><p>' + text + '</p><div class="pond-confirm-btns">' +
    '<button type="button" class="pond-btn" id="pcOk">確認</button>' +
    '<button type="button" class="pond-btn pond-close-btn" id="pcNo">取消</button></div></div>';
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  ov.querySelector("#pcNo").addEventListener("click", close);
  ov.querySelector("#pcOk").addEventListener("click", () => { close(); onOk(); });
}

function onFishClick() {
  pondConfirm("要花費 20 金幣釣魚一次嗎？", () => {
    if ((state.coins || 0) < 20) { toast("金幣不足 20，無法釣魚。"); return; }
    state.coins -= 20; saveState(); renderHeader();
    fishSpeedLevel = 0;
    startFishRound();
  });
}
function onFishResume() {
  const cost = 40 * Math.pow(2, fishSpeedLevel);   // 繼續費用：第1次40、第2次80、第3次160…每次翻倍
  if ((state.coins || 0) < cost) { toast("金幣不足 " + cost + "，無法繼續。"); return; }
  state.coins -= cost; saveState(); renderHeader();
  fishSpeedLevel += 1;
  startFishRound();
}

function setFishBtns(s) {
  const set = (id, en) => { const b = document.querySelector(id); if (b) b.disabled = !en; };
  set("#pondFishBtn", s.fish); set("#fishStop", s.stop); set("#fishResume", s.resume);
}

function genFishZones() {
  const gw = 1 / 15, ow = 1 / 6;
  const blocks = [{ c: "gold", w: gw }, { c: "orange", w: ow }, { c: "orange", w: ow }];
  for (let i = blocks.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); const t = blocks[i]; blocks[i] = blocks[j]; blocks[j] = t; }
  const greenTotal = 1 - blocks.reduce((a, b) => a + b.w, 0);
  const r = [Math.random(), Math.random(), Math.random(), Math.random()];
  const rs = r.reduce((a, b) => a + b, 0) || 1;
  const gaps = r.map((v) => v / rs * greenTotal);
  const zones = []; let x = gaps[0];
  blocks.forEach((b, i) => { zones.push({ start: x, end: x + b.w, color: b.c }); x += b.w + gaps[i + 1]; });
  return zones;
}

function buildFishBar() {
  const sp = document.querySelector("#pondSpacer");
  if (!sp) return;
  let zonesHtml = "";
  fishZones.forEach((z) => {
    const col = z.color === "gold" ? "#f4c430" : "#e8863a";
    zonesHtml += '<div class="fish-zone" style="left:' + (z.start * 100).toFixed(2) + '%;width:' + ((z.end - z.start) * 100).toFixed(2) + '%;background:' + col + '"></div>';
  });
  sp.innerHTML = '<div class="fish-bar-wrap">' +
    '<div class="fish-bar" id="fishBar">' + zonesHtml + '<div class="fish-line" id="fishLine" style="left:0%"></div></div>' +
    '<div class="fish-ctrl">' +
      '<button type="button" class="fish-mini" id="fishStop">停止</button>' +
      '<button type="button" class="fish-mini" id="fishResume">繼續</button>' +
    '</div></div>';
  sp.querySelector("#fishStop").addEventListener("click", onFishStop);
  sp.querySelector("#fishResume").addEventListener("click", onFishResume);
}

function startFishRound() {
  const img = document.querySelector("#pondImg");
  if (img) img.src = "./assets/decor/pond-fishing.png";   // 水池釣魚1
  fishZones = genFishZones();
  buildFishBar();
  setFishBtns({ fish: false, stop: true, resume: false });
  fishPos = 0; fishDir = 1; fishRunning = true;
  const round = fishSpeedLevel + 1;   // 第幾關(第1關=第一次釣魚)
  const speedMult = 1.0 + 0.05 * round * (round + 1) + 0.1 * round;   // 倍率 1.2/1.5/1.9/2.4/3.0/3.7…
  const speed = 0.62 * speedMult;   // 系統初始速度 0.62 × 倍率
  let last = 0;
  const tick = (ts) => {
    if (!fishRunning) return;
    if (!last) last = ts;
    const dt = Math.min(0.05, (ts - last) / 1000); last = ts;
    fishPos += fishDir * speed * dt;
    if (fishPos >= 1) { fishPos = 1; fishDir = -1; }
    else if (fishPos <= 0) { fishPos = 0; fishDir = 1; }
    const ln = document.querySelector("#fishLine");
    if (ln) ln.style.left = (fishPos * 100).toFixed(2) + "%";
    fishRAF = requestAnimationFrame(tick);
  };
  fishRAF = requestAnimationFrame(tick);
}

function onFishStop() {
  if (!fishRunning) return;
  fishRunning = false;
  if (fishRAF) { cancelAnimationFrame(fishRAF); fishRAF = 0; }
  let color = "green";
  for (const z of fishZones) { if (fishPos >= z.start && fishPos <= z.end) { color = z.color; break; } }
  const img = document.querySelector("#pondImg");
  if (img) img.src = "./assets/decor/pond-fishing2.png";   // 水池釣魚2
  const mult = Math.pow(2, fishSpeedLevel);   // 每繼續一級獎勵 ×2
  if (color === "green") {
    const item = FISH_TRASH[Math.floor(Math.random() * FISH_TRASH.length)];
    const n = (5 + Math.floor(Math.random() * 4)) * mult;   // (5~8) ×倍率
    state.coins = (state.coins || 0) + n;
    pondMsg("釣到" + item + "，回收得 " + n + " 元。");
  } else if (color === "orange") {
    const f = FISH_NAMES[Math.floor(Math.random() * FISH_NAMES.length)];
    state.fishBag = state.fishBag || {};
    state.fishBag[f] = (state.fishBag[f] || 0) + mult;
    pondMsg(mult === 1 ? "釣到一隻" + f + "，幸福。" : "釣到 " + mult + " 隻" + f + "，幸福。");
  } else {
    state.items = state.items || {};
    state.items.treasureChest = (state.items.treasureChest || 0) + mult;
    pondMsg(mult === 1 ? "哇！釣到一個寶箱，運氣爆棚！" : "哇！釣到 " + mult + " 個寶箱，運氣爆棚！");
  }
  saveState(); renderHeader();
  setFishBtns({ fish: false, stop: false, resume: false });
  fishResumeTimer = setTimeout(() => {
    if (!pondDialogOpen) return;
    setFishBtns({ fish: false, stop: false, resume: true });
  }, 2500);
}
function pondMsg(text) {
  const el = document.querySelector("#pondMsg");
  if (!el) return;
  const line = document.createElement("div");
  line.className = "pond-msg-line";
  line.textContent = text;
  el.appendChild(line);
  el.scrollTop = el.scrollHeight;
}
function closePondDialog() {
  pondDialogOpen = false;
  fishRunning = false;
  if (fishRAF) { cancelAnimationFrame(fishRAF); fishRAF = 0; }
  if (fishResumeTimer) { clearTimeout(fishResumeTimer); fishResumeTimer = 0; }
  const b = document.querySelector("#pondBox"); if (b) b.remove();
}

function openFishMarket() {
  let box = document.querySelector("#fishMarketBox");
  if (!box) {
    box = document.createElement("div"); box.id = "fishMarketBox"; box.className = "gift-box";
    document.body.appendChild(box);
    box.addEventListener("click", (e) => { if (e.target === box) box.remove(); });
  }
  box.innerHTML = '<div class="gift-card fishmkt-card">' +
    '<h2 class="fishmkt-title">🐟 漁市場　<span class="fishmkt-coin">🪙 <b id="fmCoin">' + (state.coins || 0) + '</b></span></h2>' +
    '<div class="fishmkt-split">' +
      '<div class="fishmkt-col"><div class="fishmkt-head">魚苗買賣</div><div class="fishmkt-list" id="fmFry"></div></div>' +
      '<div class="fishmkt-col"><div class="fishmkt-head">漁貨批發</div><div class="fishmkt-list" id="fmFish"></div></div>' +
      '<div class="fishmkt-col"><div class="fishmkt-head">漁貨庫存</div><div class="fishmkt-list" id="fmStock"></div></div>' +
    '</div>' +
    '<button type="button" id="fishMarketClose" class="gift-close">關閉</button></div>';
  box.querySelector("#fishMarketClose").addEventListener("click", () => box.remove());
  renderFishMarket();
}

function fmStepperHtml(have) {
  return '<span class="fm-stepper">' +
    '<button type="button" class="fm-step" data-fm-step="-1">−</button>' +
    '<input class="fm-qty" type="text" inputmode="numeric" maxlength="3" value="0" />' +
    '<button type="button" class="fm-step" data-fm-step="1">＋</button>' +
    '<button type="button" class="fm-all" data-fm-all="' + (have || 0) + '">ALL</button>' +
    '</span>';
}
function fmRow(name, buyP, sellP, have, type, key) {
  return '<div class="fm-row">' +
    '<div class="fm-line1"><strong class="fm-name">' + name + '</strong>' +
      '<span class="fm-right"><span class="fm-price">買 <span class="fm-num">' + buyP + '</span> ／ 賣 <span class="fm-num">' + sellP + '</span></span>' +
      '<span class="fm-have">持有 <b>' + have + '</b></span></span></div>' +
    '<div class="fm-ctrl-line">' + fmStepperHtml(have) +
      '<button type="button" class="fm-buy" data-fm-buy data-fm-type="' + type + '" data-fm-key="' + key + '">買</button>' +
      '<button type="button" class="fm-sell" data-fm-sell data-fm-type="' + type + '" data-fm-key="' + key + '">賣</button>' +
    '</div></div>';
}
function fmStockRow(name, sellP, have, key) {
  return '<div class="fm-row">' +
    '<div class="fm-line1"><strong class="fm-name">' + name + '</strong>' +
      '<span class="fm-right"><span class="fm-price">賣 <span class="fm-num">' + sellP + '</span></span>' +
      '<span class="fm-have">庫存 <b>' + have + '</b></span></span></div>' +
    '<div class="fm-ctrl-line">' + fmStepperHtml(have) +
      '<button type="button" class="fm-sell" data-fm-sell data-fm-type="fish" data-fm-key="' + key + '">賣</button>' +
    '</div></div>';
}

function renderFishMarket() {
  state.fishBag = state.fishBag || {}; state.fryBag = state.fryBag || {};
  const fry = document.querySelector("#fmFry"), fish = document.querySelector("#fmFish"), stock = document.querySelector("#fmStock");
  if (!fry) return;
  const coinEl = document.querySelector("#fmCoin"); if (coinEl) coinEl.textContent = state.coins || 0;
  fry.innerHTML = FISH_MARKET.map((f) => fmRow(f.k + "(苗)", f.fry, fishSellPrice(f.fry), state.fryBag[f.k] || 0, "fry", f.k)).join("");
  fish.innerHTML = FISH_MARKET.map((f) => fmRow(f.k, f.fish, fishSellPrice(f.fish), state.fishBag[f.k] || 0, "fish", f.k)).join("");
  stock.innerHTML = FISH_MARKET.map((f) => fmStockRow(f.k, fishSellPrice(f.fish), state.fishBag[f.k] || 0, f.k)).join("");
  const box = document.querySelector("#fishMarketBox");
  box.querySelectorAll(".fm-step").forEach((b) => b.addEventListener("click", () => {
    const inp = b.parentElement.querySelector(".fm-qty");
    let v = parseInt(inp.value, 10); if (!isFinite(v)) v = 0;
    v = Math.max(0, Math.min(999, v + parseInt(b.dataset.fmStep, 10)));
    inp.value = v;
  }));
  box.querySelectorAll(".fm-all").forEach((b) => b.addEventListener("click", () => {
    const inp = b.parentElement.querySelector(".fm-qty");
    inp.value = b.dataset.fmAll || "0";
  }));
  box.querySelectorAll(".fm-qty").forEach((inp) => inp.addEventListener("input", () => {
    let v = inp.value.replace(/[^0-9]/g, "");
    if (v.length > 3) v = v.slice(0, 3);
    inp.value = v;   // 允許暫時空字串，backspace 可刪
  }));
  const qtyOf = (b) => { const inp = b.closest(".fm-row").querySelector(".fm-qty"); return parseInt(inp.value, 10) || 0; };
  box.querySelectorAll("[data-fm-buy]").forEach((b) => b.addEventListener("click", () => fmTrade(b.dataset.fmType, b.dataset.fmKey, "buy", qtyOf(b))));
  box.querySelectorAll("[data-fm-sell]").forEach((b) => b.addEventListener("click", () => fmTrade(b.dataset.fmType, b.dataset.fmKey, "sell", qtyOf(b))));
}

function fmTrade(type, key, action, qty) {
  qty = Math.max(0, parseInt(qty, 10) || 0);
  if (qty <= 0) { toast("請先選擇數量。"); return; }
  const f = FISH_MARKET.find((x) => x.k === key); if (!f) return;
  state.fishBag = state.fishBag || {}; state.fryBag = state.fryBag || {};
  const bag = type === "fry" ? state.fryBag : state.fishBag;
  const buyP = type === "fry" ? f.fry : f.fish;
  const sellP = fishSellPrice(buyP);
  const label = type === "fry" ? key + "(苗)" : key;
  if (action === "buy") {
    const cost = buyP * qty;
    if ((state.coins || 0) < cost) { toast("金幣不足，買 " + qty + " 隻需 " + cost + " 元。"); return; }
    state.coins -= cost; bag[key] = (bag[key] || 0) + qty;
    toast("買入 " + label + " ×" + qty + "（-" + cost + "）");
  } else {
    if ((bag[key] || 0) < qty) { toast("數量不足，" + label + " 只有 " + (bag[key] || 0) + " 隻。"); return; }
    bag[key] -= qty; const gain = sellP * qty; state.coins = (state.coins || 0) + gain;
    toast("賣出 " + label + " ×" + qty + "（+" + gain + "）");
  }
  saveState(); renderHeader(); renderFishMarket();   // 重繪→數量欄回歸 0
}

function setupBuildingDrag() {
  const fx = document.querySelector("#weatherFx");
  if (!fx || fx.dataset.dragReady) return;
  fx.dataset.dragReady = "1";
  const BUILDINGS = [["#bld-windmill", "windmill", "風車", false], ["#bld-doghouse", "doghouse", "狗窩", true], ["#bld-fishing", "fishing", "釣魚", false]];
  let cur = null, key = "", label = "", openable = false, sx = 0, sy = 0, ox = 0, oy = 0, moved = false, dragging = false;
  function hitTest(x, y) {
    for (const [sel, k, lb, op] of BUILDINGS) {
      const el = document.querySelector(sel);
      if (!el || el.style.display === "none") continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return { el: el, k: k, lb: lb, op: op, r: r };
    }
    return null;
  }
  document.addEventListener("pointerdown", (e) => {
    if (visiting) { cur = null; return; }   // 參觀好友時不互動建築
    if (e.target && e.target.closest && e.target.closest(".work-panel, .inventory-panel, .panel, .gm-box, .save-box, .slot-box, .gift-box, #dogBox, #stockView, .main-nav, .topbar, .scene-toolbar, .bottom-tool-row, button, input, a")) { cur = null; return; }
    const h = hitTest(e.clientX, e.clientY);
    if (!h) { cur = null; return; }
    cur = h.el; key = h.k; label = h.lb; openable = h.op; moved = false; sx = e.clientX; sy = e.clientY;
    if (state.gm) {
      dragging = true;
      const fr = fx.getBoundingClientRect();
      ox = h.r.left - fr.left; oy = h.r.top - fr.top;
      e.preventDefault();
    }
  });
  document.addEventListener("pointermove", (e) => {
    if (!cur) return;
    if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 6) moved = true;
    if (!dragging) return;
    const fr = fx.getBoundingClientRect();
    if (!fr.width || !fr.height) return;
    let x = Math.max(0, Math.min(100, (ox + (e.clientX - sx)) / fr.width * 100));
    let y = Math.max(0, Math.min(100, (oy + (e.clientY - sy)) / fr.height * 100));
    if (!isFinite(x) || !isFinite(y)) return;
    cur.style.left = x.toFixed(1) + "%"; cur.style.top = y.toFixed(1) + "%";
    gmBuildingPos[key] = [Number(x.toFixed(1)), Number(y.toFixed(1))];
    const ro = document.querySelector("#gmStakeReadout");
    if (ro) ro.textContent = label + "｜left " + x.toFixed(1) + "%　top " + y.toFixed(1) + "%";
  });
  document.addEventListener("pointerup", () => {
    if (!cur) return;
    const wasDrag = dragging && moved;
    dragging = false;
    if (wasDrag) {
      try { localStorage.setItem("gm-building-pos", JSON.stringify(gmBuildingPos)); } catch (err) {}
    } else if (openable && !moved) {
      openDoghouse();   // 點一下沒移動＝開面板（GM 與非GM 都可，方便 GM 養狗測試）
    }
    cur = null;
  });
  setupPondBodyDrag();
}
function buyDoghouse() {
  const cost = 10000;
  if (state.doghouseBought) { toast("已經有狗窩了。"); return; }
  if (state.coins < cost) { toast("金幣不夠，狗窩需要 " + cost + " 金幣。"); return; }
  state.coins -= cost;
  state.doghouseBought = true;
  saveState(); render();
  toast("買了狗窩！農場上出現狗窩，點它可以養狗。");
}

function openDoghouse() {
  if (!state.doghouseBought && !gmDogOverride) { return; }
  let box = document.querySelector("#dogBox");
  if (!box) {
    box = document.createElement("div");
    box.id = "dogBox"; box.className = "gm-box";
    document.body.appendChild(box);
    box.addEventListener("click", (e) => { if (e.target === box) box.remove(); });
  }
  renderDoghouse();
  box.hidden = false;
}
function closeDoghouse() { const b = document.querySelector("#dogBox"); if (b) b.remove(); }

function renderDoghouse() {
  const box = document.querySelector("#dogBox");
  if (!box) return;
  if (!state.dog) {
    const cost = 500, needOrders = 20, done = state.ordersCompleted || 0;
    const ok = state.gm || (state.coins >= cost && done >= needOrders);
    const reqs = [];
    reqs.push((state.coins >= cost ? "✅" : "❌") + " 500 金幣");
    reqs.push((done >= needOrders ? "✅" : "❌") + " 完成訂單 " + done + "/" + needOrders);
    if (state.gm) reqs.push("🛠️ GM 可直接養（略過條件）");
    box.innerHTML = '<div class="dog-card"><h2>🐶 狗窩</h2>' +
      '<p class="dog-empty-hint">養一隻看門狗，幫你顧農場、嚇跑小偷。</p>' +
      '<div class="dog-reqs">' + reqs.map((r) => "<span>" + r + "</span>").join("") + '</div>' +
      '<button type="button" id="dogAdopt" class="dog-primary" ' + (ok ? "" : "disabled") + '>養狗（500 金幣）</button>' +
      '<button type="button" id="dogClose" class="dog-close">關閉</button></div>';
    box.querySelector("#dogAdopt").addEventListener("click", adoptDog);
    box.querySelector("#dogClose").addEventListener("click", closeDoghouse);
    return;
  }
  const sat = Math.round(dogSatiety()), hap = Math.round(dogHappiness());
  const guardOn = state.dog.guardOn !== false;
  box.innerHTML = '<div class="dog-card"><h2>🐶 我的看門狗</h2>' +
    '<div class="dog-main">' +
      '<div class="dog-portrait"><img src="./assets/decor/dog.png" alt="" /></div>' +
      '<div class="dog-info">' +
        '<div class="dog-name-row"><input id="dogName" type="text" maxlength="12" value="' + (state.dog.name || "小狗").replace(/"/g, "") + '" /><button type="button" id="dogRename">改名</button></div>' +
        '<div class="dog-bar"><span class="dog-bar-label">飽食度</span><span class="dog-bar-track"><span class="dog-bar-fill sat" style="width:' + sat + '%"></span></span><span class="dog-bar-num">' + sat + '%</span></div>' +
        '<div class="dog-bar"><span class="dog-bar-label">開心度</span><span class="dog-bar-track"><span class="dog-bar-fill hap" style="width:' + hap + '%"></span></span><span class="dog-bar-num">' + hap + '%</span></div>' +
      '</div>' +
      '<div class="dog-guard"><span class="dog-guard-cap">防盜</span><button type="button" id="dogGuardToggle" class="dog-guard-btn ' + (guardOn ? "on" : "off") + '">' + (guardOn ? "開" : "關") + '</button></div>' +
    '</div>' +
    '<div class="dog-actions"><button type="button" data-dog="feed">🍖 餵食</button><button type="button" data-dog="wash">🛁 洗澡</button><button type="button" data-dog="walk">🦮 散步</button></div>' +
    '<button type="button" id="dogClose" class="dog-close">關閉</button></div>';
  box.querySelector("#dogClose").addEventListener("click", closeDoghouse);
  box.querySelector("#dogRename").addEventListener("click", () => {
    const v = (box.querySelector("#dogName").value || "").trim().slice(0, 12);
    state.dog.name = v || "小狗"; saveState(); toast("改名成功：" + state.dog.name);
  });
  const gt = box.querySelector("#dogGuardToggle");
  if (gt) gt.addEventListener("click", () => {
    state.dog.guardOn = (state.dog.guardOn === false);
    saveState(); render(); renderDoghouse();
    toast(state.dog.guardOn ? "已開啟防盜，狗狗會趕小偷。" : "已關閉防盜，狗狗不趕小偷。");
  });
  box.querySelectorAll("[data-dog]").forEach((b) => b.addEventListener("click", () => dogAction(b.dataset.dog)));
}

function adoptDog() {
  const cost = 500, needOrders = 20, done = state.ordersCompleted || 0;
  if (state.dog) return;
  if (!state.gm) {
    if (done < needOrders) { toast("要完成 " + needOrders + " 次訂單才能養狗（目前 " + done + "）。"); return; }
    if (state.coins < cost) { toast("金幣不夠，養狗需要 " + cost + " 金幣。"); return; }
    state.coins -= cost;
  }
  state.dog = { name: "小狗", fedAt: Date.now(), happyAt: Date.now(), guardOn: true };
  saveState(); render(); renderDoghouse();
  toast("養了一隻看門狗！記得餵食、洗澡、散步。");
}

function dogAction(act) {
  if (!state.dog) return;
  const now = Date.now();
  if (act === "feed") { state.dog.fedAt = now; toast("餵食完成，飽食度回滿。"); }
  else if (act === "wash") { state.dog.happyAt = now; toast("洗香香，開心度回滿。"); }
  else if (act === "walk") { state.dog.happyAt = now; toast("散步去！開心度回滿。"); }
  saveState(); render(); renderDoghouse();
}

function stakeStyle(i) {
  const p = STAKE_POS[i];
  return p ? ` style="left:${p[0]}%;top:${p[1]}%;transform:translate(-50%,-50%)"` : "";
}

// GM 修改數據欄位設定（min/max/step）
const GM_FIELDS = {
  coins: { min: 0, max: 1000000, step: 100 },
  level: { min: 1, max: 50, step: 1 },
  xp: { min: 0, max: 50000, step: 50 },
};

let gmEditSnap = null;
let gmInvSnap = null; let gmSeedSnap = null;
let gmItemSnap = null;
const GM_ITEMS = [
  ["weatherCard", "🌤️ 天氣兌換卡"],
  ["fertilizer", "🌱 肥料"],
  ["thawCard", "🃏 解凍卡"],
  ["guardCard", "🛡️ 防盜卡"],
  ["coinCard500", "🪙 金幣500兌換卡"],
  ["expSpinPack", "🎰 抽獎經驗卡池包"],
  ["expandCard", "🏗️ 牧場擴建卡"],
  ["expandCardPro", "🏗️ 牧場擴建卡（特）"],
  ["dogStick", "🦴 逗狗棒"],
  ["treasureChest", "🎁 寶箱"],
];

// grow/regrow 單位「分鐘」；sell=每顆售價(原版)；yieldCount=每次收成顆數(原版產量)；img:true 有田間 PNG
const CROPS = {
  turnip:      { name: "白蘿蔔", cost: 125,   sell: 17, yieldCount: 16, grow: 2.5,  regrow: 0,    seasons: 1, xp: 15, unlock: 1,  img: true, colors: ["#f8f3ee", "#d94c75", "#67a84f"] },
  carrot:      { name: "胡蘿蔔", cost: 163,   sell: 21, yieldCount: 17, grow: 3.25, regrow: 0,    seasons: 1, xp: 18, unlock: 2,  img: true, colors: ["#f08a2d", "#ca5c24", "#5fa84d"] },
  corn:        { name: "玉米",   cost: 175,   sell: 23, yieldCount: 17, grow: 3.5,  regrow: 0,    seasons: 1, xp: 19, unlock: 3,  img: true, colors: ["#f7d64c", "#e2a73a", "#4d8a43"] },
  potato:      { name: "土豆",   cost: 188,   sell: 24, yieldCount: 18, grow: 3.75, regrow: 0,    seasons: 1, xp: 20, unlock: 4,  colors: ["#d9a86a", "#a9783f", "#6a9a4c"] },
  eggplant:    { name: "茄子",   cost: 237,   sell: 25, yieldCount: 20, grow: 4,    regrow: 0,    seasons: 1, xp: 21, unlock: 5,  colors: ["#7b4ea3", "#4f2f70", "#5a9a4c"] },
  tomato:      { name: "番茄",   cost: 251,   sell: 26, yieldCount: 21, grow: 4.25, regrow: 0,    seasons: 1, xp: 22, unlock: 6,  colors: ["#e0473a", "#a82b22", "#5a9a4c"] },
  pea:         { name: "豌豆",   cost: 266,   sell: 27, yieldCount: 22, grow: 4.5,  regrow: 0,    seasons: 1, xp: 23, unlock: 7,  colors: ["#8fc24f", "#5d9a32", "#4d8a43"] },
  pepper:      { name: "辣椒",   cost: 296,   sell: 28, yieldCount: 24, grow: 5,    regrow: 0,    seasons: 1, xp: 25, unlock: 8,  colors: ["#d8362b", "#9a241c", "#5a9a4c"] },
  pumpkin:     { name: "南瓜",   cost: 325,   sell: 30, yieldCount: 25, grow: 5.5,  regrow: 0,    seasons: 1, xp: 27, unlock: 9,  img: true, colors: ["#e98231", "#b44f25", "#3e7d43"] },
  apple:       { name: "蘋果",   cost: 578,   sell: 24, yieldCount: 23, grow: 5.25, regrow: 2.25, seasons: 2, xp: 18, unlock: 10, colors: ["#e23b3b", "#a3242b", "#5aa14c"] },
  strawberry:  { name: "草莓",   cost: 605,   sell: 27, yieldCount: 24, grow: 6,    regrow: 2.75, seasons: 2, xp: 20, unlock: 10, img: true, colors: ["#de3f4f", "#9c2734", "#4e9c50"] },
  watermelon:  { name: "西瓜",   cost: 708,   sell: 29, yieldCount: 27, grow: 7,    regrow: 3.25, seasons: 2, xp: 23, unlock: 11, colors: ["#4ca64c", "#2f6f37", "#3e7d43"] },
  banana:      { name: "香蕉",   cost: 900,   sell: 32, yieldCount: 29, grow: 7.75, regrow: 3.5,  seasons: 2, xp: 25, unlock: 12, colors: ["#f2cf3e", "#c79a2a", "#5a9a4c"] },
  peach:       { name: "桃子",   cost: 1200,  sell: 40, yieldCount: 32, grow: 10.5, regrow: 4.5,  seasons: 2, xp: 33, unlock: 13, colors: ["#f3a6b0", "#d76b7e", "#5aa14c"] },
  orange:      { name: "橙子",   cost: 1587,  sell: 41, yieldCount: 26, grow: 9.25, regrow: 4,    seasons: 3, xp: 25, unlock: 14, colors: ["#f0922e", "#c4671e", "#5aa14c"] },
  grape:       { name: "葡萄",   cost: 1978,  sell: 47, yieldCount: 29, grow: 11.5, regrow: 5,    seasons: 3, xp: 30, unlock: 15, colors: ["#7b4ea3", "#4f2f70", "#5aa14c"] },
  pomegranate: { name: "石榴",   cost: 2425,  sell: 54, yieldCount: 30, grow: 13,   regrow: 5.5,  seasons: 3, xp: 34, unlock: 16, colors: ["#cf3a4a", "#8f2330", "#5aa14c"] },
};

const WEATHERS = {
  sun: { name: "晴朗", icon: "sun", growth: 1.0, line: "陽光普照，作物正常生長。" },
  breeze: { name: "微風", icon: "wind", growth: 0.97, line: "微風輕拂，成長稍微加快。" },
  cloud: { name: "多雲", icon: "cloud", growth: 1.1, line: "雲層厚厚的，成長慢一點。" },
  rain: { name: "小雨", icon: "rain", growth: 0.9, line: "下雨了，自動幫作物澆水、長得快一些。" },
  scorch: { name: "烈日", icon: "sun", growth: 1.15, line: "烈日當頭，土地易乾、成長略慢，記得澆水。" },
  storm: { name: "雷雨", icon: "rain", growth: 1.2, line: "雷雨來襲，田地浸水中，盡快收成！" },
  fog: { name: "起霧", icon: "cloud", growth: 1.05, line: "起了霧，成長小幅變慢。" },
  snow: { name: "下雪", icon: "cloud", growth: 1.43, line: "下雪了，成長明顯變慢，作物可能凍傷。" },
  typhoon: { name: "颱風", icon: "rain", growth: 2.0, line: "颱風來襲，成長停滯、農地嚴重受損！" },
};

// 天氣自動輪換：每隔 3～5 分鐘換一次，加權（晴常見、雨偶爾）
const WEATHER_WEIGHTS = [["sun", 28], ["breeze", 18], ["cloud", 10], ["rain", 12], ["scorch", 10], ["fog", 9], ["storm", 6], ["snow", 5], ["typhoon", 2]];
const WEATHER_MIN_MS = 180000;
const WEATHER_MAX_MS = 300000;

const UPGRADES = {
  windmill: {
    name: "風車",
    icon: "wind",
    max: 10,
    description: (lvl) => "每級讓作物成長時間縮短 2%，目前等級共增加 " + ((lvl || 0) * 2) + "%。",
    cost: (n) => 5000 + 2500 * n * (n + 1),
    reqLevel: () => 1,
    reqOrders: () => 0,
  },
  stand: {
    name: "小攤",
    icon: "cart",
    max: 20,
    description: "每級讓倉庫出售價格提高 2%。",
    cost: (n) => 2500 * (n * n + 3 * n + 6),
    reqLevel: (n) => n,
    reqOrders: (n) => 5 * n * n + 55 * n - 10,
  },
};

const ICONS = {
  coin: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#e8ae36" stroke="#9b641e" stroke-width="2"/><path d="M8 12h8M12 7v10" stroke="#fff2bf" stroke-width="2" stroke-linecap="round"/></svg>`,
  energy: `<svg viewBox="0 0 24 24"><path d="M13 2 5 13h6l-1 9 9-13h-6z" fill="#f0c643" stroke="#8b6321" stroke-width="1.5" stroke-linejoin="round"/></svg>`,
  seed: `<svg viewBox="0 0 24 24"><path d="M12 20c-4.5-2.7-6.9-6-7-10.1 4.2.2 7.2 2.4 8.8 6.8 1.5-4 3.5-6.6 6.2-7.8.3 4.6-2.3 8.3-8 11.1z" fill="#5fa84d" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 20V9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  drop: `<svg viewBox="0 0 24 24"><path d="M12 3c4.2 5 6.3 8.7 6.3 11.3A6.3 6.3 0 1 1 5.7 14.3C5.7 11.7 7.8 8 12 3z" fill="#7ac7e6" stroke="#23617c" stroke-width="1.5"/></svg>`,
  hoe: `<img class="tool-asset-icon" src="./assets/tools/hoe-v1.png" alt="" />`,
  watering: `<img class="tool-asset-icon" src="./assets/tools/watering-can-v1.png" alt="" />`,
  basket: `<svg viewBox="0 0 24 24"><path d="M5 10h14l-1.4 9H6.4z" fill="#c7843e" stroke="#704126" stroke-width="1.5"/><path d="M8 10a4 4 0 0 1 8 0" fill="none" stroke="#704126" stroke-width="1.7"/><path d="M8 14h8" stroke="#f4c66a" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  cart: `<svg viewBox="0 0 24 24"><path d="M4 5h2l2 10h9l2-7H8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="19" r="1.8" fill="currentColor"/><circle cx="17" cy="19" r="1.8" fill="currentColor"/></svg>`,
  lock: `<svg viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/></svg>`,
  check: `<svg viewBox="0 0 24 24"><path d="m5 12 4.2 4.2L19 6.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  hammer: `<svg viewBox="0 0 24 24"><path d="m13 5 6 6M14.5 3.5 20.5 9.5 18 12 12 6zM11 8 4 15l5 5 7-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  sun: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5" fill="#f6c84c" stroke="#9a671e" stroke-width="1.4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" stroke="#9a671e" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  cloud: `<svg viewBox="0 0 24 24"><path d="M7.5 18h9.1a4.2 4.2 0 0 0 .2-8.4 6 6 0 0 0-11.4 2A3.3 3.3 0 0 0 7.5 18z" fill="#d7e3e7" stroke="#60747c" stroke-width="1.4"/></svg>`,
  rain: `<svg viewBox="0 0 24 24"><path d="M7.5 14h9.1a4.2 4.2 0 0 0 .2-8.4 6 6 0 0 0-11.4 2A3.3 3.3 0 0 0 7.5 14z" fill="#c8dce5" stroke="#52717c" stroke-width="1.4"/><path d="M8 17v3M12 16v4M16 17v3" stroke="#3489b2" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  wind: `<svg viewBox="0 0 24 24"><path d="M4 8h11a3 3 0 1 0-3-3M4 13h15a3 3 0 1 1-3 3M4 18h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  star: `<svg viewBox="0 0 24 24"><path d="M12 3.2l2.6 5.5 6 .8-4.4 4.1 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.5l6-.8z" fill="#f0c64a" stroke="#9a6b1e" stroke-width="1.3" stroke-linejoin="round"/></svg>`,
  gift: `<svg viewBox="0 0 24 24"><rect x="4.5" y="10" width="15" height="10" rx="1" fill="#d96b6b" stroke="#8a3b3b" stroke-width="1.4"/><rect x="3.5" y="7" width="17" height="3.4" rx="1" fill="#e88a8a" stroke="#8a3b3b" stroke-width="1.3"/><path d="M12 7v13" stroke="#ffd98a" stroke-width="1.8"/><path d="M12 7C9.5 7 8 4 9.6 3.3 11.2 2.6 12 5.4 12 7zm0 0c2.5 0 4-3 2.4-3.7C12.8 2.6 12 5.4 12 7z" fill="#ffd98a" stroke="#8a3b3b" stroke-width="0.9" stroke-linejoin="round"/></svg>`,
  bag: `<svg viewBox="0 0 24 24"><path d="M6 8h12l1 12H5z" fill="#c79a5b" stroke="#7a5a2e" stroke-width="1.5" stroke-linejoin="round"/><path d="M8.5 9V7a3.5 3.5 0 0 1 7 0v2" fill="none" stroke="#7a5a2e" stroke-width="1.7" stroke-linecap="round"/><path d="M5 12h14" stroke="#f4c66a" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  item: `<svg viewBox="0 0 24 24"><path d="M10 3.2h4v4.3l3.4 8.2a2 2 0 0 1-1.85 2.8H8.45a2 2 0 0 1-1.85-2.8L10 7.5z" fill="#8fc6e0" stroke="#37657d" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 3.2h6" stroke="#37657d" stroke-width="1.7" stroke-linecap="round"/><path d="M7.6 14.5h8.8" stroke="#37657d" stroke-width="1.2"/><circle cx="11" cy="16.5" r="1" fill="#fff"/><circle cx="13.6" cy="17.6" r="0.8" fill="#fff"/></svg>`,
  feed: `<svg viewBox="0 0 24 24"><circle cx="9" cy="6" r="1.5" fill="#f0c44a"/><circle cx="12.6" cy="4.8" r="1.5" fill="#e8b23a"/><circle cx="15.6" cy="6.3" r="1.4" fill="#f0c44a"/><path d="M5 8.2h14l-1.6 11.2a1 1 0 0 1-1 .86H7.6a1 1 0 0 1-1-.86z" fill="#c79a5b" stroke="#7a5a2e" stroke-width="1.4" stroke-linejoin="round"/><path d="M4.4 8.2h15.2" stroke="#7a5a2e" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  bath: `<svg viewBox="0 0 24 24"><path d="M12 3.5c3.2 4.2 5.2 6.8 5.2 9.4a5.2 5.2 0 0 1-10.4 0c0-2.6 2-5.2 5.2-9.4z" fill="#7fc7e8" stroke="#3a7fa0" stroke-width="1.3" stroke-linejoin="round"/><path d="M10 12.5c0 1.6 0.9 2.7 2.2 3" fill="none" stroke="#eaf6fc" stroke-width="1.3" stroke-linecap="round"/><circle cx="17.6" cy="6.6" r="1.7" fill="#cdeafa" stroke="#3a7fa0" stroke-width="0.9"/><circle cx="6.6" cy="9" r="1.2" fill="#cdeafa" stroke="#3a7fa0" stroke-width="0.8"/></svg>`,
};

const elements = {
  coinValue: document.querySelector("#coinValue"),
  energyValue: document.querySelector("#energyValue"),
  levelValue: document.querySelector("#levelValue"),
  xpFill: document.querySelector("#xpFill"),
  statusLine: document.querySelector("#statusLine"),
  sceneStatusLine: document.querySelector("#sceneStatusLine"),
  weatherValue: document.querySelector("#weatherValue"),
  dayValue: document.querySelector("#dayValue"),
  sceneWeatherValue: document.querySelector("#sceneWeatherValue"),
  sceneDayValue: document.querySelector("#sceneDayValue"),
  sceneCoinValue: document.querySelector("#sceneCoinValue"),
  sceneEnergyValue: document.querySelector("#sceneEnergyValue"),
  sceneLevelValue: document.querySelector("#sceneLevelValue"),
  sceneXpFill: document.querySelector("#sceneXpFill"),
  farmGrid: document.querySelector("#farmGrid"),
  inventoryList: document.querySelector("#inventoryList"),
  tabContent: document.querySelector("#tabContent"),
  workPanelTitle: document.querySelector("#workPanelTitle"),
  toastZone: document.querySelector("#toastZone"),
  restButton: document.querySelector("#restButton"),
  sellAllButton: document.querySelector("#sellAllButton"),
};

const GIFTS = [
  { level: 2, coins: 500,  seeds: { turnip: 5, carrot: 3 } },
  { level: 3, coins: 1200, seeds: { corn: 5, carrot: 3 } },
  { level: 4, coins: 2000, seeds: { potato: 6, corn: 3 } },
  { level: 5, coins: 3000, seeds: { eggplant: 6, potato: 3 } },
];

const FERTILIZER_COST = 300;
const THAW_CARD_COST = 280;
const REPAIR_COST = 800;

const SPIN_PRIZES = [
  { type: "coins", amount: 100,  weight: 19, short: "🪙100",  label: "金幣 ×100" },
  { type: "coins", amount: 300,  weight: 14, short: "🪙300",  label: "金幣 ×300" },
  { type: "coins", amount: 600,  weight: 8,  short: "🪙600",  label: "金幣 ×600" },
  { type: "coins", amount: 1000, weight: 4,  short: "🪙1000", label: "金幣 ×1000" },
  { type: "seed", id: "turnip", amount: 5,  weight: 16, short: "白×5",  label: "白蘿蔔種子 ×5" },
  { type: "seed", id: "turnip", amount: 10, weight: 8,  short: "白×10", label: "白蘿蔔種子 ×10" },
  { type: "seed", id: "carrot", amount: 5,  weight: 13, short: "胡×5",  label: "胡蘿蔔種子 ×5" },
  { type: "seed", id: "carrot", amount: 8,  weight: 8,  short: "胡×8",  label: "胡蘿蔔種子 ×8" },
  { type: "weatherCard", amount: 1, weight: 7, short: "🌤×1", label: "天氣兌換卡 ×1" },
  { type: "weatherCard", amount: 2, weight: 3, short: "🌤×2", label: "天氣兌換卡 ×2" },
];

const FRIEND_PLOT_COUNT = 2;
const FRIEND_PLOT_MAX = 16;
const FRIEND_PLOT_GROW_MS = 900000;
const FRIEND_LEVEL_MS = 360000;
const FRIEND_REGROW_MS = 180000;
const FRIEND_PRESETS = [
  { name: "小明", avatar: "👦" }, { name: "阿華", avatar: "🧑‍🌾" }, { name: "美玲", avatar: "👩" },
  { name: "志強", avatar: "👨" }, { name: "雅婷", avatar: "👧" }, { name: "大雄", avatar: "🧒" },
  { name: "淑芬", avatar: "👩‍🌾" }, { name: "建宏", avatar: "👨‍🌾" }, { name: "怡君", avatar: "👩‍🦰" },
  { name: "俊傑", avatar: "🧔" },
];
const FRIEND_STEAL_WINDOW = 600000;
const FRIEND_STEAL_MAX = 5;
const FRIEND_CROP_POOL = ["turnip", "carrot", "corn", "potato", "eggplant", "tomato", "pea", "pepper"];

function newFriendPlots() {
  return Array.from({ length: FRIEND_PLOT_COUNT }, () => ({ crop: null, plantedAt: 0, stolenAt: 0, hazard: null }));
}

function makeBuiltinFriends() {
  return FRIEND_PRESETS.map((f, i) => ({ id: "f" + i, name: f.name, avatar: f.avatar, builtin: true, plots: newFriendPlots() }));
}

function makeBuiltinCandidates() {
  return FRIEND_PRESETS.map((f, i) => ({ id: "c" + i, name: f.name, avatar: f.avatar }));
}

let currentFriendId = null;
let pendingInviteId = null;
let audioOn = true;
let audioReady = false;
let gmStakePos = {};
let gmCloudPos = {};
let gmBuildingPos = {};
let gmPondEllipse = { cx: 22.0, cy: 44.0, rx: 14.2, ry: 3.2 };
try { const _pe = JSON.parse(localStorage.getItem("gm-pond-ellipse") || "null"); if (_pe && isFinite(_pe.cx)) gmPondEllipse = _pe; } catch (e) {}
let gmBuildingScale = {};
try { gmBuildingScale = JSON.parse(localStorage.getItem("gm-building-scale") || "{}") || {}; } catch (e) { gmBuildingScale = {}; }

const WEATHER_AUDIO = {
  sun: ["aud-sun"],
  rain: ["aud-rain"],
  storm: ["aud-thunder"],
  typhoon: ["aud-typhoon", "aud-thunder2"],
  breeze: ["aud-breeze"],
  snow: ["aud-snow"],
  fog: ["aud-fog"],
  cloud: ["aud-cloud"],
  scorch: ["aud-scorch"],
};
const ALL_AUDIO_IDS = ["aud-sun", "aud-rain", "aud-thunder", "aud-thunder2", "aud-typhoon", "aud-breeze", "aud-snow", "aud-fog", "aud-cloud", "aud-scorch"];

const ORDER_REFRESH_MS = 1800000;   // 30 分鐘刷新
const ORDER_DAILY_CAP = 35;          // 每日最多解 35 張
// 報酬調法：B（建議）＝需求×1、金幣×1、經驗×0.4；A＝需求×4、金幣×2、經驗×1
const ORDER_DEMAND_MULT = 1;
const ORDER_COIN_MULT = 1;
const ORDER_XP_MULT = 0.4;
// 大單：約 30% 機率，需求×4、金幣×2.5、經驗不動（滿經驗）
const ORDER_BIG_CHANCE = 0.30;
const ORDER_BIG_DEMAND = 4;
const ORDER_BIG_COIN = 2.5;
const ORDER_BIG_XP = 1;

/* 動物設定需在 init/render 前定義，避免 TDZ */
const RANCH_ANIMALS = {
  chicken: { name: "雞", emoji: "🐔", img: "./assets/ranch/animal-chicken.png", price: 200,  product: "蛋",   productEmoji: "🥚", value: 20,  growMs: 100000 },
  sheep:   { name: "羊", emoji: "🐑", img: "./assets/ranch/animal-sheep.png", price: 600,  product: "羊毛", productEmoji: "🧶", value: 60, growMs: 240000 },
  pig:     { name: "豬", emoji: "🐖", img: "./assets/ranch/animal-pig.png", price: 900,  product: "豬肉", productEmoji: "🥓", value: 100, growMs: 360000 },
  cow:     { name: "牛", emoji: "🐄", img: "./assets/ranch/animal-cow.png", price: 1500, product: "牛奶", productEmoji: "🥛", value: 167, growMs: 500000 },
};

const RANCH_LEVEL_NAMES = { 1: "小牧場", 2: "大牧場", 3: "超大牧場" };
const RANCH_CAP = { 1: 4, 2: 8, 3: 16 };
function ranchCap() { return RANCH_CAP[state.ranchLevel || 1] || 4; }
function cullRanchAnimals() {
  const cap = ranchCap();
  const list = state.ranchAnimals || [];
  if (list.length <= cap) return 0;
  // 強弱排序：先物種（價值），後等級，再以產出次數細分
  const rank = (a) => ((RANCH_ANIMALS[a.type] ? RANCH_ANIMALS[a.type].price : 0) * 100000) + ((a.level || 1) * 1000) + (a.produced || 0);
  const kept = list.slice().sort((a, b) => rank(b) - rank(a)).slice(0, cap);
  const removed = list.length - kept.length;
  state.ranchAnimals = kept;
  return removed;
}
const RANCH_UPGRADES = [
  { from: 1, to: 2, name: "大牧場",   coins: 50000,  card: "expandCard",    cardName: "牧場擴建卡" },
  { from: 2, to: 3, name: "超大牧場", coins: 150000, card: "expandCardPro", cardName: "牧場擴建卡（特）" },
];
const RANCH_BG = {
  1: { sun: "./assets/ranch/ranch-s-feed-grass.jpg", bad: "./assets/ranch/ranch-s-bad.jpg" },
  2: { sun: "./assets/ranch/ranch-m-feed-grass.jpg", bad: "./assets/ranch/ranch-m-bad.jpg" },
  3: { sun: "./assets/ranch/ranch-l-feed-grass.jpg", bad: "./assets/ranch/ranch-l-bad.jpg" },
};

let state = loadState();
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA9P0ixYCA_tSxDII4A4PUONK7TH6gHNHE",
  authDomain: "happyfarm-tm.firebaseapp.com",
  projectId: "happyfarm-tm",
  storageBucket: "happyfarm-tm.firebasestorage.app",
  messagingSenderId: "621025441541",
  appId: "1:621025441541:web:dddba740aeb8a1dd59696c",
};
let fbAuth = null, fbDb = null, fbUser = null, cloudReady = false, cloudSaveTimer = null, lastProfileAt = 0; let reconcileTimer = null; let saveListener = null; let lastSelfSavedAt = 0; let pendingLocalSave = false; let lastCloudRev = 0; let mailTimer = null;
const SLOT_KEY = "happy-farm-active-slot";
let activeSlot = ""; let accountData = null; let idleTimer = null; let lastActivity = Date.now(); let slotReady = false; const IDLE_MS = 600000;
let visiting = null; let visitRefreshTimer = null; let visitPendingBug = {}; let visitPendingSpray = {};
let visitTool = "";
let visitScene = "farm";
let stockOpen = false;
let stockSel = 0;
let stockTimer = null;
let stockRange = "all"; let stockReturnScene = ""; let stockQty = {}; let stockPanelMode = "buy";
let shopQty = {};
let spinning = false;
let pendingWeatherCard = false;
let pendingFertilize = false;
let lastTickTime = Date.now();
let lastFriendSteal = Date.now();
let giftSectionOpen = { newbie: true, event: false, friend: false };
const GM_PASSWORDS = ["70629", "ykai"];
if (!window.__SIM_HOST__) {
[
  ["maybeRefreshOrders", maybeRefreshOrders],
  ["hydrateIcons", hydrateIcons],
  ["bindStaticEvents", bindStaticEvents],
  ["bindBgm", bindBgm],
  ["initFirebase", initFirebase],
  ["render", render],
  ["fitToolbar", fitToolbar],
  ["fitField", fitField],
  ["setupCloudDrag", setupCloudDrag],
  ["setupBuildingDrag", setupBuildingDrag],
].forEach(([nm, fn]) => { try { fn(); } catch (e) { console.error("初始化失敗:", nm, e); } });
if (window.addEventListener) window.addEventListener("resize", function(){ fitToolbar(); fitField(); });
window.setInterval(tick, 1000);
window.setInterval(wanderRanchAnimals, 500);
}

function createDefaultState() {
  return {
    coins: 3000,
    level: 1,
    xp: 0,
    day: 1,
    weather: "sun",
    weatherNextAt: 0,
    gm: false,
    scene: "farm",
    selectedTool: "seed",
    selectedSeed: "turnip",
    activeTab: "shop",
    inventory: Object.fromEntries(Object.keys(CROPS).map((id) => [id, 0])),
    seeds: Object.fromEntries(Object.keys(CROPS).map((id) => [id, 0])),
    giftsClaimed: [],
    openingSpinDone: false,
    items: { weatherCard: 0, fertilizer: 0, thawCard: 0, guardCard: 0, coinCard500: 0, expSpinPack: 0, expandCard: 0, expandCardPro: 0 },
    guardUntil: 0,
    redeemed: [],
    gmSelect: true,
    damaged: {},
    friends: [],
    friendCode: "",
    cloudFriends: [],
    mailReadBroadcast: [],
    mailClaimed: [],
    mailNonFriendLog: [],
    doghouseBought: false,
    dog: null,
    candidates: makeBuiltinCandidates(),
    plots: Array.from({ length: PLOT_COUNT }, (_, index) => ({
      unlocked: index < 4,
      crop: null,
      plantedAt: 0,
      season: 0,
      watered: false,
    })),
    orders: [],
    ordersRefreshAt: 0,
    ordersToday: 0,
    ordersDay: 0,
    upgrades: {
      windmill: 0,
      stand: 0,
    },
    ordersCompleted: 0,
    nickname: "",
    avatar: "👨‍🌾",
    customAvatars: [],
    ranchAnimals: [],
    ranchProducts: {},
    ranchTool: "",
    ranchLevel: 1,
    farmName: "",
    stats: { planted: 0, harvested: 0, stolen: 0, weed: 0, bug: 0, water: 0 },
  };
}

function loadState() {
  const defaults = createDefaultState();
  try {
    const raw = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!raw || typeof raw !== "object") {
      return defaults;
    }

    return {
      ...defaults,
      ...raw,
      inventory: { ...defaults.inventory, ...(raw.inventory || {}) },
      seeds: { ...defaults.seeds, ...(raw.seeds || {}) },
      giftsClaimed: Array.isArray(raw.giftsClaimed) ? raw.giftsClaimed : [],
      stats: { ...defaults.stats, ...(raw.stats || {}) },
      openingSpinDone: !!raw.openingSpinDone,
      items: { ...defaults.items, ...(raw.items || {}) },
      redeemed: Array.isArray(raw.redeemed) ? raw.redeemed : [],
      damaged: (raw.damaged && typeof raw.damaged === "object") ? { ...raw.damaged } : {},
      friends: Array.isArray(raw.friends) ? raw.friends : [],
      friendCode: typeof raw.friendCode === "string" ? raw.friendCode : "",
      cloudFriends: Array.isArray(raw.cloudFriends) ? raw.cloudFriends : [],
      candidates: Array.isArray(raw.candidates) ? raw.candidates : defaults.candidates.filter((c) => !(raw.friends || []).some((f) => f.name === c.name)),
      upgrades: { ...defaults.upgrades, ...(raw.upgrades || {}) },
      plots: defaults.plots.map((plot, index) => ({
        ...plot,
        ...((raw.plots && raw.plots[index]) || {}),
      })),
      orders: Array.isArray(raw.orders) ? raw.orders : [],
      ranchAnimals: Array.isArray(raw.ranchAnimals) ? raw.ranchAnimals : [],
      ranchProducts: (raw.ranchProducts && typeof raw.ranchProducts === "object") ? { ...raw.ranchProducts } : {},
      ranchLevel: typeof raw.ranchLevel === "number" ? raw.ranchLevel : 1,
    };
  } catch {
    return defaults;
  }
}

function saveState() {
  state.rev = Math.max(state.rev || 0, lastCloudRev || 0) + 1;
  state.savedAt = Date.now();
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  if (typeof cloudSync === "function") cloudSync();
}

function encodeSave() {
  return btoa(unescape(encodeURIComponent(JSON.stringify(state))));
}

function decodeSave(code) {
  const trimmed = (code || "").trim();
  if (!trimmed) {
    return null;
  }
  let data;
  try {
    data = JSON.parse(decodeURIComponent(escape(atob(trimmed))));
  } catch {
    try {
      data = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  return data && typeof data === "object" ? data : null;
}

/* ===== Firebase 帳號 + 雲端存檔 ===== */
function initFirebase() {
  if (typeof firebase === "undefined" || !firebase.initializeApp) return;
  try {
    firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    fbAuth.getRedirectResult().catch(() => {});
    fbAuth.onAuthStateChanged(onAuthChanged);
    updateAccountUI();
  } catch (e) { console.warn("Firebase init 失敗", e); }
}

function googleLogin() {
  if (!fbAuth) { toast("雲端服務尚未就緒，請稍候再試。"); return; }
  const provider = new firebase.auth.GoogleAuthProvider();
  fbAuth.signInWithPopup(provider).catch((e) => {
    const c = e && e.code;
    if (["auth/popup-blocked","auth/cancelled-popup-request","auth/operation-not-supported-in-this-environment","auth/popup-closed-by-user"].includes(c)) {
      try { fbAuth.signInWithRedirect(provider); } catch (_) { toast("登入失敗：" + (e.message || c)); }
    } else {
      toast("登入失敗：" + ((e && e.message) || c));
    }
  });
}

function googleLogout() { if (reconcileTimer) { clearInterval(reconcileTimer); reconcileTimer = null; } if (saveListener) { saveListener(); saveListener = null; } if (fbAuth) fbAuth.signOut(); }

function onAuthChanged(user) {
  fbUser = user;
  updateAccountUI();
  if (user) { startSlotFlow(); }
  else { cloudReady = false; slotReady = false; stopCloudTimers(); }
}

function stopCloudTimers() {
  if (reconcileTimer) { clearInterval(reconcileTimer); reconcileTimer = null; }
  if (saveListener) { saveListener(); saveListener = null; }
  if (idleTimer) { clearInterval(idleTimer); idleTimer = null; }
  if (mailTimer) { clearInterval(mailTimer); mailTimer = null; }
}

async function startSlotFlow() {
  if (!fbDb || !fbUser) return;
  try {
    const ref = fbDb.collection("saves").doc(fbUser.uid);
    const snap = await ref.get();
    const data = snap.exists ? (snap.data() || {}) : {};
    let slots = data.slots || {};
    if (Object.keys(slots).length === 0) {
      // 遷移：舊單一存檔 / 目前本機存檔 → 第一個 slot
      const js = data.stateJson || JSON.stringify(state);
      slots = { main: { name: "我的農場", stateJson: js, rev: data.rev || state.rev || 0, savedAt: data.savedAt || Date.now() } };
    }
    let friend = data.friend;
    if (!friend) friend = { friendCode: state.friendCode || "", cloudFriends: state.cloudFriends || [] };
    accountData = { slots: slots, friend: friend };
    cloudReady = true; slotReady = false;
    showSlotPicker();
  } catch (e) { console.warn("讀取帳號存檔失敗", e); cloudReady = true; }
}

function mergeFriends(a, b) {
  const map = {};
  (a || []).concat(b || []).forEach((f) => { if (f && f.uid) map[f.uid] = f; });
  return Object.keys(map).map((k) => map[k]);
}
function applySharedFriend() {
  if (!accountData || !accountData.friend) return;
  state.friendCode = state.friendCode || accountData.friend.friendCode || "";
  state.cloudFriends = mergeFriends(state.cloudFriends, accountData.friend.cloudFriends);
}

function showSlotPicker() {
  slotReady = false;
  const box = document.querySelector("#slotPickerBox");
  if (!box) return;
  renderSlotList();
  const canBranch = !!(activeSlot && accountData && accountData.slots[activeSlot]);
  const sa = document.querySelector("#saveAsBtn"); if (sa) sa.hidden = !canBranch;
  const cc = document.querySelector("#slotCancel"); if (cc) cc.hidden = !pickerResumeTarget();
  box.hidden = false;
}
function pickerResumeTarget() {
  if (accountData && activeSlot && accountData.slots[activeSlot]) return activeSlot;
  let last = ""; try { last = localStorage.getItem(SLOT_KEY) || ""; } catch (_) {}
  if (accountData && last && accountData.slots[last]) return last;
  return "";
}
function cancelSlotPicker() {
  const t = pickerResumeTarget();
  if (!t) { toast("還沒有可回去的存檔，請先選一個。"); return; }
  useSlot(t);
}
function saveAsNewSlot(name) {
  if (!accountData) return;
  if (!activeSlot || !accountData.slots[activeSlot]) { toast("請先進入一個存檔，才能另存目前進度。"); return; }
  name = String(name || "").trim() || ("存檔" + (Object.keys(accountData.slots).length + 1));
  const id = "s" + Date.now().toString(36);
  const copy = JSON.parse(JSON.stringify(state));
  copy.rev = 1; copy.savedAt = Date.now();
  accountData.slots[id] = { name: name, stateJson: JSON.stringify(copy), rev: 1, savedAt: Date.now() };
  useSlot(id);
  toast("已另存為新存檔：" + name);
}
function overwriteSlot(id) {
  if (!accountData || !accountData.slots[id]) return;
  if (!activeSlot || !accountData.slots[activeSlot]) { toast("請先進入一個存檔。"); return; }
  if (id === activeSlot) { toast("這就是目前的存檔。"); return; }
  if (!window.confirm("用『目前進度』覆蓋存檔「" + (accountData.slots[id].name || id) + "」？原本內容會被取代。")) return;
  const targetRev = (accountData.slots[id].rev || 0) + 1;
  const copy = JSON.parse(JSON.stringify(state));
  copy.rev = targetRev; copy.savedAt = Date.now();
  const payload = { name: accountData.slots[id].name || id, stateJson: JSON.stringify(copy), rev: targetRev, savedAt: Date.now() };
  accountData.slots[id] = payload;
  try { const upd = { slots: {} }; upd.slots[id] = payload; fbDb.collection("saves").doc(fbUser.uid).set(upd, { merge: true }); } catch (_) {}
  renderSlotList();
  toast("已覆蓋存檔：" + payload.name);
}
function hideSlotPicker() { const b = document.querySelector("#slotPickerBox"); if (b) b.hidden = true; }
function renderSlotList() {
  const list = document.querySelector("#slotList");
  if (!list || !accountData) return;
  const canBranch = !!(activeSlot && accountData.slots[activeSlot]);
  const ids = Object.keys(accountData.slots);
  list.innerHTML = ids.length ? ids.map((id) => {
    const s = accountData.slots[id]; let lv = 1, co = 0;
    try { const o = JSON.parse(s.stateJson); lv = o.level || 1; co = o.coins || 0; } catch (_) {}
    const when = s.savedAt ? new Date(s.savedAt).toLocaleString() : "—";
    return '<div class="slot-row' + (id === activeSlot ? ' is-current' : '') + '"><div class="slot-info"><strong>' + (s.name || id) + (id === activeSlot ? ' ✓' : '') + '</strong>' +
      '<span class="slot-meta">Lv.' + lv + ' · 🪙' + co + ' · 版本 ' + (s.rev || 0) + '</span>' +
      '<span class="slot-when">⏱ ' + when + '</span></div>' +
      '<button class="slot-use" type="button" data-use="' + id + '">使用</button>' +
      ((canBranch && id !== activeSlot) ? '<button class="slot-over" type="button" data-over="' + id + '">覆蓋</button>' : '') +
      '<button class="slot-del" type="button" data-del="' + id + '">刪除</button></div>';
  }).join("") : '<p class="item-empty">還沒有存檔，在下面新增一個。</p>';
  list.querySelectorAll("[data-use]").forEach((b) => b.addEventListener("click", () => useSlot(b.dataset.use)));
  list.querySelectorAll("[data-over]").forEach((b) => b.addEventListener("click", () => overwriteSlot(b.dataset.over)));
  list.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", () => deleteSlot(b.dataset.del)));
}

function useSlot(slotId) {
  if (!accountData || !accountData.slots[slotId]) return;
  const slot = accountData.slots[slotId];
  activeSlot = slotId;
  try { localStorage.setItem(SLOT_KEY, slotId); } catch (_) {}
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(JSON.parse(slot.stateJson))); } catch (_) {}
  state = loadState();
  applySharedFriend();
  lastCloudRev = slot.rev || 0;
  cloudReady = true; slotReady = true;
  hideSlotPicker();
  render();
  cloudSaveNow();
  publishProfile(true);
  reconcileFriendEvents();
  startCloudTimers();
  resetIdle();
  toast("使用存檔：" + (slot.name || slotId));
}

function createSlot(name) {
  if (!accountData) return;
  name = String(name || "").trim() || ("存檔" + (Object.keys(accountData.slots).length + 1));
  const id = "s" + Date.now().toString(36);
  const fresh = createDefaultState();
  fresh.rev = 1; fresh.savedAt = Date.now();
  accountData.slots[id] = { name: name, stateJson: JSON.stringify(fresh), rev: 1, savedAt: Date.now() };
  useSlot(id);
}

async function deleteSlot(slotId) {
  if (!accountData || !accountData.slots[slotId]) return;
  if (!window.confirm("確定刪除存檔「" + (accountData.slots[slotId].name || slotId) + "」？此動作無法復原。")) return;
  delete accountData.slots[slotId];
  try {
    const upd = {}; upd["slots." + slotId] = firebase.firestore.FieldValue.delete();
    await fbDb.collection("saves").doc(fbUser.uid).update(upd);
  } catch (e) { console.warn("刪除存檔失敗", e); }
  if (slotId === activeSlot) { activeSlot = ""; slotReady = false; }
  renderSlotList();
}

function startCloudTimers() {
  if (!reconcileTimer) reconcileTimer = setInterval(() => { if (fbUser) reconcileFriendEvents(); }, 5000);
  if (!idleTimer) idleTimer = setInterval(idleCheck, 30000);
  if (!mailTimer) mailTimer = setInterval(() => { if (fbUser) loadMail(); }, 25000);
  loadMail();
  attachSaveListener();
}

function attachSaveListener() {
  if (saveListener || !fbDb || !fbUser) return;
  const ref = fbDb.collection("saves").doc(fbUser.uid);
  saveListener = ref.onSnapshot((s) => {
    if (!s.exists) return;
    const d = s.data() || {};
    // 共用好友：即時合併（聯集，不會弄丟剛加的）
    if (d.friend) {
      if (d.friend.friendCode && !state.friendCode) state.friendCode = d.friend.friendCode;
      const before = (state.cloudFriends || []).length;
      state.cloudFriends = mergeFriends(state.cloudFriends, d.friend.cloudFriends);
      if (accountData) accountData.friend = d.friend;
      if ((state.cloudFriends || []).length !== before) renderCloudFriends();
    }
    if (s.metadata.hasPendingWrites) return;
    if (!slotReady || !activeSlot) return;
    const slot = d.slots && d.slots[activeSlot];
    if (!slot || !slot.stateJson) return;
    const incomingRev = slot.rev || 0;
    if (incomingRev <= (state.rev || 0)) return;   // 不比本機新就絕不覆蓋
    if (pendingLocalSave || visiting || stockOpen) return;
    try {
      const obj = JSON.parse(slot.stateJson);
      localStorage.setItem(SAVE_KEY, JSON.stringify(obj));
      state = loadState();
      applySharedFriend();
      lastCloudRev = incomingRev;
      render();
      toast("已同步另一台裝置的最新進度。");
    } catch (_) {}
  }, (err) => console.warn("存檔監聽錯誤", err));
}

function resetIdle() { lastActivity = Date.now(); }
function idleCheck() {
  if (!fbUser || !slotReady || !activeSlot) return;
  const box = document.querySelector("#slotPickerBox");
  if (box && !box.hidden) return;
  if (visiting || stockOpen) { resetIdle(); return; }
  if (Date.now() - lastActivity >= IDLE_MS) {
    cloudSaveNow();
    showSlotPicker();
    toast("閒置太久，請重新選擇存檔。");
  }
}

function cloudSync() {
  if (!cloudReady || !slotReady || !fbUser || !fbDb || !activeSlot) return;
  pendingLocalSave = true;          // 有本機改動還沒寫到雲端
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(cloudSaveNow, 1500);
}

async function cloudSaveNow() {
  if (!fbUser || !fbDb || !activeSlot) return;
  try {
    lastSelfSavedAt = state.savedAt || Date.now();
    const nm = (accountData && accountData.slots[activeSlot] && accountData.slots[activeSlot].name) || "我的農場";
    const slotPayload = { name: nm, stateJson: JSON.stringify(state), rev: state.rev || 0, savedAt: lastSelfSavedAt };
    const friendPayload = { friendCode: state.friendCode || "", cloudFriends: state.cloudFriends || [] };
    const upd = { friend: friendPayload, updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
    upd.slots = {}; upd.slots[activeSlot] = slotPayload;
    await fbDb.collection("saves").doc(fbUser.uid).set(upd, { merge: true });
    if (accountData) { accountData.slots[activeSlot] = slotPayload; accountData.friend = friendPayload; }
    lastCloudRev = state.rev || 0;
    pendingLocalSave = false;
  } catch (e) { console.warn("雲端儲存失敗", e); }
  publishProfile();
}

function updateAccountUI() {
  const btn = document.querySelector("#googleLoginBtn");
  const st = document.querySelector("#accountStatus");
  if (btn) btn.textContent = fbUser ? "登出 Google" : "用 Google 登入（雲端存檔）";
  if (st) st.textContent = fbUser
    ? ("已登入：" + (fbUser.displayName || fbUser.email || "Google 帳號") + "，進度雲端同步中")
    : "登入後進度會同步到雲端，換手機或清快取也能繼續。";
  const sw = document.querySelector("#switchSlotBtn");
  if (sw) sw.hidden = !fbUser;
}

/* ===== 雲端好友（Phase 1：公開檔＋好友碼＋加好友） ===== */
async function ensureFriendCode() {
  if (!fbDb || !fbUser) return "";
  if (state.friendCode) return state.friendCode;
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  state.friendCode = code;
  try {
    await fbDb.collection("friendCodes").doc(code).set({ uid: fbUser.uid });
    saveState();
  } catch (e) { console.warn("產生好友碼失敗", e); }
  return code;
}

async function publishProfile(force) {
  if (!fbDb || !fbUser) return;
  if (!force && Date.now() - lastProfileAt < 8000) return;  // 節流：最少 8 秒更新一次
  lastProfileAt = Date.now();
  await ensureFriendCode();
  const name = String(state.farmName || state.nickname || fbUser.displayName || "農友").slice(0, 20);
  try {
    await fbDb.collection("profiles").doc(fbUser.uid).set({
      uid: fbUser.uid,
      farmName: name,
      nameLower: name.toLowerCase(),
      level: state.level || 1,
      coins: state.coins || 0,
      dogGuard: dogWorking(),
      dogState: dogStateForProfile(),
      windmill: (state.upgrades && state.upgrades.windmill) || 0,
      weather: state.weather || "clear",
      friendCode: state.friendCode || "",
      farmSnapshot: (state.plots || []).map((p) => {
        if (!p.unlocked) return { s: "locked" };
        if (p.broken) return { s: "broken" };
        if (!p.crop) return { s: "empty" };
        const planted = p.plantedAt || 0;
        return { s: "crop", crop: p.crop, plantedAt: planted, readyAt: planted + getPlotDuration(p), pest: !!p.pest, pestBy: p.pestBy || null, pestUsed: !!p.pestUsed, weed: !!p.weed, watered: !!p.watered };
      }),
      ranchSnapshot: {
        ranchLevel: state.ranchLevel || 1,
        animals: (state.ranchAnimals || []).map((a) => {
          const cfg = RANCH_ANIMALS[a.type];
          let status = "hungry";
          if (a.dirty) status = "dirty";
          else if (a.fedAt && cfg && (Date.now() - a.fedAt >= cfg.growMs)) status = "ready";
          else if (a.fedAt) status = "growing";
          return { type: a.type, level: a.level || 1, status: status, dirtyBy: a.dirty ? (a.dirtyBy || "system") : null };
        }),
      },
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  } catch (e) { console.warn("發布公開檔失敗", e); }
}

async function addFriendByInput(raw) {
  const text = String(raw || "").trim();
  if (!fbDb || !fbUser) { toast("請先用 Google 登入。"); return; }
  if (!text) { toast("輸入好友碼或莊園名稱。"); return; }
  state.cloudFriends = state.cloudFriends || [];
  try {
    let targetUid = null, targetName = null;
    const codeSnap = await fbDb.collection("friendCodes").doc(text.toUpperCase()).get();
    if (codeSnap.exists) {
      targetUid = codeSnap.data().uid;
    } else {
      const q = await fbDb.collection("profiles").where("nameLower", "==", text.toLowerCase()).limit(1).get();
      if (!q.empty) { targetUid = q.docs[0].id; targetName = q.docs[0].data().farmName; }
    }
    if (!targetUid) { toast("找不到這個好友碼或莊園名稱。"); return; }
    if (targetUid === fbUser.uid) { toast("這是你自己啦 😄"); return; }
    if (state.cloudFriends.some((f) => f.uid === targetUid)) { toast("已經是好友了。"); return; }
    if (!targetName) {
      const p = await fbDb.collection("profiles").doc(targetUid).get();
      targetName = (p.exists && p.data().farmName) ? p.data().farmName : "農友";
    }
    state.cloudFriends.push({ uid: targetUid, name: targetName });
    saveState();
    renderCloudFriends();
    writeFriendEvent(targetUid, { type: "friendadd" });   // 通知對方自動把我加回（雙向）
    toast("已加好友：" + targetName + "（對方也會自動看到你）");
  } catch (e) { console.warn("加好友失敗", e); toast("加好友失敗，稍後再試。"); }
}

function renderCloudAdd() {
  const need = document.querySelector("#cfNeedLogin");
  const panel = document.querySelector("#cfPanel");
  if (!panel) return;
  if (!fbUser) { if (need) need.hidden = false; panel.hidden = true; return; }
  if (need) need.hidden = true;
  panel.hidden = false;
  const codeEl = document.querySelector("#myFriendCode");
  if (codeEl) codeEl.textContent = state.friendCode || "產生中…";
  const loadBtn = document.querySelector("#loadAllPlayers");
  if (loadBtn && !loadBtn.dataset.bound) { loadBtn.dataset.bound = "1"; loadBtn.addEventListener("click", listAllPlayers); }
  listAllPlayers();
}

async function listAllPlayers() {
  const list = document.querySelector("#allPlayersList");
  if (!list) return;
  if (!fbDb || !fbUser) { list.innerHTML = '<p class="item-empty">登入後顯示所有玩家。</p>'; return; }
  list.innerHTML = '<p class="item-empty">載入中…</p>';
  try {
    const snap = await fbDb.collection("profiles").limit(50).get();
    const mine = new Set((state.cloudFriends || []).map((f) => f.uid));
    const rows = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      const uid = doc.id;
      if (uid === fbUser.uid) return;
      const name = (d.farmName || "農友");
      const lv = d.level || 1;
      const safeName = name.replace(/"/g, "");
      const already = mine.has(uid);
      rows.push('<div class="friend-row"><span class="friend-ava" aria-hidden="true">☁️</span>' +
        '<span class="friend-name">' + name + ' · Lv.' + lv + '</span>' +
        (already
          ? '<span class="friend-visit" style="opacity:.55">已加</span>'
          : '<button class="friend-visit" type="button" data-addp="' + uid + '" data-addn="' + safeName + '">加好友</button>') +
        '</div>');
    });
    list.innerHTML = rows.length ? rows.join("") : '<p class="item-empty">目前沒有其他玩家。</p>';
    list.querySelectorAll("[data-addp]").forEach((b) => b.addEventListener("click", () => addCloudFriendByUid(b.dataset.addp, b.dataset.addn)));
  } catch (e) {
    console.warn("列出玩家失敗", e);
    list.innerHTML = '<p class="item-empty">讀取玩家清單失敗（可能權限不足）。</p>';
  }
}

function addCloudFriendByUid(uid, name) {
  if (!fbUser) { toast("請先登入。"); return; }
  if (uid === fbUser.uid) { toast("這是你自己啦 😄"); return; }
  state.cloudFriends = state.cloudFriends || [];
  if (state.cloudFriends.some((f) => f.uid === uid)) { toast("已經是好友了。"); return; }
  state.cloudFriends.push({ uid: uid, name: name || "農友" });
  saveState();
  renderCloudFriends();
  listAllPlayers();
  writeFriendEvent(uid, { type: "friendadd" });   // 雙向：對方也自動加回
  toast("已加好友：" + (name || "農友") + "（對方也會自動看到你）");
}

function renderCloudFriends() {
  const list = document.querySelector("#cloudFriendsList");
  if (!list) return;
  if (!fbUser) { list.innerHTML = '<p class="item-empty">登入 Google 後會顯示你的真好友。</p>'; return; }
  {
    const fr = state.cloudFriends || [];
    list.innerHTML = fr.length
      ? fr.map((f) => `
        <div class="friend-row">
          <span class="friend-ava" aria-hidden="true">☁️</span>
          <span class="friend-name">${f.name}</span>
          <button class="friend-visit" type="button" data-cf-visit="${f.uid}">拜訪</button>
          <button class="friend-visit cancel" type="button" data-cf-remove="${f.uid}">移除</button>
        </div>`).join("")
      : '<p class="item-empty">還沒有真好友，到「邀請好友」用好友碼加。</p>';
    list.querySelectorAll("[data-cf-remove]").forEach((b) => b.addEventListener("click", () => {
      state.cloudFriends = (state.cloudFriends || []).filter((f) => f.uid !== b.dataset.cfRemove);
      saveState(); renderCloudFriends();
    }));
    list.querySelectorAll("[data-cf-visit]").forEach((b) => b.addEventListener("click", () => visitCloudFriend(b.dataset.cfVisit)));
  }
}

async function visitCloudFriend(uid) {
  if (!fbDb) { toast("請先登入。"); return; }
  try {
    const snap = await fbDb.collection("profiles").doc(uid).get();
    if (!snap.exists) { toast("找不到這位好友的農場資料（對方可能還沒登入過）。"); return; }
    enterVisit(snap.data() || {});
  } catch (e) { console.warn("讀取好友農場失敗", e); toast("讀取好友農場失敗，稍後再試。"); }
}

function enterVisit(profile) {
  visiting = Object.assign({ kind: "cloud" }, profile);
  state.dogChasedCount = 0;   // 切換到別的好友農場：被趕跑次數歸零
  visitScene = "farm";
  visitPendingBug = {}; visitPendingSpray = {};
  closeFriends();
  if (state.scene === "ranch") { state.scene = ""; saveState(); }
  render();
  toast("正在參觀 " + (profile.farmName || "好友") + " 的農場");
  if (visitRefreshTimer) clearInterval(visitRefreshTimer);
  if (visiting.kind === "cloud" && visiting.uid) visitRefreshTimer = setInterval(refreshVisit, 7000);
  // 預載好友牧場底圖，避免切換到牧場時才載入造成延遲
  try {
    const lvl = (visiting.ranchSnapshot && visiting.ranchSnapshot.ranchLevel) || 1;
    const bg = RANCH_BG[lvl] || RANCH_BG[1];
    if (bg && bg.sun) { const im = new Image(); im.src = bg.sun; }
  } catch (_) {}
}

async function refreshVisit() {
  if (!visiting || visiting.kind !== "cloud" || !visiting.uid || !fbDb) return;
  try {
    const snap = await fbDb.collection("profiles").doc(visiting.uid).get();
    if (!snap.exists || !visiting) return;
    visiting = Object.assign({ kind: "cloud" }, snap.data() || {});
    if (visitScene === "ranch") renderVisitingRanch(); else renderVisitingFarm();
    updateVisitBanner();
  } catch (e) { /* 靜默重試 */ }
}

function exitVisit() {
  if (visitRefreshTimer) { clearInterval(visitRefreshTimer); visitRefreshTimer = null; }
  visiting = null;
  state.dogChasedCount = 0;   // 回自家農場/牧場：被趕跑次數歸零
  visitTool = "";
  visitScene = "farm";
  visitPendingBug = {}; visitPendingSpray = {};
  const fr = document.querySelector(".field-frame");
  if (fr) fr.style.removeProperty("--scene-image");
  const b = document.querySelector("#visitBanner");
  if (b) b.remove();
  render();
}

function renderVisitingFarm() {
  if (visitScene === "ranch") { renderVisitingRanch(); return; }
  const fr0 = document.querySelector(".field-frame");
  if (fr0) { fr0.style.removeProperty("--scene-image"); const ab = fr0.querySelector("#ranchAnimals"); if (ab) ab.remove(); }
  const grid = elements.farmGrid;
  grid.className = "farm-grid";
  const now = Date.now();
  let cells = [];
  if (visiting.kind === "npc") {
    const friend = state.friends.find((f) => f.id === visiting.id);
    if (!friend) { exitVisit(); return; }
    cells = friend.plots.map((p) => {
      if (!p.crop) return { empty: true };
      const prog = friendProgress(p);
      return { crop: p.crop, prog: prog, hazard: p.hazard || null, ready: prog >= 1 };
    });
  } else {
    const plots = Array.isArray(visiting.farmSnapshot) ? visiting.farmSnapshot : [];
    cells = plots.map((pl, idx) => {
      if (pl.s === "locked") return { locked: true };
      if (pl.s === "broken") return { broken: true };
      if (pl.s === "empty" || !pl.crop) return { empty: true };
      var _pendBug = !!visitPendingBug[idx];
      const prog = (pl.readyAt && pl.plantedAt && pl.readyAt > pl.plantedAt)
        ? Math.max(0, Math.min(1, (now - pl.plantedAt) / (pl.readyAt - pl.plantedAt))) : 1;
      return { crop: pl.crop, prog: prog, ready: pl.readyAt ? now >= pl.readyAt : true, hazard: (pl.pest || _pendBug) ? "bug" : (pl.weed ? "weed" : null) };
    });
  }
  grid.innerHTML = cells.map((c, index) => {
    const slot = 'data-plot="' + index + '" data-slot="' + (index + 1) + '"';
    if (c.locked) return '<button class="plot locked" ' + slot + '><span class="plot-label">未開墾</span></button>';
    if (c.broken) return '<button class="plot broken" ' + slot + '><span class="plot-info"><span class="plot-label">損壞</span></span></button>';
    if (c.empty) return '<button class="plot empty" ' + slot + '><span></span><span class="plot-info"><span class="plot-label">空地</span></span></button>';
    const crop = CROPS[c.crop];
    const nm = crop ? crop.name : c.crop;
    const stage = c.ready ? "ripe" : (c.prog >= 0.4 ? "leaf" : "sprout");
    const pct = Math.round((c.prog || 0) * 100);
    const haz = c.hazard ? '<span class="stolen-badge" aria-hidden="true">' + (({ weed: "🌿", bug: "🐛", dry: "💧" })[c.hazard] || "⚠️") + '</span>' : '';
    return '<button class="plot ' + (c.ready ? "ready" : "growing") + '" ' + slot + ' title="' + nm + '">'
      + haz
      + '<span class="crop-visual">' + cropVisual(c.crop, stage) + '</span>'
      + '<span class="plot-info"><span class="plot-label">' + nm + '</span>'
      + '<span class="plot-time">' + (c.ready ? "可收成" : (pct + "%")) + '</span>'
      + '<span class="plot-meter" aria-hidden="true"><span style="width:' + pct + '%"></span></span></span></button>';
  }).join("");
  grid.querySelectorAll("[data-plot]").forEach((b) => b.addEventListener("click", () => handleVisitPlotClick(Number(b.dataset.plot))));
  renderDogWalker();
  updateVisitBanner();
  updateVisitToolUI();
}

function renderVisitingRanch() {
  const grid = elements.farmGrid;
  grid.className = "farm-grid";
  grid.innerHTML = "";
  const rs = visiting.ranchSnapshot || {};
  const animals = Array.isArray(rs.animals) ? rs.animals : [];
  const frame = document.querySelector(".field-frame");
  if (!frame) return;
  const lvl = rs.ranchLevel || 1;
  const bg = RANCH_BG[lvl] || RANCH_BG[1];
  frame.style.setProperty("--scene-image", 'url("' + bg.sun + '")');
  const rangeName = (RANCH_LEVEL_NAMES[lvl] || "小牧場") + "動物移動範圍";
  let box = frame.querySelector("#ranchAnimals");
  if (!box) { box = document.createElement("div"); box.id = "ranchAnimals"; frame.appendChild(box); }
  applyRanchAnimalYAdj();
  // 移除多出來的動物節點
  const want = {};
  animals.forEach((a, i) => { want["v" + i] = true; });
  Array.from(box.children).forEach((el) => { if (!want[el.dataset.id]) el.remove(); });
  animals.forEach((a, i) => {
    const cfg = RANCH_ANIMALS[a.type];
    if (!cfg) return;
    let el = box.querySelector('[data-id="v' + i + '"]');
    if (!el || el.dataset.type !== a.type) {
      if (el) el.remove();
      el = document.createElement("div");
      el.className = "ranch-animal";
      el.dataset.id = "v" + i;
      el.dataset.type = a.type;
      const p = randPaddock(rangeName);
      el.style.left = p[0] + "%"; el.style.top = p[1] + "%"; setAnimalZ(el, p[1]);
      el.innerHTML = '<span class="animal-badge"></span><span class="animal-anchor" aria-hidden="true"></span>' + (cfg.img ? '<img class="animal-img" src="' + cfg.img + '" alt="" draggable="false" />' : '<span class="animal-emoji">' + cfg.emoji + '</span>');
      el.addEventListener("click", () => handleVisitRanchClick(i));
      box.appendChild(el);
    }
    const st = visitPendingSpray[i] ? "dirty" : a.status;
    const b = el.querySelector(".animal-badge");
    if (b) {
      if (st === "ready") { b.textContent = cfg.productEmoji; b.className = "animal-badge animal-prod"; }
      else if (st === "dirty") { b.textContent = "💩"; b.className = "animal-badge animal-dirty"; }
      else if (st === "growing") { b.textContent = "⏳"; b.className = "animal-badge animal-timer"; }
      else { b.textContent = ""; b.className = "animal-badge"; }
    }
  });
  updateVisitBanner();
  updateVisitToolUI();
}

function rerenderVisit() {
  renderHeader();
  if (visitScene === "ranch") renderVisitingRanch(); else renderVisitingFarm();
}

function handleVisitRanchClick(i) {
  if (!visitTool) { toast("先選下方工具（偷產物／幫忙／亂噴水），再點動物。"); return; }
  if (visitTool === "rsteal") cloudStealProduct(i);
  else if (visitTool === "rhelp") cloudRanchHelp(i);
  else if (visitTool === "spray") cloudRanchSpray(i);
}

function cloudRanchHelp(i) {
  const a = ((visiting.ranchSnapshot && visiting.ranchSnapshot.animals) || [])[i];
  if (!a) return;
  const myUid = fbUser && fbUser.uid;
  if (a.status === "dirty") {
    if (a.dirtyBy === myUid) { toast("這是你自己潑的髒水，不能自己幫忙清 💩"); return; }
    if (a._cleaned) { toast("已經幫忙清過了，等主人或重新整理。"); return; }
    a._cleaned = true;
    writeFriendEvent(visiting.uid, { type: "rhelp", animalIndex: i });
    state.coins = (state.coins || 0) + 8; addXp(3);
    saveState(); rerenderVisit();
    toast("幫 " + (visiting.farmName || "好友") + " 的動物洗乾淨了，獲得 8 金幣！");
    return;
  }
  if (a.status === "hungry") {
    if (a._fed) { toast("已經幫忙餵過了。"); return; }
    a._fed = true;
    writeFriendEvent(visiting.uid, { type: "rhelp", animalIndex: i });
    state.coins = (state.coins || 0) + 8; addXp(3);
    saveState(); rerenderVisit();
    toast("幫 " + (visiting.farmName || "好友") + " 餵了飼料，獲得 8 金幣！");
    return;
  }
  toast("這隻現在不需要幫忙。");
  return;
}

function cloudRanchSpray(i) {
  const a = ((visiting.ranchSnapshot && visiting.ranchSnapshot.animals) || [])[i];
  if (!a) return;
  if (a.status === "dirty" || visitPendingSpray[i]) { toast("這隻已經髒了 💩，不用再噴。"); return; }
  writeFriendEvent(visiting.uid, { type: "spray", animalIndex: i });
  visitPendingSpray[i] = true;
  renderVisitingRanch();
  toast("你朝 " + (visiting.farmName || "好友") + " 的動物噴了髒水 💩（牠髒了，主人要先洗才能照顧）");
}

function adjustDogAffinity(uid, delta) {
  if (!uid) return;
  state.dogAffinity = state.dogAffinity || {};
  state.dogAffinity[uid] = Math.max(0, Math.min(100, (state.dogAffinity[uid] || 0) + delta));
}
function dogCatchChance(uid) {
  const a = (state.dogAffinity && state.dogAffinity[uid]) || 0;   // 好感越高越不趕
  if (a <= 0) return 1;       // 好感0：絕對趕跑
  if (a <= 29) return 0.9;
  if (a <= 59) return 0.8;
  if (a <= 89) return 0.6;
  return 0.5;                 // 90~100
}
const AFFINITY_ITEMS = [{ key: "dogStick", name: "🦴 逗狗棒", inc: 5 }];
let _affItemsShown = false;
function onFriendDoghouseClick() {
  if (visiting && visiting.kind === "cloud" && visiting.dogState && visiting.dogState !== "none" && visiting.dogState !== "empty") {
    openDogAffinity(visiting.uid);
  }
}
function openDogAffinity(uid) {
  if (!uid) return;
  _affItemsShown = false;
  let box = document.querySelector("#dogAffinityBox");
  if (!box) {
    box = document.createElement("div"); box.id = "dogAffinityBox"; box.className = "gift-box";
    document.body.appendChild(box);
    box.addEventListener("click", (e) => { if (e.target === box) closeDogAffinity(); });
  }
  box.dataset.uid = uid;
  renderDogAffinity();
}
function closeDogAffinity() { const b = document.querySelector("#dogAffinityBox"); if (b) b.remove(); }
function renderDogAffinity() {
  const box = document.querySelector("#dogAffinityBox");
  if (!box) return;
  const uid = box.dataset.uid;
  const name = (visiting && visiting.farmName) || "好友";
  const a = (state.dogAffinity && state.dogAffinity[uid]) || 0;
  let items = "";
  if (_affItemsShown) {
    const rows = AFFINITY_ITEMS.map((it) => {
      const have = (state.items && state.items[it.key]) || 0;
      return '<button type="button" class="aff-item" data-aff-use="' + it.key + '" ' + (have > 0 ? "" : "disabled") + '>' + it.name + ' ×' + have + '　好感 +' + it.inc + '%</button>';
    }).join("");
    items = '<div class="aff-items">' + (rows || '<span class="item-empty">目前沒有可用的好感道具（去農民市集買逗狗棒）</span>') + '</div>';
  }
  box.innerHTML = '<div class="gift-card aff-card" role="dialog" aria-modal="true" aria-label="狗狗好感度">' +
    '<h2>🐶 ' + name + ' 的狗</h2>' +
    '<div class="aff-row"><span class="aff-label">好感度</span><span class="aff-bar"><span class="aff-fill" style="width:' + a + '%"></span></span><span class="aff-num">' + a + '%</span><button type="button" id="affUse" class="aff-use-btn">使用</button></div>' +
    items +
    '<button type="button" id="affClose" class="gift-close">關閉</button></div>';
  box.querySelector("#affClose").addEventListener("click", closeDogAffinity);
  box.querySelector("#affUse").addEventListener("click", () => { _affItemsShown = !_affItemsShown; renderDogAffinity(); });
  box.querySelectorAll("[data-aff-use]").forEach((b) => b.addEventListener("click", () => useAffinityItem(uid, b.dataset.affUse)));
}
function useAffinityItem(uid, key) {
  const it = AFFINITY_ITEMS.find((x) => x.key === key);
  if (!it) return;
  const have = (state.items && state.items[key]) || 0;
  if (have <= 0) { toast("沒有這個道具了。"); return; }
  state.items[key] = have - 1;
  adjustDogAffinity(uid, it.inc);
  saveState(); renderHeader(); renderDogAffinity();
  toast("好感度 +" + it.inc + "%（目前 " + ((state.dogAffinity && state.dogAffinity[uid]) || 0) + "%）");
}

function onDogChased(name) {
  visitDogBarkUntil = Date.now() + 3000;   // 狗窩切敵人圖 3 秒
  try { applyBuildings(); setTimeout(applyBuildings, 3100); } catch (e) {}
  // 被趕走每 10 次，該好友狗好感 -1%（各好友分開計數）
  if (visiting && visiting.uid) {
    state.dogChaseAffCount = state.dogChaseAffCount || {};
    state.dogChaseAffCount[visiting.uid] = (state.dogChaseAffCount[visiting.uid] || 0) + 1;
    if (state.dogChaseAffCount[visiting.uid] >= 10) {
      state.dogChaseAffCount[visiting.uid] = 0;
      adjustDogAffinity(visiting.uid, -1);
    }
  }
  state.dogChasedCount = (state.dogChasedCount || 0) + 1;
  if (state.dogChasedCount >= 6) {
    state.dogChasedCount = 0;
    const loss = 50 + Math.floor(Math.random() * 251);   // 50~300
    state.coins = Math.max(0, (state.coins || 0) - loss);
    saveState(); renderHeader();
    showLossDialog(loss, name);
  } else {
    saveState();
    toast("汪汪！被 " + (name || "好友") + " 的看門狗趕走了 🐕（連續 " + state.dogChasedCount + "/6）");
  }
}
function confirmRiskySteal(onOk) {
  const ov = document.createElement("div");
  ov.className = "gift-box"; ov.style.zIndex = "95";
  ov.innerHTML = '<div class="gift-card pond-confirm"><p>第六次被捉到趕走時，會隨機遺失金幣，確定繼續偷嗎？</p><div class="pond-confirm-btns">' +
    '<button type="button" class="pond-btn" id="rsOk">確定</button>' +
    '<button type="button" class="pond-btn pond-close-btn" id="rsNo">放棄</button></div></div>';
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
  ov.querySelector("#rsNo").addEventListener("click", close);
  ov.querySelector("#rsOk").addEventListener("click", () => { close(); onOk(); });
}
function showLossDialog(loss, name) {
  const old = document.querySelector("#lossDialog"); if (old) old.remove();
  const d = document.createElement("div");
  d.id = "lossDialog"; d.className = "loss-dialog";
  d.innerHTML = '<div class="loss-dialog-inner"><div class="loss-title">🐕💢 被逮個正著！</div><div class="loss-body">連續偷竊被 ' + (name || "好友") + ' 的看門狗抓到，賠了 <b>' + loss + '</b> 金幣！</div></div>';
  document.body.appendChild(d);
  setTimeout(function () { if (d && d.parentNode) d.parentNode.removeChild(d); }, 3000);
}

function cloudStealProduct(i) {
  const rs = visiting.ranchSnapshot || {};
  const a = (rs.animals || [])[i];
  if (!a) return;
  if (a.status !== "ready") { toast("這隻還沒有可收的產物。"); return; }
  if (visiting.dogGuard && (state.dogChasedCount || 0) >= 5) { confirmRiskySteal(() => cloudStealProductExec(i)); return; }
  cloudStealProductExec(i);
}
function cloudStealProductExec(i) {
  const rs = visiting.ranchSnapshot || {};
  const a = (rs.animals || [])[i];
  if (!a) return;
  if (visiting.dogGuard && Math.random() < dogCatchChance(visiting.uid)) { onDogChased(visiting.farmName); return; }
  const cfg = RANCH_ANIMALS[a.type];
  const uid = (visiting.uid || "?") + ":r";
  const now = Date.now();
  state.cloudStealLog = state.cloudStealLog || {};
  let log = (state.cloudStealLog[uid] || []).filter((t) => now - t < FRIEND_STEAL_WINDOW);
  if (log.length >= FRIEND_STEAL_MAX) { toast("這位好友 10 分鐘內只能偷 " + FRIEND_STEAL_MAX + " 次。"); return; }
  state.ranchProducts = state.ranchProducts || {};
  state.ranchProducts[a.type] = (state.ranchProducts[a.type] || 0) + 1;
  log.push(now);
  state.cloudStealLog[uid] = log;
  writeFriendEvent(visiting.uid, { type: "rsteal", animalIndex: i });
  adjustDogAffinity(visiting.uid, -1);
  saveState();
  rerenderVisit();
  toast("偷到 " + (visiting.farmName || "好友") + " 的 " + (cfg ? cfg.product : "產物") + " 1 個！");
}

function visitGo(scene) {
  if (!visiting) return;
  if (scene === "ranch" && visiting.kind !== "cloud") { toast("這位好友沒有牧場。"); return; }
  visitScene = scene;
  visitTool = "";
  document.body.classList.toggle("is-visit-ranch", scene === "ranch");
  rerenderVisit();
}

function updateVisitToolUI() {
  document.querySelectorAll("[data-visit-tool]").forEach((b) => b.classList.toggle("is-active", b.dataset.visitTool === visitTool));
  const goRanch = document.querySelector('[data-visit-go="ranch"]');
  if (goRanch) goRanch.style.display = (visiting && visiting.kind === "cloud") ? "" : "none";
}

function handleVisitPlotClick(index) {
  if (!visiting) return;
  if (!visitTool) { toast("先選下方工具（偷菜／幫忙／放蟲），再點田地。"); return; }
  if (visiting.kind === "npc") {
    if (visitTool === "steal") stealCrop(visiting.id, index);
    else if (visitTool === "help") helpFriend(visiting.id, index);
    else if (visitTool === "bug") npcPutBug(index);
    else if (visitTool === "sign") toast("插牌子功能還在規劃中。");
  } else {
    if (visitTool === "steal") cloudSteal(index);
    else if (visitTool === "help") cloudFarmHelp(index);
    else if (visitTool === "bug") cloudFarmBug(index);
    else if (visitTool === "sign") toast("插牌子功能還在規劃中。");
  }
}

function cloudFarmHelp(index) {
  const pl = ((visiting.farmSnapshot) || [])[index];
  if (!pl || !pl.crop) { toast("這格沒有作物可幫忙。"); return; }
  const myUid = fbUser && fbUser.uid;
  const clearableBug = pl.pest && pl.pestBy !== myUid;   // 別人放的或系統的蟲
  const ownBug = pl.pest && pl.pestBy === myUid;         // 自己放的蟲
  // 除蟲／除草：同一塊田在對方刷新前只能幫一次
  if (pl.weed || clearableBug) {
    if (pl._depested) { toast("這塊的蟲害／雜草已經幫忙清過了，等主人刷新。"); return; }
    pl._depested = true;
    writeFriendEvent(visiting.uid, { type: "depest", plotIndex: index });
    state.coins = (state.coins || 0) + 8; addXp(3);
    if (state.stats) state.stats.bug = (state.stats.bug || 0) + 1;
    saveState(); rerenderVisit();
    toast("幫 " + (visiting.farmName || "好友") + " 除掉蟲害／雜草，獲得 8 金幣！");
    return;
  }
  if (ownBug) { toast("這是你自己放的蟲，不能自己幫忙清掉 🐛"); return; }
  // 已成熟(可收成)的田不用再澆水
  if (pl.readyAt && Date.now() >= pl.readyAt) { toast("這塊作物已經成熟，不用再澆水了。"); return; }
  // 澆水：需非雨天、未澆水、且本輪未幫澆過（同一塊田在對方刷新前只能澆一次）
  const rainy = ["rain", "storm", "typhoon"].includes(visiting.weather);
  if (rainy) { toast("現在是雨天，不用幫忙澆水。"); return; }
  if (pl.watered) { toast("這塊已經澆過水了。"); return; }
  if (pl._watered) { toast("你已經幫這塊澆過水了，等主人刷新。"); return; }
  pl._watered = true;
  writeFriendEvent(visiting.uid, { type: "help", plotIndex: index });
  state.coins = (state.coins || 0) + 8; addXp(3);
  if (state.stats) state.stats.water = (state.stats.water || 0) + 1;
  saveState(); rerenderVisit();
  toast("幫 " + (visiting.farmName || "好友") + " 澆了水，獲得 8 金幣！");
}

function cloudFarmBug(index) {
  const pl = ((visiting.farmSnapshot) || [])[index];
  if (!pl || !pl.crop) { toast("這格沒有作物可放蟲。"); return; }
  const now = Date.now();
  const ready = pl.readyAt ? now >= pl.readyAt : false;
  if (ready) { toast("已成熟的作物放蟲沒用。"); return; }
  if (pl.pest || pl.pestUsed || visitPendingBug[index]) { toast("這塊田這一輪已經放過蟲了 🐛"); return; }
  writeFriendEvent(visiting.uid, { type: "bug", plotIndex: index });
  visitPendingBug[index] = true;
  renderVisitingFarm();
  toast("你在 " + (visiting.farmName || "好友") + " 的田裡放了蟲 🐛");
}

function npcPutBug(index) {
  const friend = state.friends.find((f) => f.id === visiting.id);
  if (!friend) return;
  const p = friend.plots[index];
  if (!p || !p.crop) { toast("這格沒有作物可放蟲。"); return; }
  if (friendProgress(p) >= 1) { toast("已成熟的作物放蟲沒用。"); return; }
  if (p.hazard) { toast("這格已經有狀況了。"); return; }
  if (p.bugUsed) { toast("這塊田這一輪已經放過蟲了 🐛"); return; }
  p.hazard = "bug";
  p.hazardPlaced = true;
  p.bugUsed = true;
  saveState();
  renderVisitingFarm();
  toast("你在 " + friend.name + " 的田裡放了蟲 🐛");
}

function writeFriendEvent(ownerUid, data) {
  if (!fbDb || !fbUser || !ownerUid) return;
  try {
    fbDb.collection("events").doc(ownerUid).collection("items").add(Object.assign({
      actor: fbUser.uid, actorName: state.farmName || "好友", at: firebase.firestore.FieldValue.serverTimestamp(),
    }, data));
  } catch (e) { console.warn("寫好友事件失敗", e); }
}

async function reconcileFriendEvents() {
  if (!fbDb || !fbUser) return;
  try {
    const snap = await fbDb.collection("events").doc(fbUser.uid).collection("items").limit(200).get();
    if (snap.empty) return;
    let stolen = 0, bugged = 0, helped = 0, sprayed = 0, rstolen = 0, added = 0;
    const batchDeletes = [];
    snap.forEach((doc) => {
      const d = doc.data() || {};
      if (applyFriendEvent(d)) {
        if (d.type === "steal") stolen++;
        else if (d.type === "bug") bugged++;
        else if (d.type === "help" || d.type === "rhelp" || d.type === "depest") helped++;
        else if (d.type === "spray") sprayed++;
        else if (d.type === "rsteal") rstolen++;
        else if (d.type === "friendadd") added++;
      }
      batchDeletes.push(doc.ref);
    });
    for (const ref of batchDeletes) { try { await ref.delete(); } catch (_) {} }
    saveState();
    render();
    const parts = [];
    if (added) parts.push("新好友×" + added);
    if (stolen) parts.push("被偷菜×" + stolen);
    if (rstolen) parts.push("被偷產物×" + rstolen);
    if (bugged) parts.push("被放蟲×" + bugged);
    if (sprayed) parts.push("被噴髒×" + sprayed);
    if (helped) parts.push("好友幫忙×" + helped);
    if (parts.length) toast("好友動態：" + parts.join("、"));
  } catch (e) { console.warn("結算好友事件失敗", e); }
}

function applyFriendEvent(d) {
  if (!d || !d.type) return false;
  if (d.type === "friendadd") {
    if (!d.actor) return false;
    state.cloudFriends = state.cloudFriends || [];
    if (state.cloudFriends.some((f) => f.uid === d.actor)) return false;
    state.cloudFriends.push({ uid: d.actor, name: d.actorName || "農友" });
    return true;
  }
  if (d.type === "steal" || d.type === "bug" || d.type === "help" || d.type === "depest") {
    const p = (state.plots || [])[d.plotIndex];
    if (!p || !p.unlocked) return false;
    if (d.type === "depest") {
      let cleared = false;
      if (p.weed) { p.weed = false; cleared = true; }
      if (p.pest && p.pestBy !== d.actor) { p.pest = false; p.pestBy = null; cleared = true; }  // 不能清自己放的
      if (cleared && p.hazardSince && !p.pest && !p.weed) { p.pausedMs = (p.pausedMs || 0) + (Date.now() - p.hazardSince); p.hazardSince = 0; }
      return cleared;
    }
    if (d.type === "steal") { if (!p.crop) return false; p.stolenPct = Math.min(0.4, (p.stolenPct || 0) + 0.2); return true; }
    if (d.type === "bug") { if (!p.crop) return false; if (p.pest || p.pestUsed) return false; p.pest = true; p.pestBy = d.actor || "system"; p.pestUsed = true; if (!p.hazardSince) p.hazardSince = Date.now(); return true; }
    if (d.type === "help") { if (!p.crop) return false; p.watered = true; return true; }
  } else {
    const a = (state.ranchAnimals || [])[d.animalIndex];
    if (!a) return false;
    const cfg = RANCH_ANIMALS[a.type];
    if (d.type === "rsteal") { a.fedAt = 0; a.dirty = false; a.dirtyBy = null; return true; }
    if (d.type === "spray") { if (a.dirty) return false; a.dirty = true; a.dirtyBy = d.actor || "system"; return true; }
    if (d.type === "rhelp") {
      if (a.dirty) {
        if (a.dirtyBy === d.actor) return false;     // 不能清自己潑的髒水
        a.dirty = false; a.dirtyBy = null; return true;  // 可清系統產生或別人潑的
      }
      if (!a.fedAt) { a.fedAt = Date.now(); return true; }  // 幫忙餵食
      return false;                                    // 生長中/可收 → 不處理
    }
  }
  return false;
}

function cloudSteal(index) {
  const plots = Array.isArray(visiting.farmSnapshot) ? visiting.farmSnapshot : [];
  const pl = plots[index];
  if (!pl || !pl.crop) { toast("這格沒有作物。"); return; }
  const ready = pl.readyAt ? Date.now() >= pl.readyAt : false;
  if (!ready) { toast("還沒成熟，不能偷。"); return; }
  if (visiting.dogGuard && (state.dogChasedCount || 0) >= 5) { confirmRiskySteal(() => cloudStealExec(index)); return; }
  cloudStealExec(index);
}
function cloudStealExec(index) {
  const plots = Array.isArray(visiting.farmSnapshot) ? visiting.farmSnapshot : [];
  const pl = plots[index];
  if (!pl || !pl.crop) return;
  if (visiting.dogGuard && Math.random() < dogCatchChance(visiting.uid)) { onDogChased(visiting.farmName); return; }
  const uid = visiting.uid || "?";
  const now = Date.now();
  state.cloudStealLog = state.cloudStealLog || {};
  let log = (state.cloudStealLog[uid] || []).filter((t) => now - t < FRIEND_STEAL_WINDOW);
  if (log.length >= FRIEND_STEAL_MAX) { toast("這位好友 10 分鐘內只能偷 " + FRIEND_STEAL_MAX + " 次。"); return; }
  const crop = CROPS[pl.crop];
  const amt = 1 + Math.floor(Math.random() * 3);
  state.inventory[pl.crop] = (state.inventory[pl.crop] || 0) + amt;
  if (state.stats) state.stats.stolen = (state.stats.stolen || 0) + amt;
  log.push(now);
  state.cloudStealLog[uid] = log;
  writeFriendEvent(visiting.uid, { type: "steal", plotIndex: index });
  adjustDogAffinity(visiting.uid, -1);
  saveState();
  rerenderVisit();
  toast("偷到 " + (visiting.farmName || "好友") + " 的 " + (crop ? crop.name : pl.crop) + " " + amt + " 個！");
}

function updateVisitBanner() {
  const frame = document.querySelector(".field-frame");
  if (!frame) return;
  let b = frame.querySelector("#visitBanner");
  if (!visiting) { if (b) b.remove(); return; }
  if (!b) { b = document.createElement("div"); b.id = "visitBanner"; frame.appendChild(b); }
  let info;
  if (visiting.kind === "npc") {
    const f = state.friends.find((x) => x.id === visiting.id);
    const cd = f ? friendCooldownMs(f) : 0;
    info = "👀 參觀 <strong>" + (f ? f.name : "好友") + "</strong> 的農場" + (cd > 0 ? ("　·　⛔ 偷菜冷卻 " + fmtCooldown(cd)) : "");
  } else {
    info = "👀 參觀 <strong>" + (visiting.farmName || "好友") + "</strong> 的農場　·　Lv." + (visiting.level || 1) + "　·　🪙 " + (visiting.coins || 0) + "　·　🔄 即時同步中";
  }
  b.innerHTML = '<span class="vb-info">' + info + '</span><button id="exitVisitBtn" type="button">返回我的農場</button>';
  b.querySelector("#exitVisitBtn").addEventListener("click", exitVisit);
}

function renderCloudFriendFarm(p) {
  const box = document.querySelector("#friendFarmBox");
  if (!box) return;
  const title = box.querySelector("#friendFarmTitle");
  if (title) title.textContent = "☁️ " + (p.farmName || "好友") + " 的農場";
  const info = box.querySelector("#friendFarmInfo");
  if (info) info.textContent = "🌾 Lv." + (p.level || 1) + "　·　🪙 " + (p.coins || 0);
  const cd = box.querySelector("#friendFarmCooldown");
  if (cd) cd.hidden = true;
  const grid = box.querySelector("#friendFarmGrid");
  const plots = Array.isArray(p.farmSnapshot) ? p.farmSnapshot : [];
  if (grid) {
    grid.className = "ff-grid";
    if (!plots.length) {
      grid.innerHTML = '<p class="item-empty">這位好友還沒有可顯示的農場（請對方上線玩一下）。</p>';
    } else {
      const now = Date.now();
      grid.innerHTML = plots.map((pl) => {
        if (pl.s === "locked") return '<div class="ff-plot"><span class="ff-state">未開墾</span></div>';
        if (pl.s === "broken") return '<div class="ff-plot"><span class="ff-state">🌪️ 損壞</span></div>';
        if (pl.s === "empty" || !pl.crop) return '<div class="ff-plot"><span class="ff-state">空地</span></div>';
        const crop = CROPS[pl.crop];
        const nm = crop ? crop.name : pl.crop;
        let lab = "🌱 成長中";
        if (pl.readyAt && now >= pl.readyAt) lab = "✅ 已成熟";
        else if (pl.readyAt && pl.plantedAt && pl.readyAt > pl.plantedAt) {
          const pct = Math.max(0, Math.min(99, Math.round((now - pl.plantedAt) / (pl.readyAt - pl.plantedAt) * 100)));
          lab = "🌱 成長中 " + pct + "%";
        }
        return '<div class="ff-plot"><span class="ff-crop" aria-hidden="true">' + cropCardVisual(pl.crop) + '</span><span class="ff-cropname">' + nm + '</span><span class="ff-state">' + lab + '</span></div>';
      }).join("");
    }
  }
  box.hidden = false;
}

function openSaveBox() {
  const box = document.querySelector("#saveBox");
  if (box) {
    box.hidden = false;
  }
}

function closeSaveBox() {
  const box = document.querySelector("#saveBox");
  if (box) {
    box.hidden = true;
  }
}

function exportCode() {
  const code = encodeSave();
  let copied = false;
  try {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(code);
      copied = true;
    }
  } catch {
    copied = false;
  }
  if (copied) {
    toast("已複製備份碼，貼到記事本或傳給自己保存即可。");
  } else {
    window.prompt("複製此備份碼保存：", code);
  }
}

function importCode() {
  const code = window.prompt("貼上備份碼還原進度：");
  if (code === null) {
    return;
  }
  const data = decodeSave(code);
  if (!data) {
    toast("備份碼無效，請確認是否完整貼上。");
    return;
  }
  const defaults = createDefaultState();
  state = {
    ...defaults,
    ...data,
    inventory: { ...defaults.inventory, ...(data.inventory || {}) },
    seeds: { ...defaults.seeds, ...(data.seeds || {}) },
    giftsClaimed: Array.isArray(data.giftsClaimed) ? data.giftsClaimed : [],
    stats: { ...defaults.stats, ...(data.stats || {}) },
    openingSpinDone: !!data.openingSpinDone,
    items: { ...defaults.items, ...(data.items || {}) },
    damaged: (data.damaged && typeof data.damaged === "object") ? { ...data.damaged } : {},
    friends: Array.isArray(data.friends) ? data.friends : [],
    friendCode: typeof data.friendCode === "string" ? data.friendCode : "",
    cloudFriends: Array.isArray(data.cloudFriends) ? data.cloudFriends : [],
    candidates: Array.isArray(data.candidates) ? data.candidates : defaults.candidates.filter((c) => !(data.friends || []).some((f) => f.name === c.name)),
    upgrades: { ...defaults.upgrades, ...(data.upgrades || {}) },
    plots: defaults.plots.map((plot, index) => ({
      ...plot,
      ...((data.plots && data.plots[index]) || {}),
    })),
    orders: Array.isArray(data.orders) ? data.orders : [],
  };
  maybeRefreshOrders();
  saveState();
  closeSaveBox();
  render();
  toast("已用備份碼還原進度。");
}


function updateGmBadge() {
  const badge = document.querySelector("#gmBadge");
  if (badge) {
    badge.hidden = !state.gm;
  }
  document.querySelector(".farm-app")?.classList.toggle("is-gm", !!state.gm);
  if (typeof updateRanchEditor === "function") updateRanchEditor();
}

function makeBgmDraggable() {
  const btn = document.querySelector("#bgmToggle");
  if (!btn || btn.dataset.dragReady) return;
  btn.dataset.dragReady = "1";
  let applied = false;
  try {
    const pos = JSON.parse(localStorage.getItem("bgm-btn-pos") || "null");
    if (pos && typeof pos.left === "number") {
      btn.style.left = pos.left + "px";
      btn.style.top = pos.top + "px";
      btn.style.right = "auto";
      applied = true;
    }
  } catch {}
  if (!applied) {
    const seed = document.querySelector('[data-tool="seed"]');
    if (seed) {
      const r = seed.getBoundingClientRect();
      btn.style.left = Math.max(0, r.left + r.width / 2 - btn.offsetWidth / 2) + "px";
      btn.style.top = Math.max(0, r.top - btn.offsetHeight - 8) + "px";
      btn.style.right = "auto";
    }
  }
  let dragging = false, moved = false, sx = 0, sy = 0, ox = 0, oy = 0;
  btn.addEventListener("pointerdown", (e) => {
    dragging = true; moved = false;
    const r = btn.getBoundingClientRect();
    ox = r.left; oy = r.top; sx = e.clientX; sy = e.clientY;
    try { btn.setPointerCapture(e.pointerId); } catch {}
  });
  btn.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
    const nx = Math.max(0, Math.min(window.innerWidth - btn.offsetWidth, ox + dx));
    const ny = Math.max(0, Math.min(window.innerHeight - btn.offsetHeight, oy + dy));
    btn.style.left = nx + "px"; btn.style.top = ny + "px"; btn.style.right = "auto";
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    try { btn.releasePointerCapture(e.pointerId); } catch {}
    if (moved) {
      btn.dataset.dragged = "1";
      localStorage.setItem("bgm-btn-pos", JSON.stringify({
        left: parseInt(btn.style.left, 10) || 0,
        top: parseInt(btn.style.top, 10) || 0,
      }));
    }
  };
  btn.addEventListener("pointerup", end);
  btn.addEventListener("pointercancel", end);
}

function makeGmBadgeDraggable() {
  const badge = document.querySelector("#gmBadge");
  if (!badge || badge.dataset.dragReady) return;
  badge.dataset.dragReady = "1";
  try {
    const pos = JSON.parse(localStorage.getItem("gm-badge-pos") || "null");
    if (pos && typeof pos.left === "number") {
      badge.style.left = pos.left + "px";
      badge.style.top = pos.top + "px";
      badge.style.right = "auto";
    }
  } catch {}
  let dragging = false;
  let sx = 0;
  let sy = 0;
  let ox = 0;
  let oy = 0;
  badge.addEventListener("pointerdown", (e) => {
    dragging = true;
    const r = badge.getBoundingClientRect();
    ox = r.left;
    oy = r.top;
    sx = e.clientX;
    sy = e.clientY;
    try { badge.setPointerCapture(e.pointerId); } catch {}
    e.preventDefault();
  });
  badge.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    let nx = ox + (e.clientX - sx);
    let ny = oy + (e.clientY - sy);
    nx = Math.max(0, Math.min(window.innerWidth - badge.offsetWidth, nx));
    ny = Math.max(0, Math.min(window.innerHeight - badge.offsetHeight, ny));
    badge.style.left = nx + "px";
    badge.style.top = ny + "px";
    badge.style.right = "auto";
  });
  const end = (e) => {
    if (!dragging) return;
    dragging = false;
    try { badge.releasePointerCapture(e.pointerId); } catch {}
    try {
      localStorage.setItem("gm-badge-pos", JSON.stringify({
        left: parseInt(badge.style.left, 10) || 0,
        top: parseInt(badge.style.top, 10) || 0,
      }));
    } catch {}
  };
  badge.addEventListener("pointerup", end);
  badge.addEventListener("pointercancel", end);
}

function showGmBox(sel) {
  const b = document.querySelector(sel);
  if (b) b.hidden = false;
}
function hideGmBox(sel) {
  const b = document.querySelector(sel);
  if (b) b.hidden = true;
}

function openGM() {
  if (!state.gm) {
    const pw = window.prompt("輸入 GM 密碼：");
    if (pw === null) {
      return;
    }
    if (!GM_PASSWORDS.includes(pw.trim().toLowerCase())) {
      toast("密碼錯誤。");
      return;
    }
    state.gm = true;
    saveState();
    updateGmBadge();
    toast("已進入 GM 模式。");
  }
  updateGmRanchToggle();
  showGmBox("#gmPanel");
}

function gmReset() {
  if (!window.confirm("確定要把遊戲重置成初始狀態嗎？此動作無法復原。")) {
    return;
  }
  const keepGm = state.gm;
  state = createDefaultState();
  state.gm = keepGm;
  maybeRefreshOrders();
  saveState();
  hideGmBox("#gmEdit");
  hideGmBox("#gmPanel");
  render();
  toast("遊戲已重置為初始狀態。");
}

function gmExit() {
  state.gm = false;
  saveState();
  hideGmBox("#gmEdit");
  hideGmBox("#gmPanel");
  updateGmBadge();
  render();
  toast("已關閉 GM 模式。");
}

function gmGet(key) {
  return key === "coins" ? state.coins : key === "level" ? state.level : state.xp;
}

function gmSyncField(key) {
  const num = document.querySelector(`[data-gm-num="${key}"]`);
  const rng = document.querySelector(`[data-gm-range="${key}"]`);
  const v = gmGet(key);
  if (num && document.activeElement !== num) num.value = v;
  if (rng) rng.value = v;
}

function gmInitFields() {
  Object.entries(GM_FIELDS).forEach(([key, f]) => {
    const num = document.querySelector(`[data-gm-num="${key}"]`);
    const rng = document.querySelector(`[data-gm-range="${key}"]`);
    if (rng) { rng.min = f.min; rng.max = f.max; rng.step = f.step; }
    if (num) { num.min = f.min; num.max = f.max; }
    gmSyncField(key);
  });
}

function gmSetVal(key, v) {
  const f = GM_FIELDS[key];
  if (Number.isNaN(v)) return;
  v = Math.max(f.min, Math.min(f.max, Math.round(v)));
  if (key === "coins") state.coins = v;
  else if (key === "level") state.level = Math.max(1, v);
  else state.xp = v;
  gmSyncField(key);
  saveState();
  render();
}

function openGmEdit() {
  gmEditSnap = gmCaptureEdit();
  gmInitFields();
  hideGmBox("#gmPanel");
  showGmBox("#gmEdit");
}

function gmCaptureEdit() {
  return { coins: state.coins, level: state.level, xp: state.xp, weather: state.weather, weatherNextAt: state.weatherNextAt, orders: JSON.parse(JSON.stringify(state.orders || [])) };
}
function gmApplyEdit(s) {
  state.coins = s.coins;
  state.level = s.level;
  state.xp = s.xp;
  state.weather = s.weather;
  state.weatherNextAt = s.weatherNextAt;
  state.orders = JSON.parse(JSON.stringify(s.orders || []));
}
function gmEditConfirm() {
  gmEditSnap = gmCaptureEdit();
  saveState();
  toast("已套用修改。");
}
function gmEditRevert() {
  if (gmEditSnap) gmApplyEdit(gmEditSnap);
  saveState();
  gmInitFields();
  render();
  toast("已回復未修改前的數值。");
}
function gmEditBack() {
  if (gmEditSnap) gmApplyEdit(gmEditSnap);
  saveState();
  gmInitFields();
  render();
  hideGmBox("#gmEdit");
  showGmBox("#gmPanel");
}
function gmEditDismiss() {
  if (gmEditSnap) gmApplyEdit(gmEditSnap);
  saveState();
  gmInitFields();
  render();
  hideGmBox("#gmEdit");
}

function gmCaptureInv() {
  return {
    inventory: JSON.parse(JSON.stringify(state.inventory)),
    ranchProducts: JSON.parse(JSON.stringify(state.ranchProducts || {})),
  };
}
function gmApplyInv(s) {
  if (!s) return;
  state.inventory = JSON.parse(JSON.stringify(s.inventory || {}));
  state.ranchProducts = JSON.parse(JSON.stringify(s.ranchProducts || {}));
}
function gmInvMax() {
  Object.keys(CROPS).forEach((id) => { state.inventory[id] = 999; });
  state.ranchProducts = state.ranchProducts || {};
  Object.keys(RANCH_ANIMALS).forEach((t) => { state.ranchProducts[t] = 999; });
  saveState(); render(); buildGmInvList(); toast("庫存全部調到最大。");
}
function gmSeedMax() {
  state.seeds = state.seeds || {};
  Object.keys(CROPS).forEach((id) => { state.seeds[id] = 999; });
  saveState(); render(); buildGmSeedList(); toast("種子全部調到最大。");
}
function gmItemMax() {
  state.items = state.items || {};
  GM_ITEMS.forEach(([id]) => { state.items[id] = 999; });
  saveState(); render(); buildGmItemList(); toast("道具全部調到最大。");
}
function gmInvConfirm() {
  gmInvSnap = gmCaptureInv();
  saveState();
  toast("已套用庫存。");
}
function gmInvRevert() {
  if (gmInvSnap) gmApplyInv(gmInvSnap);
  saveState();
  render();
  buildGmInvList();
  toast("已回復庫存。");
}
function gmInvBack() {
  gmInvSnap = gmCaptureInv();   // 保留變更（已即時套用），返回不還原
  saveState();
  render();
  hideGmBox("#gmInvBox");
  showGmBox("#gmEdit");
}
function gmInvDismiss() {
  gmInvSnap = gmCaptureInv();   // 點視窗外關閉 = 保留變更
  saveState();
  render();
  hideGmBox("#gmInvBox");
}

function buildGmInvList() {
  const list = document.querySelector("#gmInvList");
  if (!list) return;
  const cropRows = Object.entries(CROPS).map(([id, c]) => `
    <div class="gm-inv-row">
      <span class="gm-inv-name">${c.name}</span>
      <div class="gm-ctrl">
        <button class="gm-step" data-gm-inv-dec="${id}" type="button">−</button>
        <input class="gm-num" data-gm-inv-num="${id}" type="number" min="0" max="999" value="${state.inventory[id] || 0}" />
        <button class="gm-step" data-gm-inv-inc="${id}" type="button">＋</button>
      </div>
      <input class="gm-slider" data-gm-inv-range="${id}" type="range" min="0" max="999" step="1" value="${state.inventory[id] || 0}" />
    </div>
  `).join("");
  const prodRows = Object.entries(RANCH_ANIMALS).map(([type, a]) => {
    const v = (state.ranchProducts && state.ranchProducts[type]) || 0;
    return `
    <div class="gm-inv-row">
      <span class="gm-inv-name">${a.productEmoji} ${a.product}</span>
      <div class="gm-ctrl">
        <button class="gm-step" data-gm-prod-dec="${type}" type="button">−</button>
        <input class="gm-num" data-gm-prod-num="${type}" type="number" min="0" max="999" value="${v}" />
        <button class="gm-step" data-gm-prod-inc="${type}" type="button">＋</button>
      </div>
      <input class="gm-slider" data-gm-prod-range="${type}" type="range" min="0" max="999" step="1" value="${v}" />
    </div>`;
  }).join("");
  list.innerHTML = cropRows + '<div class="gm-inv-divider">牧場產物</div>' + prodRows;
  list.querySelectorAll("[data-gm-inv-dec]").forEach((b) => b.addEventListener("click", () => gmSetInv(b.dataset.gmInvDec, (state.inventory[b.dataset.gmInvDec] || 0) - 1)));
  list.querySelectorAll("[data-gm-inv-inc]").forEach((b) => b.addEventListener("click", () => gmSetInv(b.dataset.gmInvInc, (state.inventory[b.dataset.gmInvInc] || 0) + 1)));
  list.querySelectorAll("[data-gm-inv-num]").forEach((n) => n.addEventListener("input", () => { if (n.value !== "") gmSetInv(n.dataset.gmInvNum, parseInt(n.value, 10)); }));
  list.querySelectorAll("[data-gm-inv-range]").forEach((r) => r.addEventListener("input", () => gmSetInv(r.dataset.gmInvRange, parseInt(r.value, 10))));
  list.querySelectorAll("[data-gm-prod-dec]").forEach((b) => b.addEventListener("click", () => gmSetProd(b.dataset.gmProdDec, ((state.ranchProducts && state.ranchProducts[b.dataset.gmProdDec]) || 0) - 1)));
  list.querySelectorAll("[data-gm-prod-inc]").forEach((b) => b.addEventListener("click", () => gmSetProd(b.dataset.gmProdInc, ((state.ranchProducts && state.ranchProducts[b.dataset.gmProdInc]) || 0) + 1)));
  list.querySelectorAll("[data-gm-prod-num]").forEach((n) => n.addEventListener("input", () => { if (n.value !== "") gmSetProd(n.dataset.gmProdNum, parseInt(n.value, 10)); }));
  list.querySelectorAll("[data-gm-prod-range]").forEach((r) => r.addEventListener("input", () => gmSetProd(r.dataset.gmProdRange, parseInt(r.value, 10))));
}

function gmSetProd(type, v) {
  v = Math.max(0, Math.min(999, Math.round(v) || 0));
  if (!state.ranchProducts) state.ranchProducts = {};
  state.ranchProducts[type] = v;
  const num = document.querySelector(`[data-gm-prod-num="${type}"]`);
  const rng = document.querySelector(`[data-gm-prod-range="${type}"]`);
  if (num && document.activeElement !== num) num.value = v;
  if (rng) rng.value = v;
  saveState();
  render();
}

function gmSetInv(id, v) {
  v = Math.max(0, Math.min(999, Math.round(v) || 0));
  state.inventory[id] = v;
  const num = document.querySelector(`[data-gm-inv-num="${id}"]`);
  const rng = document.querySelector(`[data-gm-inv-range="${id}"]`);
  if (num && document.activeElement !== num) num.value = v;
  if (rng) rng.value = v;
  saveState();
  render();
}

function gmCaptureItems() {
  return JSON.parse(JSON.stringify(state.items || {}));
}
function gmApplyItems(s) {
  if (!s) return;
  state.items = { ...(state.items || {}), ...JSON.parse(JSON.stringify(s)) };
}
function gmItemConfirm() {
  gmItemSnap = gmCaptureItems();
  saveState();
  toast("已套用道具。");
}
function gmItemRevert() {
  if (gmItemSnap) gmApplyItems(gmItemSnap);
  saveState();
  render();
  buildGmItemList();
  toast("已回復道具。");
}
function gmItemBack() {
  gmItemSnap = gmCaptureItems();   // 保留變更，返回不還原
  saveState();
  render();
  hideGmBox("#gmItemBox");
  showGmBox("#gmEdit");
}
function gmItemDismiss() {
  gmItemSnap = gmCaptureItems();   // 點視窗外關閉 = 保留變更
  saveState();
  render();
  hideGmBox("#gmItemBox");
}

function gmCaptureSeeds() { return JSON.parse(JSON.stringify(state.seeds || {})); }
function gmApplySeeds(s) { if (!s) return; state.seeds = { ...(state.seeds || {}), ...JSON.parse(JSON.stringify(s)) }; }
function buildGmSeedList() {
  const list = document.querySelector("#gmSeedList");
  if (!list) return;
  list.innerHTML = Object.entries(CROPS).map(([id, c]) => {
    const v = (state.seeds && state.seeds[id]) || 0;
    return `
    <div class="gm-inv-row">
      <span class="gm-inv-name">${c.name}</span>
      <div class="gm-ctrl">
        <button class="gm-step" data-gm-seed-dec="${id}" type="button">−</button>
        <input class="gm-num" data-gm-seed-num="${id}" type="number" min="0" max="999" value="${v}" />
        <button class="gm-step" data-gm-seed-inc="${id}" type="button">＋</button>
      </div>
      <input class="gm-slider" data-gm-seed-range="${id}" type="range" min="0" max="999" step="1" value="${v}" />
    </div>`;
  }).join("");
  list.querySelectorAll("[data-gm-seed-dec]").forEach((b) => b.addEventListener("click", () => gmSetSeed(b.dataset.gmSeedDec, ((state.seeds && state.seeds[b.dataset.gmSeedDec]) || 0) - 1)));
  list.querySelectorAll("[data-gm-seed-inc]").forEach((b) => b.addEventListener("click", () => gmSetSeed(b.dataset.gmSeedInc, ((state.seeds && state.seeds[b.dataset.gmSeedInc]) || 0) + 1)));
  list.querySelectorAll("[data-gm-seed-num]").forEach((n) => n.addEventListener("input", () => { if (n.value !== "") gmSetSeed(n.dataset.gmSeedNum, parseInt(n.value, 10)); }));
  list.querySelectorAll("[data-gm-seed-range]").forEach((r) => r.addEventListener("input", () => gmSetSeed(r.dataset.gmSeedRange, parseInt(r.value, 10))));
}
function gmSetSeed(id, v) {
  v = Math.max(0, Math.min(999, Math.round(v) || 0));
  if (!state.seeds) state.seeds = {};
  state.seeds[id] = v;
  const num = document.querySelector(`[data-gm-seed-num="${id}"]`);
  const rng = document.querySelector(`[data-gm-seed-range="${id}"]`);
  if (num && document.activeElement !== num) num.value = v;
  if (rng) rng.value = v;
  saveState();
  render();
}
function gmSeedConfirm() { gmSeedSnap = gmCaptureSeeds(); saveState(); toast("已套用種子。"); }
function gmSeedRevert() { if (gmSeedSnap) gmApplySeeds(gmSeedSnap); saveState(); render(); buildGmSeedList(); toast("已回復種子。"); }
function gmSeedBack() { gmSeedSnap = gmCaptureSeeds(); saveState(); render(); hideGmBox("#gmSeedBox"); showGmBox("#gmEdit"); }
function gmSeedDismiss() { gmSeedSnap = gmCaptureSeeds(); saveState(); render(); hideGmBox("#gmSeedBox"); }
function buildGmItemList() {
  const list = document.querySelector("#gmItemList");
  if (!list) return;
  list.innerHTML = GM_ITEMS.map(([id, name]) => {
    const v = (state.items && state.items[id]) || 0;
    return `
    <div class="gm-inv-row">
      <span class="gm-inv-name">${name}</span>
      <div class="gm-ctrl">
        <button class="gm-step" data-gm-item-dec="${id}" type="button">−</button>
        <input class="gm-num" data-gm-item-num="${id}" type="number" min="0" max="999" value="${v}" />
        <button class="gm-step" data-gm-item-inc="${id}" type="button">＋</button>
      </div>
      <input class="gm-slider" data-gm-item-range="${id}" type="range" min="0" max="999" step="1" value="${v}" />
    </div>`;
  }).join("");
  list.querySelectorAll("[data-gm-item-dec]").forEach((b) => b.addEventListener("click", () => gmSetItem(b.dataset.gmItemDec, ((state.items && state.items[b.dataset.gmItemDec]) || 0) - 1)));
  list.querySelectorAll("[data-gm-item-inc]").forEach((b) => b.addEventListener("click", () => gmSetItem(b.dataset.gmItemInc, ((state.items && state.items[b.dataset.gmItemInc]) || 0) + 1)));
  list.querySelectorAll("[data-gm-item-num]").forEach((n) => n.addEventListener("input", () => { if (n.value !== "") gmSetItem(n.dataset.gmItemNum, parseInt(n.value, 10)); }));
  list.querySelectorAll("[data-gm-item-range]").forEach((r) => r.addEventListener("input", () => gmSetItem(r.dataset.gmItemRange, parseInt(r.value, 10))));
}
function gmSetItem(id, v) {
  v = Math.max(0, Math.min(999, Math.round(v) || 0));
  if (!state.items) state.items = {};
  state.items[id] = v;
  const num = document.querySelector(`[data-gm-item-num="${id}"]`);
  const rng = document.querySelector(`[data-gm-item-range="${id}"]`);
  if (num && document.activeElement !== num) num.value = v;
  if (rng) rng.value = v;
  saveState();
  render();
}

/* ===== 股市（種子式、全玩家一致；Phase 1：行情檢視） ===== */
const STOCKS = [
  { code: "HAPPY", name: "開心農場控股", base: 10, vol: 0.011 },
  { code: "COW",   name: "金牧畜產",     base: 10, vol: 0.015 },
  { code: "SEED",  name: "豐收種苗",     base: 10, vol: 0.019 },
  { code: "CLOUD", name: "雲端科技",     base: 10, vol: 0.023 },
  { code: "SUN",   name: "暖陽能源",     base: 10, vol: 0.016 },
  { code: "STORM", name: "雷雨重工",     base: 10, vol: 0.029 },
  { code: "HONEY", name: "蜜豐食品",     base: 10, vol: 0.012 },
];
const STOCK_EPOCH = Date.UTC(2026, 5, 1) / 86400000;  // 走勢起點(天)
function stkHash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function stkRng(seed) { let a = seed >>> 0; return function () { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function dayNumber(d) { return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000); }
const _closeCache = {};
function stockClose(stock, dayNum) {
  const key = stock.code + ":" + dayNum;
  if (_closeCache[key] != null) return _closeCache[key];
  let price = stock.base;
  for (let d = STOCK_EPOCH + 1; d <= dayNum; d++) {
    const rr = stkRng(stkHash(stock.code + "|" + d));
    let ret = (rr() * 2 - 1) * (stock.vol * 2.0);   // 每日總漲跌幅
    if (rr() > 0.88) {                              // ~12% 大波動日：朝同方向暴衝
      const dir = ret >= 0 ? 1 : -1;
      ret = dir * (0.06 + rr() * 0.045);
    }
    ret = Math.max(-0.10, Math.min(0.10, ret));     // 台股 ±10% 漲跌停
    price = Math.max(1, price * (1 + ret));
  }
  _closeCache[key] = price;
  return price;
}
function stockOpenPrice(stock, dayNum) {
  const prev = stockClose(stock, dayNum - 1);
  const prev2 = stockClose(stock, dayNum - 2);
  const yReturn = prev2 > 0 ? (prev / prev2 - 1) : 0;        // 前一天總漲跌幅
  const jitter = (stkRng(stkHash(stock.code + "open" + dayNum))() * 2 - 1) * 0.01;
  let gap = yReturn * 0.8 + jitter;                          // 偏向昨日方向
  gap = Math.max(-0.04, Math.min(0.04, gap));                // 限 ±4%
  return prev * (1 + gap);
}
const SESSION_MIN = 892;  // 早9:00-13:25 / 午13:30-18:55 / 夜19:00-24:00（盤間留5分鐘）
function stockPath(stock, dayNum) {
  const key = "p" + stock.code + ":" + dayNum;
  if (_closeCache[key]) return _closeCache[key];
  const open = stockOpenPrice(stock, dayNum);
  const close = stockClose(stock, dayNum);
  const prevC = stockClose(stock, dayNum - 1);
  const limHi = prevC * 1.1, limLo = prevC * 0.9;
  const N = SESSION_MIN;
  const rng = stkRng(stkHash(stock.code + "path" + dayNum));
  const noise = [0]; let acc = 0;
  for (let i = 1; i <= N; i++) { acc += (rng() * 2 - 1) * stock.vol; noise.push(acc); }
  const end = noise[N];
  const path = [];
  for (let i = 0; i <= N; i++) {
    const lin = open + (close - open) * (i / N);
    const bridged = noise[i] - end * (i / N);  // 兩端歸零的布朗橋
    path.push(Math.max(limLo, Math.min(limHi, lin + open * bridged)));
  }
  _closeCache[key] = path;
  return path;
}
function sessionIndexNow() {
  const d = new Date();
  const mod = d.getHours() * 60 + d.getMinutes();
  if (mod < 540) return { state: "pre", idx: 0 };                        // 9:00前 休市
  if (mod <= 805) return { state: "open", idx: mod - 540 };              // 早盤 9:00-13:25
  if (mod < 810) return { state: "closed", idx: 265 };                   // 13:25-13:30 預留禁交易
  if (mod <= 1135) return { state: "open", idx: 266 + (mod - 810) };     // 午盤 13:30-18:55
  if (mod < 1140) return { state: "closed", idx: 591 };                  // 18:55-19:00 預留禁交易
  if (mod <= 1440) return { state: "open", idx: 592 + (mod - 1140) };    // 夜盤 19:00-24:00
  return { state: "open", idx: SESSION_MIN };
}
function stockInfo(stock) {
  const d = new Date();
  const dayNum = dayNumber(d);
  const s = sessionIndexNow();
  const prevClose = stockClose(stock, dayNum - 1);
  let price, path, shown;
  if (s.state === "pre") { price = prevClose; path = []; shown = 0; }
  else { path = stockPath(stock, dayNum); shown = s.idx; price = path[Math.min(shown, SESSION_MIN)]; }
  const chg = price - prevClose;
  const chgPct = prevClose > 0 ? (chg / prevClose * 100) : 0;
  let limit = "";
  if (chgPct >= 9.9) limit = "up";
  else if (chgPct <= -9.9) limit = "down";
  return { price, prevClose, chg, chgPct, path, shown, state: s.state, limit };
}
function stockStatusText(state) {
  if (state === "pre") return "休市・早上 9:00 開盤";
  if (state === "lunch") return "休息・晚上 7:00 續盤";
  if (state === "closed") return "暫停交易・盤間休息（預留5分鐘）";
  return "盤中交易";
}

function enterStock() {
  if (visiting) exitVisit();
  stockReturnScene = state.scene;          // 記住從農場/牧場進來
  if (state.scene === "ranch") { state.scene = ""; saveState(); }
  stockOpen = true;
  document.body.classList.add("is-stock");
  renderStock();
  if (stockTimer) clearInterval(stockTimer);
  stockTimer = setInterval(function () { renderStock(); refreshStockBuyPrices(); }, 15000);
}
function exitStock() {
  stockOpen = false;
  document.body.classList.remove("is-stock");
  closeStockBuy();
  if (stockTimer) { clearInterval(stockTimer); stockTimer = null; }
  ["#stockView", "#stockBuyPanel", "#stockBuyBackdrop"].forEach((sel) => {
    const el = document.querySelector(sel); if (el) el.remove();
  });
  if (stockReturnScene === "ranch" && state.scene !== "ranch") { state.scene = "ranch"; saveState(); }
  render();
}

function stockHold(code) {
  state.stocks = state.stocks || {};
  if (!state.stocks[code]) state.stocks[code] = { sh: 0, cost: 0 };
  return state.stocks[code];
}
function stockQtyOf(code) { const n = Math.floor(stockQty[code]); return n >= 1 ? n : 1; }
function stockPnl(code, price) {
  const h = stockHold(code);
  if (h.sh <= 0) return null;
  const value = Math.round(price * h.sh), diff = value - Math.round(h.cost);
  const pct = h.cost > 0 ? (diff / h.cost * 100) : 0;
  return { value: value, diff: diff, pct: pct, up: diff >= 0 };
}
function pnlText(p) { return (p.up ? "+" : "") + p.diff.toLocaleString() + " (" + (p.up ? "+" : "") + p.pct.toFixed(1) + "%)"; }

function openStockBuy(mode) {
  if (mode) stockPanelMode = mode;
  const frame = document.querySelector(".field-frame");
  if (!frame) return;
  let bd = frame.querySelector("#stockBuyBackdrop");
  if (!bd) {
    bd = document.createElement("div"); bd.id = "stockBuyBackdrop";
    bd.addEventListener("click", closeStockBuy); frame.appendChild(bd);
  }
  let panel = frame.querySelector("#stockBuyPanel");
  if (!panel) { panel = document.createElement("div"); panel.id = "stockBuyPanel"; frame.appendChild(panel); }
  bd.classList.add("is-open");
  panel.classList.add("is-open");
  renderStockBuy();
}
function closeStockBuy() {
  const p = document.querySelector("#stockBuyPanel");
  const b = document.querySelector("#stockBuyBackdrop");
  if (p) p.classList.remove("is-open");
  if (b) b.classList.remove("is-open");
}
function toggleStockBuy(mode) {
  const p = document.querySelector("#stockBuyPanel");
  if (p && p.classList.contains("is-open") && stockPanelMode === mode) { closeStockBuy(); return; }
  openStockBuy(mode);
}

function renderStockBuy() {
  const panel = document.querySelector("#stockBuyPanel");
  if (!panel || !panel.classList.contains("is-open")) return;
  const isSell = stockPanelMode === "sell";
  const rows = STOCKS.map(function (s, i) {
    const info = stockInfo(s);
    const price = info.price;
    const hold = stockHold(s.code);
    const lots = Math.floor(hold.sh / 1000), odd = hold.sh % 1000;
    const n = stockQtyOf(s.code);
    const costLot = Math.round(price * n * 1000), costOdd = Math.round(price * n);
    const cls = info.chg > 0 ? "up" : info.chg < 0 ? "down" : "";
    const nowTag = i === stockSel ? '<span class="sbr-now">當前瀏覽</span>' : '';
    return '<article class="sbr' + (i === stockSel ? ' is-now' : '') + '" data-row="' + i + '">' +
      '<div class="sbr-head"><strong>' + s.name + '</strong>' + nowTag +
        '<span class="sbr-price ' + cls + '">$' + price.toFixed(2) + '</span></div>' +
      '<div class="sbr-have"><span>持有 ' + lots + ' 張 ' + odd + ' 股</span>' +
        '<span class="sbr-value" data-val="' + s.code + '">市值 $' + Math.round(price * hold.sh).toLocaleString() +
          (function(){ const p = stockPnl(s.code, price); return p ? ' <span class="sbr-pnl ' + (p.up ? 'up' : 'down') + '">' + pnlText(p) + '</span>' : ''; })() +
        '</span></div>' +
      '<div class="sbr-ctrl">' +
        '<span class="sell-stepper">' +
          '<button class="qty-btn" type="button" data-sq-dec="' + s.code + '" aria-label="減">−</button>' +
          '<input class="qty-num" type="number" inputmode="numeric" min="1" data-sq="' + s.code + '" value="' + n + '" />' +
          '<button class="qty-btn" type="button" data-sq-inc="' + s.code + '" aria-label="加">＋</button>' +
        '</span>' +
        '<button class="sbr-clear" type="button" data-sqclr="' + s.code + '">清空</button>' +
        (isSell
          ? '<button class="sbr-buy sell-lot" type="button" data-selllot="' + s.code + '">賣出整張</button>' +
            '<button class="sbr-buy sell-odd" type="button" data-sellodd="' + s.code + '">賣出零股</button>'
          : '<button class="sbr-buy lot" type="button" data-buylot="' + s.code + '">購買整張</button>' +
            '<button class="sbr-buy odd" type="button" data-buyodd="' + s.code + '">購買零股</button>') +
      '</div>' +
      '<div class="sbr-cost" data-cost="' + s.code + '">' + (isSell ? '可得 ' : '') +
        '整張 ' + n + ' 張＝$' + costLot.toLocaleString() + '　·　零股 ' + n + ' 股＝$' + costOdd.toLocaleString() + '</div>' +
    '</article>';
  }).join("");
  panel.innerHTML =
    '<div class="sbp-head"><h2>' + (isSell ? '賣股票' : '買股票') + '</h2>' +
      '<span class="sbp-coin">金幣 ' + state.coins.toLocaleString() + '</span>' +
      '<button class="sbp-close" type="button" id="sbpClose" aria-label="關閉">✕</button></div>' +
    '<div class="sbp-list">' + rows + '</div>';
  panel.querySelector("#sbpClose").addEventListener("click", closeStockBuy);
  const nowRow = panel.querySelector('.sbr.is-now');
  const list = panel.querySelector('.sbp-list');
  if (nowRow && list) {
    const rowTop = nowRow.offsetTop - list.offsetTop;               // 列在清單內容中的位置
    const target = rowTop - (list.clientHeight - nowRow.clientHeight) / 2;  // 置中
    list.scrollTop = Math.max(0, target);
  }
  function setQty(code, v) { stockQty[code] = Math.max(1, Math.floor(v) || 1); updateCostRow(code); }
  function updateCostRow(code) {
    const stk = STOCKS.find((x) => x.code === code);
    const price = stockInfo(stk).price, n = stockQtyOf(code);
    const el = panel.querySelector('[data-cost="' + code + '"]');
    const inp = panel.querySelector('[data-sq="' + code + '"]');
    if (inp) inp.value = n;
    if (el) el.textContent = (stockPanelMode === "sell" ? "可得 " : "") + "整張 " + n + " 張＝$" + Math.round(price * n * 1000).toLocaleString() +
      "　·　零股 " + n + " 股＝$" + Math.round(price * n).toLocaleString();
  }
  panel.querySelectorAll("[data-sq-dec]").forEach((b) => b.addEventListener("click", () => setQty(b.dataset.sqDec, stockQtyOf(b.dataset.sqDec) - 1)));
  panel.querySelectorAll("[data-sq-inc]").forEach((b) => b.addEventListener("click", () => setQty(b.dataset.sqInc, stockQtyOf(b.dataset.sqInc) + 1)));
  panel.querySelectorAll("[data-sq]").forEach((inp) => inp.addEventListener("input", () => setQty(inp.dataset.sq, Number(inp.value))));
  panel.querySelectorAll("[data-sqclr]").forEach((b) => b.addEventListener("click", () => setQty(b.dataset.sqclr, 1)));
  panel.querySelectorAll("[data-buylot]").forEach((b) => b.addEventListener("click", () => buyStock(b.dataset.buylot, stockQtyOf(b.dataset.buylot) * 1000)));
  panel.querySelectorAll("[data-buyodd]").forEach((b) => b.addEventListener("click", () => buyStock(b.dataset.buyodd, stockQtyOf(b.dataset.buyodd))));
  panel.querySelectorAll("[data-selllot]").forEach((b) => b.addEventListener("click", () => sellStock(b.dataset.selllot, stockQtyOf(b.dataset.selllot) * 1000)));
  panel.querySelectorAll("[data-sellodd]").forEach((b) => b.addEventListener("click", () => sellStock(b.dataset.sellodd, stockQtyOf(b.dataset.sellodd))));
}

function refreshStockBuyPrices() {
  const panel = document.querySelector("#stockBuyPanel");
  if (!panel || !panel.classList.contains("is-open")) return;
  STOCKS.forEach(function (s, i) {
    const info = stockInfo(s), price = info.price, n = stockQtyOf(s.code);
    const pe = panel.querySelector('.sbr[data-row="' + i + '"] .sbr-price');
    if (pe) { pe.textContent = "$" + price.toFixed(2); pe.className = "sbr-price " + (info.chg > 0 ? "up" : info.chg < 0 ? "down" : ""); }
    const ce = panel.querySelector('[data-cost="' + s.code + '"]');
    if (ce) ce.textContent = (stockPanelMode === "sell" ? "可得 " : "") + "整張 " + n + " 張＝$" + Math.round(price * n * 1000).toLocaleString() +
      "　·　零股 " + n + " 股＝$" + Math.round(price * n).toLocaleString();
    const ve = panel.querySelector('[data-val="' + s.code + '"]');
    if (ve) {
      const p = stockPnl(s.code, price);
      ve.innerHTML = "市值 $" + Math.round(price * stockHold(s.code).sh).toLocaleString() +
        (p ? ' <span class="sbr-pnl ' + (p.up ? "up" : "down") + '">' + pnlText(p) + "</span>" : "");
    }
  });
}

function buyStock(code, shares) {
  const stk = STOCKS.find((x) => x.code === code);
  if (!stk || shares < 1) return;
  const si = stockInfo(stk);
  if (si.state !== "open") { toast("目前暫停交易（盤間休息／休市）。"); return; }
  const price = si.price;
  const cost = Math.round(price * shares);
  if (state.coins < cost) { toast("金幣不夠，需要 $" + cost.toLocaleString() + "。"); return; }
  state.coins -= cost;
  const hold = stockHold(code);
  hold.sh += shares; hold.cost += cost;
  saveState();
  renderHeader();
  renderStockBuy();
  const unit = shares >= 1000 && shares % 1000 === 0 ? (shares / 1000 + " 張") : (shares + " 股");
  toast("買進 " + stk.name + " " + unit + "（$" + cost.toLocaleString() + "）");
}

function sellStock(code, shares) {
  const stk = STOCKS.find((x) => x.code === code);
  if (!stk || shares < 1) return;
  if (stockInfo(stk).state !== "open") { toast("目前暫停交易（盤間休息／休市）。"); return; }
  const hold = stockHold(code);
  if (hold.sh < shares) { toast("持股不足，目前 " + hold.sh + " 股。"); return; }
  const price = stockInfo(stk).price;
  const proceeds = Math.round(price * shares);
  const costRemoved = hold.sh > 0 ? Math.round(hold.cost * shares / hold.sh) : 0;
  const gain = proceeds - costRemoved;
  state.coins += proceeds;
  hold.sh -= shares; hold.cost -= costRemoved;
  if (hold.sh <= 0) { hold.sh = 0; hold.cost = 0; }
  saveState();
  renderHeader();
  renderStockBuy();
  const unit = shares >= 1000 && shares % 1000 === 0 ? (shares / 1000 + " 張") : (shares + " 股");
  const tail = gain >= 0 ? "賺 $" + gain.toLocaleString() : "賠 $" + Math.abs(gain).toLocaleString();
  toast("賣出 " + stk.name + " " + unit + "（$" + proceeds.toLocaleString() + "，" + tail + "）");
}

function renderStock() {
  const frame = document.querySelector(".field-frame");
  if (!frame) return;
  let view = frame.querySelector("#stockView");
  if (!view) { view = document.createElement("div"); view.id = "stockView"; frame.appendChild(view); }
  const stock = STOCKS[stockSel] || STOCKS[0];
  const info = stockInfo(stock);
  const up = info.chg >= 0;
  const sign = up ? "+" : "";
  const tabs = STOCKS.map((s, i) => `<button type="button" class="stk-tab${i === stockSel ? " is-active" : ""}" data-stk="${i}">${s.name}</button>`).join("");
  view.innerHTML =
    '<div class="stk-tabs">' + tabs + '</div>' +
    '<div class="stk-head">' +
      '<div class="stk-name">' + stock.name + ' <small>' + stock.code + '</small></div>' +
      '<div class="stk-price ' + (up ? "up" : "down") + '">' + info.price.toFixed(2) +
        ' <span class="stk-chg">' + sign + info.chg.toFixed(2) + ' (' + sign + info.chgPct.toFixed(2) + '%)</span></div>' +
      (info.limit === "up" ? '<div class="stk-limit up">🔴 漲停</div>' : info.limit === "down" ? '<div class="stk-limit down">🟢 跌停</div>' : '') +
      '<div class="stk-status">' + stockStatusText(info.state) + '　昨收 ' + info.prevClose.toFixed(2) + '</div>' +
    '</div>' +
    '<div class="stk-body"><canvas id="stkChart" class="stk-chart"></canvas>' +
    '<div class="stk-actions" id="stkActions">' +
      ['all','am','noon','pm'].map(function(r){var L={all:'全日',am:'早盤',noon:'午盤',pm:'夜盤'};return '<button type="button" class="stk-range'+(stockRange===r?' is-active':'')+'" data-stk-range="'+r+'">'+L[r]+'</button>';}).join('') +
    '</div></div>';
  view.querySelectorAll("[data-stk]").forEach((b) => b.addEventListener("click", () => { stockSel = Number(b.dataset.stk); renderStock(); }));
  view.querySelectorAll("[data-stk-range]").forEach((b) => b.addEventListener("click", () => { stockRange = b.dataset.stkRange; renderStock(); }));
  drawStockChart(stock, info);
}

function pointClock(i) {
  if (i <= 265) return 540 + i;          // 早盤 9:00-13:25
  if (i <= 591) return 810 + (i - 266);  // 午盤 13:30-18:55
  return 1140 + (i - 592);               // 夜盤 19:00-24:00
}
function fmtClock(m) { return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(Math.round(m) % 60).padStart(2, "0"); }
function drawStockChart(stock, info) {
  const cv = document.querySelector("#stkChart");
  if (!cv) return;
  const w = cv.clientWidth || 600, h = cv.clientHeight || 260;
  const dpr = window.devicePixelRatio || 1;
  cv.width = w * dpr; cv.height = h * dpr;
  const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  let tStart, tEnd, tick;
  if (stockRange === "am") { tStart = 540; tEnd = 810; tick = 30; }
  else if (stockRange === "noon") { tStart = 810; tEnd = 1140; tick = 30; }
  else if (stockRange === "pm") { tStart = 1140; tEnd = 1440; tick = 30; }
  else { tStart = 540; tEnd = 1440; tick = 60; }
  // 收集此時段、已發生的價格點
  const pts = [];
  if (info.path.length) {
    for (let i = 0; i <= Math.min(info.shown, SESSION_MIN); i++) {
      const c = pointClock(i);
      if (c >= tStart && c <= tEnd) pts.push({ c: c, v: info.path[i] });
    }
  }
  const padL = 48, padR = 10, padT = 10, padB = 22;
  const x0 = padL, x1 = w - padR, y0 = padT, y1 = h - padB;
  const x = (c) => x0 + (x1 - x0) * ((c - tStart) / (tEnd - tStart));
  // Y 軸固定：跌停(-10%)~漲停(+10%)，平盤(昨收)置中
  const lo = info.prevClose * 0.90, hi = info.prevClose * 1.10;
  const y = (v) => y0 + (y1 - y0) * (1 - (v - lo) / Math.max(0.0001, hi - lo));
  ctx.font = "10px sans-serif";
  // Y 格線 + 左側價格
  for (let k = 0; k <= 4; k++) {
    const v = lo + (hi - lo) * k / 4, py = y(v);
    const isLim = (k === 0 || k === 4), isMid = (k === 2);
    ctx.strokeStyle = isLim ? "#f0d2cf" : "#eef1f3"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, py); ctx.lineTo(x1, py); ctx.stroke();
    ctx.fillStyle = k === 4 ? "#e0352b" : k === 0 ? "#1aa260" : "#7a7f85";
    ctx.textAlign = "right"; ctx.textBaseline = "middle"; ctx.fillText(v.toFixed(2), x0 - 4, py);
  }
  // X 時間格線 + 標籤
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  for (let t = tStart; t <= tEnd; t += tick) {
    const px = x(t);
    ctx.strokeStyle = "#f2f4f6"; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(px, y0); ctx.lineTo(px, y1); ctx.stroke();
    ctx.fillStyle = "#7a7f85"; ctx.fillText(tick >= 60 ? String(Math.floor(t / 60)) : fmtClock(t), px, h - 6);
  }
  // 昨收虛線
  ctx.strokeStyle = "#b0b6bb"; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(x0, y(info.prevClose)); ctx.lineTo(x1, y(info.prevClose)); ctx.stroke(); ctx.setLineDash([]);
  // L 軸線
  ctx.strokeStyle = "#5f6368"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0, y1); ctx.lineTo(x1, y1); ctx.stroke();
  if (!pts.length) {
    ctx.fillStyle = "#9aa0a6"; ctx.font = "13px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("此時段尚無資料", (x0 + x1) / 2, (y0 + y1) / 2);
    return;
  }
  // 價格線（紅漲綠跌；中午休市處斷開）
  const up = info.chg >= 0;
  ctx.strokeStyle = up ? "#e0352b" : "#1aa260"; ctx.lineWidth = 2; ctx.lineJoin = "round"; ctx.beginPath();
  let prevC = null;
  pts.forEach((p) => {
    const px = x(p.c), py = y(p.v);
    if (prevC === null || p.c - prevC > 40) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    prevC = p.c;
  });
  ctx.stroke();
  // 現價點 + 浮動標籤
  const last = pts[pts.length - 1];
  const lastX = x(last.c), lastY = y(last.v);
  ctx.fillStyle = up ? "#e0352b" : "#1aa260"; ctx.beginPath(); ctx.arc(lastX, lastY, 3.5, 0, 7); ctx.fill();
  const tag = last.v.toFixed(2);
  ctx.font = "11px sans-serif"; const tw = ctx.measureText(tag).width + 10;
  const tagX = Math.min(lastX + 6, x1 - tw);
  ctx.fillStyle = up ? "#e0352b" : "#1aa260"; ctx.fillRect(tagX, lastY - 9, tw, 18);
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(tag, tagX + tw / 2, lastY);
}

function bindBgm() {
  const btn = document.querySelector("#bgmToggle");
  if (!btn) return;
  ALL_AUDIO_IDS.forEach((id) => {
    const el = document.querySelector("#" + id);
    if (el) el.volume = id === "aud-thunder" ? 0.6 : 0.5;
  });
  audioOn = localStorage.getItem("bgm-on") !== "0";
  audioReady = true;
  btn.addEventListener("click", () => {
    if (btn.dataset.dragged) { btn.dataset.dragged = ""; return; }
    audioOn = !audioOn;
    localStorage.setItem("bgm-on", audioOn ? "1" : "0");
    applyAudio();
  });
  applyAudio();
  window.addEventListener("pointerdown", applyAudio, { once: true });
}

function playSafe(el) { if (el && typeof el.play === "function") el.play().catch(() => {}); }
function pauseSafe(el) { if (el && typeof el.pause === "function") el.pause(); }

function applyAudio() {
  if (!audioReady) return;
  const btn = document.querySelector("#bgmToggle");
  if (btn) btn.textContent = audioOn ? "🎵 音樂" : "🔇 音樂";
  const wanted = audioOn ? (WEATHER_AUDIO[state.weather] || []) : [];
  ALL_AUDIO_IDS.forEach((id) => {
    const el = document.querySelector("#" + id);
    if (!el) return;
    if (wanted.includes(id)) playSafe(el); else pauseSafe(el);
  });
}

function bindStaticEvents() {
  const bindToolToggle = (button, doToggle) => {
    // 跟好友鈕一樣用最單純的 click（你手機上單純 click 才正常）
    button.addEventListener("click", () => { doToggle(); });
  };
  document.querySelectorAll("[data-tool]").forEach((button) => {
    bindToolToggle(button, () => {
      state.selectedTool = (state.selectedTool === button.dataset.tool) ? "" : button.dataset.tool;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-tab]").forEach((button) => {
    bindToolToggle(button, () => {
      const nextTab = button.dataset.tab;
      const workPanel = document.querySelector(".work-panel");
      const isSameOpen = workPanel?.classList.contains("is-open") && state.activeTab === nextTab;
      state.activeTab = nextTab;
      if (workPanel) workPanel.setAttribute("data-tab", nextTab);  // 先設好寬度再定位，避免首次開啟跑版
      if (isSameOpen) {
        openPanel("");
      } else if (nextTab === "shop" || nextTab === "upgrades") {
        // 行囊／開發：寬面板靠右(用 CSS)，不依按鈕定位，清掉前一個面板留下的 inline 位置
        if (workPanel) { workPanel.style.left = ""; workPanel.style.right = ""; workPanel.style.top = ""; }
        openPanel("work");
      } else {
        openPanel("work", getPanelAnchor(button));
      }
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.action === "gm") {
        openGM();
      }
      if (button.dataset.action === "rest") {
        restOneDay();
      }
      if (button.dataset.action === "sell-all") {
        sellAllInventory();
      }
      if (button.dataset.action === "gift") {
        openGift();
      }
      if (button.dataset.action === "item") {
        openItems();
      }
      if (button.dataset.action === "friends") {
        openFriends();
      }
      if (button.dataset.action === "ranch-enter") {
        enterRanch();
      }
      if (button.dataset.action === "ranch-exit") {
        exitRanch();
      }
      if (button.dataset.action === "ranch-shop") {
        openAnimalShop();
      }
      if (button.dataset.action === "ranch-sell") {
        openSellAnimal();
      }
      if (button.dataset.action === "one-farm") {
        oneClickFarm();
      }
      if (button.dataset.action === "one-ranch") {
        oneClickRanch();
      }
      if (button.dataset.action === "mail") {
        openMail();
      }
    });
  });

  [["ranch-feed", "feed"], ["ranch-wash", "wash"], ["ranch-harvest", "harvest"]].forEach(([act, t]) => {
    document.querySelectorAll('[data-action="' + act + '"]').forEach((button) => {
      bindToolToggle(button, () => {
        state.ranchTool = state.ranchTool === t ? "" : t;
        saveState();
        render();
      });
    });
  });

  document.querySelectorAll("[data-menu-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.menuAction === "save") {
        openSaveBox();
        return;
      }
      if (button.dataset.menuAction === "invite") {
        openInvite();
        return;
      }
      if (button.dataset.menuAction === "profile") {
        openProfile();
        return;
      }
      if (button.dataset.menuAction === "farm") {
        openFarmSettings();
        return;
      }
      if (button.dataset.menuAction === "redeem") {
        openRedeem();
        return;
      }
      if (button.dataset.menuAction === "leaderboard") {
        openLeaderboard();
        return;
      }
      if (button.dataset.menuAction === "stock") {
        if (stockOpen) exitStock(); else enterStock();
        return;
      }
      if (button.dataset.menuAction === "fishmarket") { openFishMarket(); return; }
      const wasActive = button.classList.contains("is-active");
      document.querySelectorAll("[data-menu-action]").forEach((item) => item.classList.remove("is-active"));
      if (!wasActive) {
        button.classList.add("is-active");
        const labels = {
          profile: "角色設定會放頭像、稱號和玩家資料。",
          farm: "莊園設定會放莊園名稱、佈景和公開狀態。",
          invite: "邀請好友會放好友碼和拜訪連結。",
          notice: "常見問題會放操作說明和版本資訊。",
          redeem: "兌換碼之後可輸入序號領取獎勵，功能開發中。",
        };
        toast(labels[button.dataset.menuAction] || "功能準備中。");
      }
    });
  });

  const saveBox = document.querySelector("#saveBox");
  const exportBtn = document.querySelector("#exportCodeBtn");
  const importBtn = document.querySelector("#importCodeBtn");
  const saveBoxClose = document.querySelector("#saveBoxClose");
  if (exportBtn) exportBtn.addEventListener("click", exportCode);
  if (importBtn) importBtn.addEventListener("click", importCode);
  if (saveBoxClose) saveBoxClose.addEventListener("click", closeSaveBox);
  document.querySelector("#googleLoginBtn")?.addEventListener("click", () => { fbUser ? googleLogout() : googleLogin(); });
  if (saveBox) {
    saveBox.addEventListener("click", (event) => {
      if (event.target === saveBox) closeSaveBox();
    });
  }

  const giftBox = document.querySelector("#giftBox");
  const giftClose = document.querySelector("#giftClose");
  if (giftClose) giftClose.addEventListener("click", closeGift);
  if (giftBox) {
    giftBox.addEventListener("click", (event) => {
      if (event.target === giftBox) closeGift();
    });
  }

  const spinGo = document.querySelector("#spinGo");
  const spinCloseBtn = document.querySelector("#spinClose");
  const spinBox = document.querySelector("#spinBox");
  if (spinGo) spinGo.addEventListener("click", doSpin);
  if (spinCloseBtn) spinCloseBtn.addEventListener("click", closeSpin);
  if (spinBox) {
    spinBox.addEventListener("click", (event) => {
      if (event.target === spinBox && !spinning) closeSpin();
    });
  }

  const itemBox = document.querySelector("#itemBox");
  const itemClose = document.querySelector("#itemClose");
  if (itemClose) itemClose.addEventListener("click", closeItems);
  if (itemBox) {
    itemBox.addEventListener("click", (event) => {
      if (event.target === itemBox) closeItems();
    });
  }

  const friendsBox = document.querySelector("#friendsBox");
  const friendsClose = document.querySelector("#friendsClose");
  if (friendsClose) friendsClose.addEventListener("click", closeFriends);
  document.querySelector("#leaderboardClose")?.addEventListener("click", () => { const b = document.querySelector("#leaderboardBox"); if (b) b.hidden = true; });
  document.querySelector('[data-action="stock-exit"]')?.addEventListener("click", exitStock);
  document.querySelectorAll("[data-stock-act]").forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.stockAct === "buy") { toggleStockBuy("buy"); return; }
    if (b.dataset.stockAct === "sell") { toggleStockBuy("sell"); return; }
    toast("定期定額／收益情形會在下一階段開放。");
  }));
  document.querySelectorAll("[data-visit-tool]").forEach((b) => b.addEventListener("click", () => {
    visitTool = (visitTool === b.dataset.visitTool) ? "" : b.dataset.visitTool;
    updateVisitToolUI();
  }));
  document.querySelector("#bld-doghouse")?.addEventListener("click", onFriendDoghouseClick);
  document.querySelector("#bld-pond")?.addEventListener("click", () => { if (!visiting && state.scene !== "ranch" && !state.gm) openPondDialog(); });
  document.querySelector('[data-action="visit-exit"]')?.addEventListener("click", exitVisit);
  document.querySelectorAll("[data-visit-go]").forEach((b) => b.addEventListener("click", () => visitGo(b.dataset.visitGo)));
  document.querySelector("#addFriendBtn")?.addEventListener("click", () => {
    const inp = document.querySelector("#addFriendInput");
    if (inp) { addFriendByInput(inp.value); inp.value = ""; }
  });
  document.querySelector("#addFriendInput")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { addFriendByInput(e.target.value); e.target.value = ""; }
  });
  document.querySelector("#copyFriendCode")?.addEventListener("click", () => {
    if (!state.friendCode) { toast("好友碼產生中，稍候再試。"); return; }
    try { navigator.clipboard && navigator.clipboard.writeText(state.friendCode); toast("已複製好友碼：" + state.friendCode); }
    catch (_) { window.prompt("你的好友碼：", state.friendCode); }
  });
  if (friendsBox) friendsBox.addEventListener("click", (e) => { if (e.target === friendsBox) closeFriends(); });
  const inviteBox = document.querySelector("#inviteBox");
  const inviteClose = document.querySelector("#inviteClose");
  const inviteAdd = document.querySelector("#inviteAddBtn");
  if (inviteClose) inviteClose.addEventListener("click", closeInvite);
  if (inviteAdd) inviteAdd.addEventListener("click", inviteCustom);
  if (inviteBox) inviteBox.addEventListener("click", (e) => { if (e.target === inviteBox) closeInvite(); });

  const profileName = document.querySelector("#profileName");
  if (profileName) profileName.addEventListener("input", () => { state.nickname = profileName.value; saveState(); });
  const profileClose = document.querySelector("#profileClose");
  if (profileClose) profileClose.addEventListener("click", closeProfile);
  const profileBox = document.querySelector("#profileBox");
  if (profileBox) profileBox.addEventListener("click", (e) => { if (e.target === profileBox) closeProfile(); });
  const farmNameInput = document.querySelector("#farmNameInput");
  if (farmNameInput) farmNameInput.addEventListener("input", () => { state.farmName = farmNameInput.value; saveState(); applyFarmTitle(); });
  const roleNameInput = document.querySelector("#roleNameInput");
  if (roleNameInput) roleNameInput.addEventListener("input", () => { state.nickname = roleNameInput.value; saveState(); });
  const roleMoreBtn = document.querySelector("#roleMoreBtn");
  if (roleMoreBtn) roleMoreBtn.addEventListener("click", () => { closeFarmSettings(); openProfile(); });
  setupCropper();
  const farmClose = document.querySelector("#farmClose");
  if (farmClose) farmClose.addEventListener("click", closeFarmSettings);
  document.querySelector("#guideBtn")?.addEventListener("click", openGuide);
  document.querySelector("#guideClose")?.addEventListener("click", closeGuide);
  const guideBox = document.querySelector("#guideBox");
  if (guideBox) guideBox.addEventListener("click", (e) => { if (e.target === guideBox) closeGuide(); });
  const farmBox = document.querySelector("#farmBox");
  if (farmBox) farmBox.addEventListener("click", (e) => { if (e.target === farmBox) closeFarmSettings(); });
  const friendFarmBox = document.querySelector("#friendFarmBox");
  const friendFarmBack = document.querySelector("#friendFarmBack");
  if (friendFarmBack) friendFarmBack.addEventListener("click", closeFriendFarm);
  if (friendFarmBox) friendFarmBox.addEventListener("click", (e) => { if (e.target === friendFarmBox) closeFriendFarm(); });

  const gmPanel = document.querySelector("#gmPanel");
  const gmEdit = document.querySelector("#gmEdit");
  document.querySelector("#gmEditBtn")?.addEventListener("click", openGmEdit);
  document.querySelector("#gmResetBtn")?.addEventListener("click", gmReset);
  document.querySelector("#gmExitBtn")?.addEventListener("click", gmExit);
  document.querySelectorAll("[data-dog-set]").forEach((b) => b.addEventListener("click", () => {
    gmDogOverride = b.dataset.dogSet || "";
    applyBuildings();
    const L = { none: "清空(無狗窩)", empty: "空(未養狗)", wait: "等待(飽食>0)", sleep: "睡覺(飽食=0)", enemy: "敵人(有小偷)", walk: "散步", "": "自動" };
    toast("狗窩圖：" + (L[gmDogOverride] || "自動"));
  }));
  document.querySelectorAll("[data-ranch-set]").forEach((b) => b.addEventListener("click", () => {
    state.ranchLevel = Number(b.dataset.ranchSet) || 1;
    const culled = cullRanchAnimals();
    saveState();
    applyRanchBg();
    updateGmRanchToggle();
    render();
    repositionRanchAnimals();
    if (document.querySelector("#ranchEditor")) renderRanchEditor();
    const nm = RANCH_LEVEL_NAMES[state.ranchLevel] || "小牧場";
    toast(culled ? ("牧場切換為" + nm + "，超出上限已移除 " + culled + " 隻較弱的動物。") : ("牧場切換為" + nm + "。"));
  }));
  updateGmRanchToggle();
  document.querySelector("#gmPanelClose")?.addEventListener("click", () => { state.gmSelect = !(state.gmSelect !== false); saveState(); hideGmBox("#gmPanel"); render(); toast(state.gmSelect ? "已開啟圈選畫面。" : "已關閉圈選畫面（GM 保留）。"); });
  if (gmPanel) gmPanel.addEventListener("click", (e) => { if (e.target === gmPanel) hideGmBox("#gmPanel"); });
  document.querySelector("#gmEditConfirm")?.addEventListener("click", gmEditConfirm);
  document.querySelector("#gmEditRevert")?.addEventListener("click", gmEditRevert);
  document.querySelector("#gmEditBack")?.addEventListener("click", gmEditBack);
  if (gmEdit) gmEdit.addEventListener("click", (e) => { if (e.target === gmEdit) gmEditDismiss(); });
  Object.keys(GM_FIELDS).forEach((key) => {
    const f = GM_FIELDS[key];
    document.querySelector(`[data-gm-dec="${key}"]`)?.addEventListener("click", () => gmSetVal(key, gmGet(key) - f.step));
    document.querySelector(`[data-gm-inc="${key}"]`)?.addEventListener("click", () => gmSetVal(key, gmGet(key) + f.step));
    document.querySelector(`[data-gm-num="${key}"]`)?.addEventListener("input", (e) => { if (e.target.value !== "") gmSetVal(key, parseFloat(e.target.value)); });
    document.querySelector(`[data-gm-range="${key}"]`)?.addEventListener("input", (e) => gmSetVal(key, parseFloat(e.target.value)));
  });
  document.querySelectorAll("[data-gm-weather]").forEach((b) => b.addEventListener("click", () => {
    state.weather = b.dataset.gmWeather; state.weatherNextAt = Date.now() + weatherInterval(); if (b.dataset.gmWeather === "typhoon") applyTyphoonDamage(); saveState(); render(); toast("天氣已切換。");
  }));
  document.querySelector("#gmInvOpen")?.addEventListener("click", () => { gmInvSnap = gmCaptureInv(); buildGmInvList(); hideGmBox("#gmEdit"); showGmBox("#gmInvBox"); });
  document.querySelector("#gmInvConfirm")?.addEventListener("click", gmInvConfirm);
  document.querySelector("#gmInvMax")?.addEventListener("click", gmInvMax);
  document.querySelector("#gmInvRevert")?.addEventListener("click", gmInvRevert);
  document.querySelector("#gmInvBack")?.addEventListener("click", gmInvBack);
  const gmInvBox = document.querySelector("#gmInvBox");
  if (gmInvBox) gmInvBox.addEventListener("click", (e) => { if (e.target === gmInvBox) gmInvDismiss(); });
  document.querySelector("#gmItemOpen")?.addEventListener("click", () => { gmItemSnap = gmCaptureItems(); buildGmItemList(); hideGmBox("#gmEdit"); showGmBox("#gmItemBox"); });
  document.querySelector("#gmItemConfirm")?.addEventListener("click", gmItemConfirm);
  document.querySelector("#gmItemMax")?.addEventListener("click", gmItemMax);
  document.querySelector("#gmItemRevert")?.addEventListener("click", gmItemRevert);
  document.querySelector("#gmItemBack")?.addEventListener("click", gmItemBack);
  const gmItemBox = document.querySelector("#gmItemBox");
  if (gmItemBox) gmItemBox.addEventListener("click", (e) => { if (e.target === gmItemBox) gmItemDismiss(); });
  document.querySelector("#gmSeedOpen")?.addEventListener("click", () => { gmSeedSnap = gmCaptureSeeds(); buildGmSeedList(); hideGmBox("#gmEdit"); showGmBox("#gmSeedBox"); });
  document.querySelector("#gmSeedConfirm")?.addEventListener("click", gmSeedConfirm);
  document.querySelector("#gmSeedMax")?.addEventListener("click", gmSeedMax);
  document.querySelector("#gmSeedRevert")?.addEventListener("click", gmSeedRevert);
  document.querySelector("#gmSeedBack")?.addEventListener("click", gmSeedBack);
  const gmSeedBox = document.querySelector("#gmSeedBox");
  if (gmSeedBox) gmSeedBox.addEventListener("click", (e) => { if (e.target === gmSeedBox) gmSeedDismiss(); });
  document.querySelector("#newSlotBtn")?.addEventListener("click", () => {
    const inp = document.querySelector("#newSlotName");
    createSlot(inp ? inp.value : "");
    if (inp) inp.value = "";
  });
  document.querySelector("#saveAsBtn")?.addEventListener("click", () => {
    const inp = document.querySelector("#newSlotName");
    saveAsNewSlot(inp ? inp.value : "");
    if (inp) inp.value = "";
  });
  document.querySelector("#slotCancel")?.addEventListener("click", cancelSlotPicker);
  // 工作面板內容點擊不冒泡到「點空白關閉面板」，避免買一個就關閉
  if (elements.tabContent) elements.tabContent.addEventListener("click", (e) => e.stopPropagation());
  document.querySelector("#switchSlotBtn")?.addEventListener("click", () => {
    if (!fbUser) { toast("請先登入。"); return; }
    if (!accountData) { toast("雲端載入中，稍候再試。"); return; }
    if (slotReady) cloudSaveNow();
    const sb = document.querySelector("#saveBox"); if (sb) sb.hidden = true;
    showSlotPicker();
  });
  ["pointerdown", "keydown", "touchstart"].forEach((ev) => document.addEventListener(ev, resetIdle, { passive: true }));
  document.querySelector("#gmOrderRefresh")?.addEventListener("click", () => {
    state.orders = generateOrders();
    state.ordersRefreshAt = Date.now() + ORDER_REFRESH_MS;
    if (gmEditSnap) gmEditSnap.orders = JSON.parse(JSON.stringify(state.orders));
    saveState(); render(); toast("訂單已全部刷新。");
  });
  document.querySelector("#gmThief")?.addEventListener("click", gmSpawnThief);
  makeGmBadgeDraggable();

  document.querySelectorAll("[data-panel-target]").forEach((button) => {
    bindToolToggle(button, () => {
      togglePanel(button.dataset.panelTarget, getPanelAnchor(button));
      render();
    });
  });

  // 點擊面板與觸發鈕以外的地方，自動關閉倉庫/種子/訂單/開發面板
  document.addEventListener("click", (event) => {
    const hasOpen = document.querySelector(".work-panel.is-open, .inventory-panel.is-open");
    if (!hasOpen) return;
    const t = event.target;
    if (t.closest && (t.closest(".work-panel, .inventory-panel") || t.closest("[data-tab], [data-panel-target]"))) return;
    openPanel("");
    render();
  });

  // 點空白處（非工具鈕／田地／動物／面板等）自動取消目前選取的工具（農場＋牧場）
  document.addEventListener("click", (event) => {
    if (!state.selectedTool && !state.ranchTool) return;
    const t = event.target;
    if (!t || !t.closest) return;
    if (t.closest("[data-tool], [data-action], [data-tab], [data-panel-target], [data-plot], .plot, .ranch-animal, .work-panel, .inventory-panel, .scene-toolbar, .gm-box, .panel, button, input")) return;
    let changed = false;
    if (state.selectedTool) { state.selectedTool = ""; changed = true; }
    if (state.ranchTool) { state.ranchTool = ""; changed = true; }
    if (changed) { saveState(); render(); }
  });

  // 直接綁在田框上：點場景背景（天空/泥土/草地等非互動物件）也取消工具
  const fieldFrameEl = document.querySelector(".field-frame");
  if (fieldFrameEl) {
    fieldFrameEl.addEventListener("click", (event) => {
      if (!state.selectedTool && !state.ranchTool) return;
      const t = event.target;
      if (t && t.closest && t.closest("[data-plot], .plot, .ranch-animal, [data-action], button")) return;
      let changed = false;
      if (state.selectedTool) { state.selectedTool = ""; changed = true; }
      if (state.ranchTool) { state.ranchTool = ""; changed = true; }
      if (changed) { saveState(); render(); }
    });
  }

  elements.restButton.addEventListener("click", restOneDay);
  elements.sellAllButton.addEventListener("click", sellAllInventory);
  document.querySelector("#sellAllRanchButton")?.addEventListener("click", sellAllRanchProducts);
}

const HOUSE_BRAND_SVG = '<svg viewBox="0 0 64 64" role="img"><path d="M8 28 32 10l24 18v28H8z" fill="#cf4b3f"/><path d="M8 28 32 10l24 18" fill="none" stroke="#703629" stroke-width="4" stroke-linejoin="round"/><path d="M24 56V36h16v20" fill="#f4c66a"/><path d="M18 56V42h8v14M38 56V42h8v14" fill="#ffe09a" opacity=".8"/><path d="M29 20h6v9h-6z" fill="#f7efe3"/></svg>';

function brandMarkInner() {
  const a = state.avatar;
  const changed = a && a !== "\uD83D\uDC68\u200D\uD83C\uDF3E"; // 預設(👨‍🌾)視為未變更
  if (!changed) return HOUSE_BRAND_SVG;
  if (/^(data:|https?:|blob:)/.test(a)) return `<img class="brand-img" src="${a}" alt="" />`;
  return `<svg viewBox="0 0 64 64"><text x="32" y="34" font-size="46" text-anchor="middle" dominant-baseline="central">${a}</text></svg>`;
}

function updateBrandMark() {
  const inner = brandMarkInner();
  document.querySelectorAll(".brand .brand-mark, .scene-brand .brand-mark").forEach((el) => { el.innerHTML = inner; });
}

function applyFarmTitle() {
  const name = (state.farmName || "").trim();
  const title = name ? name + "莊園" : "開心農場";
  document.querySelectorAll(".js-farm-title").forEach((el) => { el.textContent = title; });
  updateBrandMark();
}

function applyScene() {
  document.body.classList.toggle("is-ranch", state.scene === "ranch");
  document.body.classList.toggle("is-visiting", !!visiting);
  document.body.classList.toggle("is-visit-ranch", !!visiting && visitScene === "ranch");
  document.body.classList.toggle("gm-noselect", state.gmSelect === false);
  updateRanchEditor();
  updateFarmExportBtn();
  applyRanchBg();
  const gmRo = document.querySelector("#gmStakeReadout");
  if (gmRo) {
    gmRo.hidden = !state.gm;                       // 關 GM 一律隱藏提示
    if (state.gm) {
      gmRo.textContent = state.scene === "ranch"
        ? "GM：點圈選範圍角落點來校正效果發生範圍"
        : "GM：拖曳田裡的標桿來校正位置";
    }
  }
}

function updateFarmExportBtn() {
  const frame = document.querySelector(".field-frame");
  if (!frame) return;
  const show = state.gm && state.scene !== "ranch" && state.gmSelect !== false;
  let btn = frame.querySelector("#farmExportBtn");
  let rst = frame.querySelector("#farmResetBtn");
  if (!show) { if (btn) btn.remove(); if (rst) rst.remove(); return; }
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "farmExportBtn"; btn.type = "button"; btn.textContent = "匯出圈選座標";
    btn.addEventListener("click", exportStakePos);
    frame.appendChild(btn);
  }
  if (!rst) {
    rst = document.createElement("button");
    rst.id = "farmResetBtn"; rst.type = "button"; rst.textContent = "重設";
    rst.addEventListener("click", resetFarmCalibration);
    frame.appendChild(rst);
  }
}

function resetFarmCalibration() {
  if (!window.confirm("確定要把標桿／雲／風車座標重設為預設嗎？")) return;
  gmStakePos = {};
  gmBuildingPos = {};
  try { localStorage.removeItem("gm-stake-pos"); localStorage.removeItem("gm-building-pos"); } catch (e) {}
  render();
  toast("已重設標桿／建築座標為預設。");
}

function applyRanchBg() {
  const frame = document.querySelector(".field-frame");
  if (!frame) return;
  if (state.scene !== "ranch") { frame.style.removeProperty("--scene-image"); return; }
  const set = RANCH_BG[state.ranchLevel || 1] || RANCH_BG[1];
  const bad = ["rain", "storm", "typhoon"].includes(state.weather);
  frame.style.setProperty("--scene-image", 'url("' + (bad ? set.bad : set.sun) + '")');
}

function updateGmRanchToggle() {
  document.querySelectorAll("[data-ranch-set]").forEach((b) => {
    b.classList.toggle("is-active", Number(b.dataset.ranchSet) === (state.ranchLevel || 1));
  });
}

function enterRanch() {
  if (visiting) exitVisit();
  state.scene = "ranch";
  if (typeof Image === "function") {
    Object.values(RANCH_BG).forEach((s) => { [s.sun, s.bad].forEach((u) => { const im = new Image(); im.src = u; }); });
  }
  openPanel("");
  applyScene();
  saveState();
  render();
}

function exitRanch() {
  state.scene = "farm";
  applyScene();
  saveState();
  render();
}

function openPanel(target, anchor) {
  const panels = {
    inventory: document.querySelector(".inventory-panel"),
    work: document.querySelector(".work-panel"),
  };

  Object.entries(panels).forEach(([name, panel]) => {
    if (panel) {
      panel.classList.toggle("is-open", name === target);
      if (name === target && anchor) {
        positionPanel(panel, anchor);
      }
    }
  });
}

function togglePanel(target, anchor) {
  const panel = document.querySelector(`.${target}-panel`);
  if (!panel) {
    return;
  }

  openPanel(panel.classList.contains("is-open") ? "" : target, anchor);
}

function getPanelAnchor(button) {
  if (button.dataset.panelTarget === "inventory") {
    return document.querySelector('.scene-action[data-panel-target="inventory"]') || button;
  }

  if (button.dataset.tab) {
    return document.querySelector(`.scene-action[data-tab="${button.dataset.tab}"]`) || button;
  }

  return button;
}

function positionPanel(panel, anchor) {
  const layout = document.querySelector(".game-layout");
  if (!layout || !anchor) {
    return;
  }

  const layoutRect = layout.getBoundingClientRect();
  const anchorRect = anchor.getBoundingClientRect();
  const panelWidth = panel.offsetWidth || 340;
  const leftMax = Math.max(8, layoutRect.width - panelWidth - 8);
  const left = Math.min(leftMax, Math.max(8, anchorRect.right - layoutRect.left - panelWidth));
  const top = Math.max(8, anchorRect.bottom - layoutRect.top + 8);

  panel.style.left = `${left}px`;
  panel.style.right = "auto";
  panel.style.top = `${top}px`;
}

function hasClaimableGift() {
  if (!state.openingSpinDone) return true;
  return GIFTS.some((g) => state.level >= g.level && !(state.giftsClaimed || []).includes(g.level));
}

function updateGiftBadge() {
  const btn = document.querySelector('.scene-action[data-action="gift"]');
  if (btn) btn.classList.toggle("has-gift", hasClaimableGift());
}

function giftSeedText(seeds) {
  return Object.entries(seeds).map(([id, n]) => `${CROPS[id].name}\u7a2e\u5b50\u00d7${n}`).join("\u3001");
}

function openGift() {
  renderGiftList();
  const box = document.querySelector("#giftBox");
  if (box) box.hidden = false;
}

function closeGift() {
  const box = document.querySelector("#giftBox");
  if (box) box.hidden = true;
}

function newbieAllDone() {
  if (!state.openingSpinDone) return false;
  return GIFTS.every((g) => (state.giftsClaimed || []).includes(g.level));
}

function newbieBodyHtml() {
  let rows = "";
  if (!state.openingSpinDone) rows += spinRowHtml();
  const claimed = state.giftsClaimed || [];
  GIFTS.forEach((g) => {
    if (claimed.includes(g.level)) return;
    const reached = state.level >= g.level;
    const label = reached ? "領取" : `Lv.${g.level} 解鎖`;
    rows += `
      <div class="gift-row ${reached ? "is-claimable" : ""}">
        <div class="gift-row-main">
          <strong>Lv.${g.level} 禮包</strong>
          <span class="gift-contents">🪙 ${g.coins}　${giftSeedText(g.seeds)}</span>
        </div>
        <button class="gift-claim" type="button" data-gift-claim="${g.level}" ${reached ? "" : "disabled"}>${label}</button>
      </div>`;
  });
  return rows;
}

function renderGiftList() {
  const list = document.querySelector("#giftList");
  if (!list) return;
  const newbieDone = newbieAllDone();
  const sections = [
    { id: "newbie", title: "🌱 新手禮包", body: newbieBodyHtml(), note: newbieDone ? "本區禮包已全數領完" : "", empty: "🎉 感謝領取！" },
    { id: "event", title: "🎉 活動禮包", body: "", note: "", empty: "敬請期待，活動開跑後開放。" },
    { id: "friend", title: "🤝 友情禮包", body: "", note: "", empty: "敬請期待，邀請好友後開放。" },
  ];
  list.innerHTML = sections.map((sec) => {
    const open = !!giftSectionOpen[sec.id];
    const note = sec.note ? `<span class="gift-sec-note">${sec.note}</span>` : "";
    const inner = sec.body && sec.body.trim() ? sec.body : `<p class="gift-sec-empty">${sec.empty}</p>`;
    return `
      <div class="gift-section">
        <button class="gift-sec-head" type="button" data-sec="${sec.id}">
          <span class="gift-sec-title">${sec.title}</span>
          ${note}
          <span class="gift-sec-caret">▼</span>
        </button>
        <div class="gift-sec-body" ${open ? "" : "hidden"}>${inner}</div>
      </div>`;
  }).join("");
  list.querySelectorAll("[data-sec]").forEach((h) => {
    h.addEventListener("click", () => {
      const id = h.dataset.sec;
      giftSectionOpen[id] = !giftSectionOpen[id];
      renderGiftList();
    });
  });
  list.querySelectorAll("[data-gift-claim]").forEach((b) => {
    b.addEventListener("click", () => claimGift(Number(b.dataset.giftClaim)));
  });
  const spinOpenBtn = document.querySelector("#spinOpen");
  if (spinOpenBtn) spinOpenBtn.addEventListener("click", openSpin);
}

function claimGift(level) {
  const gift = GIFTS.find((g) => g.level === level);
  if (!gift) return;
  if (state.level < gift.level) {
    toast("\u9084\u6c92\u5230\u9019\u500b\u7b49\u7d1a\u3002");
    return;
  }
  if (!Array.isArray(state.giftsClaimed)) state.giftsClaimed = [];
  if (state.giftsClaimed.includes(level)) {
    toast("\u9019\u500b\u79ae\u5305\u5df2\u7d93\u9818\u904e\u4e86\u3002");
    return;
  }
  state.coins += gift.coins;
  Object.entries(gift.seeds).forEach(([id, n]) => {
    state.seeds[id] = (state.seeds[id] || 0) + n;
  });
  state.giftsClaimed.push(level);
  toast(`\u9818\u53d6 Lv.${level} \u79ae\u5305\uff1a+${gift.coins} \u91d1\u5e63\u3001${giftSeedText(gift.seeds)}\u3002`);
  saveState();
  renderGiftList();
  render();
}

function spinRowHtml() {
  const done = !!state.openingSpinDone;
  return `
    <div class="gift-row ${done ? "is-claimed" : "is-claimable"}">
      <div class="gift-row-main">
        <strong>Lv.1 開場禮包</strong>
        <span class="gift-contents">🎡 幸運轉盤，限轉一次</span>
      </div>
      <button class="gift-claim" type="button" id="spinOpen" ${done ? "disabled" : ""}>${done ? "已開啟" : "開啟轉盤"}</button>
    </div>`;
}

function buildWheelSvg() {
  const n = SPIN_PRIZES.length;
  const seg = 360 / n;
  const cx = 150, cy = 150, r = 148;
  const base = ["#f6d97a", "#f3c14e"];
  let out = "";
  for (let i = 0; i < n; i++) {
    const p = SPIN_PRIZES[i];
    const a0 = (i * seg - 90) * Math.PI / 180;
    const a1 = ((i + 1) * seg - 90) * Math.PI / 180;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0);
    const x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const fill = p.type === "weatherCard" ? "#8fcfe6" : base[i % 2];
    out += `<path d="M${cx},${cy} L${x0.toFixed(1)},${y0.toFixed(1)} A${r},${r} 0 0 1 ${x1.toFixed(1)},${y1.toFixed(1)} Z" fill="${fill}" stroke="#fffef8" stroke-width="1.5"/>`;
    const am = ((i + 0.5) * seg - 90) * Math.PI / 180;
    const lr = r * 0.62;
    const lx = cx + lr * Math.cos(am), ly = cy + lr * Math.sin(am);
    const rot = (i + 0.5) * seg;
    let glyph, amount;
    if (p.type === "coins") {
      glyph = `<svg x="${(lx - 15).toFixed(1)}" y="${(ly - 30).toFixed(1)}" width="30" height="30" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="#e8ae36" stroke="#9b641e" stroke-width="2"/><path d="M8 12h8M12 7v10" stroke="#fff2bf" stroke-width="2" stroke-linecap="round"/></svg>`;
      amount = `${p.amount}`;
    } else if (p.type === "seed") {
      glyph = `<image href="./assets/crops/field/${p.id}-ripe.png" x="${(lx - 18).toFixed(1)}" y="${(ly - 32).toFixed(1)}" width="36" height="36" preserveAspectRatio="xMidYMid meet"/>`;
      amount = `×${p.amount}`;
    } else {
      glyph = `<text x="${lx.toFixed(1)}" y="${(ly - 8).toFixed(1)}" text-anchor="middle" font-size="27">🌤️</text>`;
      amount = `×${p.amount}`;
    }
    out += `<g transform="rotate(${rot.toFixed(1)} ${lx.toFixed(1)} ${ly.toFixed(1)})">${glyph}<text x="${lx.toFixed(1)}" y="${(ly + 16).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="800" fill="#3a2e12">${amount}</text></g>`;
  }
  out += `<circle cx="${cx}" cy="${cy}" r="20" fill="#fffef8" stroke="#e8b94a" stroke-width="3"/>`;
  return `<svg viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${out}</svg>`;
}

function pickWeightedIndex(arr) {
  const total = arr.reduce((sum, p) => sum + p.weight, 0);
  let r = Math.random() * total;
  for (let i = 0; i < arr.length; i++) {
    r -= arr[i].weight;
    if (r < 0) return i;
  }
  return arr.length - 1;
}

function openSpin() {
  if (state.openingSpinDone) {
    toast("開場禮包已經開過了。");
    return;
  }
  const rotor = document.querySelector("#wheelRotor");
  if (rotor) {
    rotor.style.transition = "none";
    rotor.style.transform = "rotate(0deg)";
    rotor.innerHTML = buildWheelSvg();
    void rotor.offsetWidth;
    rotor.style.transition = "";
  }
  const res = document.querySelector("#spinResult");
  if (res) res.textContent = "";
  const go = document.querySelector("#spinGo");
  if (go) { go.hidden = false; go.disabled = false; }
  const close = document.querySelector("#spinClose");
  if (close) close.hidden = true;
  const box = document.querySelector("#spinBox");
  if (box) box.hidden = false;
}

function closeSpin() {
  const box = document.querySelector("#spinBox");
  if (box) box.hidden = true;
  renderGiftList();
  updateGiftBadge();
}

function doSpin() {
  if (spinning || state.openingSpinDone) return;
  spinning = true;
  const go = document.querySelector("#spinGo");
  if (go) go.disabled = true;
  const idx = pickWeightedIndex(SPIN_PRIZES);
  const R = 360 * 6 - (idx * 36 + 18);
  const rotor = document.querySelector("#wheelRotor");
  if (rotor) rotor.style.transform = `rotate(${R}deg)`;
  setTimeout(() => {
    awardSpinPrize(SPIN_PRIZES[idx]);
    state.openingSpinDone = true;
    saveState();
    const res = document.querySelector("#spinResult");
    if (res) res.textContent = `🎉 獲得：${SPIN_PRIZES[idx].label}`;
    const close = document.querySelector("#spinClose");
    if (close) close.hidden = false;
    if (go) go.hidden = true;
    updateGiftBadge();
    spinning = false;
  }, 4400);
}

function awardSpinPrize(p) {
  if (p.type === "coins") {
    state.coins += p.amount;
  } else if (p.type === "seed") {
    state.seeds[p.id] = (state.seeds[p.id] || 0) + p.amount;
  } else if (p.type === "weatherCard") {
    if (!state.items) state.items = {};
    state.items.weatherCard = (state.items.weatherCard || 0) + p.amount;
  }
  render();
}

function openItems() {
  pendingWeatherCard = false;
  renderItemList();
  const box = document.querySelector("#itemBox");
  if (box) box.hidden = false;
}

function closeItems() {
  pendingWeatherCard = false;
  const box = document.querySelector("#itemBox");
  if (box) box.hidden = true;
  if (state.activeTab === "shop") openPanel("");   // 行囊整合：使用道具後關面板
}

function renderItemList() {
  const list = document.querySelector("#bagItemBody") || document.querySelector("#itemList");
  if (!list) return;
  if (pendingWeatherCard) {
    list.innerHTML = `
      <div class="gift-row">
        <div class="gift-row-main">
          <strong>使用天氣兌換卡</strong>
          <span class="gift-contents">選一個天氣，會維持到下次自然轉換</span>
        </div>
      </div>
      <div class="weather-pick">
        <button data-wcard="sun" type="button">☀️ 晴朗</button>
        <button data-wcard="cloud" type="button">⛅ 多雲</button>
        <button data-wcard="rain" type="button">🌧️ 小雨</button>
      </div>`;
    list.querySelectorAll("[data-wcard]").forEach((b) => {
      b.addEventListener("click", () => applyWeatherCard(b.dataset.wcard));
    });
    return;
  }
  const fert = (state.items && state.items.fertilizer) || 0;
  const wcard = (state.items && state.items.weatherCard) || 0;
  const thaw = (state.items && state.items.thawCard) || 0;
  let rows = "";
  if (fert > 0) {
    rows += `
    <div class="gift-row is-claimable">
      <div class="gift-row-main">
        <strong>🌱 肥料 ×${fert}</strong>
        <span class="gift-contents">選一塊田施肥，剩餘成長時間減半（一作物限一次）</span>
      </div>
      <button class="gift-claim" type="button" id="useFert">使用</button>
    </div>`;
  }
  if (wcard > 0) {
    rows += `
    <div class="gift-row is-claimable">
      <div class="gift-row-main">
        <strong>🌤️ 天氣兌換卡 ×${wcard}</strong>
        <span class="gift-contents">使用後把天氣切成你要的，維持到下次自然轉換</span>
      </div>
      <button class="gift-claim" type="button" id="useWcard">使用</button>
    </div>`;
  }
  if (thaw > 0) {
    rows += `
    <div class="gift-row is-claimable">
      <div class="gift-row-main">
        <strong>🃏 解凍卡 ×${thaw}</strong>
        <span class="gift-contents">在「災損作物」清單對凍傷作物使用，完全返還 50 個</span>
      </div>
      <button class="gift-claim" type="button" disabled title="請到倉庫「災損作物」清單使用">使用</button>
    </div>`;
  }
  const guard = (state.items && state.items.guardCard) || 0;
  const coinC = (state.items && state.items.coinCard500) || 0;
  const expP = (state.items && state.items.expSpinPack) || 0;
  if (guard > 0) {
    rows += `
    <div class="gift-row is-claimable">
      <div class="gift-row-main">
        <strong>🛡️ 防盜卡 ×${guard}</strong>
        <span class="gift-contents">使用後 2 小時內不會被好友偷菜（可累加時間）</span>
      </div>
      <button class="gift-claim" type="button" id="useGuard">使用</button>
    </div>`;
  }
  if (coinC > 0) {
    rows += `
    <div class="gift-row is-claimable">
      <div class="gift-row-main">
        <strong>🪙 金幣500兌換卡 ×${coinC}</strong>
        <span class="gift-contents">點擊使用後立即獲得 500 金幣</span>
      </div>
      <button class="gift-claim" type="button" id="useCoinCard">使用</button>
    </div>`;
  }
  if (expP > 0) {
    rows += `
    <div class="gift-row is-claimable">
      <div class="gift-row-main">
        <strong>🎰 抽獎經驗卡池包 ×${expP}</strong>
        <span class="gift-contents">使用抽一次，隨機獲得 50~350 經驗</span>
      </div>
      <button class="gift-claim" type="button" id="useExpPack">使用</button>
    </div>`;
  }
  const exC = (state.items && state.items.expandCard) || 0;
  const exP = (state.items && state.items.expandCardPro) || 0;
  if (exC > 0) {
    rows += `
    <div class="gift-row">
      <div class="gift-row-main">
        <strong>🏗️ 牧場擴建卡 ×${exC}</strong>
        <span class="gift-contents">於「開發 → 牧場建設」升級小牧場為大牧場時消耗</span>
      </div>
    </div>`;
  }
  if (exP > 0) {
    rows += `
    <div class="gift-row">
      <div class="gift-row-main">
        <strong>🏗️ 牧場擴建卡（特）×${exP}</strong>
        <span class="gift-contents">於「開發 → 牧場建設」升級大牧場為超大牧場時消耗</span>
      </div>
    </div>`;
  }
  const chest = (state.items && state.items.treasureChest) || 0;
  if (chest > 0) {
    rows += `
    <div class="gift-row">
      <div class="gift-row-main">
        <strong>🎁 寶箱 ×${chest}</strong>
        <span class="gift-contents">釣魚釣到的寶箱，開箱內容日後開放</span>
      </div>
      <button class="gift-claim" type="button" disabled title="開箱功能開發中">開箱</button>
    </div>`;
  }
  if (!rows) rows = '<p class="item-empty">目前沒有道具。</p>';
  list.innerHTML = rows;
  const useFert = document.querySelector("#useFert");
  if (useFert) useFert.addEventListener("click", startFertilize);
  const useW = document.querySelector("#useWcard");
  if (useW) useW.addEventListener("click", () => { pendingWeatherCard = true; renderItemList(); });
  document.querySelector("#useGuard")?.addEventListener("click", useGuard);
  document.querySelector("#useCoinCard")?.addEventListener("click", useCoinCard);
  document.querySelector("#useExpPack")?.addEventListener("click", useExpPack);
}

function thawCost(id, n) {
  return Math.round((CROPS[id] ? CROPS[id].sell : 1) * n * 0.5);
}

function renderDamaged() {
  const list = document.querySelector("#damagedList");
  if (!list) return;
  const entries = Object.entries(state.damaged || {}).filter(([, n]) => n > 0);
  const cards = (state.items && state.items.thawCard) || 0;
  if (!entries.length) {
    list.innerHTML = '<p class="item-empty">目前沒有災損作物。</p>';
    return;
  }
  list.innerHTML = entries.map(([id, n]) => {
    const cost = thawCost(id, n);
    const back = Math.round(n * 0.7);
    return `
      <div class="inventory-row damaged-row">
        <span class="mini-crop" aria-hidden="true">${cropCardVisual(id)}</span>
        <span>
          <span class="item-title"><strong>${CROPS[id].name}</strong><span class="frost-tag">❄️凍傷 ${n}</span></span>
          <span class="item-meta">金幣解凍 ${cost}：取回 ${back}（70%）</span>
        </span>
        <span class="damaged-actions">
          <button class="mini-thaw" type="button" data-thaw-coin="${id}" title="金幣解凍">💰</button>
          <button class="mini-thaw card" type="button" data-thaw-card="${id}" ${cards > 0 ? "" : "disabled"} title="解凍卡（完全返還50）">🃏</button>
        </span>
      </div>`;
  }).join("");
  list.querySelectorAll("[data-thaw-coin]").forEach((b) => b.addEventListener("click", () => thawWithCoins(b.dataset.thawCoin)));
  list.querySelectorAll("[data-thaw-card]").forEach((b) => b.addEventListener("click", () => thawWithCard(b.dataset.thawCard)));
}

function thawWithCoins(id) {
  const n = (state.damaged && state.damaged[id]) || 0;
  if (n <= 0) return;
  const cost = thawCost(id, n);
  if (state.coins < cost) { toast("金幣不夠解凍。"); return; }
  state.coins -= cost;
  const back = Math.round(n * 0.7);
  state.inventory[id] = (state.inventory[id] || 0) + back;
  delete state.damaged[id];
  toast(`解凍 ${CROPS[id].name}：花 ${cost} 金幣，取回 ${back} 個（70%）。`);
  saveState();
  render();
}

function thawWithCard(id) {
  const cards = (state.items && state.items.thawCard) || 0;
  if (cards < 1) { toast("沒有解凍卡。"); return; }
  const n = (state.damaged && state.damaged[id]) || 0;
  if (n <= 0) return;
  const take = Math.min(50, n);
  state.items.thawCard -= 1;
  state.inventory[id] = (state.inventory[id] || 0) + take;
  state.damaged[id] = n - take;
  if (state.damaged[id] <= 0) delete state.damaged[id];
  toast(`使用解凍卡：完全返還 ${CROPS[id].name} ${take} 個。`);
  saveState();
  render();
}

function buyThawCard() {
  if (state.coins < THAW_CARD_COST) { toast("金幣不夠買解凍卡。"); return; }
  state.coins -= THAW_CARD_COST;
  if (!state.items) state.items = {};
  state.items.thawCard = (state.items.thawCard || 0) + 1;
  toast("購買解凍卡 ×1。");
  saveState();
  render();
  renderItemList();
}

function buyFertilizer() {
  if (state.coins < FERTILIZER_COST) {
    toast("金幣不夠買肥料。");
    return;
  }
  state.coins -= FERTILIZER_COST;
  if (!state.items) state.items = {};
  state.items.fertilizer = (state.items.fertilizer || 0) + 1;
  toast("購買肥料 ×1。");
  saveState();
  render();
  renderItemList();
}

function startFertilize() {
  if (!state.items || (state.items.fertilizer || 0) < 1) {
    toast("沒有肥料。");
    return;
  }
  pendingFertilize = true;
  closeItems();
  toast("點選要施肥的田地（剩餘時間減半）。");
}

function applyFertilizer(index) {
  pendingFertilize = false;
  const plot = state.plots[index];
  if (!plot.crop) {
    toast("空地不用施肥。");
    return;
  }
  if (getPlotProgress(plot) >= 1) {
    toast("已經可以收成了，不用施肥。");
    return;
  }
  if (plot.fertilized) {
    toast("這作物已經施過肥了。");
    return;
  }
  if (!state.items || (state.items.fertilizer || 0) < 1) {
    toast("沒有肥料。");
    return;
  }
  const dur = getPlotDuration(plot);
  const elapsed = Date.now() - plot.plantedAt;
  const remaining = Math.max(0, dur - elapsed);
  plot.plantedAt -= remaining * 0.5;
  plot.fertilized = true;
  state.items.fertilizer -= 1;
  toast(`施肥成功，${CROPS[plot.crop].name}剩餘時間減半。`);
  saveState();
  render();
}

function applyWeatherCard(w) {
  if (!state.items || (state.items.weatherCard || 0) < 1) {
    pendingWeatherCard = false;
    renderItemList();
    return;
  }
  if (!WEATHERS[w]) return;
  state.items.weatherCard -= 1;
  state.weather = w;
  state.weatherNextAt = Date.now() + weatherInterval();
  pendingWeatherCard = false;
  toast(`天氣切換成${WEATHERS[w].name}。`);
  saveState();
  render();
  renderItemList();
}

function friendLevel(friend) {
  const min = (Date.now() - (friend.startedAt || Date.now())) / 60000;
  return Math.max(1, Math.min(30, 1 + Math.floor(Math.log2(min / 5 + 1))));
}

function friendProgress(p) {
  if (!p.crop || !CROPS[p.crop]) return 0;
  return Math.min(1, (Date.now() - p.plantedAt) / (CROPS[p.crop].grow * 60000));
}

function refreshFriendFarm(friend) {
  const now = Date.now();
  if (!friend.startedAt) friend.startedAt = now;
  const lvl = friendLevel(friend);
  const target = Math.min(FRIEND_PLOT_MAX, 4 + PLOT_UNLOCKS.filter((u) => u.level <= lvl).length);
  if (!Array.isArray(friend.plots)) friend.plots = [];
  if (friend.plots.length > target) friend.plots.length = target;
  while (friend.plots.length < target) friend.plots.push({ crop: null, plantedAt: 0, stolenAt: 0, hazard: null });
  const pool = Object.keys(CROPS).filter((id) => CROPS[id].unlock <= lvl);
  const pickHazard = () => (Math.random() < 0.3 ? ["weed", "bug", "dry"][Math.floor(Math.random() * 3)] : null);
  friend.plots.forEach((p) => {
    const hasCrop = p.crop && CROPS[p.crop];
    const lingered = hasCrop && now > p.plantedAt + CROPS[p.crop].grow * 60000 + FRIEND_REGROW_MS;
    if (!hasCrop) {
      // 初次：給隨機進度（有些已成熟可偷）
      const id = pool[Math.floor(Math.random() * pool.length)];
      p.crop = id;
      p.plantedAt = now - Math.floor(Math.random() * CROPS[id].grow * 60000 * 1.1);
      p.stolenAt = 0;
      p.bugUsed = false;
      p.yield = Math.round(CROPS[id].yieldCount * (0.8 + Math.random() * 0.6));
      p.stolen = 0;
      p.hazard = pickHazard(); p.hazardPlaced = false;
    } else if (lingered) {
      // 成熟超過可偷窗口 → 好友自己收掉、重種一個新的（從現在開始長）
      const id = pool[Math.floor(Math.random() * pool.length)];
      p.crop = id;
      p.plantedAt = now;
      p.stolenAt = 0;
      p.bugUsed = false;
      p.yield = Math.round(CROPS[id].yieldCount * (0.8 + Math.random() * 0.6));
      p.stolen = 0;
      p.hazard = pickHazard(); p.hazardPlaced = false;
    }
  });
}

function openFriends() {
  renderFriendsList();
  renderCloudFriends();
  const box = document.querySelector("#friendsBox");
  if (box) box.hidden = false;
}

function closeFriends() {
  const box = document.querySelector("#friendsBox");
  if (box) box.hidden = true;
}

function closeFriendFarm() {
  const box = document.querySelector("#friendFarmBox");
  if (box) box.hidden = true;
  currentFriendId = null;
}

function renderFriendsList() {
  const list = document.querySelector("#friendsList");
  if (!list) return;
  if (!state.friends.length) {
    list.innerHTML = '<p class="item-empty">還沒有好友，到「邀請好友」邀請吧。</p>';
    return;
  }
  list.innerHTML = state.friends.map((f) => `
    <div class="friend-row">
      <span class="friend-ava" aria-hidden="true">${f.avatar}</span>
      <span class="friend-name">${f.name} <small>Lv.${friendLevel(f)}</small></span>
      <button class="friend-visit" type="button" data-visit="${f.id}">拜訪</button>
    </div>`).join("");
  list.querySelectorAll("[data-visit]").forEach((b) => b.addEventListener("click", () => visitFriend(b.dataset.visit)));
}

function inviteCost() {
  const n = state.friends.length + 1;
  return 25 * (n * n + 3 * n + 4);
}

function openInvite() {
  pendingInviteId = null;
  renderInviteList();
  renderCloudAdd();
  if (fbUser) publishProfile(true);
  const box = document.querySelector("#inviteBox");
  if (box) box.hidden = false;
}

function openLeaderboard() {
  const box = document.querySelector("#leaderboardBox");
  if (box) box.hidden = false;
  const list = document.querySelector("#leaderboardList");
  if (!list) return;
  if (!fbUser || !fbDb) { list.innerHTML = '<p class="item-empty">登入 Google 後才能看好友排行榜。</p>'; return; }
  list.innerHTML = '<p class="item-empty">載入中…</p>';
  (async () => {
    try {
      const ids = [fbUser.uid].concat((state.cloudFriends || []).map((f) => f.uid));
      const rows = [];
      for (const uid of ids) {
        try {
          const s = await fbDb.collection("profiles").doc(uid).get();
          if (s.exists) { const d = s.data(); rows.push({ name: d.farmName || "農友", level: d.level || 1, coins: d.coins || 0, me: uid === fbUser.uid }); }
        } catch (_) {}
      }
      rows.sort((a, b) => (b.level - a.level) || (b.coins - a.coins));
      list.innerHTML = rows.length ? rows.map((r, i) => `
        <div class="friend-row${r.me ? " lb-me" : ""}">
          <span class="lb-rank">${i + 1}</span>
          <span class="friend-name">${r.name}${r.me ? "（你）" : ""} <small>Lv.${r.level} · 🪙${r.coins}</small></span>
        </div>`).join("") : '<p class="item-empty">沒有資料。</p>';
    } catch (e) { console.warn(e); list.innerHTML = '<p class="item-empty">載入失敗，稍後再試。</p>'; }
  })();
}

function closeInvite() {
  pendingInviteId = null;
  const box = document.querySelector("#inviteBox");
  if (box) box.hidden = true;
}

function renderInviteList() {
  const cost = inviteCost();
  const note = document.querySelector("#inviteCostNote");
  if (note) note.textContent = `邀請下一位好友：${cost} 金幣（每多一位越貴）`;
  const list = document.querySelector("#inviteList");
  if (!list) return;
  if (!state.candidates.length) {
    list.innerHTML = '<p class="item-empty">內建好友都邀請過了，可在下方自訂名稱邀請。</p>';
  } else {
    list.innerHTML = state.candidates.map((c) => {
      const right = pendingInviteId === c.id
        ? `<span class="invite-confirm"><button class="friend-visit ok" type="button" data-invite-ok="${c.id}">確定 ${cost}</button><button class="friend-visit cancel" type="button" data-invite-cancel="1">取消</button></span>`
        : `<button class="friend-visit" type="button" data-invite="${c.id}">邀請</button>`;
      return `
        <div class="friend-row">
          <span class="friend-ava" aria-hidden="true">${c.avatar}</span>
          <span class="friend-name">${c.name}</span>
          ${right}
        </div>`;
    }).join("");
  }
  list.querySelectorAll("[data-invite]").forEach((b) => b.addEventListener("click", () => { pendingInviteId = b.dataset.invite; renderInviteList(); }));
  list.querySelectorAll("[data-invite-ok]").forEach((b) => b.addEventListener("click", () => inviteFriend(b.dataset.inviteOk)));
  list.querySelectorAll("[data-invite-cancel]").forEach((b) => b.addEventListener("click", () => { pendingInviteId = null; renderInviteList(); }));
}

function inviteFriend(candidateId) {
  const idx = state.candidates.findIndex((c) => c.id === candidateId);
  if (idx < 0) return;
  const cost = inviteCost();
  if (state.coins < cost) { toast(`金幣不夠，邀請需要 ${cost} 金幣。`); return; }
  const c = state.candidates[idx];
  state.coins -= cost;
  state.friends.push({ id: "f" + Date.now(), name: c.name, avatar: c.avatar, builtin: true, startedAt: Date.now(), plots: newFriendPlots() });
  state.candidates.splice(idx, 1);
  pendingInviteId = null;
  toast(`花 ${cost} 金幣，邀請 ${c.name} 成為好友！`);
  saveState();
  renderInviteList();
  render();
}

function inviteCustom() {
  const input = document.querySelector("#inviteNameInput");
  const name = (input && input.value || "").trim();
  if (!name) { toast("請輸入要邀請的名稱。"); return; }
  const cost = inviteCost();
  if (state.coins < cost) { toast(`金幣不夠，邀請需要 ${cost} 金幣。`); return; }
  const avatars = ["🧑‍🌾", "👩‍🌾", "👨‍🌾", "👧", "🧒", "🧔", "👩‍🦰", "🧑"];
  state.coins -= cost;
  state.friends.push({ id: "f" + Date.now(), name, avatar: avatars[Math.floor(Math.random() * avatars.length)], builtin: false, startedAt: Date.now(), plots: newFriendPlots() });
  if (input) input.value = "";
  toast(`花 ${cost} 金幣，邀請 ${name} 成為好友！`);
  saveState();
  renderInviteList();
  render();
}

function visitFriend(id) {
  const friend = state.friends.find((f) => f.id === id);
  if (!friend) return;
  refreshFriendFarm(friend);
  saveState();
  currentFriendId = id;
  visiting = { kind: "npc", id: id };
  state.dogChasedCount = 0;   // 切換好友：被趕跑次數歸零
  visitScene = "farm";
  closeFriends();
  if (state.scene === "ranch") { state.scene = ""; saveState(); }
  render();
  toast("正在參觀 " + friend.name + " 的農場");
}

function friendCooldownMs(friend) {
  const now = Date.now();
  if (!Array.isArray(friend.steals)) return 0;
  const recent = friend.steals.filter((t) => now - t < FRIEND_STEAL_WINDOW);
  if (recent.length < FRIEND_STEAL_MAX) return 0;
  return Math.max(0, FRIEND_STEAL_WINDOW - (now - recent[0]));
}

function fmtCooldown(ms) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function updateFriendCooldown() {
  if (!currentFriendId) return;
  const friend = state.friends.find((f) => f.id === currentFriendId);
  if (!friend) return;
  const cd = friendCooldownMs(friend);
  const grid = document.querySelector("#friendFarmGrid");
  const banner = document.querySelector("#friendFarmCooldown");
  if (cd > 0) {
    if (grid) grid.classList.add("is-cooldown");
    if (banner) { banner.hidden = false; banner.textContent = `⛔ 目前不能偷菜 · 剩 ${fmtCooldown(cd)}`; }
  } else if (grid && grid.classList.contains("is-cooldown")) {
    renderFriendFarm(currentFriendId);
  }
}

function renderFriendFarm(id) {
  const friend = state.friends.find((f) => f.id === id);
  const box = document.querySelector("#friendFarmBox");
  if (!friend || !box) return;
  const title = box.querySelector("#friendFarmTitle");
  if (title) title.textContent = `${friend.avatar} ${friend.name} 的農場`;
  const info = box.querySelector("#friendFarmInfo");
  if (info) info.textContent = `🌾 農場等級 Lv.${friendLevel(friend)}　·　${friend.plots.length} 塊田`;
  const grid = box.querySelector("#friendFarmGrid");
  const blocked = friendCooldownMs(friend) > 0;
  grid.innerHTML = friend.plots.map((p, i) => {
    if (!p.crop) return `<div class="ff-plot"><span class="ff-state">空地</span></div>`;
    const crop = CROPS[p.crop];
    const ready = friendProgress(p) >= 1;
    let label = "", action = "";
    if (p.hazard) {
      label = { weed: "🌿 雜草", bug: "🐛 蟲害", dry: "💧 缺水" }[p.hazard];
      action = `<button class="ff-btn help" type="button" data-help="${i}">幫忙</button>`;
    } else if (p.stolenAt) {
      label = "已被偷，重長中";
    } else if (ready) {
      const cap = Math.floor(((p.yield || crop.yieldCount || 1) * 0.4));
      const remain = cap - (p.stolen || 0);
      if (remain <= 0) {
        label = "已偷滿";
      } else {
        label = `✅ 可偷（剩 ${remain}）`;
        action = `<button class="ff-btn steal" type="button" data-steal="${i}" ${blocked ? "disabled" : ""}>偷菜</button>`;
      }
    } else {
      label = `成長 ${Math.round(friendProgress(p) * 100)}%`;
    }
    return `
      <div class="ff-plot">
        <span class="ff-crop" aria-hidden="true">${cropCardVisual(p.crop)}</span>
        <span class="ff-cropname">${crop.name}</span>
        <span class="ff-state">${label}</span>
        ${action}
      </div>`;
  }).join("");
  grid.querySelectorAll("[data-steal]").forEach((b) => b.addEventListener("click", () => stealCrop(id, Number(b.dataset.steal))));
  grid.querySelectorAll("[data-help]").forEach((b) => b.addEventListener("click", () => helpFriend(id, Number(b.dataset.help))));
  grid.classList.toggle("is-cooldown", blocked);
  const cdBanner = box.querySelector("#friendFarmCooldown");
  if (cdBanner) {
    cdBanner.hidden = !blocked;
    if (blocked) cdBanner.textContent = `⛔ 目前不能偷菜 · 剩 ${fmtCooldown(friendCooldownMs(friend))}`;
  }
}

function stealCrop(friendId, idx) {
  const friend = state.friends.find((f) => f.id === friendId);
  if (!friend) return;
  const p = friend.plots[idx];
  if (!p || !p.crop) return;
  if (friendProgress(p) < 1) { toast("還沒成熟，不能偷。"); return; }
  const cap = Math.floor(((p.yield || CROPS[p.crop].yieldCount || 1) * 0.4));
  const remaining = cap - (p.stolen || 0);
  if (remaining <= 0) { toast(`${friend.name} 這塊田能偷的數量已偷滿。`); return; }
  const now = Date.now();
  if (!Array.isArray(friend.steals)) friend.steals = [];
  friend.steals = friend.steals.filter((t) => now - t < FRIEND_STEAL_WINDOW);
  if (friend.steals.length >= FRIEND_STEAL_MAX) {
    const wait = Math.ceil((FRIEND_STEAL_WINDOW - (now - friend.steals[0])) / 60000);
    toast(`${friend.name} 10 分鐘內只能偷 ${FRIEND_STEAL_MAX} 次，約 ${wait} 分後再來。`);
    return;
  }
  const amt = Math.min(remaining, 1 + Math.floor(Math.random() * Math.max(1, Math.ceil(cap * 0.5))));
  state.inventory[p.crop] = (state.inventory[p.crop] || 0) + amt;
  if (state.stats) state.stats.stolen = (state.stats.stolen || 0) + amt;
  p.stolen = (p.stolen || 0) + amt;
  friend.steals.push(now);
  const plotLeft = cap - p.stolen;
  toast(`偷到 ${friend.name} 的 ${CROPS[p.crop].name} ${amt} 個！${plotLeft > 0 ? `（這塊還可偷 ${plotLeft}）` : "（這塊已偷滿）"}`);
  saveState();
  renderFriendFarm(friendId);
  render();
}

function helpFriend(friendId, idx) {
  const friend = state.friends.find((f) => f.id === friendId);
  if (!friend) return;
  const p = friend.plots[idx];
  if (!p || !p.hazard) { toast("這格不需要幫忙。"); return; }
  if (p.hazard === "bug" && p.hazardPlaced) { toast("這是別人放的蟲，要主人自己除，幫忙不能清 🐛"); return; }
  const labels = { weed: "除草", bug: "除蟲", dry: "澆水" };
  const did = labels[p.hazard];
  const hk = { weed: "weed", bug: "bug", dry: "water" }[p.hazard];
  if (hk && state.stats) state.stats[hk] = (state.stats[hk] || 0) + 1;
  p.hazard = null; p.hazardPlaced = false;
  const coin = 20 + state.level * 3;
  state.coins += coin;
  addXp(5);
  toast(`幫 ${friend.name} ${did}，獲得 ${coin} 金幣、5 XP。`);
  saveState();
  renderFriendFarm(friendId);
  render();
}

const HOUSE_AVATAR = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#f3e4c3"/><path d="M8 28 32 10l24 18v28H8z" fill="#cf4b3f"/><path d="M8 28 32 10l24 18" fill="none" stroke="#703629" stroke-width="4" stroke-linejoin="round"/><path d="M24 56V36h16v20" fill="#f4c66a"/><path d="M18 56V42h8v14M38 56V42h8v14" fill="#ffe09a" opacity=".8"/><path d="M29 20h6v9h-6z" fill="#f7efe3"/></svg>');
const AVATARS = [HOUSE_AVATAR, "👨‍🌾", "👩‍🌾", "🧑‍🌾", "🧔", "👩‍🦰", "🧒"];

function playerTitle() {
  const lv = state.level;
  if (lv >= 20) return "農場大師";
  if (lv >= 15) return "資深農夫";
  if (lv >= 10) return "老練農夫";
  if (lv >= 5) return "見習農夫";
  return "新手農夫";
}

function statLine(k, v) {
  return `<div class="stat-line"><span>${k}</span><strong>${v}</strong></div>`;
}

function addCustomAvatar() {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = "image/*";
  inp.addEventListener("change", () => {
    const file = inp.files && inp.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => openAvatarCrop(reader.result);
    reader.readAsDataURL(file);
  });
  inp.click();
}

let cropState = null;

function openAvatarCrop(dataUrl) {
  const box = document.querySelector("#avatarCropBox");
  const img = document.querySelector("#cropImg");
  const vp = document.querySelector("#cropViewport");
  const zoom = document.querySelector("#cropZoom");
  if (!box || !img || !vp) return;
  const probe = new Image();
  probe.onload = () => {
    const VP = vp.clientWidth || 240;
    const s0 = Math.max(VP / probe.width, VP / probe.height);
    img.src = dataUrl;
    img.style.width = (probe.width * s0) + "px";
    img.style.height = (probe.height * s0) + "px";
    cropState = { VP: VP, s0: s0, natW: probe.width, natH: probe.height, z: 1, tx: 0, ty: 0, url: dataUrl, _pd: 0 };
    if (zoom) zoom.value = "1";
    applyCropTransform();
    box.hidden = false;
  };
  probe.src = dataUrl;
}

function clampCrop() {
  const c = cropState; if (!c) return;
  const imgW = c.natW * c.s0 * c.z, imgH = c.natH * c.s0 * c.z;
  const maxX = Math.max(0, (imgW - c.VP) / 2), maxY = Math.max(0, (imgH - c.VP) / 2);
  c.tx = Math.min(maxX, Math.max(-maxX, c.tx));
  c.ty = Math.min(maxY, Math.max(-maxY, c.ty));
}

function applyCropTransform() {
  const c = cropState; if (!c) return;
  clampCrop();
  const img = document.querySelector("#cropImg");
  if (img) img.style.transform = `translate(-50%, -50%) translate(${c.tx}px, ${c.ty}px) scale(${c.z})`;
}

function setupCropper() {
  const vp = document.querySelector("#cropViewport");
  const zoom = document.querySelector("#cropZoom");
  const box = document.querySelector("#avatarCropBox");
  if (!vp || vp._wired) return;
  vp._wired = true;
  if (zoom) zoom.addEventListener("input", () => { if (!cropState) return; cropState.z = parseFloat(zoom.value) || 1; applyCropTransform(); });
  let drag = null;
  const pts = new Map();
  vp.addEventListener("pointerdown", (e) => {
    if (!cropState) return;
    try { vp.setPointerCapture(e.pointerId); } catch (err) {}
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) drag = { x: e.clientX, y: e.clientY, tx: cropState.tx, ty: cropState.ty };
  });
  vp.addEventListener("pointermove", (e) => {
    if (!cropState || !pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size >= 2) {
      const arr = [...pts.values()];
      const d = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      if (cropState._pd) {
        cropState.z = Math.min(4, Math.max(1, cropState.z * (d / cropState._pd)));
        if (zoom) zoom.value = String(cropState.z);
        applyCropTransform();
      }
      cropState._pd = d;
    } else if (drag) {
      cropState.tx = drag.tx + (e.clientX - drag.x);
      cropState.ty = drag.ty + (e.clientY - drag.y);
      applyCropTransform();
    }
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2 && cropState) cropState._pd = 0; if (pts.size === 0) drag = null; };
  vp.addEventListener("pointerup", up);
  vp.addEventListener("pointercancel", up);
  vp.addEventListener("wheel", (e) => {
    if (!cropState) return;
    e.preventDefault();
    cropState.z = Math.min(4, Math.max(1, cropState.z + (e.deltaY < 0 ? 0.12 : -0.12)));
    if (zoom) zoom.value = String(cropState.z);
    applyCropTransform();
  }, { passive: false });
  document.querySelector("#cropCancel")?.addEventListener("click", closeAvatarCrop);
  if (box) box.addEventListener("click", (e) => { if (e.target === box) closeAvatarCrop(); });
  document.querySelector("#cropConfirm")?.addEventListener("click", confirmAvatarCrop);
}

function closeAvatarCrop() {
  const box = document.querySelector("#avatarCropBox");
  if (box) box.hidden = true;
  cropState = null;
}

function confirmAvatarCrop() {
  const c = cropState; if (!c) return;
  const out = 256;
  const canvas = document.createElement("canvas");
  canvas.width = out; canvas.height = out;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = "high";
  const disp = c.s0 * c.z;
  const srcSize = c.VP / disp;
  const natCx = c.natW / 2 - c.tx / disp;
  const natCy = c.natH / 2 - c.ty / disp;
  const sx = natCx - srcSize / 2, sy = natCy - srcSize / 2;
  const probe = new Image();
  probe.onload = () => {
    ctx.drawImage(probe, sx, sy, srcSize, srcSize, 0, 0, out, out);
    let url;
    try { url = canvas.toDataURL("image/jpeg", 0.92); } catch (e) { url = c.url; }
    state.customAvatars = state.customAvatars || [];
    if (state.customAvatars.length >= 6) state.customAvatars.shift();
    state.customAvatars.push(url);
    state.avatar = url;
    saveState();
    closeAvatarCrop();
    renderProfile();
    toast("已新增頭像。");
  };
  probe.src = c.url;
}

function removeCustomAvatar(url) {
  state.customAvatars = (state.customAvatars || []).filter((u) => u !== url);
  if (state.avatar === url) state.avatar = AVATARS[0];
  saveState();
  renderProfile();
}

function openProfile() { renderProfile(); const b = document.querySelector("#profileBox"); if (b) b.hidden = false; }
function closeProfile() { const b = document.querySelector("#profileBox"); if (b) b.hidden = true; }

function renderProfile() {
  const nameInput = document.querySelector("#profileName");
  if (nameInput) nameInput.value = state.nickname || "";
  const titleEl = document.querySelector("#profileTitle");
  if (titleEl) titleEl.textContent = playerTitle();
  const photo = document.querySelector("#profilePhoto");
  if (photo) {
    const a = state.avatar || "";
    photo.innerHTML = /^(data:|https?:|blob:)/.test(a)
      ? `<img class="avatar-img" src="${a}" alt="" />`
      : `<span class="profile-photo-emoji">${a}</span>`;
  }
  const av = document.querySelector("#profileAvatars");
  if (av) {
    const sel = state.avatar;
    const isImgAvatar = (a) => /^(data:|https?:|blob:)/.test(a);
    let html = AVATARS.map((e) => `<button type="button" class="avatar-btn ${isImgAvatar(e) ? "avatar-custom" : ""} ${sel === e ? "is-on" : ""}" data-avatar="${e}">${isImgAvatar(e) ? `<img class="avatar-img" src="${e}" alt="" />` : e}</button>`).join("");
    html += (state.customAvatars || []).map((u) => `<button type="button" class="avatar-btn avatar-custom ${sel === u ? "is-on" : ""}" data-avatar="${u}"><img class="avatar-img" src="${u}" alt="" /><span class="avatar-del" data-avatar-del="${u}" title="移除">✕</span></button>`).join("");
    html += `<button type="button" class="avatar-btn avatar-add" data-avatar-add="1" title="新增頭像">＋</button>`;
    av.innerHTML = html;
    av.querySelectorAll("[data-avatar]").forEach((b) => b.addEventListener("click", () => { state.avatar = b.dataset.avatar; saveState(); renderProfile(); }));
    const addBtn = av.querySelector("[data-avatar-add]");
    if (addBtn) addBtn.addEventListener("click", addCustomAvatar);
    av.querySelectorAll("[data-avatar-del]").forEach((b) => b.addEventListener("click", (e) => { e.stopPropagation(); removeCustomAvatar(b.dataset.avatarDel); }));
  }
  const s = state.stats || {};
  const help = (s.weed || 0) + (s.bug || 0) + (s.water || 0);
  const list = document.querySelector("#profileStats");
  if (list) list.innerHTML = [
    statLine("等級", "Lv." + state.level),
    statLine("金幣", state.coins),
    statLine("完成訂單", state.ordersCompleted || 0),
    statLine("好友數", (state.friends || []).length),
    statLine("累計種植", s.planted || 0),
    statLine("累計收成", s.harvested || 0),
    statLine("偷菜", s.stolen || 0),
    statLine("幫好友除草", s.weed || 0),
    statLine("幫好友除蟲", s.bug || 0),
    statLine("幫好友澆水", s.water || 0),
    statLine("幫助合計", help),
  ].join("");
}

function openGuide() { const b = document.querySelector("#guideBox"); if (b) b.hidden = false; }
function closeGuide() { const b = document.querySelector("#guideBox"); if (b) b.hidden = true; }
function openFarmSettings() { renderFarmSettings(); const b = document.querySelector("#farmBox"); if (b) b.hidden = false; }
function closeFarmSettings() { const b = document.querySelector("#farmBox"); if (b) b.hidden = true; }

function renderFarmSettings() {
  const nameInput = document.querySelector("#farmNameInput");
  if (nameInput) nameInput.value = state.farmName || "";
  const roleInput = document.querySelector("#roleNameInput");
  if (roleInput) roleInput.value = state.nickname || "";
  const plots = state.plots || [];
  const unlocked = plots.filter((p) => p.unlocked && !p.broken).length;
  const growing = plots.filter((p) => p.crop && getPlotProgress(p) < 1).length;
  const ready = plots.filter((p) => p.crop && getPlotProgress(p) >= 1).length;
  const broken = plots.filter((p) => p.broken).length;
  const list = document.querySelector("#farmStats");
  if (list) list.innerHTML = [
    statLine("已開墾田地", `${unlocked} / ${plots.length}`),
    statLine("種植中", growing),
    statLine("可收成", ready),
    statLine("損壞田", broken),
    statLine("農場等級", "Lv." + state.level),
  ].join("");
}

function render() {
  applyScene();
  applyFarmTitle();
  renderRanchAnimals();
  renderDogWalker();
  applyWeatherPassive();
  renderHeader();
  renderFarm();
  renderInventory();
  renderDamaged();
  renderRanchProducts();
  renderTabs();
  renderTabContent();
  hydrateIcons();
  updateGmBadge();
  updateGiftBadge();
  updateWeatherFx();
  applyAudio();
}

function updateWeatherFx() {
  const fx = document.querySelector("#weatherFx");
  if (!fx) return;
  // 超大牧場：關掉中央門的天氣粒子特效（保留天氣差底圖與音效）
  const hugeRanch = state.scene === "ranch" && (state.ranchLevel || 1) === 3;
  const curWeather = (visiting && visiting.weather) ? visiting.weather : state.weather;
  const w = (!hugeRanch && ["rain", "storm", "snow", "typhoon", "scorch", "breeze", "fog", "cloud"].includes(curWeather)) ? curWeather : "";
  fx.className = "wfx" + (w ? " " + w : "");
  applyClouds();
  applyBuildings();
  applyRanchBg();
}

// 每秒的輕量更新：只就地更新成長倒數與進度，不重建 DOM，避免畫面閃爍
function tick() {
  const now = Date.now();
  const delta = Math.min(now - lastTickTime, 3000);
  lastTickTime = now;
  applyWeatherPassive();
  applyFieldWeather(delta);
  rotateWeather();
  updateFarmTimers();
  friendStealTick(now);
  resolveThieves(now);
  maybeSpawnHazards(now);
  try { applyBuildings(); } catch (e) {}
  if (state.scene === "ranch") renderRanchAnimals();
  if (visiting) {
    if (visiting.kind === "npc") {
      const f = state.friends.find((x) => x.id === visiting.id);
      if (f) refreshFriendFarm(f);
    }
    renderVisitingFarm();
  }
  maybeRefreshOrders();
  const wp = document.querySelector(".work-panel");
  if (wp && wp.classList.contains("is-open") && state.activeTab === "orders") renderTabContent();
}

let lastHazardAt = 0;
function maybeSpawnHazards(now) {
  if (visiting || state.scene === "ranch") return;
  if (now - lastHazardAt < 18000) return;          // 每 18 秒檢查一次
  lastHazardAt = now;
  if (Math.random() > 0.35) return;                // 該次 35% 機率發生
  const elig = (state.plots || []).filter((p) => p.unlocked && p.crop && !p.pest && !p.weed && !p.thief && getPlotProgress(p) < 1);
  if (!elig.length) return;
  const p = elig[Math.floor(Math.random() * elig.length)];
  if (Math.random() < 0.5) { p.weed = true; } else { p.pest = true; p.pestBy = "system"; }
  p.hazardSince = Date.now();
  saveState();
  render();
  toast(p.weed ? "🌿 有一塊田長雜草了，生長暫停！用「除蟲/拔草」清除。" : "🐛 有一塊田鬧蟲害了，生長暫停！用「除蟲/拔草」清除。");
}

function gmSpawnThief() {
  if (isGuarded()) { toast("🛡️ 防盜卡生效中，目前不會被偷菜。"); return; }
  const cand = state.plots
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.crop && !p.thief && (p.stolenPct || 0) < 0.4);
  if (!cand.length) { toast("先種一塊作物再測試好友偷菜。"); return; }
  const ready = cand.filter(({ p }) => getPlotProgress(p) >= 1);
  const pool = ready.length ? ready : cand;
  const pick = pool[Math.floor(Math.random() * pool.length)];
  if (getPlotProgress(pick.p) < 1) {
    pick.p.plantedAt = Date.now() - getPlotDuration(pick.p) - 1000;
  }
  const name = (state.friends && state.friends.length)
    ? state.friends[Math.floor(Math.random() * state.friends.length)].name
    : "小偷";
  pick.p.thief = { name, expiresAt: Date.now() + 30000 };
  if (dogWorking() && Math.random() < DOG_CATCH) {
    pick.p.thief = null; dogBarkUntil = Date.now() + 10000; saveState(); render();
    toast(`🐕 看門狗趕走了 ${name}！`);
    return;
  }
  saveState();
  toast(`🦹 ${name} 來偷你的 ${CROPS[pick.p.crop].name}！點田地把他趕走（30 秒）。`);
  render();
}

function resolveThieves(now) {
  let changed = false;
  state.plots.forEach((p) => {
    if (p.thief && now >= p.thief.expiresAt) {
      const name = p.thief.name;
      const cropName = CROPS[p.crop] ? CROPS[p.crop].name : "作物";
      p.stolenPct = Math.min(0.4, (p.stolenPct || 0) + 0.2);
      p.thief = null;
      changed = true;
      toast(`${name} 偷走了你的${cropName}！`);
    }
  });
  if (changed) { saveState(); render(); }
}

function friendStealTick(now) {
  if (!state.friends || !state.friends.length) return;
  if (now - lastFriendSteal < 60000) return;
  lastFriendSteal = now;
  if (Math.random() > 0.45) return;
  const ready = state.plots
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.crop && getPlotProgress(p) >= 1 && (p.stolenPct || 0) < 0.4 && !p.thief);
  if (!ready.length) return;
  const pick = ready[Math.floor(Math.random() * ready.length)];
  const friend = state.friends[Math.floor(Math.random() * state.friends.length)];
  pick.p.thief = { name: friend.name, expiresAt: now + 30000 };
  if (dogWorking() && Math.random() < DOG_CATCH) {
    pick.p.thief = null; dogBarkUntil = Date.now() + 10000; saveState(); render();
    toast(`🐕 看門狗趕走了 ${friend.name}！`);
    return;
  }
  saveState();
  toast(`🦹 ${friend.name} 來偷你的 ${CROPS[pick.p.crop].name}！點田地把他趕走（30 秒）。`);
  render();
}

function applyTyphoonDamage() {
  const growing = state.plots
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.unlocked && !p.broken && p.crop && getPlotProgress(p) < 1);
  for (let k = growing.length - 1; k > 0; k--) {
    const j = Math.floor(Math.random() * (k + 1));
    [growing[k], growing[j]] = [growing[j], growing[k]];
  }
  growing.slice(0, 3).forEach(({ i }) => { state.plots[i].typhoonHalf = true; });
  const breakable = state.plots.map((p, i) => ({ p, i })).filter(({ p }) => p.unlocked && !p.broken);
  if (breakable.length) {
    const pick = breakable[Math.floor(Math.random() * breakable.length)].i;
    state.plots[pick] = { ...state.plots[pick], crop: null, plantedAt: 0, season: 0, soakMs: 0, frostMs: 0, typhoonHalf: false, watered: false, broken: true };
  }
  toast("颱風來襲！隨機吹壞一塊農地，另有三格作物收成減半。");
}

function repairPlot() {
  const index = state.plots.findIndex((p) => p.broken);
  if (index === -1) { toast("沒有損壞的農地。"); return; }
  if (state.coins < REPAIR_COST) { toast("金幣不夠修復。"); return; }
  state.coins -= REPAIR_COST;
  state.plots[index] = { ...state.plots[index], broken: false, crop: null, plantedAt: 0, season: 0, soakMs: 0, frostMs: 0, typhoonHalf: false, watered: false };
  toast("農地修復完成，可以再種植了。");
  saveState();
  render();
}

function applyFieldWeather(delta) {
  if (delta <= 0) return;
  const w = state.weather;
  if (w !== "storm" && w !== "snow") return;
  let changed = false;
  state.plots.forEach((plot) => {
    if (!plot.crop || getPlotProgress(plot) >= 1) return;
    if (w === "storm") { plot.soakMs = (plot.soakMs || 0) + delta; changed = true; }       // 雷雨浸水（永久扣收成）
    if (w === "snow") { plot.frostMs = Math.min(120000, (plot.frostMs || 0) + delta); changed = true; } // 下雪凍傷（最高10%，入災損）
  });
  if (changed) saveState();
}

function updateFarmTimers() {
  if (!elements.farmGrid) {
    return;
  }
  elements.farmGrid.querySelectorAll("[data-plot]").forEach((button) => {
    const index = Number(button.dataset.plot);
    const plot = state.plots[index];
    if (!plot || !plot.unlocked || !plot.crop) {
      return;
    }
    const progress = getPlotProgress(plot);
    const ready = progress >= 1;
    button.classList.toggle("ready", ready);
    button.classList.toggle("growing", !ready);
    button.classList.toggle("watered", !!plot.watered);

    const timeEl = button.querySelector(".plot-time");
    if (timeEl) {
      const remaining = Math.max(0, getPlotDuration(plot) * (1 - getPlotProgress(plot)));
      const text = ready ? "可收成" : formatTime(remaining);
      if (timeEl.textContent !== text) {
        timeEl.textContent = text;
      }
    }

    const thiefEl = button.querySelector(".thief-label");
    if (thiefEl && plot.thief) {
      thiefEl.textContent = `趕走 ${Math.max(0, Math.ceil((plot.thief.expiresAt - Date.now()) / 1000))}s`;
    }

    const meter = button.querySelector(".plot-meter span");
    if (meter) {
      meter.style.width = `${Math.min(100, Math.round(progress * 100))}%`;
    }

    const stage = getPlotStage(plot, progress);
    const img = button.querySelector(".crop-stage-image");
    if (img) {
      const suffix = `${plot.crop}-${stage}.png`;
      const cur = img.getAttribute("src") || "";
      if (!cur.endsWith(suffix)) {
        img.setAttribute("src", `./assets/crops/field/${suffix}?v=20260615-claude-016`);
        img.className = `crop-stage-image crop-${plot.crop} crop-stage-${stage}`;
      }
    }
  });
}

function renderHeader() {
  const requiredXp = xpToNextLevel();
  elements.coinValue.textContent = state.coins;
  elements.levelValue.textContent = `Lv. ${state.level}`;
  elements.xpFill.style.width = `${Math.min(100, Math.round((state.xp / requiredXp) * 100))}%`;
  elements.sceneCoinValue.textContent = state.coins;
  elements.sceneLevelValue.textContent = `Lv. ${state.level}`;
  elements.sceneXpFill.style.width = `${Math.min(100, Math.round((state.xp / requiredXp) * 100))}%`;
  if (elements.weatherValue) {
    elements.weatherValue.textContent = WEATHERS[state.weather].name;
  }
  elements.sceneWeatherValue.textContent = WEATHERS[state.weather].name;

  const seed = CROPS[state.selectedSeed];
  if (state.selectedTool === "seed") {
    elements.statusLine.textContent = `選中 ${seed.name}，空地點一下就能播種。`;
  } else if (state.selectedTool === "water") {
    elements.statusLine.textContent = "水壺已裝滿，幫作物加快成長。";
  } else {
    elements.statusLine.textContent = "成熟作物會亮起來，收成後放進倉庫。";
  }

  if (elements.sceneStatusLine) {
    elements.sceneStatusLine.textContent = elements.statusLine.textContent;
  }
}

function renderFarm() {
  if (visiting) { renderVisitingFarm(); return; }
  elements.farmGrid.className = "farm-grid";
  elements.farmGrid.innerHTML = state.plots
    .map((plot, index) => {
      if (!plot.unlocked) {
        return `
          <button class="plot locked" type="button" data-plot="${index}" data-slot="${index + 1}" title="未開墾">
            <span class="plot-stake plot-sign"${stakeStyle(index)} aria-hidden="true"><img src="./assets/sign-uncultivated.png" alt="" /></span>
          </button>
        `;
      }

      if (plot.broken) {
        return `
          <button class="plot broken" type="button" data-plot="${index}" data-slot="${index + 1}" title="損壞農地">
            <span class="plot-stake"${stakeStyle(index)} aria-hidden="true">🚩</span>
            <span class="plot-info">
              <span class="plot-label">損壞</span>
              <span class="plot-time">需修復</span>
            </span>
          </button>
        `;
      }

      if (!plot.crop) {
        return `
          <button class="plot empty" type="button" data-plot="${index}" data-slot="${index + 1}" title="空地">
            <span></span>
            <span class="plot-info">
              <span class="plot-label">空地</span>
              <span class="plot-time">可播種</span>
            </span>
          </button>
        `;
      }

      const crop = CROPS[plot.crop];
      const progress = getPlotProgress(plot);
      const ready = progress >= 1;
      const stage = getPlotStage(plot, progress);
      const remaining = Math.max(0, getPlotDuration(plot) - (Date.now() - plot.plantedAt));

      return `
        <button class="plot ${ready ? "ready" : "growing"} ${plot.watered ? "watered" : ""} ${plot.soakMs > 0 ? "soaked" : ""} ${state.weather === "snow" && !ready ? "frosted" : ""} ${plot.thief ? "has-thief" : ""}" type="button" data-plot="${index}" data-slot="${index + 1}" title="${crop.name}">
          ${plot.watered ? `<span class="water-badge" aria-hidden="true">${ICONS.drop}</span>` : ""}
          ${plot.soakMs > 0 ? `<span class="soak-badge" aria-hidden="true">💧浸水</span>` : ""}
          ${state.weather === "snow" && !ready ? `<span class="frost-badge" aria-hidden="true">❄️凍傷</span>` : ""}
          ${plot.typhoonHalf && !ready ? `<span class="typhoon-badge" aria-hidden="true">🌀颱風</span>` : ""}
          ${plot.stolenPct ? `<span class="stolen-badge" aria-hidden="true">🤏 -${Math.round(plot.stolenPct * 100)}%</span>` : ""}
          ${plot.pest ? `<span class="stolen-badge" aria-hidden="true">🐛 蟲害</span>` : ""}
          ${plot.weed ? `<span class="stolen-badge" aria-hidden="true">🌿 雜草</span>` : ""}
          ${plot.thief ? `<span class="thief-wrap" aria-hidden="true"><span class="thief-label">趕走 ${Math.max(0, Math.ceil((plot.thief.expiresAt - Date.now()) / 1000))}s</span><img class="thief-person" src="./assets/thief.png" alt="" draggable="false" /></span>` : ""}
          <span class="crop-visual">${cropVisual(plot.crop, stage)}</span>
          <span class="plot-info">
            <span class="plot-label">${crop.name}</span>
            <span class="plot-time">${ready ? "可收成" : formatTime(remaining)}</span>
            <span class="plot-meter" aria-hidden="true"><span style="width:${Math.min(100, Math.round(progress * 100))}%"></span></span>
          </span>
        </button>
      `;
    })
    .join("");

  elements.farmGrid.querySelectorAll("[data-plot]").forEach((plotButton) => {
    plotButton.addEventListener("click", () => handlePlotClick(Number(plotButton.dataset.plot)));
  });
  setupGmStakes();
}

function exportStakePos() {
  if (!elements.farmGrid) { toast("找不到農場。"); return; }
  const out = [];
  elements.farmGrid.querySelectorAll(".plot-stake").forEach((stake) => {
    const plot = stake.closest(".plot");
    if (!plot) return;
    const pr = plot.getBoundingClientRect();
    const sr = stake.getBoundingClientRect();
    if (!pr.width || !pr.height) return;
    const x = ((sr.left + sr.width / 2 - pr.left) / pr.width * 100).toFixed(1);
    const y = ((sr.top + sr.height / 2 - pr.top) / pr.height * 100).toFixed(1);
    out.push(`${plot.dataset.plot}:${x},${y}`);
  });
  const fx = document.querySelector("#weatherFx");
  const cl = [];
  if (fx) {
    const r = fx.getBoundingClientRect();
    fx.querySelectorAll(".wfx-cloud-img").forEach((img) => {
      const ir = img.getBoundingClientRect();
      if (ir.width <= 0) return;
      const x = ((ir.left - r.left) / r.width * 100).toFixed(1);
      const y = ((ir.top - r.top) / r.height * 100).toFixed(1);
      cl.push(`雲${img.dataset.cloud}:${x},${y}`);
    });
  }
  const bl = [];
  if (fx) {
    const r = fx.getBoundingClientRect();
    const wm = fx.querySelector("#bld-windmill");
    if (wm && wm.style.display !== "none") {
      const ir = wm.getBoundingClientRect();
      if (ir.width > 0) {
        const x = ((ir.left - r.left) / r.width * 100).toFixed(1);
        const y = ((ir.top - r.top) / r.height * 100).toFixed(1);
        bl.push(`風車:${x},${y}`);
      }
    }
    const dh = fx.querySelector("#bld-doghouse");
    if (dh && dh.style.display !== "none") {
      const ir = dh.getBoundingClientRect();
      if (ir.width > 0) {
        const x = ((ir.left - r.left) / r.width * 100).toFixed(1);
        const y = ((ir.top - r.top) / r.height * 100).toFixed(1);
        bl.push(`狗窩:${x},${y}`);
      }
    }
    const fsE = fx.querySelector("#bld-fishing");
    if (fsE && fsE.style.display !== "none") {
      const pos = gmBuildingPos.fishing || BUILDING_POS.fishing;
      bl.push(`釣魚:${pos[0]},${pos[1]}(縮放${(gmBuildingScale.fishing || 0.75).toFixed(2)}x)`);
    }
    const pondE = fx.querySelector("#bld-pond");
    if (pondE && pondE.style.display !== "none") {
      const pe = gmPondEllipse;
      bl.push(`水池橢圓:中心${pe.cx.toFixed(1)},${pe.cy.toFixed(1)} 半徑${pe.rx.toFixed(1)}x${pe.ry.toFixed(1)}`);
    }
  }
  if (!out.length && !cl.length && !bl.length) { toast("目前畫面沒有可匯出的座標。"); return; }
  const text = (out.length ? out.join(" | ") : "(無標桿)") + (cl.length ? "\n雲： " + cl.join(" | ") : "") + (bl.length ? "\n建築： " + bl.join(" | ") : "");
  try { if (navigator.clipboard) navigator.clipboard.writeText(text); } catch (e) {}
  try { console.log("STAKE_POS:", text); } catch (e) {}
  try { window.prompt("已複製，貼到對話給 Claude 即可：", text); } catch (e) {}
  toast("標桿座標已匯出（已複製到剪貼簿）。");
}

function setupGmStakes() {
  const readout = document.querySelector("#gmStakeReadout");
  if (readout) readout.hidden = !state.gm;
  if (!state.gm || !elements.farmGrid) return;
  if (!Object.keys(gmStakePos).length) {
    try { gmStakePos = JSON.parse(localStorage.getItem("gm-stake-pos") || "{}") || {}; } catch (e) { gmStakePos = {}; }
  }
  elements.farmGrid.querySelectorAll(".plot-stake").forEach((stake) => {
    const plot = stake.closest(".plot");
    if (!plot) return;
    const idx = Number(plot.dataset.plot);
    if (gmStakePos[idx]) {
      stake.style.left = gmStakePos[idx].x + "%";
      stake.style.top = gmStakePos[idx].y + "%";
      stake.style.transform = "translate(-50%, -50%)";
    }
    stake.style.pointerEvents = "auto";
    stake.style.cursor = "grab";
    let dragging = false;
    stake.addEventListener("pointerdown", (e) => {
      dragging = true;
      e.stopPropagation();
      e.preventDefault();
      try { stake.setPointerCapture(e.pointerId); } catch {}
    });
    stake.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const r = plot.getBoundingClientRect();
      let x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      let y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      const xp = (x * 100).toFixed(1), yp = (y * 100).toFixed(1);
      stake.style.left = xp + "%";
      stake.style.top = yp + "%";
      stake.style.transform = "translate(-50%, -50%)";
      gmStakePos[idx] = { x: xp, y: yp };
      if (readout) readout.textContent = `格#${idx + 1}｜left ${xp}%　top ${yp}%`;
    });
    const end = (e) => {
      if (!dragging) return;
      dragging = false;
      e.stopPropagation();
      try { stake.releasePointerCapture(e.pointerId); } catch {}
      try { localStorage.setItem("gm-stake-pos", JSON.stringify(gmStakePos)); } catch (err) {}
    };
    stake.addEventListener("pointerup", end);
    stake.addEventListener("pointercancel", end);
  });
}

function renderInventory() {
  const owned = Object.entries(CROPS).filter(([id]) => (state.inventory[id] || 0) > 0);
  if (!owned.length) {
    elements.inventoryList.innerHTML = '<p class="item-empty">目前沒有庫存物品。</p>';
    elements.sellAllButton.disabled = true;
    return;
  }
  elements.inventoryList.innerHTML = owned
    .map(([id, crop]) => {
      const count = state.inventory[id] || 0;
      return `
        <div class="inventory-row">
          <span class="mini-crop" aria-hidden="true">${cropCardVisual(id)}</span>
          <span>
            <span class="item-title">
              <strong>${crop.name}</strong>
              <span class="sell-stepper">
                <button class="qty-btn" type="button" data-qty-dec="${id}" aria-label="減少">−</button>
                <input class="qty-num" type="number" inputmode="numeric" data-qty="${id}" value="1" min="1" max="${count}" />
                <button class="qty-btn" type="button" data-qty-inc="${id}" aria-label="增加">＋</button>
              </span>
              <span class="count-max" data-max-for="${id}" title="點我填入最大數量">${count} 個</span>
            </span>
            <span class="item-meta">單價 ${sellPrice(id)} 金幣</span>
          </span>
          <button class="mini-sell" type="button" data-sell-item="${id}" title="出售${crop.name}" aria-label="出售${crop.name}" ${count <= 0 ? "disabled" : ""}>
            ${ICONS.cart}
          </button>
        </div>
      `;
    })
    .join("");

  const clampQty = (id) => {
    const inp = elements.inventoryList.querySelector('[data-qty="' + id + '"]');
    if (!inp) return 0;
    const max = state.inventory[id] || 0;
    let v = Math.floor(Number(inp.value) || 0);
    v = Math.max(1, Math.min(max, v));
    inp.value = v;
    return v;
  };
  elements.inventoryList.querySelectorAll("[data-qty-dec]").forEach((b) => b.addEventListener("click", () => {
    const inp = elements.inventoryList.querySelector('[data-qty="' + b.dataset.qtyDec + '"]');
    if (inp) { inp.value = (Number(inp.value) || 1) - 1; clampQty(b.dataset.qtyDec); }
  }));
  elements.inventoryList.querySelectorAll("[data-qty-inc]").forEach((b) => b.addEventListener("click", () => {
    const inp = elements.inventoryList.querySelector('[data-qty="' + b.dataset.qtyInc + '"]');
    if (inp) { inp.value = (Number(inp.value) || 0) + 1; clampQty(b.dataset.qtyInc); }
  }));
  elements.inventoryList.querySelectorAll("[data-qty]").forEach((inp) => inp.addEventListener("change", () => clampQty(inp.dataset.qty)));
  elements.inventoryList.querySelectorAll("[data-sell-item]").forEach((button) => {
    button.addEventListener("click", () => sellItem(button.dataset.sellItem, clampQty(button.dataset.sellItem)));
  });
  elements.inventoryList.querySelectorAll("[data-max-for]").forEach((el) => el.addEventListener("click", () => {
    const id = el.dataset.maxFor;
    const inp = elements.inventoryList.querySelector('[data-qty="' + id + '"]');
    if (inp) { inp.value = state.inventory[id] || 0; clampQty(id); }
  }));

  elements.sellAllButton.disabled = inventoryValue() <= 0;
}

function renderTabs() {
  document.querySelector(".farm-app")?.classList.toggle("is-watering-tool", state.selectedTool === "water" && state.scene !== "ranch");
  document.querySelector(".farm-app")?.classList.toggle("is-planting-tool", state.selectedTool === "seed" && state.scene !== "ranch");
  const workOpen = document.querySelector(".work-panel")?.classList.contains("is-open");

  document.querySelectorAll("[data-tool]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tool === state.selectedTool);
  });
  [["feed", "ranch-feed"], ["wash", "ranch-wash"], ["harvest", "ranch-harvest"]].forEach(([t, act]) => {
    const rb = document.querySelector('[data-action="' + act + '"]');
    if (rb) rb.classList.toggle("is-active", (state.ranchTool || "") === t);
  });

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("is-active", workOpen && button.dataset.tab === state.activeTab);
  });
  const invOpen = document.querySelector(".inventory-panel")?.classList.contains("is-open");
  document.querySelectorAll('[data-panel-target="inventory"]').forEach((button) => {
    button.classList.toggle("is-active", !!invOpen);
  });

  const wpEl = document.querySelector(".work-panel");
  if (wpEl) wpEl.setAttribute("data-tab", state.activeTab);
  if (elements.workPanelTitle) {
    const titles = { shop: "行囊", market: "農民市集", orders: "訂單", upgrades: "開發" };
    if (state.activeTab === "upgrades" || state.activeTab === "shop") {
      elements.workPanelTitle.style.display = "none";
    } else {
      elements.workPanelTitle.style.display = "";
      elements.workPanelTitle.textContent = titles[state.activeTab] || "農場管理";
    }
  }
}

function renderTabContent() {
  if (state.activeTab === "market") {
    renderMarket();
    return;
  }
  if (state.activeTab === "orders") {
    renderOrders();
    return;
  }

  if (state.activeTab === "upgrades") {
    renderUpgrades();
    return;
  }

  renderShop();
}

function renderShop() {
  const bagSeedCards = Object.entries(CROPS)
    .map(([id, crop]) => {
      const locked = crop.unlock > state.level;
      const selected = state.selectedSeed === id;
      return `
        <article class="seed-card ${locked ? "is-locked" : ""}">
          <span class="seed-lv">Lv.${crop.unlock}</span>
          <span class="mini-crop" aria-hidden="true">${cropCardVisual(id)}</span>
          <span class="seed-details">
            <span class="seed-title">
              <span class="seed-name-wrap">
                <strong>${crop.name}</strong>
                <span class="seed-grow-pill">⏱ ${formatMinutes(crop.grow)}</span>
              </span>
              <span class="seed-price">${crop.cost} 金幣</span>
            </span>
            <span class="seed-meta">收成價 ${sellPrice(id)} · 產量 ${crop.yieldCount} · 經驗 ${crop.xp}</span>
            <span class="seed-buy">
              <button class="seed-step" type="button" data-seed-dec="${id}" ${locked ? "disabled" : ""}>−</button>
              <input class="seed-qty" type="number" inputmode="numeric" min="1" data-seed-qty="${id}" value="${shopQty[id] || 1}" ${locked ? "disabled" : ""} />
              <button class="seed-step" type="button" data-seed-inc="${id}" ${locked ? "disabled" : ""}>＋</button>
              <span class="seed-own">背包內有 <span class="seed-own-num">${state.seeds[id] || 0}</span> 個</span>
              <button class="seed-buy-btn" type="button" data-seed-buy="${id}" ${locked ? "disabled" : ""}>購買</button>
            </span>
            <span class="seed-actions">
              <button class="seed-button ${selected ? "is-active" : ""}" type="button" data-seed-choice="${id}" ${locked ? "disabled" : ""}>
                <span class="button-icon" aria-hidden="true" data-icon="${selected ? "check" : "seed"}"></span>
                ${selected ? "種這個" : "選來種"}
              </button>
            </span>
          </span>
        </article>
      `;
    })
    .join("");

  elements.tabContent.innerHTML = `
    <div class="inv-split bag-split">
      <div class="inv-col bag-item-col">
        <div class="panel-head"><h2>道具</h2></div>
        <div class="bag-col-body inventory-list" id="bagItemBody"></div>
      </div>
      <div class="inv-col bag-seed-col">
        <div class="panel-head"><h2>種子</h2></div>
        <div class="bag-col-body" id="bagSeedBody">${bagSeedCards}</div>
      </div>
    </div>`;
  renderItemList();

  elements.tabContent.querySelectorAll("[data-seed-choice]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedSeed = button.dataset.seedChoice;
      state.selectedTool = "seed";
      saveState();
      render();
    });
  });
  elements.tabContent.querySelectorAll("[data-seed-buy]").forEach((button) => {
    button.addEventListener("click", () => buySeed(button.dataset.seedBuy));
  });
  elements.tabContent.querySelectorAll("[data-seed-inc]").forEach((button) => {
    button.addEventListener("click", () => setShopQty(button.dataset.seedInc, (shopQty[button.dataset.seedInc] || 1) + 1));
  });
  elements.tabContent.querySelectorAll("[data-seed-dec]").forEach((button) => {
    button.addEventListener("click", () => setShopQty(button.dataset.seedDec, (shopQty[button.dataset.seedDec] || 1) - 1));
  });
  elements.tabContent.querySelectorAll("[data-seed-qty]").forEach((input) => {
    input.addEventListener("change", () => setShopQty(input.dataset.seedQty, Math.floor(Number(input.value) || 1)));
  });
}

function setShopQty(id, value) {
  shopQty[id] = Math.max(1, Math.floor(value) || 1);
  const input = elements.tabContent.querySelector(`[data-seed-qty="${id}"]`);
  if (input) input.value = shopQty[id];
}

function buySeed(id) {
  const crop = CROPS[id];
  if (!crop) return;
  if (crop.unlock > state.level) {
    toast("這包種子還沒解鎖。");
    return;
  }
  const qty = Math.max(1, Math.floor(shopQty[id] || 1));
  const cost = crop.cost * qty;
  if (state.coins < cost) {
    toast(`金幣不夠，購買 ${qty} 包要 ${cost} 金幣。`);
    return;
  }
  state.coins -= cost;
  state.seeds[id] = (state.seeds[id] || 0) + qty;
  toast(`購買 ${crop.name} 種子 ×${qty}，花了 ${cost} 金幣。`);
  saveState();
  render();
}

function marketRow(key, name, cost, desc, opts) {
  opts = opts || {};
  const have = (state.items && state.items[key]) || 0;
  const locked = !!opts.locked;
  return `
    <article class="seed-card ${locked ? "is-locked" : ""}">
      <span class="mini-crop market-icon" aria-hidden="true">${name.split(" ")[0]}</span>
      <span class="seed-details">
        <span class="seed-title">
          <span class="seed-name-wrap"><strong>${name}</strong></span>
          <span class="seed-price">${cost} 金幣</span>
        </span>
        <span class="seed-meta">${desc}</span>
        <span class="seed-actions">
          <span class="seed-meta">持有 ${have}</span>
          <button class="seed-button" type="button" data-buy="${key}" ${locked ? "disabled" : ""}>
            <span class="button-icon" aria-hidden="true" data-icon="cart"></span>
            ${locked ? (opts.lockText || "未解鎖") : "購買"}
          </button>
        </span>
      </span>
    </article>`;
}

function renderMarket() {
  const sold = Math.min(10, state.animalsSoldForCard || 0);
  const expLocked = (state.animalsSoldForCard || 0) < 10;
  elements.tabContent.innerHTML =
    marketRow("fertilizer", "🌱 肥料", FERTILIZER_COST, "對一塊田施肥，剩餘成長時間減半（一作物限一次）") +
    marketRow("thawCard", "🃏 解凍卡", THAW_CARD_COST, "對凍傷作物完全返還最多 50 個（在災損清單使用）") +
    marketRow("expandCard", "🏗️ 牧場擴建卡", 20000,
      "小牧場升級大牧場時消耗。<br>解鎖：售出動物 " + sold + "/10",
      { locked: expLocked, lockText: "售出動物 " + sold + "/10" }) +
    marketRow("dogStick", "🦴 逗狗棒", 300, "參觀好友時逗牠家的狗，每次好感度 +5%（好感越高越不會被趕）");
  elements.tabContent.querySelectorAll("[data-buy]").forEach((b) => {
    b.addEventListener("click", () => {
      if (b.dataset.buy === "fertilizer") buyFertilizer();
      if (b.dataset.buy === "thawCard") buyThawCard();
      if (b.dataset.buy === "expandCard") buyExpandCard();
      if (b.dataset.buy === "dogStick") buyDogStick();
    });
  });
}

function buyDogStick() {
  const cost = 300;
  if (state.coins < cost) { toast("金幣不夠，逗狗棒需要 300 金幣。"); return; }
  state.coins -= cost;
  state.items = state.items || {};
  state.items.dogStick = (state.items.dogStick || 0) + 1;
  saveState(); render();
  toast("購買逗狗棒 ×1（花費 300 金幣）。");
}

function buyExpandCard() {
  const cost = 20000;
  if ((state.animalsSoldForCard || 0) < 10) { toast("要累計售出 10 隻動物才能購買。"); return; }
  if (state.coins < cost) { toast("金幣不夠，牧場擴建卡需要 20000 金幣。"); return; }
  state.coins -= cost;
  state.items = state.items || {};
  state.items.expandCard = (state.items.expandCard || 0) + 1;
  saveState(); render();
  toast("購買牧場擴建卡 ×1（花費 20000 金幣）。");
}

function renderOrders() {
  maybeRefreshOrders();
  const now = Date.now();
  const remain = Math.max(0, (state.ordersRefreshAt || now) - now);
  const mm = Math.floor(remain / 60000);
  const ss = String(Math.floor(remain / 1000) % 60).padStart(2, "0");
  const today = state.ordersToday || 0;
  const capped = today >= ORDER_DAILY_CAP;
  const head = `<div class="order-head">下次刷新 ${mm}:${ss}　·　今日 ${today}/${ORDER_DAILY_CAP}${capped ? "（已額滿）" : ""}</div>`;
  elements.tabContent.innerHTML = head + state.orders
    .map((order) => {
      const canFill = canCompleteOrder(order);
      const done = !!order.done;
      return `
        <article class="order-card ${done ? "is-done" : ""} ${order.big ? "is-big" : ""}">
          ${order.big ? `<span class="order-big">⭐ 大單・量大報酬高・滿經驗</span>` : ""}
          <div class="order-row">
            <div class="order-items">
              ${order.items
                .map((item) => {
                  const have = state.inventory[item.crop] || 0;
                  const ready = have >= item.count;
                  return `
                    <span class="order-item ${ready ? "is-ready" : "is-short"}">
                      <span>${CROPS[item.crop].name}</span>
                      <strong>${have}/${item.count}</strong>
                    </span>
                  `;
                })
                .join("")}
            </div>
            <div class="order-reward">
              <span class="reward-pill reward-coin">${ICONS.coin}<strong>${order.reward}</strong></span>
              <span class="reward-pill reward-xp">${ICONS.star}<strong>${order.xp}</strong> XP</span>
            </div>
          </div>
          <button class="action-button" type="button" data-complete-order="${order.id}" ${done || !canFill || capped ? "disabled" : ""}>
            <span class="button-icon" aria-hidden="true" data-icon="check"></span>
            ${done ? "已完成" : "完成訂單"}
          </button>
        </article>
      `;
    })
    .join("");

  elements.tabContent.querySelectorAll("[data-complete-order]").forEach((button) => {
    button.addEventListener("click", (e) => { e.stopPropagation(); completeOrder(button.dataset.completeOrder); });
  });
}

function renderUpgrades() {
  const nextLockedIndex = state.plots.findIndex((plot) => !plot.unlocked);
  const plotInfo = nextPlotInfo();
  const canPlot = !!plotInfo && state.level >= plotInfo.level && state.coins >= plotInfo.cost;
  const plotRow =
    nextLockedIndex === -1 || !plotInfo
      ? `
        <article class="upgrade-row">
          <span class="upgrade-title"><strong>開墾田地</strong><span>完成</span></span>
          <span class="upgrade-meta">所有田地都能使用了。</span>
        </article>
      `
      : `
        <article class="upgrade-row">
          <span class="upgrade-title"><strong>開墾田地</strong><span>${plotInfo.cost} 金幣</span></span>
          <span class="upgrade-meta">需 Lv.${plotInfo.level}，增加 1 格可種植的田地。</span>
          <button class="action-button" type="button" data-buy-plot ${canPlot ? "" : "disabled"}>
            <span class="button-icon" aria-hidden="true" data-icon="hammer"></span>
            開墾
          </button>
        </article>
      `;

  const upgradeRows = Object.entries(UPGRADES)
    .map(([id, upgrade]) => {
      const level = state.upgrades[id] || 0;
      const complete = level >= upgrade.max;
      const n = level + 1;
      const cost = complete ? 0 : upgrade.cost(n);
      const reqLv = complete ? 0 : upgrade.reqLevel(n);
      const reqOrders = complete ? 0 : upgrade.reqOrders(n);
      const done = state.ordersCompleted || 0;
      const reqText = [];
      if (!complete && reqLv > 1) reqText.push(`需農場 Lv.${reqLv}`);
      if (!complete && reqOrders > 0) reqText.push(`完成訂單 ${done}/${reqOrders}`);
      const meet = !complete && state.level >= reqLv && done >= reqOrders && state.coins >= cost;
      const btnLabel = level === 0 ? "啟用" : "升級";
      return `
        <article class="upgrade-row">
          <span class="upgrade-title">
            <strong>${upgrade.name} Lv.${level}/${upgrade.max}</strong>
            <span>${complete ? "滿級" : `${cost} 金幣`}</span>
          </span>
          <span class="upgrade-meta">${typeof upgrade.description === "function" ? upgrade.description(level) : upgrade.description}${reqText.length ? `（${reqText.join("、")}）` : ""}</span>
          <button class="action-button" type="button" data-buy-upgrade="${id}" ${complete || !meet ? "disabled" : ""}>
            <span class="button-icon" aria-hidden="true" data-icon="${upgrade.icon}"></span>
            ${complete ? "滿級" : btnLabel}
          </button>
        </article>
      `;
    })
    .join("");

  const brokenCount = state.plots.filter((p) => p.broken).length;
  const canRepair = brokenCount > 0 && state.coins >= REPAIR_COST;
  const repairRow = brokenCount === 0
    ? `
        <article class="upgrade-row">
          <span class="upgrade-title"><strong>損壞農地修復</strong><span>無損壞</span></span>
          <span class="upgrade-meta">目前沒有被颱風吹壞的農地。</span>
        </article>
      `
    : `
        <article class="upgrade-row">
          <span class="upgrade-title"><strong>損壞農地修復</strong><span>${REPAIR_COST} 金幣</span></span>
          <span class="upgrade-meta">有 ${brokenCount} 塊農地被颱風吹壞，修復後恢復可種植。</span>
          <button class="action-button" type="button" data-repair-plot ${canRepair ? "" : "disabled"}>
            <span class="button-icon" aria-hidden="true" data-icon="hammer"></span>
            修復
          </button>
        </article>
      `;

  const dogBought = state.doghouseBought;
  const dogCost = 10000;
  const canBuyDog = !dogBought && state.coins >= dogCost;
  const doghouseBuyRow = dogBought
    ? `
        <article class="upgrade-row">
          <span class="upgrade-title"><strong>狗窩</strong><span>已購買</span></span>
          <span class="upgrade-meta">農場上點狗窩可以養看門狗。</span>
        </article>
      `
    : `
        <article class="upgrade-row">
          <span class="upgrade-title"><strong>狗窩</strong><span>${dogCost} 金幣</span></span>
          <span class="upgrade-meta">買了會出現在農場，可養看門狗顧家、嚇小偷。</span>
          <button class="action-button" type="button" data-buy-doghouse ${canBuyDog ? "" : "disabled"}>
            <span class="button-icon" aria-hidden="true" data-icon="hammer"></span>
            購買
          </button>
        </article>
      `;
  const facilityHtml = upgradeRows + doghouseBuyRow;
  const farmHtml = plotRow + repairRow;
  const ranchHtml = ranchBuildRows();
  elements.tabContent.innerHTML = `
    <div class="inv-split build-split">
      <div class="inv-col facbuild-col">
        <div class="panel-head"><h2>設施建設</h2></div>
        <div class="build-col-body">${facilityHtml}</div>
      </div>
      <div class="inv-col farmbuild-col">
        <div class="panel-head"><h2>農地建設</h2></div>
        <div class="build-col-body">${farmHtml}</div>
      </div>
      <div class="inv-col ranchbuild-col">
        <div class="panel-head"><h2>牧場建設</h2></div>
        <div class="build-col-body">${ranchHtml}</div>
      </div>
    </div>
  `;

  const plotButton = elements.tabContent.querySelector("[data-buy-plot]");
  if (plotButton) {
    plotButton.addEventListener("click", buyPlot);
  }

  const repairBtn = elements.tabContent.querySelector("[data-repair-plot]");
  if (repairBtn) repairBtn.addEventListener("click", repairPlot);
  const dogBuyBtn = elements.tabContent.querySelector("[data-buy-doghouse]");
  if (dogBuyBtn) dogBuyBtn.addEventListener("click", buyDoghouse);

  elements.tabContent.querySelectorAll("[data-buy-upgrade]").forEach((button) => {
    button.addEventListener("click", () => buyUpgrade(button.dataset.buyUpgrade));
  });

  const ranchUpBtn = elements.tabContent.querySelector("[data-ranch-upgrade]");
  if (ranchUpBtn) ranchUpBtn.addEventListener("click", doRanchUpgrade);
}

function ranchBuildRows() {
  const lvl = state.ranchLevel || 1;
  const curName = RANCH_LEVEL_NAMES[lvl] || "小牧場";
  const up = RANCH_UPGRADES.find((u) => u.from === lvl);
  if (!up) {
    return `
      <article class="upgrade-row">
        <span class="upgrade-title"><strong>牧場升級</strong><span>最高級</span></span>
        <span class="upgrade-meta">目前為${curName}，已達最高等級，無法再擴建。</span>
      </article>
    `;
  }
  const cardHave = (state.items && state.items[up.card]) || 0;
  const meet = state.coins >= up.coins && cardHave >= 1;
  return `
    <article class="upgrade-row">
      <span class="upgrade-title">
        <strong>牧場升級　${curName} → ${up.name}</strong>
        <span>${up.coins} 金幣</span>
      </span>
      <span class="upgrade-meta">另需 ${up.cardName} ×1（持有 ${cardHave} 張）。升級後牧場空間更大、可養更多動物。</span>
      <button class="action-button" type="button" data-ranch-upgrade ${meet ? "" : "disabled"}>
        <span class="button-icon" aria-hidden="true" data-icon="hammer"></span>
        升級
      </button>
    </article>
  `;
}

function doRanchUpgrade() {
  const lvl = state.ranchLevel || 1;
  const up = RANCH_UPGRADES.find((u) => u.from === lvl);
  if (!up) return;
  const cardHave = (state.items && state.items[up.card]) || 0;
  if (state.coins < up.coins) { toast("金幣不足。"); return; }
  if (cardHave < 1) { toast("缺少" + up.cardName + "。"); return; }
  state.coins -= up.coins;
  state.items[up.card] = cardHave - 1;
  state.ranchLevel = up.to;
  saveState();
  applyRanchBg();
  renderUpgrades();
  render();
  toast("牧場已升級為" + up.name + "！");
}

function handlePlotClick(index) {
  const plot = state.plots[index];
  if (!plot.unlocked) {
    state.activeTab = "upgrades";
    toast("這格還沒開墾，去開發頁買一格田地。");
    render();
    return;
  }

  if (plot.broken) {
    state.activeTab = "upgrades";
    toast("這塊農地被颱風吹壞了，到「開發→損壞農地修復」修復。");
    render();
    return;
  }

  if (plot.thief) {
    const name = plot.thief.name;
    plot.thief = null;
    toast(`趕走了 ${name}！作物保住了。`);
    saveState();
    render();
    return;
  }

  if (pendingFertilize) {
    applyFertilizer(index);
    return;
  }

  if (state.selectedTool === "clean") {
    if (plot.pest || plot.weed) {
      const what = (plot.pest && plot.weed) ? "蟲害和雜草" : plot.pest ? "蟲害" : "雜草";
      if (plot.hazardSince) { plot.pausedMs = (plot.pausedMs || 0) + (Date.now() - plot.hazardSince); plot.hazardSince = 0; }
      plot.pest = false; plot.weed = false; plot.pestBy = null;
      saveState(); render(); toast("清除了" + what + "，作物恢復生長 🌱");
    } else {
      toast("這格沒有蟲害或雜草。");
    }
    return;
  }

  if (plot.crop && getPlotProgress(plot) >= 1) {
    harvestPlot(index);
    return;
  }

  if (state.selectedTool === "water") {
    waterPlot(index);
    return;
  }

  if (state.selectedTool === "harvest") {
    toast(plot.crop ? "還沒成熟，再等一下。" : "這格還沒有作物。");
    return;
  }

  if (state.selectedTool === "seed") {
    if (!plot.crop) {
      plantPlot(index);
      return;
    }
    toast(plot.watered ? "它正在長大。" : "換成澆水工具可以加快成長。");
    return;
  }

  toast("先點下方工具（種植／澆水／收成）再操作田地。");
}

function plantPlot(index) {
  const crop = CROPS[state.selectedSeed];
  if (!crop || crop.unlock > state.level) {
    toast("這包種子還沒解鎖。");
    return;
  }

  if ((state.seeds[state.selectedSeed] || 0) < 1) {
    toast(`背包沒有${crop.name}種子，先到商店購買。`);
    return;
  }

  state.seeds[state.selectedSeed] -= 1;
  if (state.stats) state.stats.planted = (state.stats.planted || 0) + 1;
  state.plots[index] = {
    ...state.plots[index],
    crop: state.selectedSeed,
    plantedAt: Date.now(),
    season: 0,
    fertilized: false,
    soakMs: 0,
    frostMs: 0,
    typhoonHalf: false,
    stolenPct: 0,
    thief: null,
    pest: false,
    weed: false,
    pestUsed: false,
    pausedMs: 0,
    hazardSince: 0,
    watered: state.weather === "rain",
  };
  toast(`${crop.name} 已播種。`);
  saveState();
  render();
}

function waterPlot(index) {
  const plot = state.plots[index];
  if (!plot.crop) {
    toast("空地不用澆水。");
    return;
  }

  if (getPlotProgress(plot) >= 1) {
    toast("已經成熟了，直接收成吧。");
    return;
  }

  if (plot.soakMs > 0) {
    toast("田裡浸水中，水太多了，不能再澆水。");
    return;
  }

  if (plot.watered) {
    toast("這格已經喝飽水了。");
    return;
  }

  plot.watered = true;
  toast("澆水完成，成長速度加快。");
  saveState();
  render();
}

function harvestPlot(index) {
  const plot = state.plots[index];
  if (!plot.crop) { toast("這格還沒有作物。"); return; }
  if (getPlotProgress(plot) < 1) { toast("再等一下，作物還沒成熟。"); return; }
  const msg = doHarvest(index);
  saveState();
  render();
  if (fbUser) publishProfile(true);
  if (msg) toast(msg);
}

function doHarvest(index) {
  const plot = state.plots[index];
  if (!plot.crop) return "";
  const crop = CROPS[plot.crop];
  const bonus = plot.watered && Math.random() < 0.24 ? 1 : 0;
  const soakMin = (plot.soakMs || 0) / 60000;
  const soakPenalty = plot.soakMs > 0 ? Math.min(0.8, 0.05 + soakMin * 0.05) : 0;
  const frostPenalty = Math.min(0.10, ((plot.frostMs || 0) / 60000) * 0.05);
  const afterSoak = ((crop.yieldCount || 1) + bonus) * (1 - soakPenalty);
  const frostLost = Math.round(afterSoak * frostPenalty);
  let amount = Math.max(1, Math.round(afterSoak) - frostLost);
  if (plot.typhoonHalf) amount = Math.max(1, Math.round(amount * 0.5));
  if (plot.stolenPct) amount = Math.max(1, Math.round(amount * (1 - plot.stolenPct)));
  state.inventory[plot.crop] = (state.inventory[plot.crop] || 0) + amount;
  if (state.stats) state.stats.harvested = (state.stats.harvested || 0) + amount;
  if (frostLost > 0) {
    if (!state.damaged) state.damaged = {};
    state.damaged[plot.crop] = (state.damaged[plot.crop] || 0) + frostLost;
  }
  addXp(crop.xp);
  const notes = [];
  if (soakPenalty > 0) notes.push(`浸水 -${Math.round(soakPenalty * 100)}%`);
  if (frostLost > 0) notes.push(`凍傷 ${frostLost} 個入災損`);
  if (plot.typhoonHalf) notes.push("颱風 -50%");
  if (plot.stolenPct) notes.push(`被偷 -${Math.round(plot.stolenPct * 100)}%`);
  const penaltyNote = notes.length ? `（${notes.join("、")}）` : "";
  const season = plot.season || 0;
  const seasons = crop.seasons || 1;
  if (season + 1 < seasons) {
    state.plots[index] = { ...plot, plantedAt: Date.now(), season: season + 1, soakMs: 0, frostMs: 0, typhoonHalf: false, pest: false, weed: false, pestUsed: false, pausedMs: 0, hazardSince: 0, watered: false };
    return `${crop.name} 收成 ${amount} 個，還會再長第 ${season + 2} 季。${penaltyNote}`;
  }
  state.plots[index] = { ...plot, crop: null, plantedAt: 0, season: 0, soakMs: 0, frostMs: 0, typhoonHalf: false, stolenPct: 0, thief: null, pest: false, weed: false, pestUsed: false, pausedMs: 0, hazardSince: 0, watered: false };
  return `${crop.name} 收成 ${amount} 個。${penaltyNote}`;
}

function showActionConfirm(msg, onYes) {
  const old = document.querySelector("#actConfirm"); if (old) old.remove();
  const m = document.createElement("div");
  m.id = "actConfirm";
  m.innerHTML = '<div class="act-confirm-card"><p>' + msg + '</p>' +
    '<div class="act-confirm-btns"><button type="button" id="actYes">確定</button>' +
    '<button type="button" id="actNo">取消</button></div></div>';
  document.body.appendChild(m);
  m.querySelector("#actYes").addEventListener("click", () => { m.remove(); onYes(); });
  m.querySelector("#actNo").addEventListener("click", () => m.remove());
  m.addEventListener("click", (e) => { if (e.target === m) m.remove(); });
}

function oneClickFarm() {
  if (state.scene === "ranch" || visiting) { toast("請在農場模式使用。"); return; }
  let count = 0;
  (state.plots || []).forEach((p) => {
    if (!p.unlocked || !p.crop) return;
    if (p.pest || p.weed) count++;
    if (getPlotProgress(p) >= 1) count++;
    else if (!p.watered) count++;
  });
  if (!count) { toast("目前沒有可一鍵完成的動作。"); return; }
  const cost = count * 20;
  if (state.coins < cost) { toast("金幣不夠，一鍵完成需要 " + cost + " 金幣。"); return; }
  showActionConfirm("一鍵完成 " + count + " 個動作<br>（除蟲拔草／澆水／收成），共收 <b>" + cost + "</b> 金幣？", () => {
    state.coins -= cost;
    (state.plots || []).forEach((p, i) => {
      if (!p.unlocked || !p.crop) return;
      if (p.pest || p.weed) {
        if (p.hazardSince) { p.pausedMs = (p.pausedMs || 0) + (Date.now() - p.hazardSince); p.hazardSince = 0; }
        p.pest = false; p.weed = false; p.pestBy = null;
      }
      if (getPlotProgress(p) >= 1) { doHarvest(i); }
      else if (!p.watered) { p.watered = true; }
    });
    saveState(); render();
    if (fbUser) publishProfile(true);
    toast("一鍵完成 " + count + " 個動作，花了 " + cost + " 金幣。");
  });
}

function oneClickRanch() {
  if (state.scene !== "ranch" || visiting) { toast("請在牧場模式使用。"); return; }
  const list = state.ranchAnimals || [];
  const now = Date.now();
  // 乾跑計算：洗澡→收成→(收成後再)洗澡→餵食，只算會發生效果的
  let count = 0;
  list.forEach((a) => {
    const cfg = RANCH_ANIMALS[a.type]; if (!cfg) return;
    let dirty = a.dirty, fedAt = a.fedAt;
    if (dirty) { count++; dirty = false; }
    if (fedAt && now - fedAt >= cfg.growMs) { count++; fedAt = 0; dirty = true; }
    if (dirty) { count++; dirty = false; }
    if (!fedAt) { count++; }
  });
  if (!count) { toast("目前沒有可一鍵完成的動作。"); return; }
  const cost = count * 20;
  if (state.coins < cost) { toast("金幣不夠，一鍵完成需要 " + cost + " 金幣。"); return; }
  showActionConfirm("一鍵完成 " + count + " 個動作<br>（洗澡／收成／餵食），共收 <b>" + cost + "</b> 金幣？", () => {
    state.coins -= cost;
    list.forEach((a) => {
      const cfg = RANCH_ANIMALS[a.type]; if (!cfg) return;
      if (a.dirty) { a.dirty = false; a.dirtyBy = null; }                        // 1.洗澡(原有髒污/被噴)
      if (a.fedAt && now - a.fedAt >= cfg.growMs) {                              // 2.收成
        const y = 3 + Math.floor(Math.random() * 3);
        state.ranchProducts = state.ranchProducts || {};
        state.ranchProducts[a.type] = (state.ranchProducts[a.type] || 0) + y;
        a.produced = (a.produced || 0) + 1; a.fedAt = 0; a.dirty = true; a.dirtyBy = "system";
      }
      if (a.dirty) { a.dirty = false; a.dirtyBy = null; }                        // 3.收成後再洗澡
      if (!a.fedAt) { a.fedAt = now; }                                          // 4.餵食
    });
    saveState(); render();
    if (fbUser) publishProfile(true);
    toast("一鍵完成 " + count + " 個動作，花了 " + cost + " 金幣。");
  });
}

function restOneDay() {
  const weatherIds = Object.keys(WEATHERS);
  state.day += 1;
  state.weather = weatherIds[Math.floor(Math.random() * weatherIds.length)];
  if (state.weather === "rain") {
    state.plots.forEach((plot) => {
      if (plot.crop) {
        plot.watered = true;
      }
    });
  }
  toast(`${WEATHERS[state.weather].name}，${WEATHERS[state.weather].line}`);
  saveState();
  render();
}

function sellItem(id, qty) {
  const count = state.inventory[id] || 0;
  if (count <= 0) {
    return;
  }
  let n = Math.floor(Number(qty) || count);
  n = Math.max(1, Math.min(count, n));
  const earned = n * sellPrice(id);
  state.inventory[id] = count - n;
  state.coins += earned;
  toast(`${CROPS[id].name} 售出 ${n} 個，獲得 ${earned} 金幣。`);
  saveState();
  render();
}

function sellAllInventory() {
  const earned = inventoryValue();
  if (earned <= 0) {
    toast("倉庫目前是空的。");
    return;
  }

  Object.keys(state.inventory).forEach((id) => {
    state.inventory[id] = 0;
  });
  state.coins += earned;
  toast(`倉庫清出去了，獲得 ${earned} 金幣。`);
  saveState();
  render();
}

function completeOrder(orderId) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order || order.done) return;
  if ((state.ordersToday || 0) >= ORDER_DAILY_CAP) {
    toast(`今天訂單已達上限（${ORDER_DAILY_CAP} 張），明天再來。`);
    return;
  }
  if (!canCompleteOrder(order)) {
    toast("訂單材料還不夠。");
    return;
  }
  order.items.forEach((item) => {
    state.inventory[item.crop] -= item.count;
  });
  state.coins += order.reward;
  addXp(order.xp);
  state.ordersCompleted = (state.ordersCompleted || 0) + 1;
  state.ordersToday = (state.ordersToday || 0) + 1;
  order.done = true;
  toast(`訂單完成，收到 ${order.reward} 金幣。`);
  saveState();
  render();
}

function buyPlot() {
  const index = state.plots.findIndex((plot) => !plot.unlocked);
  if (index === -1) {
    toast("所有田地都開墾好了。");
    return;
  }

  const info = nextPlotInfo();
  if (!info) {
    toast("已達開墾上限。");
    return;
  }
  if (state.level < info.level) {
    toast(`需要 Lv.${info.level} 才能開墾下一格。`);
    return;
  }
  if (state.coins < info.cost) {
    toast("金幣不夠開墾。");
    return;
  }

  state.coins -= info.cost;
  state.plots[index].unlocked = true;
  toast("新田地開好了。");
  saveState();
  render();
}

function buyUpgrade(id) {
  const upgrade = UPGRADES[id];
  const level = state.upgrades[id] || 0;
  if (!upgrade || level >= upgrade.max) {
    return;
  }
  const n = level + 1;
  const reqLv = upgrade.reqLevel(n);
  if (state.level < reqLv) {
    toast(`需要農場 Lv.${reqLv} 才能${level === 0 ? "啟用" : "升級"}${upgrade.name}。`);
    return;
  }
  const reqOrders = upgrade.reqOrders(n);
  const done = state.ordersCompleted || 0;
  if (done < reqOrders) {
    toast(`需完成 ${reqOrders} 次訂單（目前 ${done}）。`);
    return;
  }
  const cost = upgrade.cost(n);
  if (state.coins < cost) {
    toast("金幣不夠。");
    return;
  }
  state.coins -= cost;
  state.upgrades[id] = n;
  toast(`${upgrade.name} ${level === 0 ? "啟用" : `升到 Lv.${n}`}。`);
  saveState();
  render();
}

function canCompleteOrder(order) {
  return order.items.every((item) => (state.inventory[item.crop] || 0) >= item.count);
}

function todayKey() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function makeOrder(cropPool, big) {
  const pool = (cropPool && cropPool.length) ? cropPool : Object.keys(CROPS).filter((id) => CROPS[id].unlock <= state.level);
  const itemCount = Math.min(pool.length, Math.random() < 0.62 ? 1 : 2);
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, itemCount);
  const base = shuffled.map((cropId) => {
    const b = 2 + Math.floor(Math.random() * (2 + state.level));
    const c = cropId === "turnip" ? b + 1 : Math.max(1, b - 1);
    return { crop: cropId, count: c };
  });
  const cropValue = base.reduce((sum, it) => sum + sellPrice(it.crop) * it.count, 0);
  const baseReward = Math.round(cropValue * 1.28 + 8 + state.level * 5);
  const baseXp = 8 + base.reduce((sum, it) => sum + CROPS[it.crop].xp * it.count, 0);
  const dM = big ? ORDER_BIG_DEMAND : ORDER_DEMAND_MULT;
  const cM = big ? ORDER_BIG_COIN : ORDER_COIN_MULT;
  const xM = big ? ORDER_BIG_XP : ORDER_XP_MULT;
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    items: base.map((it) => ({ crop: it.crop, count: it.count * dM })),
    reward: Math.round(baseReward * cM),
    xp: Math.max(1, Math.round(baseXp * xM)),
    big: !!big,
    done: false,
  };
}

function generateOrders() {
  const level = state.level;
  const unlocked = Object.keys(CROPS).filter((id) => CROPS[id].unlock <= level);
  let current = unlocked.filter((id) => CROPS[id].unlock >= level - 1);
  if (!current.length) current = unlocked.slice(-2);
  let below = unlocked.filter((id) => CROPS[id].unlock < level - 1);
  if (!below.length) below = unlocked;
  const bigIndex = Math.random() < ORDER_BIG_CHANCE ? Math.floor(Math.random() * 5) : -1;
  const orders = [];
  for (let i = 0; i < 5; i++) {
    const pool = i < 2 ? current : below;        // 前 2 張當級作物、後 3 張低階作物
    orders.push(makeOrder(pool, i === bigIndex));
  }
  return orders;
}

function maybeRefreshOrders() {
  const now = Date.now();
  let changed = false;
  const dk = todayKey();
  if (state.ordersDay !== dk) { state.ordersDay = dk; state.ordersToday = 0; changed = true; }
  if (!state.ordersRefreshAt || now >= state.ordersRefreshAt || !Array.isArray(state.orders) || state.orders.length < 5) {
    state.orders = generateOrders();
    state.ordersRefreshAt = now + ORDER_REFRESH_MS;
    changed = true;
  }
  if (changed) saveState();
}

function addXp(amount) {
  state.xp += amount;
  while (state.xp >= xpToNextLevel()) {
    state.xp -= xpToNextLevel();
    state.level += 1;
    state.coins += (25 + state.level * 5) * 2;
    toast(`升到 Lv.${state.level}，解鎖新作物更近了。`);
  }
}

function xpToNextLevel() {
  return state.level * 800;
}

function getPlotDuration(plot) {
  const crop = CROPS[plot.crop];
  if (!crop) {
    return 0;
  }

  const baseMinutes = plot.season && plot.season > 0 && crop.regrow ? crop.regrow : crop.grow;
  const windmill = 1 - (state.upgrades.windmill || 0) * 0.02;
  const weather = WEATHERS[state.weather].growth;
  const water = plot.watered ? 2 / 3 : 1;
  return baseMinutes * 60 * 1000 * Math.max(0.48, windmill * weather * water);
}

function getPlotProgress(plot) {
  if (!plot.crop) {
    return 0;
  }
  let elapsed = Date.now() - plot.plantedAt - (plot.pausedMs || 0);
  if (plot.hazardSince) elapsed -= (Date.now() - plot.hazardSince);   // 蟲害/雜草期間凍結
  return Math.min(1, Math.max(0, elapsed) / getPlotDuration(plot));
}

function getPlotStage(plot, progress) {
  if (progress >= 1) {
    return "ripe";
  }
  if (plot.watered) {
    return "leaf";
  }
  return "sprout";
}

function weatherInterval() {
  return WEATHER_MIN_MS + Math.random() * (WEATHER_MAX_MS - WEATHER_MIN_MS);
}

function pickWeather() {
  const total = WEATHER_WEIGHTS.reduce((sum, w) => sum + w[1], 0);
  let r = Math.random() * total;
  for (const [id, w] of WEATHER_WEIGHTS) {
    r -= w;
    if (r < 0) return id;
  }
  return "sun";
}

function rotateWeather() {
  const now = Date.now();
  if (!state.weatherNextAt) {
    state.weatherNextAt = now + weatherInterval();
    return;
  }
  if (now >= state.weatherNextAt) {
    let next = pickWeather();
    if (next === state.weather) {
      next = pickWeather();
    }
    state.weather = next;
    state.weatherNextAt = now + weatherInterval();
    if (next === "typhoon") applyTyphoonDamage();
    saveState();
    render();
  }
}

function applyWeatherPassive() {
  if (state.weather !== "rain") {
    return;
  }

  let changed = false;
  state.plots.forEach((plot) => {
    if (plot.crop && !plot.watered && getPlotProgress(plot) < 1) {
      plot.watered = true;
      changed = true;
    }
  });

  if (changed) {
    saveState();
  }
}

function sellPrice(id) {
  return Math.round(CROPS[id].sell * (1 + (state.upgrades.stand || 0) * 0.02));
}

function inventoryValue() {
  return Object.entries(state.inventory).reduce((sum, [id, count]) => sum + sellPrice(id) * count, 0);
}

function nextPlotInfo() {
  const unlocked = state.plots.filter((plot) => plot.unlocked).length;
  return PLOT_UNLOCKS[unlocked - 4] || null;
}

function formatMinutes(min) {
  const total = Math.round(min * 60);
  const m = Math.floor(total / 60);
  const sec = total % 60;
  if (m > 0 && sec > 0) {
    return `${m} 分 ${sec} 秒`;
  }
  if (m > 0) {
    return `${m} 分`;
  }
  return `${sec} 秒`;
}

function formatTime(ms) {
  const totalSec = Math.ceil(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const sec = totalSec % 60;
  if (h > 0) {
    return `${h} 小時 ${m} 分`;
  }
  if (m > 0) {
    return `${m} 分 ${String(sec).padStart(2, "0")} 秒`;
  }
  return `${sec} 秒`;
}

function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((element) => {
    const name = element.dataset.icon;
    if (element.dataset.iconRendered === name) {
      return;
    }
    element.innerHTML = ICONS[name] || "";
    element.dataset.iconRendered = name;
  });
}

function toast(message) {
  const note = document.createElement("div");
  note.className = "toast";
  note.textContent = message;
  elements.toastZone.append(note);
  window.setTimeout(() => note.remove(), 2600);
}

function cropSvgWrap(inner) {
  return `<svg class="crop-stage-svg" viewBox="0 0 96 88" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

function cropVisual(id, stage) {
  const crop = CROPS[id];
  if (!crop) {
    return "";
  }

  // 所有作物都已有田間 PNG（含 GPT 補的 12 種），一律用圖片
  const validStage = stage === "leaf" || stage === "ripe" ? stage : "sprout";
  return `<img class="crop-stage-image crop-${id} crop-stage-${validStage}" src="./assets/crops/field/${id}-${validStage}.png?v=20260615-claude-016" alt="" />`;
}

function sproutCropSvg(leaf) {
  return `
    <path d="M48 78C48 66 48 57 48 48" fill="none" stroke="#4e8f46" stroke-width="4" stroke-linecap="round"/>
    <path d="M48 56c-10-8-21-9-31-2 10 6 21 7 31 2z" fill="${leaf}"/>
    <path d="M48 56c10-8 21-9 31-2-10 6-21 7-31 2z" fill="#76b95f"/>
    <path d="M48 45c-5-6-5-13 1-20 6 7 6 14-1 20z" fill="#8ed06e"/>
  `;
}

function halfCropSvg(id, crop) {
  const [primary, shadow, leaf] = crop.colors;
  const bud = id === "corn" ? "#f3d35b" : primary;
  return `
    <path d="M48 78V36" fill="none" stroke="#3e7f3d" stroke-width="5" stroke-linecap="round"/>
    <path d="M48 64c-14-10-28-11-40-3 12 7 27 8 40 3z" fill="${leaf}"/>
    <path d="M48 63c14-10 28-11 40-3-12 7-27 8-40 3z" fill="#74b95d"/>
    <path d="M48 49c-11-9-23-10-34-4 11 7 23 8 34 4z" fill="#66aa55"/>
    <path d="M48 49c11-9 23-10 34-4-11 7-23 8-34 4z" fill="${leaf}"/>
    <path d="M48 36c-7-8-7-18 1-28 8 10 7 20-1 28z" fill="#8acc66"/>
    <circle cx="48" cy="42" r="${id === "pumpkin" ? 7 : 5}" fill="${bud}" stroke="${shadow}" stroke-width="1.5" opacity=".7"/>
  `;
}

function ripeCropSvg(id, crop) {
  const [primary, shadow, leaf] = crop.colors;
  const sharedLeaves = `
    <path d="M48 80V32" fill="none" stroke="#39793a" stroke-width="6" stroke-linecap="round"/>
    <path d="M48 66c-17-12-32-12-45-2 13 8 29 8 45 2z" fill="${leaf}"/>
    <path d="M48 66c17-12 32-12 45-2-13 8-29 8-45 2z" fill="#74b95d"/>
    <path d="M48 50c-14-11-28-12-40-3 12 7 26 8 40 3z" fill="#5ea64e"/>
    <path d="M48 50c14-11 28-12 40-3-12 7-26 8-40 3z" fill="${leaf}"/>
  `;

  if (id === "corn") {
    return `
      ${sharedLeaves}
      <path d="M48 16c13 13 15 32 0 54-15-22-13-41 0-54z" fill="#f6d64d" stroke="${shadow}" stroke-width="2"/>
      <path d="M40 30h16M39 42h18M41 54h14" stroke="#c8922f" stroke-width="2.5" stroke-linecap="round"/>
    `;
  }

  if (id === "strawberry") {
    return `
      ${sharedLeaves}
      <path d="M48 25c15 7 22 19 14 31-6 10-22 12-28 0-8-12-1-24 14-31z" fill="${primary}" stroke="${shadow}" stroke-width="2"/>
      <path d="M41 39h1M50 37h1M56 46h1M44 51h1M36 47h1" stroke="#ffe29a" stroke-width="3" stroke-linecap="round"/>
    `;
  }

  if (id === "pumpkin") {
    return `
      <path d="M48 35c-3-12 4-20 15-23" fill="none" stroke="${leaf}" stroke-width="5" stroke-linecap="round"/>
      <path d="M26 54c0-15 10-25 22-25s22 10 22 25c0 17-10 27-22 27S26 71 26 54z" fill="${primary}" stroke="${shadow}" stroke-width="2"/>
      <path d="M11 57c0-13 9-23 20-23s20 10 20 23c0 15-9 24-20 24s-20-9-20-24zM45 57c0-13 9-23 20-23s20 10 20 23c0 15-9 24-20 24S45 72 45 57z" fill="${primary}" opacity=".9" stroke="${shadow}" stroke-width="1.5"/>
      <path d="M48 35v43M32 39c-8 8-10 25-1 38M64 39c8 8 10 25 1 38" fill="none" stroke="${shadow}" stroke-width="2" opacity=".4"/>
    `;
  }

  return `
    ${sharedLeaves}
    <path d="M30 47c0-13 8-23 18-23s18 10 18 23c0 17-9 29-18 29S30 64 30 47z" fill="${primary}" stroke="${shadow}" stroke-width="2"/>
    <path d="M39 46c0-12 4-21 9-21s9 9 9 21c0 16-4 27-9 27s-9-11-9-27z" fill="${shadow}" opacity=".18"/>
    <path d="M42 18c4-8 13-11 23-8-2 11-10 16-23 8z" fill="${leaf}"/>
  `;
}

function cropCardVisual(id) {
  const cropCardImages = {
    turnip: "turnip-card-v1.png",
    carrot: "carrot-card-v1.png",
    corn: "corn-card-v1.png",
    strawberry: "strawberry-card-v1.png",
    pumpkin: "pumpkin-card-v1.png",
  };

  if (cropCardImages[id]) {
    return `<img class="crop-card-image" src="./assets/crops/${cropCardImages[id]}" alt="" />`;
  }

  return cropVisual(id, "ripe");
}


/* ===== 牧場窗門四點框選器（GM + 牧場模式才出現）===== */
const RANCH_OPENINGS_DEFAULT = [
  { n: "中央門", p: [[46.3,18.2],[53.8,18.2],[53.8,31.4],[46.4,31.3]] },
  { n: "小牧場動物移動範圍", p: [[36.4,39.8],[63,40.3],[69.1,52.1],[30.1,52.2]] },
  { n: "大牧場動物移動範圍", p: [[36.5,40.3],[62.7,40.1],[75,66.8],[26,66]] },
  { n: "超大牧場動物移動範圍", p: [[31.9,33.9],[68.1,34.2],[90.4,58],[9,58]] },
  { n: "小牧場散步路線", p: [[17.2,84.3],[81.7,84.2]] },
  { n: "大牧場散步路線", p: [[16.3,95.9],[78.6,95.5]] },
  { n: "超大牧場散步路線", p: [[15.5,94.7],[88.4,94.6]] },
];
function currentRangeName() {
  return (RANCH_LEVEL_NAMES[state.ranchLevel || 1] || "小牧場") + "動物移動範圍";
}
function ranchLvlNow() {
  if (visiting && visitScene === "ranch") return (visiting.ranchSnapshot && visiting.ranchSnapshot.ranchLevel) || 1;
  return state.ranchLevel || 1;
}
function currentTrackName() { return (RANCH_LEVEL_NAMES[ranchLvlNow()] || "小牧場") + "散步路線"; }
function hasDogForWalk() {
  if (visiting && visitScene === "ranch") { const ds = visiting.dogState; return !!ds && ds !== "none" && ds !== "empty"; }
  return !!state.dog;
}
const DOG_WALK_SPEED = 0.006;  // %/ms：固定速度(不因路線長度變速)
function dogTrack() { return loadRanchOpenings().find((o) => o.n === currentTrackName()); }
// 只在牧場(自家/參觀)且有狗時顯示散步狗；切場景會被移除(避免跑出來)
function renderDogWalker() {
  const frame = document.querySelector(".field-frame");
  if (!frame) return;
  const inRanch = state.scene === "ranch" || (visiting && visitScene === "ranch");
  let layer = frame.querySelector("#dogWalkerLayer");
  const track = dogTrack();
  if (!inRanch || !hasDogForWalk() || !track || !track.p || track.p.length < 2) {
    if (layer) layer.remove();
    return;
  }
  if (!layer) {
    layer = document.createElement("div"); layer.id = "dogWalkerLayer";
    const w = document.createElement("div"); w.id = "dogWalker"; w.className = "dog-walker";
    w.innerHTML = '<div class="dog-walker-sprite"></div>';
    const p0 = track.p[0];
    w.style.left = p0[0] + "%"; w.style.top = p0[1] + "%"; w.dataset.target = "1";
    setAnimalZ(w, p0[1]);
    w.addEventListener("transitionend", (e) => { if (e.propertyName === "left") stepDogWalker(); });
    layer.appendChild(w); frame.appendChild(layer);
    setTimeout(stepDogWalker, 60);
  }
  applyRanchAnimalYAdj();
}
function stepDogWalker() {
  const w = document.querySelector("#dogWalker");
  if (!w) return;
  const track = dogTrack();
  if (!track || track.p.length < 2) return;
  const fromX = parseFloat(w.style.left) || track.p[0][0], fromY = parseFloat(w.style.top) || track.p[0][1];
  const target = Number(w.dataset.target || 1);
  const dest = track.p[target] || track.p[1];
  const dist = Math.hypot(dest[0] - fromX, dest[1] - fromY) || 1;
  const dur = Math.round(dist / DOG_WALK_SPEED);
  w.style.transitionDuration = dur + "ms";
  w.style.left = dest[0] + "%"; w.style.top = dest[1] + "%";
  setAnimalZ(w, dest[1]);
  const spr = w.querySelector(".dog-walker-sprite");
  if (spr) spr.style.transform = (dest[0] < fromX) ? "scaleX(-1)" : "scaleX(1)";
  w.dataset.target = target ? "0" : "1";
  w.dataset.arriveBy = String(Date.now() + dur);
}

let gmRanchOpenings = null;
function loadRanchOpenings() {
  if (gmRanchOpenings) return gmRanchOpenings;
  let loaded = null;
  try {
    const r = JSON.parse(localStorage.getItem("gm-ranch-openings"));
    if (Array.isArray(r) && r.length) loaded = r;
  } catch (e) {}
  gmRanchOpenings = RANCH_OPENINGS_DEFAULT.map((d) => {
    const saved = loaded && loaded.find((o) => o.n === d.n);
    return JSON.parse(JSON.stringify(saved || d));
  });
  return gmRanchOpenings;
}
function saveRanchOpenings() {
  try { localStorage.setItem("gm-ranch-openings", JSON.stringify(gmRanchOpenings)); } catch (e) {}
}
function ptsStr(p) { return p.map((q) => q[0] + "," + q[1]).join(" "); }

function updateRanchEditor() {
  const frame = document.querySelector(".field-frame");
  if (!frame) return;
  const show = state.scene === "ranch" && state.gm && state.gmSelect !== false;
  let ed = frame.querySelector("#ranchEditor");
  if (!show) { if (ed) ed.remove(); return; }
  if (!ed) buildRanchEditor(frame);
}

function buildRanchEditor(frame) {
  loadRanchOpenings();
  const SVGNS = "http://www.w3.org/2000/svg";
  const ed = document.createElement("div");
  ed.id = "ranchEditor";
  const svg = document.createElementNS(SVGNS, "svg");
  svg.id = "ranchEditorSvg";
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  ed.appendChild(svg);
  const btn = document.createElement("button");
  btn.type = "button"; btn.id = "ranchExportBtn"; btn.textContent = "匯出圈選座標";
  btn.addEventListener("click", exportRanchOpenings);
  ed.appendChild(btn);
  const reset = document.createElement("button");
  reset.type = "button"; reset.id = "ranchResetBtn"; reset.textContent = "重設";
  reset.addEventListener("click", () => {
    gmRanchOpenings = JSON.parse(JSON.stringify(RANCH_OPENINGS_DEFAULT));
    saveRanchOpenings(); renderRanchEditor();
  });
  ed.appendChild(reset);
  frame.appendChild(ed);
  renderRanchEditor();
}

function renderRanchEditor() {
  const ed = document.querySelector("#ranchEditor");
  if (!ed) return;
  const frame = ed.parentElement;
  const svg = ed.querySelector("#ranchEditorSvg");
  const SVGNS = "http://www.w3.org/2000/svg";
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  ed.querySelectorAll(".ro-handle").forEach((n) => n.remove());
  const ops = loadRanchOpenings();
  const visible = ((state.ranchLevel || 1) === 3) ? [currentRangeName(), currentTrackName()] : ["中央門", currentRangeName(), currentTrackName()];
  ops.forEach((op, gi) => {
    if (!visible.includes(op.n)) return;
    const poly = document.createElementNS(SVGNS, "polygon");
    poly.setAttribute("points", ptsStr(op.p));
    poly.setAttribute("class", op.p.length === 2 ? "ro-poly ro-track" : "ro-poly");
    poly.setAttribute("data-g", gi);
    svg.appendChild(poly);
    addRanchBodyDrag(poly, gi, frame);
    op.p.forEach((pt, pi) => {
      const h = document.createElement("div");
      h.className = "ro-handle";
      h.style.left = pt[0] + "%"; h.style.top = pt[1] + "%";
      h.setAttribute("data-g", gi); h.setAttribute("data-i", pi);
      addRanchHandleDrag(h, gi, pi, frame);
      ed.appendChild(h);
    });
  });
}

function addRanchHandleDrag(h, gi, pi, frame) {
  let drag = false;
  h.addEventListener("pointerdown", (e) => {
    drag = true; e.preventDefault(); e.stopPropagation();
    try { h.setPointerCapture(e.pointerId); } catch (_) {}
  });
  h.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = frame.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, (e.clientX - r.left) / r.width * 100));
    const y = Math.max(0, Math.min(100, (e.clientY - r.top) / r.height * 100));
    gmRanchOpenings[gi].p[pi] = [Number(x.toFixed(1)), Number(y.toFixed(1))];
    h.style.left = x + "%"; h.style.top = y + "%";
    const poly = frame.querySelector('.ro-poly[data-g="' + gi + '"]');
    if (poly) poly.setAttribute("points", ptsStr(gmRanchOpenings[gi].p));
  });
  const end = (e) => {
    if (!drag) return; drag = false;
    try { h.releasePointerCapture(e.pointerId); } catch (_) {}
    saveRanchOpenings();
    clampRanchAnimalsInRange();
  };
  h.addEventListener("pointerup", end);
  h.addEventListener("pointercancel", end);
}

function addRanchBodyDrag(poly, gi, frame) {
  let drag = false, sx = 0, sy = 0, orig = null;
  poly.addEventListener("pointerdown", (e) => {
    drag = true; sx = e.clientX; sy = e.clientY;
    orig = gmRanchOpenings[gi].p.map((q) => q.slice());
    e.preventDefault();
    try { poly.setPointerCapture(e.pointerId); } catch (_) {}
  });
  poly.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = frame.getBoundingClientRect();
    const dx = (e.clientX - sx) / r.width * 100;
    const dy = (e.clientY - sy) / r.height * 100;
    gmRanchOpenings[gi].p = orig.map((q) => [
      Number(Math.max(0, Math.min(100, q[0] + dx)).toFixed(1)),
      Number(Math.max(0, Math.min(100, q[1] + dy)).toFixed(1)),
    ]);
    poly.setAttribute("points", ptsStr(gmRanchOpenings[gi].p));
    frame.querySelectorAll('.ro-handle[data-g="' + gi + '"]').forEach((h) => {
      const i = Number(h.getAttribute("data-i"));
      h.style.left = gmRanchOpenings[gi].p[i][0] + "%";
      h.style.top = gmRanchOpenings[gi].p[i][1] + "%";
    });
  });
  const end = (e) => {
    if (!drag) return; drag = false;
    try { poly.releasePointerCapture(e.pointerId); } catch (_) {}
    saveRanchOpenings();
    clampRanchAnimalsInRange();
  };
  poly.addEventListener("pointerup", end);
  poly.addEventListener("pointercancel", end);
}

function exportRanchOpenings() {
  const ops = loadRanchOpenings();
  const visible = ((state.ranchLevel || 1) === 3) ? [currentRangeName(), currentTrackName()] : ["中央門", currentRangeName(), currentTrackName()];
  const text = ops.filter((op) => visible.includes(op.n)).map((op) => op.n + ": " + ptsStr(op.p)).join("\n");
  try { if (navigator.clipboard) navigator.clipboard.writeText(text); } catch (e) {}
  try { console.log("RANCH_OPENINGS:\n" + text); } catch (e) {}
  try { window.prompt("已複製，貼回對話給 Claude：", text); } catch (e) {}
  toast("窗門座標已匯出（已複製到剪貼簿）。");
}


/* ===== 牧場動物系統 ===== */
// 格柵內可漫步範圍（%）
function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
const RANCH_INSET = 0.12;  // 移動範圍往形心內縮，讓動物離圍欄有邊距、不貼邊超出
function insetPoly(poly, f) {
  if (!poly || poly.length < 3) return poly;
  const cx = poly.reduce((s, q) => s + q[0], 0) / poly.length;
  const cy = poly.reduce((s, q) => s + q[1], 0) / poly.length;
  return poly.map((q) => [q[0] + (cx - q[0]) * f, q[1] + (cy - q[1]) * f]);
}
function rangePoly(rangeName) {
  const region = loadRanchOpenings().find((o) => o.n === (rangeName || currentRangeName()));
  return (region && region.p && region.p.length >= 3) ? insetPoly(region.p, RANCH_INSET) : null;
}
function randPaddock(rangeName) {
  const poly = rangePoly(rangeName);
  if (poly) {
    const region = { p: poly };
    const xs = region.p.map((q) => q[0]), ys = region.p.map((q) => q[1]);
    const minx = Math.min.apply(null, xs), maxx = Math.max.apply(null, xs);
    const miny = Math.min.apply(null, ys), maxy = Math.max.apply(null, ys);
    for (let i = 0; i < 24; i++) {
      const x = minx + Math.random() * (maxx - minx);
      const y = miny + Math.random() * (maxy - miny);
      if (pointInPoly(x, y, region.p)) return [Number(x.toFixed(1)), Number(y.toFixed(1))];
    }
    return [Number(((minx + maxx) / 2).toFixed(1)), Number(((miny + maxy) / 2).toFixed(1))];
  }
  const x = 31 + Math.random() * 36, y = 41 + Math.random() * 9;
  return [Number(x.toFixed(1)), Number(y.toFixed(1))];
}

function setAnimalZ(el, topPct) {
  // 動物以腳底為錨點，topPct 即腳底位置：越下面 z 越大(越前面)
  el.style.zIndex = Math.round(topPct * 10);
}

function renderRanchAnimals() {
  const frame = document.querySelector(".field-frame");
  if (!frame) return;
  if (visiting) return;   // 參觀中由 renderVisitingRanch/Farm 管理動物層
  let box = frame.querySelector("#ranchAnimals");
  if (state.scene !== "ranch") { if (box) box.remove(); return; }
  if (!box) { box = document.createElement("div"); box.id = "ranchAnimals"; frame.appendChild(box); }
  applyRanchAnimalYAdj();
  const now = Date.now();
  const list = state.ranchAnimals || [];
  const ids = {};
  list.forEach((a) => { ids[a.id] = true; });
  Array.from(box.children).forEach((el) => { if (!ids[el.dataset.id]) el.remove(); });
  list.forEach((a) => {
    const cfg = RANCH_ANIMALS[a.type];
    if (!cfg) return;
    let el = box.querySelector('[data-id="' + a.id + '"]');
    if (!el) {
      el = document.createElement("div");
      el.className = "ranch-animal";
      el.dataset.id = a.id;
      el.dataset.type = a.type;
      const p = randPaddock();
      el.style.left = p[0] + "%"; el.style.top = p[1] + "%"; el.style.zIndex = Math.round(p[1] * 10);
      el.innerHTML = '<span class="animal-badge"></span><span class="animal-anchor" aria-hidden="true"></span>' + (cfg.img ? '<img class="animal-img" src="' + cfg.img + '" alt="" draggable="false" />' : '<span class="animal-emoji">' + cfg.emoji + '</span>');
      el.addEventListener("click", () => onRanchAnimalClick(a.id));
      box.appendChild(el);
    }
    const ready = a.fedAt && (now - a.fedAt >= cfg.growMs);
    const growing = a.fedAt && !ready;
    const b = el.querySelector(".animal-badge");
    if (b) {
      if (ready) { b.textContent = cfg.productEmoji; b.className = "animal-badge animal-prod"; }
      else if (a.dirty) { b.textContent = "💩"; b.className = "animal-badge animal-dirty"; }
      else if (growing) { b.textContent = fmtSecs(cfg.growMs - (now - a.fedAt)); b.className = "animal-badge animal-timer"; }
      else { b.textContent = ""; b.className = "animal-badge"; }
    }
  });
  clampRanchAnimalsInRange();
}

function ranchYAdj() { return 0; }
function applyRanchAnimalYAdj() {
  const t = "translateY(" + ranchYAdj() + "%)";
  const box = document.querySelector("#ranchAnimals"); if (box) box.style.transform = t;
  const dl = document.querySelector("#dogWalkerLayer"); if (dl) dl.style.transform = t;
}
// 自動校正：量測動物實際渲染腳底 vs 資料腳底，補正系統性垂直落差(收斂後不再變動)
let _ranchCalibrated = false;
// 進牧場時量測一次系統性垂直落差並補正(只做一次、不連續回饋，避免與 bob 打架抖動)
function autoCalibrateRanchYAdj() {
  const frame = document.querySelector(".field-frame");
  const box = document.querySelector("#ranchAnimals");
  if (!frame || !box) return false;
  const fr = frame.getBoundingClientRect();
  if (!fr.width || !fr.height) return false;
  let el = null;
  box.querySelectorAll(".ranch-animal").forEach((a) => {
    if (el) return;
    const rr = a.getBoundingClientRect();
    if (rr.height < 6) return;
    const cx = (rr.left + rr.width / 2 - fr.left) / fr.width * 100;
    if (Math.abs(cx - (parseFloat(a.style.left) || 50)) <= 2) el = a;   // 只量已停下的動物
  });
  if (!el) return false;
  const r = el.getBoundingClientRect();
  const intended = parseFloat(el.style.top) || 50;        // 資料上的腳底 %
  const feetPct = (r.bottom - fr.top) / fr.height * 100;  // 實際渲染的腳底 %
  const delta = feetPct - intended;
  if (Math.abs(delta) > 1.0) {
    localStorage.setItem("gm-ranch-yadj", (ranchYAdj() - delta).toFixed(1));
    applyRanchAnimalYAdj();
  }
  return true;   // 已完成一次量測(即使已對齊也算)
}
function calibrateRanchOnce(tries) {
  if (_ranchCalibrated) return;
  if (autoCalibrateRanchYAdj()) { _ranchCalibrated = true; return; }
  if ((tries || 0) < 10) setTimeout(function () { calibrateRanchOnce((tries || 0) + 1); }, 300);
}

function clampRanchAnimalsInRange(rangeName) {
  const box = document.querySelector("#ranchAnimals");
  if (!box) return;
  const poly = rangePoly(rangeName);
  if (!poly) return;
  const now = Date.now();
  box.querySelectorAll(".ranch-animal").forEach((el) => {
    const cx = parseFloat(el.style.left) || 50, cy = parseFloat(el.style.top) || 50;
    if (!pointInPoly(cx, cy, poly)) {
      const t = randPaddock(rangeName);
      el.style.transition = "none";
      el.style.left = t[0] + "%"; el.style.top = t[1] + "%"; setAnimalZ(el, t[1]);
      void el.offsetWidth; el.style.transition = "";
      el.dataset.nextMove = now + RANCH_GLIDE_MS + ranchRestMs();
    }
  });
}

// 滑行 5.5s，每次抵達後強制停頓 1.5-2.5s（期間僅原地抖動），不連續滑行
const RANCH_GLIDE_MS = 5500;
const RANCH_SPEED = 0.0065;  // %/ms：等速移動(時間與距離成正比，不再有遠距離衝刺感)
function ranchGlideMs(x1, y1, x2, y2) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  return Math.min(9000, Math.max(1800, Math.round(d / RANCH_SPEED)));
}
function ranchRestMs() { return 1500 + Math.random() * 1000; }
function wanderRanchAnimals() {
  const isVisit = visiting && visitScene === "ranch";
  if (state.scene !== "ranch" && !isVisit) return;
  const box = document.querySelector("#ranchAnimals");
  if (!box) return;
  // 參觀好友牧場：用好友牧場大小的範圍，但走自己的隨機（不與對方即時同步移動）
  let rangeName = null;
  if (isVisit) {
    const lvl = (visiting.ranchSnapshot && visiting.ranchSnapshot.ranchLevel) || 1;
    rangeName = (RANCH_LEVEL_NAMES[lvl] || "小牧場") + "動物移動範圍";
  }
  const now = Date.now();
  const _dw = document.querySelector("#dogWalker");
  if (_dw && Date.now() > Number(_dw.dataset.arriveBy || 0) + 1200) stepDogWalker();
  const poly = rangePoly(rangeName);
  box.querySelectorAll(".ranch-animal").forEach((el) => {
    setAnimalZ(el, parseFloat(el.style.top) || 50);   // 每次重算前後層級(含未移動者)
    // 即時自我修正：腳底若已不在(內縮)範圍內，立刻無滑行拉回範圍內
    if (poly) {
      const cx = parseFloat(el.style.left) || 50, cy = parseFloat(el.style.top) || 50;
      if (!pointInPoly(cx, cy, poly)) {
        const t = randPaddock(rangeName);
        el.style.transition = "none";
        el.style.left = t[0] + "%"; el.style.top = t[1] + "%"; setAnimalZ(el, t[1]);
        void el.offsetWidth; el.style.transition = "";
        el.dataset.nextMove = now + RANCH_GLIDE_MS + ranchRestMs();
        return;
      }
    }
    let next = Number(el.dataset.nextMove || 0);
    if (!next) { el.dataset.nextMove = now + 300 + Math.random() * 3500; return; }  // 初次錯開
    if (now < next) return;
    const cur = parseFloat(el.style.left) || 50;
    const curY = parseFloat(el.style.top) || 50;
    const t = randPaddock(rangeName);
    const dur = ranchGlideMs(cur, curY, t[0], t[1]);   // 等速：依距離決定時間
    el.style.transitionDuration = dur + "ms";
    el.style.left = t[0] + "%"; el.style.top = t[1] + "%"; setAnimalZ(el, t[1]);
    const face = el.querySelector(".animal-emoji, .animal-img");
    if (face) face.style.transform = (t[0] < cur) ? "scaleX(-1)" : "scaleX(1)";
    el.dataset.nextMove = now + dur + ranchRestMs();  // 滑行完成 + 停頓後才能再滑行
  });
}

function repositionRanchAnimals() {
  const box = document.querySelector("#ranchAnimals");
  if (!box) return;
  const now = Date.now();
  let i = 0;
  box.querySelectorAll(".ranch-animal").forEach((el) => {
    const t = randPaddock();
    el.style.transition = "none";          // 瞬移進新範圍，不走滑行
    el.style.left = t[0] + "%"; el.style.top = t[1] + "%"; el.style.zIndex = Math.round(t[1] * 10);
    void el.offsetWidth;                    // 強制 reflow 後恢復過渡
    el.style.transition = "";
    el.dataset.nextMove = now + RANCH_GLIDE_MS + ranchRestMs() + (i++ * 200);
  });
}

function feedRanchAnimals() {
  const list = state.ranchAnimals || [];
  if (!list.length) { toast("牧場裡還沒有動物，先用「買動物」買一隻。"); return; }
  const now = Date.now();
  let n = 0;
  list.forEach((a) => {
    const cfg = RANCH_ANIMALS[a.type];
    if (!cfg) return;
    const ready = a.fedAt && (now - a.fedAt >= cfg.growMs);
    if (a.dirty || a.fedAt || ready) return;
    a.fedAt = now; n++;
  });
  saveState(); renderRanchAnimals();
  toast(n ? `餵了 ${n} 隻動物，等產出。` : "沒有可餵的（生產中、待收成或要先洗澡）。");
}

function washRanchAnimals() {
  const list = state.ranchAnimals || [];
  const dirty = list.filter((a) => a.dirty);
  if (!dirty.length) { toast("目前沒有需要洗澡的動物。"); return; }
  dirty.forEach((a) => { a.dirty = false; });
  saveState(); renderRanchAnimals();
  toast(`幫 ${dirty.length} 隻動物洗好澡了，可以再餵飼料。`);
}

function harvestRanchAnimals() {
  const list = state.ranchAnimals || [];
  const now = Date.now();
  let coins = 0, n = 0;
  list.forEach((a) => {
    const cfg = RANCH_ANIMALS[a.type];
    if (!cfg) return;
    if (a.fedAt && now - a.fedAt >= cfg.growMs) {
      state.ranchProducts = state.ranchProducts || {};
      state.ranchProducts[a.type] = (state.ranchProducts[a.type] || 0) + 1;
      a.produced = (a.produced || 0) + 1;
      n++;
      a.fedAt = 0; a.dirty = true; a.dirtyBy = "system";
    }
  });
  if (!n) { toast("還沒有可收成的產物。"); return; }
  saveState(); render();
  toast(`收成 ${n} 份產物，已放進牧場倉。記得幫動物洗澡。`);
  if (fbUser) publishProfile(true);
}

function openAnimalShop() {
  const old = document.querySelector("#animalShop");
  if (old) old.remove();
  const m = document.createElement("div");
  m.id = "animalShop"; m.className = "gm-box";
  const cards = [["chicken", RANCH_ANIMALS.chicken], ["pig", RANCH_ANIMALS.pig], ["sheep", RANCH_ANIMALS.sheep], ["cow", RANCH_ANIMALS.cow]].map(([k, c]) =>
    `<button type="button" class="animal-buy" data-buy="${k}"><span class="ab-top"><span class="ab-emoji">${c.img ? '<img src="' + c.img + '" alt="">' : c.emoji}</span><span class="ab-text"><span class="ab-name">${c.name}</span><span class="ab-info">產${c.product}・${c.value}金</span></span></span><span class="ab-price">🪙 ${c.price}</span></button>`
  ).join("");
  m.innerHTML = `<div class="animal-shop-card"><h2>🐄 買動物</h2><div class="animal-shop-grid">${cards}</div><p class="animal-shop-hint">買來會放進格柵內。流程：餵飼料 → 等產出 → 收成 → 洗澡 → 再餵。</p><button type="button" class="gm-close" id="animalShopClose">關閉</button></div>`;
  document.body.appendChild(m);
  m.querySelectorAll("[data-buy]").forEach((b) => b.addEventListener("click", () => buyAnimal(b.dataset.buy)));
  m.querySelector("#animalShopClose").addEventListener("click", () => m.remove());
  m.addEventListener("click", (e) => { if (e.target === m) m.remove(); });
}

function buyAnimal(type) {
  const cfg = RANCH_ANIMALS[type];
  if (!cfg) return;
  state.ranchAnimals = state.ranchAnimals || [];
  const cap = ranchCap();
  if (state.ranchAnimals.length >= cap) { toast((RANCH_LEVEL_NAMES[state.ranchLevel || 1] || "小牧場") + "最多養 " + cap + " 隻動物。"); return; }
  if (state.coins < cfg.price) { toast("金幣不足。"); return; }
  state.coins -= cfg.price;
  state.ranchAnimals.push({ id: "a" + Date.now(), type: type, level: 1, fedAt: 0, dirty: false, produced: 0 });
  saveState();
  render();
  if (document.querySelector("#animalShop")) openAnimalShop();   // 刷新商店、不關閉，可連買
  toast(`買了一隻${cfg.name}！已放進牧場。`);
}


/* ===== 牧場產物倉（顯示在倉庫面板「牧場」欄，售出介面同農場）===== */
function renderRanchProducts() {
  const list = document.querySelector("#ranchProductList");
  if (!list) return;
  const entries = Object.entries(state.ranchProducts || {}).filter(([, n]) => n > 0);
  const sellAllBtn = document.querySelector("#sellAllRanchButton");
  if (sellAllBtn) sellAllBtn.disabled = !entries.length;
  if (!entries.length) { list.innerHTML = '<p class="item-empty">目前沒有牧場產物。</p>'; return; }
  list.innerHTML = entries.map(([type, n]) => {
    const cfg = RANCH_ANIMALS[type];
    if (!cfg) return "";
    return `
      <div class="inventory-row">
        <span class="mini-crop ranch-prod-emoji" aria-hidden="true">${cfg.productEmoji}</span>
        <span>
          <span class="item-title">
            <strong>${cfg.product}</strong>
            <span class="sell-stepper">
              <button class="qty-btn" type="button" data-rp-dec="${type}" aria-label="減少">−</button>
              <input class="qty-num" type="number" inputmode="numeric" data-rp-qty="${type}" value="1" min="1" max="${n}" />
              <button class="qty-btn" type="button" data-rp-inc="${type}" aria-label="增加">＋</button>
            </span>
            <span class="count-max" data-rp-max-for="${type}" title="點我填入最大數量">${n} 個</span>
          </span>
          <span class="item-meta">售價 ${cfg.value} 金幣</span>
        </span>
        <button class="mini-sell" type="button" data-rp-sell="${type}" title="出售${cfg.product}" aria-label="出售${cfg.product}">${ICONS.cart}</button>
      </div>`;
  }).join("");
  const clamp = (type) => {
    const inp = list.querySelector('[data-rp-qty="' + type + '"]');
    if (!inp) return 0;
    const max = (state.ranchProducts || {})[type] || 0;
    let v = Math.max(1, Math.min(max, Math.floor(Number(inp.value) || 0)));
    inp.value = v;
    return v;
  };
  list.querySelectorAll("[data-rp-dec]").forEach((b) => b.addEventListener("click", () => {
    const inp = list.querySelector('[data-rp-qty="' + b.dataset.rpDec + '"]');
    if (inp) { inp.value = (Number(inp.value) || 1) - 1; clamp(b.dataset.rpDec); }
  }));
  list.querySelectorAll("[data-rp-inc]").forEach((b) => b.addEventListener("click", () => {
    const inp = list.querySelector('[data-rp-qty="' + b.dataset.rpInc + '"]');
    if (inp) { inp.value = (Number(inp.value) || 0) + 1; clamp(b.dataset.rpInc); }
  }));
  list.querySelectorAll("[data-rp-qty]").forEach((inp) => inp.addEventListener("change", () => clamp(inp.dataset.rpQty)));
  list.querySelectorAll("[data-rp-sell]").forEach((b) => b.addEventListener("click", () => sellRanchProduct(b.dataset.rpSell, clamp(b.dataset.rpSell))));
  list.querySelectorAll("[data-rp-max-for]").forEach((el) => el.addEventListener("click", () => {
    const type = el.dataset.rpMaxFor;
    const inp = list.querySelector('[data-rp-qty="' + type + '"]');
    if (inp) { inp.value = (state.ranchProducts || {})[type] || 0; clamp(type); }
  }));
}

function sellRanchProduct(type, qty) {
  const cfg = RANCH_ANIMALS[type];
  if (!cfg) return;
  const have = (state.ranchProducts && state.ranchProducts[type]) || 0;
  if (have <= 0) return;
  let n = Math.max(1, Math.min(have, Math.floor(Number(qty) || have)));
  const earned = n * cfg.value;
  state.ranchProducts[type] = have - n;
  state.coins += earned;
  saveState(); render();
  toast(`${cfg.product} 售出 ${n} 個，獲得 ${earned} 金幣。`);
}

function sellAllRanchProducts() {
  const prods = state.ranchProducts || {};
  let coins = 0;
  Object.entries(prods).forEach(([type, n]) => {
    const cfg = RANCH_ANIMALS[type];
    if (cfg && n > 0) coins += n * cfg.value;
  });
  if (coins <= 0) { toast("牧場目前沒有產物。"); return; }
  state.ranchProducts = {};
  state.coins += coins;
  saveState(); render();
  toast(`牧場產物全部售出，獲得 ${coins} 金幣。`);
}


/* ===== 賣動物（小牧場：生產滿 30 次才能賣）===== */
const RANCH_SELL_THRESHOLD = 30;
function openSellAnimal() {
  const old = document.querySelector("#animalSell");
  if (old) old.remove();
  const list = state.ranchAnimals || [];
  const m = document.createElement("div");
  m.id = "animalSell"; m.className = "gm-box";
  let body;
  if (!list.length) {
    body = '<p class="animal-shop-hint">牧場裡還沒有動物。</p>';
  } else {
    body = '<div class="animal-shop-grid">' + list.map((a) => {
      const cfg = RANCH_ANIMALS[a.type];
      if (!cfg) return "";
      const p = a.produced || 0;
      const can = p >= RANCH_SELL_THRESHOLD;
      return `<button type="button" class="animal-buy" data-sell-animal="${a.id}" ${can ? "" : "disabled"}><span class="ab-emoji">${cfg.emoji}</span><span class="ab-name">${cfg.name}</span><span class="ab-info">生產 ${p}/${RANCH_SELL_THRESHOLD}</span><span class="ab-price">${can ? "🪙 " + Math.round(cfg.price / 10) : "未達標"}</span></button>`;
    }).join("") + '</div>';
  }
  m.innerHTML = `<div class="animal-shop-card"><h2>🪙 賣動物</h2>${body}<p class="animal-shop-hint">動物生產滿 ${RANCH_SELL_THRESHOLD} 次後才能賣掉，賣出價為購買價的 1/10。</p><button type="button" class="gm-close" id="animalSellClose">關閉</button></div>`;
  document.body.appendChild(m);
  m.querySelectorAll("[data-sell-animal]").forEach((b) => b.addEventListener("click", () => sellAnimal(b.dataset.sellAnimal)));
  m.querySelector("#animalSellClose").addEventListener("click", () => m.remove());
  m.addEventListener("click", (e) => { if (e.target === m) m.remove(); });
}

function sellAnimal(id) {
  const list = state.ranchAnimals || [];
  const a = list.find((x) => x.id === id);
  if (!a) return;
  const cfg = RANCH_ANIMALS[a.type];
  if (!cfg) return;
  if ((a.produced || 0) < RANCH_SELL_THRESHOLD) { toast(`要生產滿 ${RANCH_SELL_THRESHOLD} 次才能賣。`); return; }
  const sellPrice = Math.round(cfg.price / 10);
  state.ranchAnimals = list.filter((x) => x.id !== id);
  state.coins += sellPrice;
  state.animalsSoldForCard = (state.animalsSoldForCard || 0) + 1;   // 累計售出(擴建卡解鎖用)
  const m = document.querySelector("#animalSell");
  if (m) m.remove();
  saveState(); render();
  toast(`賣出一隻${cfg.name}，獲得 ${sellPrice} 金幣（原價 1/10）。`);
}


/* ===== 點個別動物施作（餵飼料/洗澡/收成）===== */
function onRanchAnimalClick(id) {
  const a = (state.ranchAnimals || []).find((x) => x.id === id);
  if (!a) return;
  const cfg = RANCH_ANIMALS[a.type];
  if (!cfg) return;
  const tool = state.ranchTool;
  if (!tool) {
    if (state.gm) {
      if (window.confirm("（GM）確定要移除這隻" + cfg.name + "嗎？")) {
        state.ranchAnimals = (state.ranchAnimals || []).filter((x) => x.id !== id);
        saveState(); renderRanchAnimals();
        toast("（GM）已移除一隻" + cfg.name + "。");
      }
      return;
    }
    toast("先選下方的餵飼料／洗澡／收成，再點動物。");
    return;
  }
  const now = Date.now();
  const ready = a.fedAt && (now - a.fedAt >= cfg.growMs);
  if (tool === "feed") {
    if (a.dirty) { toast(cfg.name + "髒了，要先洗澡。"); return; }
    if (a.fedAt) { toast(ready ? (cfg.name + " 有產物可收成。") : (cfg.name + " 生產中…")); return; }
    a.fedAt = now; saveState(); renderRanchAnimals(); toast("餵了" + cfg.name + "，等產出。");
  } else if (tool === "wash") {
    if (!a.dirty) { toast(cfg.name + " 不需要洗澡。"); return; }
    a.dirty = false; a.dirtyBy = null; saveState(); renderRanchAnimals(); toast("幫" + cfg.name + "洗好澡了。");
  } else if (tool === "harvest") {
    if (a.dirty) { toast(cfg.name + "髒了 💩，要先洗澡才能收成。"); return; }
    if (!ready) { toast(a.fedAt ? (cfg.name + " 還沒生產完。") : (cfg.name + " 還沒餵飼料。")); return; }
    const yieldN = 3 + Math.floor(Math.random() * 3);
    state.ranchProducts = state.ranchProducts || {};
    state.ranchProducts[a.type] = (state.ranchProducts[a.type] || 0) + yieldN;
    a.produced = (a.produced || 0) + 1;
    a.fedAt = 0; a.dirty = true; a.dirtyBy = "system";
    saveState(); render(); toast("收成 " + yieldN + " 份" + cfg.product + "，放進牧場倉。"); if (fbUser) publishProfile(true);
  }
}


/* ===== 防盜卡 / 金幣卡 / 經驗卡池 使用 ===== */
function isGuarded() { return (state.guardUntil || 0) > Date.now(); }

function useGuard() {
  if (((state.items && state.items.guardCard) || 0) < 1) return;
  state.items.guardCard -= 1;
  const base = Math.max(Date.now(), state.guardUntil || 0);
  state.guardUntil = base + 2 * 60 * 60 * 1000;
  saveState(); renderItemList(); render();
  toast("🛡️ 防盜卡啟用：2 小時內不會被偷菜。");
}

function useCoinCard() {
  if (((state.items && state.items.coinCard500) || 0) < 1) return;
  state.items.coinCard500 -= 1;
  state.coins += 500;
  saveState(); renderItemList(); render();
  toast("🪙 使用金幣兌換卡，+500 金幣。");
}

const EXP_WHEEL = [50, 50, 80, 80, 100, 100, 120, 150, 150, 180, 200, 200, 250, 300, 350];
function useExpPack() {
  if (((state.items && state.items.expSpinPack) || 0) < 1) return;
  state.items.expSpinPack -= 1;
  const exp = EXP_WHEEL[Math.floor(Math.random() * EXP_WHEEL.length)];
  addXp(exp);
  saveState(); renderItemList(); render();
  toast("🎰 經驗轉盤抽中 " + exp + " 點經驗！");
}

/* ===== 兌換碼 ===== */
const REDEEM_ITEM_NAMES = { weatherCard: "天氣兌換卡", guardCard: "防盜卡", coinCard500: "金幣500兌換卡", expSpinPack: "抽獎經驗卡池包", fertilizer: "肥料", thawCard: "解凍卡" };
const REDEEM_CODES = {
  "csccltd": { coins: 1500, items: { weatherCard: 3, guardCard: 2 } },
  "happyfarmer666": { coins: 500, xp: 100, seeds: { turnip: 20 } },
  "happyfarmer777": { coins: 700, xp: 50, inventory: { carrot: 40 } },
  "happyfarmer888": { coins: 1300, xp: 150, items: { weatherCard: 1 } },
  "happyfarmer999": { items: { coinCard500: 3, expSpinPack: 2, weatherCard: 1 } },
};
function openRedeem() {
  const input = window.prompt("輸入兌換碼：");
  if (input === null) return;
  redeemCode(input);
}
function redeemCode(input) {
  const code = String(input).trim().toLowerCase();
  if (!code) return;
  const reward = REDEEM_CODES[code];
  if (!reward) { toast("兌換碼無效。"); return; }
  state.redeemed = state.redeemed || [];
  if (state.redeemed.includes(code)) { toast("這組兌換碼已經用過了。"); return; }
  const parts = [];
  if (reward.coins) { state.coins += reward.coins; parts.push(reward.coins + " 金幣"); }
  if (reward.xp) { addXp(reward.xp); parts.push(reward.xp + " 經驗"); }
  if (reward.seeds) { state.seeds = state.seeds || {}; Object.entries(reward.seeds).forEach(([k, v]) => { state.seeds[k] = (state.seeds[k] || 0) + v; parts.push((CROPS[k] ? CROPS[k].name : k) + "種子×" + v); }); }
  if (reward.inventory) { state.inventory = state.inventory || {}; Object.entries(reward.inventory).forEach(([k, v]) => { state.inventory[k] = (state.inventory[k] || 0) + v; parts.push((CROPS[k] ? CROPS[k].name : k) + "×" + v); }); }
  if (reward.items) { state.items = state.items || {}; Object.entries(reward.items).forEach(([k, v]) => { state.items[k] = (state.items[k] || 0) + v; parts.push((REDEEM_ITEM_NAMES[k] || k) + "×" + v); }); }
  state.redeemed.push(code);
  saveState(); render();
  toast("兌換成功：" + parts.join("、") + "。");
}


/* ===== 信件系統 ===== */
const ADMIN_UIDS = ["Ozb3FwBxDlZiUjdCKEi3zbXkdiw2"];
function isAdmin() { return !!(fbUser && ADMIN_UIDS.includes(fbUser.uid)); }
let mailInbox = [], mailBroadcast = [], mailRecipientType = "player", mailRewardOpen = false;

function myDisplayName() { return String(state.farmName || state.nickname || (fbUser && fbUser.displayName) || "農友").slice(0, 20); }
function tsMillis(t) { try { return t && t.toMillis ? t.toMillis() : (typeof t === "number" ? t : 0); } catch (e) { return 0; } }
function fmtMailTime(t) { const ms = tsMillis(t); if (!ms) return "剛剛"; const d = new Date(ms); const p = (n) => String(n).padStart(2, "0"); return (d.getMonth() + 1) + "/" + d.getDate() + " " + p(d.getHours()) + ":" + p(d.getMinutes()); }

function mailUnreadCount() {
  let n = 0;
  mailInbox.forEach((m) => { if (!m.read) n++; });
  const rb = state.mailReadBroadcast || [];
  mailBroadcast.forEach((b) => { if (!rb.includes(b.id)) n++; });
  return n;
}
function updateMailBadge() {
  const btn = document.querySelector('[data-action="mail"]');
  if (!btn) return;
  let b = btn.querySelector(".mail-badge");
  const n = mailUnreadCount();
  if (n > 0) { if (!b) { b = document.createElement("span"); b.className = "mail-badge"; btn.appendChild(b); } b.textContent = n > 99 ? "99+" : String(n); }
  else if (b) { b.remove(); }
}
async function loadMail() {
  if (!fbDb || !fbUser) return;
  try {
    const ms = await fbDb.collection("mail").doc(fbUser.uid).collection("items").limit(100).get();
    mailInbox = ms.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => tsMillis(b.at) - tsMillis(a.at));
  } catch (e) { console.warn("讀個人信失敗", e); }
  try {
    const bs = await fbDb.collection("broadcast").limit(50).get();
    mailBroadcast = bs.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => tsMillis(b.at) - tsMillis(a.at));
  } catch (e) { console.warn("讀公告失敗", e); }
  updateMailBadge();
}

function openMail() {
  if (!fbUser) { toast("登入 Google 後才能用信件功能。"); return; }
  let box = document.querySelector("#mailBox");
  if (!box) { box = document.createElement("div"); box.id = "mailBox"; box.className = "gm-box"; document.body.appendChild(box); box.addEventListener("click", (e) => { if (e.target === box) box.remove(); }); }
  box.hidden = false;
  loadMail().then(renderMailMenu);
  renderMailMenu();
}
function closeMail() { const b = document.querySelector("#mailBox"); if (b) b.remove(); }

function renderMailMenu() {
  const box = document.querySelector("#mailBox"); if (!box) return;
  const unread = mailUnreadCount();
  box.innerHTML = '<div class="mail-card"><h2>📬 信件</h2>' +
    '<button type="button" class="mail-big" id="mailGoSend">✉️ 寄信</button>' +
    '<button type="button" class="mail-big" id="mailGoInbox">📥 收信' + (unread ? ' <span class="mail-inline-badge">' + unread + '</span>' : '') + '</button>' +
    '<button type="button" class="mail-close" id="mailClose">關閉</button></div>';
  box.querySelector("#mailGoSend").addEventListener("click", renderMailSend);
  box.querySelector("#mailGoInbox").addEventListener("click", renderMailInbox);
  box.querySelector("#mailClose").addEventListener("click", closeMail);
}

function renderMailSend() {
  const box = document.querySelector("#mailBox"); if (!box) return;
  const admin = isAdmin();
  const friendOpts = (state.cloudFriends || []).map((f) => '<option value="' + (f.name || "").replace(/"/g, "") + '">' + (f.name || "好友") + '</option>').join("");
  const adminSel = "";
  let toRow;
  if (admin) {
    // 管理員：收件人那排＝類型下拉 + 名稱(公告時隱藏)
    toRow = '<div class="mail-row"><label>收件人</label>' +
      '<select id="mailType">' +
        '<option value="player"' + (mailRecipientType === "player" ? " selected" : "") + '>一般收件人</option>' +
        '<option value="admin"' + (mailRecipientType === "admin" ? " selected" : "") + '>管-玩家</option>' +
        '<option value="broadcast"' + (mailRecipientType === "broadcast" ? " selected" : "") + '>全服公告</option>' +
      '</select>' +
      '<input id="mailTo" type="text" maxlength="20" placeholder="玩家名稱"' + (mailRecipientType === "broadcast" ? ' style="display:none"' : '') + ' /></div>';
  } else {
    toRow = '<div class="mail-row"><label>收件人</label>' +
      '<input id="mailTo" type="text" maxlength="20" placeholder="輸入玩家名稱" />' +
      '<select id="mailToPick"><option value="">好友…</option>' + friendOpts + '</select></div>';
  }
  const rewardBox = admin ? (
    '<button type="button" id="mailRewardToggle" class="mail-reward-toggle">＋ 附加獎勵／兌換碼</button>' +
    '<div id="mailRewardArea" class="mail-reward-area"' + (mailRewardOpen ? "" : " hidden") + '>' +
      '<div class="mail-row"><label>金幣</label><input id="mailRwCoins" type="number" min="0" placeholder="0" /></div>' +
      '<div class="mail-row"><label>兌換碼</label><input id="mailRwCode" type="text" placeholder="可填現有兌換碼" /></div>' +
    '</div>') : "";
  box.innerHTML = '<div class="mail-card"><h2>✉️ 寄信</h2>' +
    toRow +
    '<div class="mail-row"><label>主旨</label><input id="mailSubject" type="text" maxlength="40" placeholder="主旨" /></div>' +
    '<textarea id="mailBody" maxlength="500" placeholder="信件內容…"></textarea>' +
    rewardBox +
    '<div class="mail-send-row"><button type="button" id="mailSendBtn" class="mail-primary">寄送確認</button></div>' +
    '<button type="button" class="mail-close" id="mailBack">返回</button></div>';
  box.querySelector("#mailBack").addEventListener("click", renderMailMenu);
  box.querySelector("#mailSendBtn").addEventListener("click", sendMail);
  const pick = box.querySelector("#mailToPick");
  if (pick) pick.addEventListener("change", () => { const v = pick.value; if (v) { const to = box.querySelector("#mailTo"); if (to) to.value = v; } });
  const typeSel = box.querySelector("#mailType");
  if (typeSel) typeSel.addEventListener("change", () => { mailRecipientType = typeSel.value; const to = box.querySelector("#mailTo"); if (to) to.style.display = mailRecipientType === "broadcast" ? "none" : ""; });
  const rt = box.querySelector("#mailRewardToggle");
  if (rt) rt.addEventListener("click", () => { mailRewardOpen = !mailRewardOpen; const a = box.querySelector("#mailRewardArea"); if (a) a.hidden = !mailRewardOpen; });
}

function collectMailReward(box) {
  const coins = parseInt((box.querySelector("#mailRwCoins") || {}).value || "0", 10) || 0;
  const code = ((box.querySelector("#mailRwCode") || {}).value || "").trim();
  if (coins <= 0 && !code) return null;
  const rw = {};
  if (coins > 0) rw.coins = coins;
  if (code) rw.code = code;
  return rw;
}

async function sendMail() {
  const box = document.querySelector("#mailBox"); if (!box || !fbDb || !fbUser) return;
  const subject = (box.querySelector("#mailSubject").value || "").trim().slice(0, 40) || "(無主旨)";
  const body = (box.querySelector("#mailBody").value || "").trim().slice(0, 500);
  if (!body) { toast("信件內容不能空白。"); return; }
  const admin = isAdmin();
  // 全服公告
  if (admin && mailRecipientType === "broadcast") {
    const payload = { fromName: "📢 管理員公告", subject: subject, body: body, at: firebase.firestore.FieldValue.serverTimestamp() };
    const rw = collectMailReward(box); if (rw) payload.reward = rw;
    try { await fbDb.collection("broadcast").add(payload); toast("已發送全服公告。"); renderMailMenu(); loadMail(); }
    catch (e) { console.warn(e); toast("發送失敗（權限或網路）。"); }
    return;
  }
  const name = (box.querySelector("#mailTo").value || "").trim();
  if (!name) { toast("請輸入收件人。"); return; }
  let uid = null, rname = name;
  const fr = (state.cloudFriends || []).find((f) => f.name === name);
  if (fr) { uid = fr.uid; rname = fr.name; }
  else {
    try { const q = await fbDb.collection("profiles").where("nameLower", "==", name.toLowerCase()).limit(1).get(); if (!q.empty) { uid = q.docs[0].id; rname = q.docs[0].data().farmName || name; } } catch (e) {}
  }
  if (!uid) { toast("找不到這位玩家（名稱要正確）。"); return; }
  if (uid === fbUser.uid) { toast("不能寄給自己啦 😄"); return; }
  const isFriend = (state.cloudFriends || []).some((f) => f.uid === uid);
  if (!admin && !isFriend) {
    const now = Date.now();
    state.mailNonFriendLog = (state.mailNonFriendLog || []).filter((t) => now - t < 86400000);
    if (state.mailNonFriendLog.length >= 5) { toast("對非好友一天最多寄 5 封，明天再寄。"); return; }
  }
  const kind = (admin && mailRecipientType === "admin") ? "admin" : "player";
  const payload = { from: fbUser.uid, fromName: kind === "admin" ? "🛡️ 管理員" : myDisplayName(), subject: subject, body: body, at: firebase.firestore.FieldValue.serverTimestamp(), read: false, kind: kind };
  if (admin) { const rw = collectMailReward(box); if (rw) payload.reward = rw; }
  try {
    await fbDb.collection("mail").doc(uid).collection("items").add(payload);
    if (!admin && !isFriend) { state.mailNonFriendLog.push(Date.now()); saveState(); }
    toast("信件已寄給 " + rname + "！");
    renderMailMenu(); loadMail();
  } catch (e) { console.warn(e); toast("寄送失敗（網路或權限）。"); }
}

function renderMailInbox() {
  const box = document.querySelector("#mailBox"); if (!box) return;
  const rb = state.mailReadBroadcast || [];
  const list = []
    .concat(mailBroadcast.map((b) => ({ kind: "broadcast", id: b.id, fromName: b.fromName || "📢 公告", subject: b.subject, body: b.body, at: b.at, reward: b.reward, read: rb.includes(b.id) })))
    .concat(mailInbox.map((m) => ({ kind: m.kind || "player", id: m.id, fromName: m.fromName || "玩家", subject: m.subject, body: m.body, at: m.at, reward: m.reward, read: !!m.read })))
    .sort((a, b) => tsMillis(b.at) - tsMillis(a.at));
  const rows = list.length ? list.map((m, i) => {
    return '<div class="mail-item ' + (m.read ? "is-read" : "is-unread") + '" data-mi="' + i + '">' +
      '<span class="mail-dot"></span>' +
      '<div class="mail-item-main"><div class="mail-item-top"><strong>' + (m.subject || "(無主旨)") + '</strong><span class="mail-item-time">' + fmtMailTime(m.at) + '</span></div>' +
      '<div class="mail-item-from">' + m.fromName + '</div></div></div>';
  }).join("") : '<p class="item-empty">沒有信件。</p>';
  box.innerHTML = '<div class="mail-card"><h2>📥 收信</h2><div class="mail-list">' + rows + '</div>' +
    '<button type="button" class="mail-close" id="mailBack">返回</button></div>';
  box.querySelector("#mailBack").addEventListener("click", renderMailMenu);
  box.querySelectorAll("[data-mi]").forEach((el) => el.addEventListener("click", () => openMailItem(list[Number(el.dataset.mi)])));
}

function openMailItem(m) {
  if (!m) return;
  // 標記已讀 + 領獎(一次)
  if (m.kind === "broadcast") {
    state.mailReadBroadcast = state.mailReadBroadcast || [];
    const firstRead = !state.mailReadBroadcast.includes(m.id);
    if (firstRead) { state.mailReadBroadcast.push(m.id); claimMailReward(m.reward, m.id, true); saveState(); }
  } else {
    const local = mailInbox.find((x) => x.id === m.id);
    const firstRead = local && !local.read;
    if (local) local.read = true;
    if (firstRead) {
      try { fbDb.collection("mail").doc(fbUser.uid).collection("items").doc(m.id).update({ read: true }); } catch (e) {}
      claimMailReward(m.reward, m.id, false);
      saveState();
    }
  }
  updateMailBadge();
  const box = document.querySelector("#mailBox"); if (!box) return;
  let rewardHtml = "";
  if (m.reward) {
    const parts = [];
    if (m.reward.coins) parts.push("金幣 " + m.reward.coins);
    if (m.reward.code) parts.push("兌換碼：" + m.reward.code);
    rewardHtml = '<div class="mail-reward-note">🎁 附帶獎勵：' + parts.join("、") + "（已自動領取）</div>";
  }
  box.innerHTML = '<div class="mail-card"><h2>' + (m.subject || "(無主旨)") + '</h2>' +
    '<div class="mail-read-meta">寄件人：' + m.fromName + '　·　' + fmtMailTime(m.at) + '</div>' +
    '<div class="mail-read-body">' + String(m.body || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/\n/g, "<br>") + '</div>' +
    rewardHtml +
    '<button type="button" class="mail-primary" id="mailDone">閱讀完成</button>' +
    '<button type="button" class="mail-close" id="mailBack">返回收信</button></div>';
  box.querySelector("#mailDone").addEventListener("click", renderMailInbox);
  box.querySelector("#mailBack").addEventListener("click", renderMailInbox);
}

function claimMailReward(reward, id, isBroadcast) {
  if (!reward) return;
  const claimed = state.mailClaimed || (state.mailClaimed = []);
  const key = (isBroadcast ? "b:" : "m:") + id;
  if (claimed.includes(key)) return;
  claimed.push(key);
  const parts = [];
  if (reward.coins) { state.coins = (state.coins || 0) + reward.coins; parts.push(reward.coins + " 金幣"); }
  saveState(); render();
  if (reward.code) { redeemCode(reward.code); }      // 兌換碼用既有邏輯(含有效性/只能用一次)
  if (parts.length) toast("領取獎勵：" + parts.join("、"));
}

/* ===== 上排工具列自動縮放字體以符合寬幅 ===== */
function fitField() {
  const f = document.querySelector(".field-frame");
  if (!f) return;
  if (window.self !== window.top) { f.style.width = ""; f.style.height = ""; f.style.aspectRatio = ""; return; }
  const desktop = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!desktop) { f.style.width = ""; f.style.height = ""; f.style.aspectRatio = ""; return; }
  // 量可用格子大小：先撐滿再量
  f.style.width = "100%"; f.style.height = "100%"; f.style.aspectRatio = "auto";
  const aw = f.clientWidth, ah = f.clientHeight;
  if (!aw || !ah) { f.style.width = ""; f.style.height = ""; f.style.aspectRatio = ""; return; }
  const R = 1672 / 941;
  let w = aw, h = w / R;
  if (h > ah) { h = ah; w = h * R; }     // 先碰下緣→以高度為準；否則以寬度為準
  f.style.width = Math.floor(w) + "px";
  f.style.height = Math.floor(h) + "px";
  f.style.aspectRatio = "";
}

function fitToolbar() {
  const bar = document.querySelector(".scene-toolbar-top");
  if (!bar) return;
  bar.style.setProperty("--tb-scale", "1");
  const avail = bar.clientWidth || 0;
  const need = bar.scrollWidth || 0;
  if (need > avail + 1 && avail > 0) {
    bar.style.setProperty("--tb-scale", Math.max(0.68, avail / need).toFixed(3));
  }
}


/* 倒數時間格式（M:SS 或 Xs）*/
function fmtSecs(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(s / 60);
  return m > 0 ? (m + ":" + String(s % 60).padStart(2, "0")) : (s + "s");
}
