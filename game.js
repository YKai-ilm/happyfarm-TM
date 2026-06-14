const SAVE_KEY = "happy-farm-browser-game-v1";
const PLOT_COUNT = 16;

const CROPS = {
  turnip: {
    name: "小蘿蔔",
    cost: 4,
    sell: 9,
    grow: 18,
    xp: 4,
    unlock: 1,
    colors: ["#f8f3ee", "#d94c75", "#67a84f"],
  },
  carrot: {
    name: "紅蘿蔔",
    cost: 7,
    sell: 16,
    grow: 34,
    xp: 6,
    unlock: 1,
    colors: ["#f08a2d", "#ca5c24", "#5fa84d"],
  },
  corn: {
    name: "玉米",
    cost: 13,
    sell: 31,
    grow: 54,
    xp: 9,
    unlock: 2,
    colors: ["#f7d64c", "#e2a73a", "#4d8a43"],
  },
  strawberry: {
    name: "草莓",
    cost: 20,
    sell: 52,
    grow: 76,
    xp: 12,
    unlock: 3,
    colors: ["#de3f4f", "#9c2734", "#4e9c50"],
  },
  pumpkin: {
    name: "南瓜",
    cost: 32,
    sell: 88,
    grow: 112,
    xp: 18,
    unlock: 4,
    colors: ["#e98231", "#b44f25", "#3e7d43"],
  },
};

const WEATHERS = {
  sun: { name: "晴朗", icon: "sun", growth: 0.94, line: "陽光很足，作物會精神一點。" },
  cloud: { name: "多雲", icon: "cloud", growth: 1, line: "雲層厚厚的，節奏剛剛好。" },
  rain: { name: "小雨", icon: "rain", growth: 0.82, line: "雨水落下，田地自己喝飽了。" },
};

const UPGRADES = {
  well: {
    name: "水井",
    icon: "drop",
    max: 4,
    description: "每級增加 4 點體力上限。",
    cost: (level) => 85 + level * 55,
  },
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
  basket: `<svg viewBox="0 0 24 24"><path d="M5 10h14l-1.4 9H6.4z" fill="#c7843e" stroke="#704126" stroke-width="1.5"/><path d="M8 10a4 4 0 0 1 8 0" fill="none" stroke="#704126" stroke-width="1.7"/><path d="M8 14h8" stroke="#f4c66a" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  cart: `<svg viewBox="0 0 24 24"><path d="M4 5h2l2 10h9l2-7H8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><circle cx="10" cy="19" r="1.8" fill="currentColor"/><circle cx="17" cy="19" r="1.8" fill="currentColor"/></svg>`,
  lock: `<svg viewBox="0 0 24 24"><path d="M7 11V8a5 5 0 0 1 10 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><rect x="5" y="11" width="14" height="10" rx="2" fill="currentColor"/></svg>`,
  check: `<svg viewBox="0 0 24 24"><path d="m5 12 4.2 4.2L19 6.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  hammer: `<svg viewBox="0 0 24 24"><path d="m13 5 6 6M14.5 3.5 20.5 9.5 18 12 12 6zM11 8 4 15l5 5 7-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  sun: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.5" fill="#f6c84c" stroke="#9a671e" stroke-width="1.4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1" stroke="#9a671e" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  cloud: `<svg viewBox="0 0 24 24"><path d="M7.5 18h9.1a4.2 4.2 0 0 0 .2-8.4 6 6 0 0 0-11.4 2A3.3 3.3 0 0 0 7.5 18z" fill="#d7e3e7" stroke="#60747c" stroke-width="1.4"/></svg>`,
  rain: `<svg viewBox="0 0 24 24"><path d="M7.5 14h9.1a4.2 4.2 0 0 0 .2-8.4 6 6 0 0 0-11.4 2A3.3 3.3 0 0 0 7.5 14z" fill="#c8dce5" stroke="#52717c" stroke-width="1.4"/><path d="M8 17v3M12 16v4M16 17v3" stroke="#3489b2" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  wind: `<svg viewBox="0 0 24 24"><path d="M4 8h11a3 3 0 1 0-3-3M4 13h15a3 3 0 1 1-3 3M4 18h7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
};

const elements = {
  coinValue: document.querySelector("#coinValue"),
  energyValue: document.querySelector("#energyValue"),
  levelValue: document.querySelector("#levelValue"),
  xpFill: document.querySelector("#xpFill"),
  statusLine: document.querySelector("#statusLine"),
  weatherValue: document.querySelector("#weatherValue"),
  dayValue: document.querySelector("#dayValue"),
  farmGrid: document.querySelector("#farmGrid"),
  inventoryList: document.querySelector("#inventoryList"),
  tabContent: document.querySelector("#tabContent"),
  toastZone: document.querySelector("#toastZone"),
  restButton: document.querySelector("#restButton"),
  sellAllButton: document.querySelector("#sellAllButton"),
};

let state = loadState();
ensureOrders();
hydrateIcons();
bindStaticEvents();
render();
window.setInterval(render, 1000);

function createDefaultState() {
  return {
    coins: 90,
    level: 1,
    xp: 0,
    day: 1,
    weather: "sun",
    energy: 24,
    maxEnergy: 24,
    selectedTool: "seed",
    selectedSeed: "turnip",
    activeTab: "shop",
    inventory: Object.fromEntries(Object.keys(CROPS).map((id) => [id, 0])),
    plots: Array.from({ length: PLOT_COUNT }, (_, index) => ({
      unlocked: index < 12,
      crop: null,
      plantedAt: 0,
      watered: false,
    })),
    orders: [],
    upgrades: {
      well: 0,
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
      state.activeTab = button.dataset.tab;
      saveState();
      render();
    });
  });

  elements.restButton.addEventListener("click", restOneDay);
  elements.sellAllButton.addEventListener("click", sellAllInventory);
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

function renderHeader() {
  const requiredXp = xpToNextLevel();
  elements.coinValue.textContent = state.coins;
  elements.energyValue.textContent = `${state.energy}/${state.maxEnergy}`;
  elements.levelValue.textContent = `Lv. ${state.level}`;
  elements.xpFill.style.width = `${Math.min(100, Math.round((state.xp / requiredXp) * 100))}%`;
  elements.weatherValue.textContent = WEATHERS[state.weather].name;
  elements.dayValue.textContent = `第 ${state.day} 天`;

  const seed = CROPS[state.selectedSeed];
  if (state.energy <= 0) {
    elements.statusLine.textContent = "體力見底了，休息一天就能重新開工。";
  } else if (state.selectedTool === "seed") {
    elements.statusLine.textContent = `選中 ${seed.name}，空地點一下就能播種。`;
  } else if (state.selectedTool === "water") {
    elements.statusLine.textContent = "水壺已經裝滿，幫作物加快一段腳步。";
  } else {
    elements.statusLine.textContent = "成熟作物會亮起來，收成後放進倉庫。";
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
      const stage = getPlotStage(progress);
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
  document.querySelectorAll("[data-tool]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tool === state.selectedTool);
  });

  document.querySelectorAll("[data-tab]").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tab === state.activeTab);
  });
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
            <span>報酬</span>
            <strong>${ICONS.coin} ${order.reward} · XP ${order.xp}</strong>
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
  const plotCost = nextPlotCost();
  const plotRow =
    nextLockedIndex === -1
      ? `
        <article class="upgrade-row">
          <span class="upgrade-title"><strong>開墾田地</strong><span>完成</span></span>
          <span class="upgrade-meta">所有田地都能使用了。</span>
        </article>
      `
      : `
        <article class="upgrade-row">
          <span class="upgrade-title"><strong>開墾田地</strong><span>${plotCost} 金幣</span></span>
          <span class="upgrade-meta">增加 1 格可種植的田地。</span>
          <button class="action-button" type="button" data-buy-plot ${state.coins < plotCost ? "disabled" : ""}>
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

  if (!spendEnergy(1)) {
    return;
  }

  state.coins -= crop.cost;
  state.plots[index] = {
    ...state.plots[index],
    crop: state.selectedSeed,
    plantedAt: Date.now(),
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

  if (!spendEnergy(1)) {
    return;
  }

  plot.watered = true;
  toast("澆水完成，成長速度提升。");
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

  if (!spendEnergy(1)) {
    return;
  }

  const crop = CROPS[plot.crop];
  const bonus = plot.watered && Math.random() < 0.24 ? 1 : 0;
  const amount = 1 + bonus;
  state.inventory[plot.crop] = (state.inventory[plot.crop] || 0) + amount;
  addXp(crop.xp);
  state.plots[index] = {
    ...plot,
    crop: null,
    plantedAt: 0,
    watered: false,
  };
  toast(`${crop.name} 收成 ${amount} 個。`);
  saveState();
  render();
}

function spendEnergy(amount) {
  if (state.energy < amount) {
    toast("體力不夠了，休息一天吧。");
    return false;
  }

  state.energy -= amount;
  return true;
}

function restOneDay() {
  const weatherIds = Object.keys(WEATHERS);
  state.day += 1;
  state.energy = state.maxEnergy;
  state.weather = weatherIds[Math.floor(Math.random() * weatherIds.length)];

  const timeJump = 26000 + state.level * 6000;
  state.plots.forEach((plot) => {
    if (plot.crop) {
      plot.plantedAt -= timeJump;
      if (state.weather === "rain") {
        plot.watered = true;
      }
    }
  });

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

  const cost = nextPlotCost();
  if (state.coins < cost) {
    toast("金幣不夠開墾。");
    return;
  }

  state.coins -= cost;
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
  if (id === "well") {
    state.maxEnergy += 4;
    state.energy += 4;
  }
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
    state.maxEnergy += 2;
    state.energy = state.maxEnergy;
    state.coins += 25 + state.level * 5;
    toast(`升到 Lv.${state.level}，新種子也靠近了。`);
  }
}

function xpToNextLevel() {
  return 54 + (state.level - 1) * 38;
}

function getPlotDuration(plot) {
  const crop = CROPS[plot.crop];
  if (!crop) {
    return 0;
  }

  const windmill = 1 - (state.upgrades.windmill || 0) * 0.06;
  const weather = WEATHERS[state.weather].growth;
  const water = plot.watered ? 0.72 : 1;
  return crop.grow * 1000 * Math.max(0.48, windmill * weather * water);
}

function getPlotProgress(plot) {
  if (!plot.crop) {
    return 0;
  }

  return Math.min(1, (Date.now() - plot.plantedAt) / getPlotDuration(plot));
}

function getPlotStage(progress) {
  if (progress >= 1) {
    return "ripe";
  }
  if (progress >= 0.58) {
    return "leaf";
  }
  if (progress >= 0.28) {
    return "sprout";
  }
  return "seed";
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

function nextPlotCost() {
  const unlocked = state.plots.filter((plot) => plot.unlocked).length;
  return 44 + unlocked * 9;
}

function formatTime(ms) {
  const seconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const rest = String(seconds % 60).padStart(2, "0");
  return minutes > 0 ? `${minutes}:${rest}` : `${rest} 秒`;
}

function hydrateIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((element) => {
    element.innerHTML = ICONS[element.dataset.icon] || "";
  });
}

function toast(message) {
  const note = document.createElement("div");
  note.className = "toast";
  note.textContent = message;
  elements.toastZone.append(note);
  window.setTimeout(() => note.remove(), 2600);
}

function cropVisual(id, stage) {
  const crop = CROPS[id];
  if (!crop) {
    return "";
  }

  const [primary, shadow, leaf] = crop.colors;
  const scale = { seed: 0.55, sprout: 0.7, leaf: 0.9, ripe: 1 }[stage] || 1;
  const fruit = stage === "ripe" ? primary : stage === "leaf" ? primary : "#6db65a";
  const fruitOpacity = stage === "seed" ? 0 : stage === "sprout" ? 0.15 : 1;

  if (id === "corn") {
    return `
      <svg viewBox="0 0 72 72" style="transform:scale(${scale})" aria-hidden="true">
        <path d="M36 63c-9-12-13-25-10-38 8 5 11 16 10 38z" fill="${leaf}"/>
        <path d="M36 63c9-12 13-25 10-38-8 5-11 16-10 38z" fill="#6baa52"/>
        <path d="M36 14c8 9 10 22 0 39-10-17-8-30 0-39z" fill="${fruit}" opacity="${fruitOpacity}"/>
        <path d="M31 24h10M30 33h12M31 42h10" stroke="${shadow}" stroke-width="2" opacity="${fruitOpacity}" stroke-linecap="round"/>
      </svg>
    `;
  }

  if (id === "strawberry") {
    return `
      <svg viewBox="0 0 72 72" style="transform:scale(${scale})" aria-hidden="true">
        <path d="M36 62V28" stroke="${leaf}" stroke-width="5" stroke-linecap="round"/>
        <path d="M36 29c-8-5-14-5-20-1 6 3 12 5 20 1zM36 29c8-5 14-5 20-1-6 3-12 5-20 1z" fill="${leaf}"/>
        <path d="M36 28c13 5 19 15 13 25-4 8-22 8-26 0-6-10 0-20 13-25z" fill="${fruit}" opacity="${fruitOpacity}"/>
        <path d="M31 38h1M39 38h1M35 47h1M45 47h1M27 47h1" stroke="#ffe3a0" stroke-width="3" stroke-linecap="round" opacity="${fruitOpacity}"/>
      </svg>
    `;
  }

  if (id === "pumpkin") {
    return `
      <svg viewBox="0 0 72 72" style="transform:scale(${scale})" aria-hidden="true">
        <path d="M35 23c-4-9 2-13 8-14" fill="none" stroke="${leaf}" stroke-width="4" stroke-linecap="round"/>
        <path d="M22 38c0-11 7-18 14-18s14 7 14 18c0 13-7 22-14 22S22 51 22 38z" fill="${fruit}" opacity="${fruitOpacity}"/>
        <path d="M14 40c0-10 6-17 13-17s13 7 13 17c0 12-6 20-13 20s-13-8-13-20zM32 40c0-10 6-17 13-17s13 7 13 17c0 12-6 20-13 20S32 52 32 40z" fill="${fruit}" opacity="${fruitOpacity * 0.9}"/>
        <path d="M36 25v34" stroke="${shadow}" stroke-width="2" opacity=".35"/>
        <path d="M27 28c-6 5-9 21 0 29M45 28c6 5 9 21 0 29" fill="none" stroke="${shadow}" stroke-width="2" opacity=".35"/>
        <path d="M36 29c-6-6-13-7-21-3 7 3 14 5 21 3zM36 29c6-6 13-7 21-3-7 3-14 5-21 3z" fill="${leaf}"/>
      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 72 72" style="transform:scale(${scale})" aria-hidden="true">
      <path d="M36 63V29" stroke="${leaf}" stroke-width="5" stroke-linecap="round"/>
      <path d="M36 34c-9-7-18-8-26-3 9 4 17 5 26 3zM36 34c9-7 18-8 26-3-9 4-17 5-26 3z" fill="${leaf}"/>
      <path d="M22 42c0-8 6-15 14-15s14 7 14 15c0 10-7 18-14 18S22 52 22 42z" fill="${fruit}" opacity="${fruitOpacity}"/>
      <path d="M28 42c0-8 4-14 8-14s8 6 8 14c0 10-4 17-8 17s-8-7-8-17z" fill="${shadow}" opacity="${fruitOpacity * 0.2}"/>
      <path d="M31 22c2-6 8-9 14-9 0 8-5 13-14 9z" fill="${leaf}" opacity="${stage === "seed" ? 0.4 : 1}"/>
    </svg>
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
