/**
 * timeline.js — 手账日记时间线（三层结构）
 *
 * 视图层次：
 *  1. 时间选项列表（按天/周/月）—— 选择时间段
 *  2. 记录列表 —— 展示该时间段下的所有记录条目，点击进入单条手账页
 *  3. 单条记录手账页 —— 一张可写写画画、贴贴纸、改字体的"纸"
 *
 * 手账页结构：
 *  - journal-content：记录原始内容（文字/照片/涂鸦/位置/语音）
 *  - journal-doodle-canvas：透明涂鸦层（可切换涂鸦模式，保存到 record.journalDoodle）
 *  - journal-sticker-layer：贴纸层（贴纸按 recordId 存储）
 */
import { store, EMOTIONS } from './store.js';
import { pageInits, goBack, toast } from './router.js';
import {
  addSticker,
  renderStickerDrawer,
  renderPlacedStickers,
  initStickerDropZone,
} from './stickers.js';

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 时间线状态
let timelineGran = 'day';            // 'day' | 'week' | 'month'
let timelineFont = 'default';        // 当前手账页字体
let currentGroupKey = null;           // 当前正在查看的时间段 key
let currentGroup = null;              // 当前时间段分组数据 { label, sub, records }
let currentRecordId = null;           // 当前手账页正在查看的记录 id

// 涂鸦状态
let doodleMode = false;               // 是否处于涂鸦模式
let doodleDrawing = false;            // 正在绘制
let doodleCtx = null;
let doodleDirty = false;              // 是否有未保存的涂鸦

// 字体映射
const FONT_MAP = {
  default: "'Noto Sans SC',sans-serif",
  hand: "'ZCOOL XiaoWei',cursive",
  serif: "'Noto Serif SC','SimSun',serif",
  kai: "KaiTi,STKaiti,楷体,serif",
};

// ---- 挂载路由初始化 ----
pageInits.timeline = () => {
  // 顶部返回（智能返回：手账页→记录列表→时间列表→首页）
  document.querySelector('#view-timeline [data-back]').onclick = () => {
    if (!document.getElementById('timeline-journal-view').classList.contains('hidden')) {
      // 在手账页 → 返回记录列表
      exitJournalView();
    } else if (!document.getElementById('timeline-records-view').classList.contains('hidden')) {
      // 在记录列表 → 返回时间列表
      showTimelineListView();
    } else {
      // 在时间列表 → 返回上一页
      goBack('home');
    }
  };

  // 顶部"返回"按钮（与左上角箭头同逻辑）
  document.getElementById('timeline-back-btn').onclick = () => {
    document.querySelector('#view-timeline [data-back]').click();
  };

  // 粒度切换
  document.querySelectorAll('.gran-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.gran-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      timelineGran = btn.dataset.gran;
      renderTimelineList();
    };
  });

  // 字体切换（作用于手账页）
  document.querySelectorAll('.font-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.font-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      timelineFont = btn.dataset.font;
      applyJournalFont();
    };
  });

  // 涂鸦模式开关
  const doodleToggle = document.getElementById('doodle-toggle');
  if (doodleToggle) {
    doodleToggle.onclick = () => toggleDoodleMode();
  }

  // 清空涂鸦
  const doodleClear = document.getElementById('doodle-clear');
  if (doodleClear) {
    doodleClear.onclick = () => clearDoodle();
  }

  // 贴纸抽屉开关
  const stickerToggle = document.getElementById('sticker-toggle');
  if (stickerToggle) {
    stickerToggle.onclick = () => {
      const drawer = document.getElementById('sticker-drawer');
      drawer.classList.toggle('hidden');
      stickerToggle.classList.toggle('active', !drawer.classList.contains('hidden'));
    };
  }
  const drawerClose = document.getElementById('sticker-drawer-close');
  if (drawerClose) {
    drawerClose.onclick = () => {
      document.getElementById('sticker-drawer').classList.add('hidden');
      document.getElementById('sticker-toggle').classList.remove('active');
    };
  }

  // 贴纸上传
  const stickerUpload = document.getElementById('sticker-upload');
  if (stickerUpload) {
    stickerUpload.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        addSticker(ev.target.result);
        renderStickerDrawer();
        toast('贴纸已添加');
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    };
  }

  showTimelineListView();
  renderStickerDrawer();
};

// ==================== 第一层：时间选项列表 ====================
function showTimelineListView() {
  document.getElementById('timeline-list-view').classList.remove('hidden');
  document.getElementById('timeline-records-view').classList.add('hidden');
  document.getElementById('timeline-journal-view').classList.add('hidden');
  document.getElementById('timeline-back-btn').classList.add('hidden');
  document.getElementById('timeline-page-title').textContent = '手账日记';
  const drawer = document.getElementById('sticker-drawer');
  if (drawer) drawer.classList.add('hidden');
  renderTimelineList();
}

function renderTimelineList() {
  const list = document.getElementById('timeline-list');
  const records = store.get().records;
  if (!records.length) {
    list.innerHTML = '<div class="timeline-empty">还没有记录<br>点击地图页的 + 开始记录吧</div>';
    return;
  }

  // 按所选粒度分组聚合
  const groups = {};
  records.forEach(r => {
    const d = new Date(r.createdAt);
    let key, label, sub;
    if (timelineGran === 'day') {
      key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      label = `${d.getMonth() + 1}月${d.getDate()}日`;
      sub = WEEKDAYS[d.getDay()];
    } else if (timelineGran === 'week') {
      const dayIdx = d.getDay() === 0 ? 6 : d.getDay() - 1;
      const monday = new Date(d); monday.setDate(d.getDate() - dayIdx);
      key = `${monday.getFullYear()}-${monday.getMonth()}-${monday.getDate()}`;
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      label = `${monday.getMonth() + 1}/${monday.getDate()} - ${sunday.getMonth() + 1}/${sunday.getDate()}`;
      sub = '本周';
    } else {
      key = `${d.getFullYear()}-${d.getMonth()}`;
      label = `${d.getFullYear()}年${d.getMonth() + 1}月`;
      sub = '';
    }
    if (!groups[key]) groups[key] = { label, sub, records: [] };
    groups[key].records.push(r);
  });

  // 按时间倒序
  const keys = Object.keys(groups).sort((a, b) => {
    const [ay, am, ad] = a.split('-').map(Number);
    const [by, bm, bd] = b.split('-').map(Number);
    return new Date(by, bm, bd || 1) - new Date(ay, am, ad || 1);
  });

  list.innerHTML = '';
  keys.forEach(key => {
    const g = groups[key];
    // 统计该时间段主导情绪
    const emoCounts = {};
    g.records.forEach(r => { emoCounts[r.emotion] = (emoCounts[r.emotion] || 0) + 1; });
    let topEmo = 'calm', topCnt = 0;
    Object.entries(emoCounts).forEach(([e, c]) => { if (c > topCnt) { topEmo = e; topCnt = c; } });
    const info = EMOTIONS[topEmo] || EMOTIONS.calm;
    const locCount = g.records.filter(r => r.location?.name).length;

    const card = document.createElement('div');
    card.className = 'timeline-card';
    card.innerHTML = `
      <div class="timeline-card-tape" style="background:${info.color}"></div>
      <div class="timeline-card-body">
        <div class="timeline-card-date">${g.label}</div>
        <div class="timeline-card-sub">${g.sub ? g.sub + ' · ' : ''}${g.records.length} 条记录${locCount ? ' · 📍 ' + locCount + ' 个位置' : ''}</div>
        <div class="timeline-card-mood">
          <span class="tcm-emoji">${info.emoji}</span>
          <span class="tcm-label">主导：${info.label}</span>
        </div>
      </div>
      <div class="timeline-card-arrow">›</div>
    `;
    card.onclick = () => {
      currentGroupKey = key;
      currentGroup = g;
      showTimelineRecordsView(key, g);
    };
    list.appendChild(card);
  });
}

// ==================== 第二层：该时间段的记录列表 ====================
function showTimelineRecordsView(key, group) {
  document.getElementById('timeline-list-view').classList.add('hidden');
  document.getElementById('timeline-records-view').classList.remove('hidden');
  document.getElementById('timeline-journal-view').classList.add('hidden');
  document.getElementById('timeline-back-btn').classList.remove('hidden');
  document.getElementById('timeline-page-title').textContent = group.label + (group.sub ? ' · ' + group.sub : '');
  const drawer = document.getElementById('sticker-drawer');
  if (drawer) drawer.classList.add('hidden');
  renderRecordsList(group);
}

function renderRecordsList(group) {
  const list = document.getElementById('timeline-records-list');
  // 按日期分组（同一天的记录归到一起，但每条都可点击）
  const byDate = {};
  group.records.forEach(r => {
    const d = new Date(r.createdAt);
    const dk = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (!byDate[dk]) byDate[dk] = { date: d, records: [] };
    byDate[dk].records.push(r);
  });
  const dateKeys = Object.keys(byDate).sort((a, b) => {
    const [ay, am, ad] = a.split('-').map(Number);
    const [by, bm, bd] = b.split('-').map(Number);
    return new Date(by, bm, bd) - new Date(ay, am, ad);
  });

  let html = '';
  dateKeys.forEach(dk => {
    const { date, records } = byDate[dk];
    records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    html += `<div class="records-date-group">
      <div class="records-date-header">${date.getMonth() + 1}月${date.getDate()}日 · ${WEEKDAYS[date.getDay()]}</div>`;
    records.forEach(record => {
      const info = EMOTIONS[record.emotion] || EMOTIONS.calm;
      const time = new Date(record.createdAt);
      const timeStr = `${String(time.getHours()).padStart(2, '0')}:${String(time.getMinutes()).padStart(2, '0')}`;
      // 记录预览：取文字前 40 字 / 照片 / 涂鸦缩略
      let preview = '';
      if (record.textContent) {
        preview = record.textContent.slice(0, 42) + (record.textContent.length > 42 ? '...' : '');
      } else if (record.voiceTranscript) {
        preview = '🎙️ ' + record.voiceTranscript.slice(0, 36) + (record.voiceTranscript.length > 36 ? '...' : '');
      } else if (record.photoUrl) {
        preview = '<span class="record-preview-photo">📷 照片记录</span>';
      } else if (record.doodleData) {
        preview = '<span class="record-preview-doodle">🎨 涂鸦记录</span>';
      } else {
        preview = '<span class="record-preview-empty">（无内容）</span>';
      }
      const decoCount = (getRecordDecoCount(record) || 0);
      html += `
        <div class="record-card" data-record-id="${record.id}" style="border-left-color:${info.color}">
          <div class="record-card-time">${timeStr}</div>
          <div class="record-card-emoji">${info.emoji}</div>
          <div class="record-card-body">
            <div class="record-card-preview">${preview}</div>
            ${record.location?.name ? `<div class="record-card-loc">📍 ${record.location.name}</div>` : ''}
          </div>
          ${decoCount ? `<div class="record-card-deco">🌸 ×${decoCount}</div>` : ''}
          <div class="record-card-arrow">›</div>
        </div>
      `;
    });
    html += '</div>';
  });
  list.innerHTML = html;

  // 绑定点击进入手账页
  list.querySelectorAll('.record-card').forEach(card => {
    card.onclick = () => {
      const rid = card.dataset.recordId;
      showJournalView(rid);
    };
  });
}

// 统计一条记录的装饰数量（贴纸 + 涂鸦）
function getRecordDecoCount(record) {
  let n = 0;
  // 贴纸数量从 localStorage 读取
  try {
    const all = JSON.parse(localStorage.getItem('emotion-tuanzi-placed') || '{}');
    n += (all[record.id]?.length || 0);
  } catch {}
  if (record.journalDoodle) n += 1;
  return n;
}

// ==================== 第三层：单条记录手账页 ====================
function showJournalView(recordId) {
  // 先保存上一条手账的涂鸦
  flushDoodle();

  currentRecordId = recordId;
  document.getElementById('timeline-list-view').classList.add('hidden');
  document.getElementById('timeline-records-view').classList.add('hidden');
  document.getElementById('timeline-journal-view').classList.remove('hidden');
  document.getElementById('timeline-back-btn').classList.remove('hidden');

  const record = store.getRecord(recordId);
  if (!record) {
    toast('记录不存在');
    return;
  }
  const info = EMOTIONS[record.emotion] || EMOTIONS.calm;
  const time = new Date(record.createdAt);
  document.getElementById('timeline-page-title').textContent =
    `${time.getMonth() + 1}/${time.getDate()} ${String(time.getHours()).padStart(2,'0')}:${String(time.getMinutes()).padStart(2,'0')}`;

  renderJournalContent(record);
  // 重置字体为该记录保存的字体（或默认）
  const savedFont = record.journalFont || 'default';
  document.querySelectorAll('.font-btn').forEach(b => b.classList.toggle('active', b.dataset.font === savedFont));
  timelineFont = savedFont;
  applyJournalFont();

  // 贴纸层
  renderPlacedStickers(recordId);
  initStickerDropZone(recordId);

  // 涂鸦层：先退出涂鸦模式，再加载已保存的涂鸦
  if (doodleMode) setDoodleMode(false);
  loadDoodle(record);
}

function exitJournalView() {
  flushDoodle();
  setDoodleMode(false);
  currentRecordId = null;
  document.getElementById('timeline-journal-view').classList.add('hidden');
  document.getElementById('timeline-records-view').classList.remove('hidden');
  if (currentGroup) {
    document.getElementById('timeline-page-title').textContent =
      currentGroup.label + (currentGroup.sub ? ' · ' + currentGroup.sub : '');
  }
}

// 渲染手账页内容（记录原始内容）
function renderJournalContent(record) {
  const content = document.getElementById('journal-content');
  const info = EMOTIONS[record.emotion] || EMOTIONS.calm;
  const time = new Date(record.createdAt);
  const timeStr = `${time.getMonth() + 1}月${time.getDate()}日 ${WEEKDAYS[time.getDay()]} · ${String(time.getHours()).padStart(2,'0')}:${String(time.getMinutes()).padStart(2,'0')}`;

  let html = `
    <div class="journal-meta">
      <span class="journal-time">${timeStr}</span>
      <span class="journal-emotion" style="color:${info.color}">${info.emoji} ${info.label}</span>
    </div>
  `;
  if (record.textContent) {
    html += `<div class="journal-text">${escapeHtml(record.textContent)}</div>`;
  }
  if (record.photoUrl) {
    html += `<div class="journal-photo"><img src="${record.photoUrl}" alt="照片"></div>`;
  }
  if (record.doodleData) {
    html += `<div class="journal-doodle-img"><img src="${record.doodleData}" alt="涂鸦"></div>`;
  }
  if (record.location?.name) {
    html += `<div class="journal-location">📍 ${escapeHtml(record.location.name)}</div>`;
  }
  if (record.voiceTranscript) {
    html += `<div class="journal-voice">🎙️ ${escapeHtml(record.voiceTranscript)}</div>`;
  }
  if (record.reply) {
    html += `<div class="journal-reply">
      <div class="journal-reply-head">🍼 团子的回信</div>
      <div class="journal-reply-body">${escapeHtml(record.reply)}</div>
    </div>`;
  }
  content.innerHTML = html;
}

function applyJournalFont() {
  const content = document.getElementById('journal-content');
  if (content) content.style.fontFamily = FONT_MAP[timelineFont];
  // 字体也持久化到当前记录
  if (currentRecordId) {
    store.updateRecord(currentRecordId, { journalFont: timelineFont });
  }
}

// ==================== 涂鸦层 ====================
function toggleDoodleMode() {
  setDoodleMode(!doodleMode);
}

function setDoodleMode(on) {
  doodleMode = on;
  const canvas = document.getElementById('journal-doodle-canvas');
  const toggle = document.getElementById('doodle-toggle');
  if (!canvas || !toggle) return;
  if (on) {
    canvas.classList.add('active');
    toggle.classList.add('active');
    // 关闭贴纸抽屉
    document.getElementById('sticker-drawer').classList.add('hidden');
    document.getElementById('sticker-toggle').classList.remove('active');
    toast('涂鸦模式：在手账上自由画', 1800);
  } else {
    canvas.classList.remove('active');
    toggle.classList.remove('active');
    flushDoodle();
  }
}

function setupDoodleCanvas() {
  const canvas = document.getElementById('journal-doodle-canvas');
  if (!canvas) return;
  // 尺寸跟随 journal-paper
  resizeDoodleCanvas();
  doodleCtx = canvas.getContext('2d');
  doodleCtx.lineCap = 'round';
  doodleCtx.lineJoin = 'round';
  doodleCtx.lineWidth = 3;
  doodleCtx.strokeStyle = '#5A6A5A';

  // 绑定绘制事件（用 offset 坐标）
  let lastX = 0, lastY = 0;
  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };
  const onDown = (e) => {
    if (!doodleMode) return;
    doodleDrawing = true;
    const p = getPos(e);
    lastX = p.x; lastY = p.y;
    // 画一个点
    doodleCtx.beginPath();
    doodleCtx.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
    doodleCtx.fillStyle = doodleCtx.strokeStyle;
    doodleCtx.fill();
    e.preventDefault();
  };
  const onMove = (e) => {
    if (!doodleMode || !doodleDrawing) return;
    const p = getPos(e);
    doodleCtx.beginPath();
    doodleCtx.moveTo(lastX, lastY);
    doodleCtx.lineTo(p.x, p.y);
    doodleCtx.stroke();
    lastX = p.x; lastY = p.y;
    doodleDirty = true;
    e.preventDefault();
  };
  const onUp = () => {
    if (doodleDrawing) {
      doodleDrawing = false;
      flushDoodle();
    }
  };
  canvas.onmousedown = onDown;
  canvas.onmousemove = onMove;
  window.onmouseup = onUp;

  // 触屏支持
  canvas.ontouchstart = (e) => {
    if (!doodleMode) return;
    const t = e.touches[0];
    onDown({ clientX: t.clientX, clientY: t.clientY, preventDefault: () => e.preventDefault() });
  };
  canvas.ontouchmove = (e) => {
    if (!doodleMode) return;
    const t = e.touches[0];
    onMove({ clientX: t.clientX, clientY: t.clientY, preventDefault: () => e.preventDefault() });
  };
  canvas.ontouchend = onUp;
}

function resizeDoodleCanvas() {
  const canvas = document.getElementById('journal-doodle-canvas');
  const paper = document.getElementById('journal-paper');
  if (!canvas || !paper) return;
  const rect = paper.getBoundingClientRect();
  const w = Math.max(rect.width, 300);
  const h = Math.max(paper.scrollHeight, rect.height, 400);
  // 保存现有内容
  let imgData = null;
  if (canvas.width > 0 && canvas.height > 0) {
    try { imgData = canvas.toDataURL(); } catch {}
  }
  canvas.width = w;
  canvas.height = h;
  if (doodleCtx) {
    doodleCtx.lineCap = 'round';
    doodleCtx.lineJoin = 'round';
    doodleCtx.lineWidth = 3;
    doodleCtx.strokeStyle = '#5A6A5A';
  }
  // 恢复内容
  if (imgData) {
    const img = new Image();
    img.onload = () => doodleCtx && doodleCtx.drawImage(img, 0, 0, w, h);
    img.src = imgData;
  }
}

// 加载该记录已保存的涂鸦
function loadDoodle(record) {
  const canvas = document.getElementById('journal-doodle-canvas');
  if (!canvas) return;
  setupDoodleCanvas();
  // 清空
  if (doodleCtx) doodleCtx.clearRect(0, 0, canvas.width, canvas.height);
  if (record.journalDoodle) {
    const img = new Image();
    img.onload = () => {
      if (doodleCtx) doodleCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
    };
    img.src = record.journalDoodle;
  }
  doodleDirty = false;
}

// 保存涂鸦到当前记录
function flushDoodle() {
  if (!doodleDirty || !currentRecordId) return;
  const canvas = document.getElementById('journal-doodle-canvas');
  if (!canvas) return;
  try {
    const dataUrl = canvas.toDataURL('image/png');
    store.updateRecord(currentRecordId, { journalDoodle: dataUrl });
    doodleDirty = false;
  } catch (e) {
    console.warn('涂鸦保存失败', e);
  }
}

function clearDoodle() {
  const canvas = document.getElementById('journal-doodle-canvas');
  if (!canvas || !doodleCtx) return;
  doodleCtx.clearRect(0, 0, canvas.width, canvas.height);
  doodleDirty = true;
  flushDoodle();
  toast('涂鸦已清除');
}

// 简单 HTML 转义
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

// 监听窗口尺寸变化重设 canvas
window.addEventListener('resize', () => {
  if (!document.getElementById('timeline-journal-view').classList.contains('hidden')) {
    resizeDoodleCanvas();
  }
});

export {
  WEEKDAYS,
  FONT_MAP,
  showTimelineListView,
  renderTimelineList,
  renderRecordsList,
  renderJournalContent,
  applyJournalFont,
};
