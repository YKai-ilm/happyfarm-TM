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
  0: [17.2, 69.4], 1: [18.7, 69.4], 2: [20.0, 69.4], 3: [21.3, 69.4],
  4: [15.3, 57.4], 5: [16.3, 57.4], 6: [16.4, 57.4], 7: [15.3, 57.4],
  8: [17.0, 48.7], 9: [17.8, 44.9], 10: [14.4, 47.3], 11: [13.1, 47.3],
  12: [19.1, 44.4], 13: [7.5, 41.6], 14: [13.0, 42.5], 15: [11.2, 35.5],
};

const CLOUD_POS = { 0: [50.9, 1.8], 1: [35.8, 1.7] };

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
let gmInvSnap = null;

// grow/regrow 單位「分鐘」；sell=每顆售價(原版)；yieldCount=每次收成顆數(原版產量)；img:true 有田間 PNG
const CROPS = {
  turnip:      { name: "白蘿蔔", cost: 125,   sell: 17, yieldCount: 16, grow: 2.5,  regrow: 0,    seasons: 1, xp: 15, unlock: 0,  img: true, colors: ["#f8f3ee", "#d94c75", "#67a84f"] },
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
    description: "每級讓作物成長時間縮短 6%。",
    cost: (n) => 5000 + 2500 * n * (n + 1),
    reqLevel: () => 5,
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
  item: `<svg viewBox="0 0 24 24"><path d="M10 3.2h4v4.3l3.4 8.2a2 2 0 0 1-1.85 2.8H8.45a2 2 0 0 1-1.85-2.8L10 7.5z" fill="#8fc6e0" stroke="#37657d" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 3.2h6" stroke="#37657d" stroke-width="1.7" stroke-linecap="round"/><path d="M7.6 14.5h8.8" stroke="#37657d" stroke-width="1.2"/><circle cx="11" cy="16.5" r="1" fill="#fff"/><circle cx="13.6" cy="17.6" r="0.8" fill="#fff"/></svg>`,
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
const FRIEND_PLOT_MAX = 8;
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

let state = loadState();
let shopQty = {};
let spinning = false;
let pendingWeatherCard = false;
let pendingFertilize = false;
let lastTickTime = Date.now();
let lastFriendSteal = Date.now();
let giftSectionOpen = { newbie: true, event: false, friend: false };
ensureOrders();
hydrateIcons();
bindStaticEvents();
bindBgm();
render();
setupCloudDrag();
window.setInterval(tick, 1000);

function createDefaultState() {
  return {
    coins: 3000,
    level: 1,
    xp: 0,
    day: 1,
    weather: "sun",
    weatherNextAt: 0,
    gm: false,
    selectedTool: "seed",
    selectedSeed: "turnip",
    activeTab: "shop",
    inventory: Object.fromEntries(Object.keys(CROPS).map((id) => [id, 0])),
    seeds: Object.fromEntries(Object.keys(CROPS).map((id) => [id, 0])),
    giftsClaimed: [],
    openingSpinDone: false,
    items: { weatherCard: 0, fertilizer: 0, thawCard: 0 },
    damaged: {},
    friends: [],
    candidates: makeBuiltinCandidates(),
    plots: Array.from({ length: PLOT_COUNT }, (_, index) => ({
      unlocked: index < 4,
      crop: null,
      plantedAt: 0,
      season: 0,
      watered: false,
    })),
    orders: [],
    upgrades: {
      windmill: 0,
      stand: 0,
    },
    ordersCompleted: 0,
    nickname: "",
    avatar: "👨‍🌾",
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
      damaged: (raw.damaged && typeof raw.damaged === "object") ? { ...raw.damaged } : {},
      friends: Array.isArray(raw.friends) ? raw.friends : [],
      candidates: Array.isArray(raw.candidates) ? raw.candidates : defaults.candidates.filter((c) => !(raw.friends || []).some((f) => f.name === c.name)),
      upgrades: { ...defaults.upgrades, ...(raw.upgrades || {}) },
      plots: defaults.plots.map((plot, index) => ({
        ...plot,
        ...((raw.plots && raw.plots[index]) || {}),
      })),
      orders: Array.isArray(raw.orders) ? raw.orders : [],
    };
  } catch {
    return defaults;
  }
}

function saveState() {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
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
    candidates: Array.isArray(data.candidates) ? data.candidates : defaults.candidates.filter((c) => !(data.friends || []).some((f) => f.name === c.name)),
    upgrades: { ...defaults.upgrades, ...(data.upgrades || {}) },
    plots: defaults.plots.map((plot, index) => ({
      ...plot,
      ...((data.plots && data.plots[index]) || {}),
    })),
    orders: Array.isArray(data.orders) ? data.orders : [],
  };
  ensureOrders();
  saveState();
  closeSaveBox();
  render();
  toast("已用備份碼還原進度。");
}

const GM_PASSWORDS = ["70629", "ykai"];

function updateGmBadge() {
  const badge = document.querySelector("#gmBadge");
  if (badge) {
    badge.hidden = !state.gm;
  }
  document.querySelector(".farm-app")?.classList.toggle("is-gm", !!state.gm);
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
  showGmBox("#gmPanel");
}

function gmReset() {
  if (!window.confirm("確定要把遊戲重置成初始狀態嗎？此動作無法復原。")) {
    return;
  }
  const keepGm = state.gm;
  state = createDefaultState();
  state.gm = keepGm;
  ensureOrders();
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
  return JSON.parse(JSON.stringify(state.inventory));
}
function gmApplyInv(s) {
  state.inventory = JSON.parse(JSON.stringify(s));
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
  if (gmInvSnap) gmApplyInv(gmInvSnap);
  saveState();
  render();
  hideGmBox("#gmInvBox");
  showGmBox("#gmEdit");
}
function gmInvDismiss() {
  if (gmInvSnap) gmApplyInv(gmInvSnap);
  saveState();
  render();
  hideGmBox("#gmInvBox");
}

function buildGmInvList() {
  const list = document.querySelector("#gmInvList");
  if (!list) return;
  list.innerHTML = Object.entries(CROPS).map(([id, c]) => `
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
  list.querySelectorAll("[data-gm-inv-dec]").forEach((b) => b.addEventListener("click", () => gmSetInv(b.dataset.gmInvDec, (state.inventory[b.dataset.gmInvDec] || 0) - 1)));
  list.querySelectorAll("[data-gm-inv-inc]").forEach((b) => b.addEventListener("click", () => gmSetInv(b.dataset.gmInvInc, (state.inventory[b.dataset.gmInvInc] || 0) + 1)));
  list.querySelectorAll("[data-gm-inv-num]").forEach((n) => n.addEventListener("input", () => { if (n.value !== "") gmSetInv(n.dataset.gmInvNum, parseInt(n.value, 10)); }));
  list.querySelectorAll("[data-gm-inv-range]").forEach((r) => r.addEventListener("input", () => gmSetInv(r.dataset.gmInvRange, parseInt(r.value, 10))));
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
  document.querySelectorAll("[data-tool]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTool = (state.selectedTool === button.dataset.tool) ? "" : button.dataset.tool;
      saveState();
      render();
    });
  });

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextTab = button.dataset.tab;
      const workPanel = document.querySelector(".work-panel");
      const isSameOpen = workPanel?.classList.contains("is-open") && state.activeTab === nextTab;
      state.activeTab = nextTab;
      if (isSameOpen) {
        openPanel("");
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
      document.querySelectorAll("[data-menu-action]").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      const labels = {
        profile: "角色設定會放頭像、稱號和玩家資料。",
        farm: "農場設定會放農場名稱、佈景和公開狀態。",
        invite: "邀請好友會放好友碼和拜訪連結。",
        notice: "常見問題會放操作說明和版本資訊。",
        redeem: "兌換碼之後可輸入序號領取獎勵，功能開發中。",
      };
      toast(labels[button.dataset.menuAction] || "功能準備中。");
    });
  });

  const saveBox = document.querySelector("#saveBox");
  const exportBtn = document.querySelector("#exportCodeBtn");
  const importBtn = document.querySelector("#importCodeBtn");
  const saveBoxClose = document.querySelector("#saveBoxClose");
  if (exportBtn) exportBtn.addEventListener("click", exportCode);
  if (importBtn) importBtn.addEventListener("click", importCode);
  if (saveBoxClose) saveBoxClose.addEventListener("click", closeSaveBox);
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
  if (farmNameInput) farmNameInput.addEventListener("input", () => { state.farmName = farmNameInput.value; saveState(); });
  const farmClose = document.querySelector("#farmClose");
  if (farmClose) farmClose.addEventListener("click", closeFarmSettings);
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
  document.querySelector("#gmTodoBtn")?.addEventListener("click", exportStakePos);
  document.querySelector("#gmPanelClose")?.addEventListener("click", () => hideGmBox("#gmPanel"));
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
  document.querySelector("#gmInvRevert")?.addEventListener("click", gmInvRevert);
  document.querySelector("#gmInvBack")?.addEventListener("click", gmInvBack);
  const gmInvBox = document.querySelector("#gmInvBox");
  if (gmInvBox) gmInvBox.addEventListener("click", (e) => { if (e.target === gmInvBox) gmInvDismiss(); });
  document.querySelector("#gmOrderRefresh")?.addEventListener("click", () => {
    state.orders = []; ensureOrders(); saveState(); render(); toast("訂單已刷新。");
  });
  document.querySelector("#gmThief")?.addEventListener("click", gmSpawnThief);
  makeGmBadgeDraggable();

  document.querySelectorAll("[data-panel-target]").forEach((button) => {
    button.addEventListener("click", () => {
      togglePanel(button.dataset.panelTarget, getPanelAnchor(button));
    });
  });

  elements.restButton.addEventListener("click", restOneDay);
  elements.sellAllButton.addEventListener("click", sellAllInventory);
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
}

function renderItemList() {
  const list = document.querySelector("#itemList");
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
    </div>`;
  }
  if (!rows) rows = '<p class="item-empty">目前沒有道具。</p>';
  list.innerHTML = rows;
  const useFert = document.querySelector("#useFert");
  if (useFert) useFert.addEventListener("click", startFertilize);
  const useW = document.querySelector("#useWcard");
  if (useW) useW.addEventListener("click", () => { pendingWeatherCard = true; renderItemList(); });
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
  const target = Math.min(FRIEND_PLOT_MAX, 2 + PLOT_UNLOCKS.filter((u) => u.level <= lvl).length);
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
      p.yield = Math.round(CROPS[id].yieldCount * (0.8 + Math.random() * 0.6));
      p.stolen = 0;
      p.hazard = pickHazard();
    } else if (lingered) {
      // 成熟超過可偷窗口 → 好友自己收掉、重種一個新的（從現在開始長）
      const id = pool[Math.floor(Math.random() * pool.length)];
      p.crop = id;
      p.plantedAt = now;
      p.stolenAt = 0;
      p.yield = Math.round(CROPS[id].yieldCount * (0.8 + Math.random() * 0.6));
      p.stolen = 0;
      p.hazard = pickHazard();
    }
  });
}

function openFriends() {
  renderFriendsList();
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
  const box = document.querySelector("#inviteBox");
  if (box) box.hidden = false;
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
  renderFriendFarm(id);
  const box = document.querySelector("#friendFarmBox");
  if (box) box.hidden = false;
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
  const labels = { weed: "除草", bug: "除蟲", dry: "澆水" };
  const did = labels[p.hazard];
  const hk = { weed: "weed", bug: "bug", dry: "water" }[p.hazard];
  if (hk && state.stats) state.stats[hk] = (state.stats[hk] || 0) + 1;
  p.hazard = null;
  const coin = 20 + state.level * 3;
  state.coins += coin;
  addXp(5);
  toast(`幫 ${friend.name} ${did}，獲得 ${coin} 金幣、5 XP。`);
  saveState();
  renderFriendFarm(friendId);
  render();
}

const AVATARS = ["👨‍🌾", "👩‍🌾", "🧑‍🌾", "👦", "👧", "🧒", "🧔", "👩‍🦰", "🧓", "👵", "👨", "👩"];

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

function openProfile() { renderProfile(); const b = document.querySelector("#profileBox"); if (b) b.hidden = false; }
function closeProfile() { const b = document.querySelector("#profileBox"); if (b) b.hidden = true; }

function renderProfile() {
  const nameInput = document.querySelector("#profileName");
  if (nameInput) nameInput.value = state.nickname || "";
  const titleEl = document.querySelector("#profileTitle");
  if (titleEl) titleEl.textContent = playerTitle();
  const av = document.querySelector("#profileAvatars");
  if (av) {
    av.innerHTML = AVATARS.map((e) => `<button type="button" class="avatar-btn ${state.avatar === e ? "is-on" : ""}" data-avatar="${e}">${e}</button>`).join("");
    av.querySelectorAll("[data-avatar]").forEach((b) => b.addEventListener("click", () => { state.avatar = b.dataset.avatar; saveState(); renderProfile(); }));
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

function openFarmSettings() { renderFarmSettings(); const b = document.querySelector("#farmBox"); if (b) b.hidden = false; }
function closeFarmSettings() { const b = document.querySelector("#farmBox"); if (b) b.hidden = true; }

function renderFarmSettings() {
  const nameInput = document.querySelector("#farmNameInput");
  if (nameInput) nameInput.value = state.farmName || "";
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
  applyWeatherPassive();
  renderHeader();
  renderFarm();
  renderInventory();
  renderDamaged();
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
  const w = ["rain", "storm", "snow", "typhoon", "scorch", "breeze", "fog", "cloud"].includes(state.weather) ? state.weather : "";
  fx.className = "wfx" + (w ? " " + w : "");
  applyClouds();
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
  const ffBox = document.querySelector("#friendFarmBox");
  if (ffBox && !ffBox.hidden && currentFriendId) {
    const f = state.friends.find((x) => x.id === currentFriendId);
    if (f) { refreshFriendFarm(f); renderFriendFarm(currentFriendId); }
  }
}

function gmSpawnThief() {
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
  const first = state.plots.findIndex((p) => p.unlocked && !p.broken);
  if (first >= 0) {
    state.plots[first] = { ...state.plots[first], crop: null, plantedAt: 0, season: 0, soakMs: 0, frostMs: 0, typhoonHalf: false, watered: false, broken: true };
  }
  toast("颱風來襲！第一塊農地被吹壞，隨機三格作物收成減半。");
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
      const remaining = Math.max(0, getPlotDuration(plot) - (Date.now() - plot.plantedAt));
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
  elements.farmGrid.innerHTML = state.plots
    .map((plot, index) => {
      if (!plot.unlocked) {
        return `
          <button class="plot locked" type="button" data-plot="${index}" data-slot="${index + 1}" title="未開墾">
            <span class="plot-stake"${stakeStyle(index)} aria-hidden="true">🚩</span>
            ${ICONS.lock}
            <span class="plot-label">未開墾</span>
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
          ${plot.thief ? `<span class="thief-wrap" aria-hidden="true"><span class="thief-label">趕走 ${Math.max(0, Math.ceil((plot.thief.expiresAt - Date.now()) / 1000))}s</span><span class="thief-person">🦹</span></span>` : ""}
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
  if (!out.length) { toast("目前畫面沒有標桿可匯出（未開墾／損壞田才有）。"); return; }
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
  const text = out.join(" | ") + (cl.length ? "\n雲： " + cl.join(" | ") : "");
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
  if (readout && !readout.dataset.init) {
    readout.dataset.init = "1";
    readout.textContent = "GM：拖曳田裡的標桿來校正位置";
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
              <span>${count} 個</span>
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

  elements.inventoryList.querySelectorAll("[data-sell-item]").forEach((button) => {
    button.addEventListener("click", () => sellItem(button.dataset.sellItem));
  });

  elements.sellAllButton.disabled = inventoryValue() <= 0;
}

function renderTabs() {
  document.querySelector(".farm-app")?.classList.toggle("is-watering-tool", state.selectedTool === "water");
  document.querySelector(".farm-app")?.classList.toggle("is-planting-tool", state.selectedTool === "seed");
  const workOpen = document.querySelector(".work-panel")?.classList.contains("is-open");

  document.querySelectorAll("[data-tool]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tool === state.selectedTool);
  });

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("is-active", workOpen && button.dataset.tab === state.activeTab);
  });

  if (elements.workPanelTitle) {
    const titles = { shop: "種子", market: "農民市集", orders: "訂單", upgrades: "開發" };
    elements.workPanelTitle.textContent = titles[state.activeTab] || "農場管理";
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
  elements.tabContent.innerHTML = Object.entries(CROPS)
    .map(([id, crop]) => {
      const locked = crop.unlock > state.level;
      const selected = state.selectedSeed === id;
      return `
        <article class="seed-card ${locked ? "is-locked" : ""}">
          <span class="mini-crop" aria-hidden="true">${cropCardVisual(id)}</span>
          <span class="seed-details">
            <span class="seed-title">
              <span class="seed-name-wrap">
                <strong>${crop.name}</strong>
                <span class="seed-grow-pill">⏱ ${formatMinutes(crop.grow)}</span>
              </span>
              <span class="seed-price">${locked ? `Lv.${crop.unlock}` : `${crop.cost} 金幣`}</span>
            </span>
            <span class="seed-meta">單價 ${sellPrice(id)} · 產量 ${crop.yieldCount} · 經驗 ${crop.xp}</span>
            <span class="seed-bag-line">種子背包 <strong>${state.seeds[id] || 0}</strong> · 倉庫 ${state.inventory[id] || 0}</span>
            <span class="seed-buy">
              <button class="seed-step" type="button" data-seed-dec="${id}" ${locked ? "disabled" : ""}>−</button>
              <input class="seed-qty" type="number" inputmode="numeric" min="1" data-seed-qty="${id}" value="${shopQty[id] || 1}" ${locked ? "disabled" : ""} />
              <button class="seed-step" type="button" data-seed-inc="${id}" ${locked ? "disabled" : ""}>＋</button>
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

function marketRow(key, name, cost, desc) {
  const have = (state.items && state.items[key]) || 0;
  return `
    <article class="seed-card">
      <span class="mini-crop market-icon" aria-hidden="true">${name.split(" ")[0]}</span>
      <span class="seed-details">
        <span class="seed-title">
          <span class="seed-name-wrap"><strong>${name}</strong></span>
          <span class="seed-price">${cost} 金幣</span>
        </span>
        <span class="seed-meta">${desc}</span>
        <span class="seed-actions">
          <span class="seed-meta">持有 ${have}</span>
          <button class="seed-button" type="button" data-buy="${key}">
            <span class="button-icon" aria-hidden="true" data-icon="cart"></span>
            購買
          </button>
        </span>
      </span>
    </article>`;
}

function renderMarket() {
  elements.tabContent.innerHTML =
    marketRow("fertilizer", "🌱 肥料", FERTILIZER_COST, "對一塊田施肥，剩餘成長時間減半（一作物限一次）") +
    marketRow("thawCard", "🃏 解凍卡", THAW_CARD_COST, "對凍傷作物完全返還最多 50 個（在災損清單使用）");
  elements.tabContent.querySelectorAll("[data-buy]").forEach((b) => {
    b.addEventListener("click", () => {
      if (b.dataset.buy === "fertilizer") buyFertilizer();
      if (b.dataset.buy === "thawCard") buyThawCard();
    });
  });
}

function renderOrders() {
  ensureOrders();
  elements.tabContent.innerHTML = state.orders
    .map((order) => {
      const canFill = canCompleteOrder(order);
      return `
        <article class="order-card">
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
            <span class="order-reward-label">報酬</span>
            <span class="reward-pill reward-coin">${ICONS.coin}<strong>${order.reward}</strong></span>
            <span class="reward-pill reward-xp">${ICONS.star}<strong>${order.xp}</strong> XP</span>
          </div>
          <button class="action-button" type="button" data-complete-order="${order.id}" ${canFill ? "" : "disabled"}>
            <span class="button-icon" aria-hidden="true" data-icon="check"></span>
            完成訂單
          </button>
        </article>
      `;
    })
    .join("");

  elements.tabContent.querySelectorAll("[data-complete-order]").forEach((button) => {
    button.addEventListener("click", () => completeOrder(button.dataset.completeOrder));
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
          <span class="upgrade-meta">${upgrade.description}${reqText.length ? `（${reqText.join("、")}）` : ""}</span>
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

  elements.tabContent.innerHTML = plotRow + repairRow + upgradeRows;

  const plotButton = elements.tabContent.querySelector("[data-buy-plot]");
  if (plotButton) {
    plotButton.addEventListener("click", buyPlot);
  }

  const repairBtn = elements.tabContent.querySelector("[data-repair-plot]");
  if (repairBtn) repairBtn.addEventListener("click", repairPlot);

  elements.tabContent.querySelectorAll("[data-buy-upgrade]").forEach((button) => {
    button.addEventListener("click", () => buyUpgrade(button.dataset.buyUpgrade));
  });
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
  if (!plot.crop) {
    toast("這格還沒有作物。");
    return;
  }

  if (getPlotProgress(plot) < 1) {
    toast("再等一下，作物還沒成熟。");
    return;
  }

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
    state.plots[index] = { ...plot, plantedAt: Date.now(), season: season + 1, soakMs: 0, frostMs: 0, typhoonHalf: false, watered: false };
    toast(`${crop.name} 收成 ${amount} 個，還會再長第 ${season + 2} 季。${penaltyNote}`);
  } else {
    state.plots[index] = { ...plot, crop: null, plantedAt: 0, season: 0, soakMs: 0, frostMs: 0, typhoonHalf: false, stolenPct: 0, thief: null, watered: false };
    toast(`${crop.name} 收成 ${amount} 個。${penaltyNote}`);
  }
  saveState();
  render();
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

function sellItem(id) {
  const count = state.inventory[id] || 0;
  if (count <= 0) {
    return;
  }

  const earned = count * sellPrice(id);
  state.inventory[id] = 0;
  state.coins += earned;
  toast(`${CROPS[id].name} 售出，獲得 ${earned} 金幣。`);
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
  if (!order || !canCompleteOrder(order)) {
    toast("訂單材料還不夠。");
    return;
  }

  order.items.forEach((item) => {
    state.inventory[item.crop] -= item.count;
  });
  state.coins += order.reward;
  addXp(order.xp);
  state.ordersCompleted = (state.ordersCompleted || 0) + 1;
  state.orders = state.orders.map((item) => (item.id === orderId ? createOrder() : item));
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

function ensureOrders() {
  while (state.orders.length < 3) {
    state.orders.push(createOrder());
  }
}

function createOrder() {
  const available = Object.keys(CROPS).filter((id) => CROPS[id].unlock <= state.level);
  const itemCount = Math.min(available.length, Math.random() < 0.62 ? 1 : 2);
  const shuffled = [...available].sort(() => Math.random() - 0.5).slice(0, itemCount);
  const items = shuffled.map((cropId) => {
    const base = 2 + Math.floor(Math.random() * (2 + state.level));
    const count = cropId === "turnip" ? base + 1 : Math.max(1, base - 1);
    return { crop: cropId, count };
  });
  const cropValue = items.reduce((sum, item) => sum + sellPrice(item.crop) * item.count, 0);
  return {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    items,
    reward: Math.round(cropValue * 1.28 + 8 + state.level * 5),
    xp: 8 + items.reduce((sum, item) => sum + CROPS[item.crop].xp * item.count, 0),
  };
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
  const windmill = 1 - (state.upgrades.windmill || 0) * 0.06;
  const weather = WEATHERS[state.weather].growth;
  const water = plot.watered ? 2 / 3 : 1;
  return baseMinutes * 60 * 1000 * Math.max(0.48, windmill * weather * water);
}

function getPlotProgress(plot) {
  if (!plot.crop) {
    return 0;
  }

  return Math.min(1, (Date.now() - plot.plantedAt) / getPlotDuration(plot));
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
