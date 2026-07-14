/**
 * stickers.js — 手账贴纸系统
 * 职责：贴纸库存储、贴纸上传、贴纸抽屉渲染、贴纸拖拽（HTML5 Drag API）
 *       已放置贴纸的位置调整（mousedown/mousemove/mouseup 自定义拖拽）+ 持久化
 *
 * 数据存储（独立于 store 主数据，避免侵入）：
 *  - STICKER_KEY：贴纸库（用户上传的所有贴纸源）
 *  - PLACED_KEY：已放置贴纸（按记录 id 分组，{ recordId: [{src,top,left,width}] }）
 */
import { toast } from './router.js';

const STICKER_KEY = 'emotion-tuanzi-stickers';
const PLACED_KEY = 'emotion-tuanzi-placed';

// ---- 贴纸库（用户上传的贴纸源）----
function getStickers() {
  try { return JSON.parse(localStorage.getItem(STICKER_KEY) || '[]'); }
  catch { return []; }
}

function addSticker(src) {
  const stickers = getStickers();
  const s = {
    id: 's_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
    src,
  };
  stickers.push(s);
  try {
    localStorage.setItem(STICKER_KEY, JSON.stringify(stickers));
  } catch (e) {
    toast('存储已满，请删除旧贴纸');
  }
  return s;
}

function deleteSticker(id) {
  const stickers = getStickers().filter(s => s.id !== id);
  localStorage.setItem(STICKER_KEY, JSON.stringify(stickers));
}

// ---- 已放置贴纸（按记录 id 分组）----
function getPlacedStickers(recordId) {
  try {
    const all = JSON.parse(localStorage.getItem(PLACED_KEY) || '{}');
    return all[recordId] || [];
  } catch { return []; }
}

function savePlacedSticker(recordId, sticker) {
  const all = JSON.parse(localStorage.getItem(PLACED_KEY) || '{}');
  if (!all[recordId]) all[recordId] = [];
  all[recordId].push(sticker);
  localStorage.setItem(PLACED_KEY, JSON.stringify(all));
}

function clearPlacedSticker(recordId, idx) {
  const all = JSON.parse(localStorage.getItem(PLACED_KEY) || '{}');
  if (all[recordId]) {
    all[recordId].splice(idx, 1);
    localStorage.setItem(PLACED_KEY, JSON.stringify(all));
  }
}

/**
 * 渲染贴纸抽屉（贴纸库列表）
 * 贴纸从这里被拖到手账页
 */
function renderStickerDrawer() {
  const list = document.getElementById('sticker-drawer-list');
  if (!list) return;
  const stickers = getStickers();
  if (!stickers.length) {
    list.innerHTML = '<div class="sticker-empty">还没有贴纸<br>点击「＋ 上传」添加</div>';
    return;
  }
  list.innerHTML = '';
  stickers.forEach(s => {
    const item = document.createElement('div');
    item.className = 'sticker-item';
    item.draggable = true;
    item.innerHTML = `<img src="${s.src}" alt="" draggable="false"><button class="sticker-del" data-id="${s.id}">×</button>`;
    item.ondragstart = (e) => {
      e.dataTransfer.setData('sticker-id', s.id);
      e.dataTransfer.setData('sticker-src', s.src);
    };
    item.querySelector('.sticker-del').onclick = (e) => {
      e.stopPropagation();
      deleteSticker(s.id);
      renderStickerDrawer();
    };
    list.appendChild(item);
  });
}

/**
 * 渲染某条记录已放置的所有贴纸到指定 layer 容器
 * @param {string} recordId 记录 id
 * @param {string} containerId 贴纸层容器 id（默认 journal-sticker-layer）
 */
function renderPlacedStickers(recordId, containerId = 'journal-sticker-layer') {
  const layer = document.getElementById(containerId);
  if (!layer) return;
  layer.innerHTML = '';
  const placed = getPlacedStickers(recordId);
  placed.forEach((p, i) => {
    const el = document.createElement('img');
    el.className = 'placed-sticker';
    el.src = p.src;
    el.style.top = p.top + '%';
    el.style.left = p.left + '%';
    el.style.width = (p.width || 60) + 'px';
    el.dataset.idx = i;
    makePlacedStickerDraggable(el, recordId, i, containerId);
    // 双击删除
    el.ondblclick = () => {
      clearPlacedSticker(recordId, i);
      renderPlacedStickers(recordId, containerId);
    };
    layer.appendChild(el);
  });
}

/**
 * 让已放置的贴纸可拖动调整位置（自定义 mousedown/mousemove/mouseup）
 * 位置以百分比存储，自适应容器尺寸
 * @param {string} dropContainerId 拖放区容器 id（用于计算百分比坐标）
 */
function makePlacedStickerDraggable(el, recordId, idx, dropContainerId = 'journal-paper') {
  let dragging = false, offsetX = 0, offsetY = 0;

  el.onmousedown = (e) => {
    if (e.button !== 0) return;
    dragging = true;
    const rect = el.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    el.style.zIndex = 100;
    e.preventDefault();
  };

  const onMove = (e) => {
    if (!dragging) return;
    const container = document.getElementById(dropContainerId);
    if (!container) return;
    const rect = container.getBoundingClientRect();
    el.style.left = ((e.clientX - rect.left - offsetX) / rect.width * 100) + '%';
    el.style.top = ((e.clientY - rect.top - offsetY) / rect.height * 100) + '%';
  };

  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    el.style.zIndex = '';
    // 持久化新位置
    const all = JSON.parse(localStorage.getItem(PLACED_KEY) || '{}');
    if (all[recordId] && all[recordId][idx]) {
      all[recordId][idx].top = parseFloat(el.style.top);
      all[recordId][idx].left = parseFloat(el.style.left);
      localStorage.setItem(PLACED_KEY, JSON.stringify(all));
    }
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/**
 * 初始化拖放区：从抽屉拖贴纸到手账页时接收并放置
 * @param {string} recordId 记录 id
 * @param {string} dropContainerId 拖放区容器 id（默认 journal-paper）
 */
function initStickerDropZone(recordId, dropContainerId = 'journal-paper') {
  const container = document.getElementById(dropContainerId);
  if (!container) return;
  container.ondragover = (e) => { e.preventDefault(); };
  container.ondrop = (e) => {
    e.preventDefault();
    const src = e.dataTransfer.getData('sticker-src');
    if (!src) return;
    const rect = container.getBoundingClientRect();
    const left = (e.clientX - rect.left - 30) / rect.width * 100;
    const top = (e.clientY - rect.top - 30) / rect.height * 100;
    savePlacedSticker(recordId, { src, top, left, width: 60 });
    renderPlacedStickers(recordId);
  };
}

export {
  STICKER_KEY,
  PLACED_KEY,
  getStickers,
  addSticker,
  deleteSticker,
  getPlacedStickers,
  savePlacedSticker,
  clearPlacedSticker,
  renderStickerDrawer,
  renderPlacedStickers,
  makePlacedStickerDraggable,
  initStickerDropZone,
};
