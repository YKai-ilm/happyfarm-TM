const SAVE_KEY = "happy-farm-browser-game-v1";
const PLOT_COUNT = 16;
// 原版開墾：最初 6 格，之後依序解鎖（金幣 / 需求等級）
const PLOT_UNLOCKS = [
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

// grow / regrow 單位為「小時」（照原版開心農場數值）；img:true 代表有田間 PNG 圖，其餘用程式繪製的 SVG 代替
const CROPS = {
  turnip:      { name: "白蘿蔔", cost: 125,  sell: 17, grow: 10, regrow: 0,  seasons: 1, xp: 15, unlock: 0,  img: true, colors: ["#f8f3ee", "#d94c75", "#67a84f"] },
  carrot:      { name: "胡蘿蔔", cost: 163,  sell: 21, grow: 13, regrow: 0,  seasons: 1, xp: 18, unlock: 0,  img: true, colors: ["#f08a2d", "#ca5c24", "#5fa84d"] },
  corn:        { name: "玉米",   cost: 175,  sell: 23, grow: 14, regrow: 0,  seasons: 1, xp: 19, unlock: 3,  img: true, colors: ["#f7d64c", "#e2a73a", "#4d8a43"] },
  potato:      { name: "土豆",   cost: 188,  sell: 24, grow: 15, regrow: 0,  seasons: 1, xp: 20, unlock: 4,  colors: ["#d9a86a", "#a9783f", "#6a9a4c"] },
  eggplant:    { name: "茄子",   cost: 237,  sell: 25, grow: 16, regrow: 0,  seasons: 1, xp: 21, unlock: 5,  colors: ["#7b4ea3", "#4f2f70", "#5a9a4c"] },
  tomato:      { name: "番茄",   cost: 251,  sell: 26, grow: 17, regrow: 0,  seasons: 1, xp: 22, unlock: 6,  colors: ["#e0473a", "#a82b22", "#5a9a4c"] },
  pea:         { name: "豌豆",   cost: 266,  sell: 27, grow: 18, regrow: 0,  seasons: 1, xp: 23, unlock: 7,  colors: ["#8fc24f", "#5d9a32", "#4d8a43"] },
  pepper:      { name: "辣椒",   cost: 296,  sell: 28, grow: 20, regrow: 0,  seasons: 1, xp: 25, unlock: 8,  colors: ["#d8362b", "#9a241c", "#5a9a4c"] },
  pumpkin:     { name: "南瓜",   cost: 325,  sell: 30, grow: 22, regrow: 0,  seasons: 1, xp: 27, unlock: 9,  img: true, colors: ["#e98231", "#b44f25", "#3e7d43"] },
  apple:       { name: "蘋果",   cost: 578,  sell: 24, grow: 21, regrow: 9,  seasons: 2, xp: 18, unlock: 10, colors: ["#e23b3b", "#a3242b", "#5aa14c"] },
  strawberry:  { name: "草莓",   cost: 605,  sell: 27, grow: 24, regrow: 11, seasons: 2, xp: 20, unlock: 10, img: true, colors: ["#de3f4f", "#9c2734", "#4e9c50"] },
  watermelon:  { name: "西瓜",   cost: 708,  sell: 29, grow: 28, regrow: 13, seasons: 2, xp: 23, unlock: 11, colors: ["#4ca64c", "#2f6f37", "#3e7d43"] },
  banana:      { name: "香蕉",   cost: 900,  sell: 32, grow: 31, regrow: 14, seasons: 2, xp: 25, unlock: 12, colors: ["#f2cf3e", "#c79a2a", "#5a9a4c"] },
  peach:       { name: "桃子",   cost: 1200, sell: 40, grow: 42, regrow: 18, seasons: 2, xp: 33, unlock: 13, colors: ["#f3a6b0", "#d76b7e", "#5aa14c"] },
  orange:      { name: "橙子",   cost: 1587, sell: 41, grow: 37, regrow: 16, seasons: 3, xp: 25, unlock: 14, colors: ["#f0922e", "#c4671e", "#5aa14c"] },
  grape:       { name: "葡萄",   cost: 1978, sell: 47, grow: 46, regrow: 20, seasons: 3, xp: 30, unlock: 15, colors: ["#7b4ea3", "#4f2f70", "#5aa14c"] },
  pomegranate: { name: "石榴",   cost: 2425, sell: 54, grow: 52, regrow: 22, seasons: 3, xp: 34, unlock: 16, colors: ["#cf3a4a", "#8f2330", "#5aa14c"] },
};

const WEATHERS = {
  sun: { name: "晴朗", icon: "sun", growth: 0.94, line: "陽光很足，作物會精神一點。" },
  cloud: { name: "多雲", icon: "cloud", growth: 1, line: "雲層厚厚的，節奏剛剛好。" },
  rain: { name: "小雨", icon: "rain", growth: 0.82, line: "雨水落下，田地自己喝飽了。" },
};

const UPGRADES = {
  windmill: {
    name: "風車",
    icon: "wind",
    max: 5,
    description: "每級讓作物成長時間縮短 6%。",
    cost: (level) => 110 + level * 70,
  },
  stand: {
    name: "小攤",
    icon: "cart",
    max: 5,
    description: "每級讓倉庫出售價格提高 7%。",
    cost: (level) => 120 + level * 80,
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

let state = loadState();
ensureOrders();
hydrateIcons();
bindStaticEvents();
render();
window.setInterval(tick, 1000);

function createDefaultState() {
  return {
    coins: 3000,
    level: 1,
    xp: 0,
    day: 1,
    weather: "sun",
    selectedTool: "seed",
    selectedSeed: "turnip",
    activeTab: "shop",
    inventory: Object.fromEntries(Object.keys(CROPS).map((id) => [id, 0])),
    plots: Array.from({ length: PLOT_COUNT }, (_, index) => ({
      unlocked: index < 6,
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

function bindStaticEvents() {
  document.querySelectorAll("[data-tool]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedTool = button.dataset.tool;
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
      if (button.dataset.action === "rest") {
        restOneDay();
      }
      if (button.dataset.action === "sell-all") {
        sellAllInventory();
      }
    });
  });

  document.querySelectorAll("[data-menu-action]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.menuAction === "save") {
        openSaveBox();
        return;
      }
      document.querySelectorAll("[data-menu-action]").forEach((item) => item.classList.remove("is-active"));
      button.classList.add("is-active");
      const labels = {
        profile: "角色設定會放頭像、稱號和玩家資料。",
        farm: "農場設定會放農場名稱、佈景和公開狀態。",
        invite: "邀請好友會放好友碼和拜訪連結。",
        notice: "常見問題會放操作說明和版本資訊。",
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

function render() {
  applyWeatherPassive();
  renderHeader();
  renderFarm();
  renderInventory();
  renderTabs();
  renderTabContent();
  hydrateIcons();
}

// 每秒的輕量更新：只就地更新成長倒數與進度，不重建 DOM，避免畫面閃爍
function tick() {
  applyWeatherPassive();
  updateFarmTimers();
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
        img.setAttribute("src", `./assets/crops/field/${suffix}`);
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
  if (elements.dayValue) {
    elements.dayValue.textContent = `第 ${state.day} 天`;
  }
  elements.sceneWeatherValue.textContent = WEATHERS[state.weather].name;
  elements.sceneDayValue.textContent = `第 ${state.day} 天`;

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
            ${ICONS.lock}
            <span class="plot-label">未開墾</span>
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
        <button class="plot ${ready ? "ready" : "growing"} ${plot.watered ? "watered" : ""}" type="button" data-plot="${index}" data-slot="${index + 1}" title="${crop.name}">
          ${plot.watered ? `<span class="water-badge" aria-hidden="true">${ICONS.drop}</span>` : ""}
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
}

function renderInventory() {
  const visibleCrops = Object.entries(CROPS).filter(([, crop]) => crop.unlock <= state.level + 1);
  elements.inventoryList.innerHTML = visibleCrops
    .map(([id, crop]) => {
      const count = state.inventory[id] || 0;
      const locked = crop.unlock > state.level;
      return `
        <div class="inventory-row ${locked ? "is-locked" : ""}">
          <span class="mini-crop" aria-hidden="true">${cropCardVisual(id)}</span>
          <span>
            <span class="item-title">
              <strong>${crop.name}</strong>
              <span>${locked ? `Lv.${crop.unlock}` : `${count} 個`}</span>
            </span>
            <span class="item-meta">${locked ? "尚未解鎖" : `單價 ${sellPrice(id)} 金幣`}</span>
          </span>
          <button class="mini-sell" type="button" data-sell-item="${id}" title="出售${crop.name}" aria-label="出售${crop.name}" ${count <= 0 || locked ? "disabled" : ""}>
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
    const titles = { shop: "種子", orders: "訂單", upgrades: "升級" };
    elements.workPanelTitle.textContent = titles[state.activeTab] || "農場管理";
  }
}

function renderTabContent() {
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
              <strong>${crop.name}</strong>
              <span>${locked ? `Lv.${crop.unlock}` : `${crop.cost} 金幣`}</span>
            </span>
            <span class="seed-meta">成長 ${crop.grow} 秒 · 售價 ${sellPrice(id)} · 經驗 ${crop.xp}</span>
            <span class="seed-actions">
              <span class="seed-meta">倉庫 ${state.inventory[id] || 0}</span>
              <button class="seed-button ${selected ? "is-active" : ""}" type="button" data-seed-choice="${id}" ${locked ? "disabled" : ""}>
                <span class="button-icon" aria-hidden="true" data-icon="${selected ? "check" : "seed"}"></span>
                ${selected ? "已選" : "選取"}
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
      const cost = upgrade.cost(level);
      return `
        <article class="upgrade-row">
          <span class="upgrade-title">
            <strong>${upgrade.name} Lv.${level}</strong>
            <span>${complete ? "滿級" : `${cost} 金幣`}</span>
          </span>
          <span class="upgrade-meta">${upgrade.description}</span>
          <button class="action-button" type="button" data-buy-upgrade="${id}" ${complete || state.coins < cost ? "disabled" : ""}>
            <span class="button-icon" aria-hidden="true" data-icon="${upgrade.icon}"></span>
            升級
          </button>
        </article>
      `;
    })
    .join("");

  elements.tabContent.innerHTML = plotRow + upgradeRows;

  const plotButton = elements.tabContent.querySelector("[data-buy-plot]");
  if (plotButton) {
    plotButton.addEventListener("click", buyPlot);
  }

  elements.tabContent.querySelectorAll("[data-buy-upgrade]").forEach((button) => {
    button.addEventListener("click", () => buyUpgrade(button.dataset.buyUpgrade));
  });
}

function handlePlotClick(index) {
  const plot = state.plots[index];
  if (!plot.unlocked) {
    state.activeTab = "upgrades";
    toast("這格還沒開墾，去升級頁買一格田地。");
    render();
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

  if (!plot.crop) {
    plantPlot(index);
    return;
  }

  toast(plot.watered ? "它正在長大。" : "換成澆水工具可以加快成長。");
}

function plantPlot(index) {
  const crop = CROPS[state.selectedSeed];
  if (!crop || crop.unlock > state.level) {
    toast("這包種子還沒解鎖。");
    return;
  }

  if (state.coins < crop.cost) {
    toast("金幣不夠，先出售倉庫作物或完成訂單。");
    return;
  }

  state.coins -= crop.cost;
  state.plots[index] = {
    ...state.plots[index],
    crop: state.selectedSeed,
    plantedAt: Date.now(),
    season: 0,
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

  if (plot.watered) {
    toast("這格已經喝飽水了。");
    return;
  }

  plot.watered = true;
  state.selectedTool = "seed";
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
  const amount = 1 + bonus;
  state.inventory[plot.crop] = (state.inventory[plot.crop] || 0) + amount;
  addXp(crop.xp);
  const season = plot.season || 0;
  const seasons = crop.seasons || 1;
  if (season + 1 < seasons) {
    state.plots[index] = { ...plot, plantedAt: Date.now(), season: season + 1, watered: false };
    toast(`${crop.name} 收成 ${amount} 個，還會再長第 ${season + 2} 季。`);
  } else {
    state.plots[index] = { ...plot, crop: null, plantedAt: 0, season: 0, watered: false };
    toast(`${crop.name} 收成 ${amount} 個。`);
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

  const cost = upgrade.cost(level);
  if (state.coins < cost) {
    toast("金幣不夠升級。");
    return;
  }

  state.coins -= cost;
  state.upgrades[id] = level + 1;
  toast(`${upgrade.name} 升到 Lv.${state.upgrades[id]}。`);
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
    state.coins += 25 + state.level * 5;
    toast(`升到 Lv.${state.level}，解鎖新作物更近了。`);
  }
}

function xpToNextLevel() {
  return state.level * 200;
}

function getPlotDuration(plot) {
  const crop = CROPS[plot.crop];
  if (!crop) {
    return 0;
  }

  const baseHours = plot.season && plot.season > 0 && crop.regrow ? crop.regrow : crop.grow;
  const windmill = 1 - (state.upgrades.windmill || 0) * 0.06;
  const weather = WEATHERS[state.weather].growth;
  const water = plot.watered ? 2 / 3 : 1;
  return baseHours * 3600 * 1000 * Math.max(0.48, windmill * weather * water);
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
  return Math.round(CROPS[id].sell * (1 + (state.upgrades.stand || 0) * 0.07));
}

function inventoryValue() {
  return Object.entries(state.inventory).reduce((sum, [id, count]) => sum + sellPrice(id) * count, 0);
}

function nextPlotInfo() {
  const unlocked = state.plots.filter((plot) => plot.unlocked).length;
  return PLOT_UNLOCKS[unlocked - 6] || null;
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
  return `<img class="crop-stage-image crop-${id} crop-stage-${validStage}" src="./assets/crops/field/${id}-${validStage}.png" alt="" />`;
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
