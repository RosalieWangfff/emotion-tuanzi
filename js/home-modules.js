/**
 * home-modules.js — 精灵之家首页的小模块
 * 职责：天气、日历、心情速记、AI情绪面板
 *       实用性维度新增：今日情绪温度计、团子回信卡、情绪建议小卡
 *
 * 依赖：store（数据/统计）、EMOTIONS（情绪定义）、map（定位）、router（toast）
 */
import { store, EMOTIONS } from './store.js';
import { toast } from './router.js';
import { getCurrentLocation } from './map.js';

// ---- 常量 ----
const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const WEATHER_CODES = {
  0:'晴',1:'晴',2:'多云',3:'阴',45:'雾',48:'雾',
  51:'小雨',53:'小雨',55:'小雨',56:'冻雨',57:'冻雨',
  61:'中雨',63:'中雨',65:'大雨',66:'冻雨',67:'冻雨',
  71:'小雪',73:'小雪',75:'大雪',77:'雪',
  80:'阵雨',81:'阵雨',82:'暴雨',95:'雷雨',96:'雷雨',99:'雷雨',
};
const WEATHER_EMOJI = {
  晴:'☀️',多云:'⛅',阴:'☁️',雾:'🌫️',小雨:'🌦️',中雨:'🌧️',大雨:'🌧️',
  冻雨:'🌧️',小雪:'🌨️',大雪:'❄️',雪:'🌨️',阵雨:'🌦️',暴雨:'⛈️',雷雨:'⛈️',
};

// ---- 时段判定 ----
function getTimePeriod() {
  const h = new Date().getHours();
  if (h >= 6 && h < 17) return 'day';
  if (h >= 17 && h < 19) return 'dusk';
  return 'night';
}

// ---- 天气模块 ----
async function renderWeather() {
  const el = document.getElementById('home-weather');
  if (!el) return;
  const now = new Date();
  const dateStr = `${now.getMonth() + 1}月${now.getDate()}日`;
  const render = (icon, temp, desc) => {
    el.innerHTML = `
      <div class="home-module-title">🌤 今日天气</div>
      <div class="weather-row">
        <span class="weather-icon">${icon}</span>
        <div><div class="weather-temp">${temp}</div><div class="weather-desc">${desc}</div></div>
        <div class="weather-date"><div class="wd-day">${dateStr}</div>${WEEKDAYS[now.getDay()]}</div>
      </div>`;
  };
  // 兜底：用时段场景描述
  const period = getTimePeriod();
  const fbIcon = period === 'day' ? '☀️' : period === 'dusk' ? '🌆' : '🌙';
  const fbDesc = period === 'day' ? '晴朗' : period === 'dusk' ? '晚霞' : '星夜';
  try {
    const loc = await getCurrentLocation();
    const resp = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lng}&current=temperature_2m,weather_code&timezone=auto`);
    const data = await resp.json();
    const temp = Math.round(data.current.temperature_2m) + '°';
    const desc = WEATHER_CODES[data.current.weather_code] || '晴';
    const icon = WEATHER_EMOJI[desc] || '🌤';
    render(icon, temp, desc);
  } catch (e) {
    render(fbIcon, '—', fbDesc);
  }
}

// ---- 日历模块 ----
function renderCalendar(records) {
  const el = document.getElementById('home-calendar');
  if (!el) return;
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth();
  const startDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const hasDays = new Set();
  records.forEach(r => {
    const d = new Date(r.createdAt);
    if (d.getFullYear() === year && d.getMonth() === month) hasDays.add(d.getDate());
  });
  const heads = ['日', '一', '二', '三', '四', '五', '六'];
  let html = `<div class="home-module-title">📅 ${month + 1}月</div><div class="cal-grid">`;
  heads.forEach(h => html += `<div class="cal-head">${h}</div>`);
  for (let i = 0; i < startDay; i++) html += '<div class="cal-cell cal-other"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const cls = ['cal-cell'];
    if (hasDays.has(d)) cls.push('cal-has');
    if (d === now.getDate()) cls.push('cal-today');
    html += `<div class="${cls.join(' ')}">${d}</div>`;
  }
  html += '</div>';
  el.innerHTML = html;
}

// ---- 今日心情速记 ----
function renderMoodQuick(records) {
  const el = document.getElementById('home-mood-quick');
  if (!el) return;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayRecords = records.filter(r => new Date(r.createdAt) >= today);
  const lastMood = todayRecords.length ? todayRecords[0].emotion : null;
  let html = '<div class="home-module-title">💫 今日心情速记</div><div class="mood-quick">';
  Object.entries(EMOTIONS).forEach(([key, info]) => {
    html += `<div class="mood-chip ${key === lastMood ? 'selected' : ''}" data-mood="${key}">
      <span class="mood-chip-emoji">${info.emoji}</span>
      <span class="mood-chip-label">${info.label}</span>
    </div>`;
  });
  html += `</div><div class="mood-note">${todayRecords.length ? '已记 ' + todayRecords.length + ' 次' : '点一下记录此刻心情'}</div>`;
  el.innerHTML = html;
  el.querySelectorAll('.mood-chip').forEach(chip => {
    chip.onclick = () => {
      const mood = chip.dataset.mood;
      store.addRecord({ emotion: mood, type: 'quick', note: '心情速记' });
      renderMoodQuick(store.get().records);
      renderEmotionPanel(store.get().records);
      renderTodayMoodThermometer(store.get().records); // 实用性：刷新温度计
      renderMoodAdvice(store.get().records);            // 实用性：刷新建议
      toast(`已记录 ${EMOTIONS[mood].label}`);
    };
  });
}

// ---- AI 情绪识别小面板（创新性维度）----
function renderEmotionPanel(records) {
  const el = document.getElementById('home-emotion-panel');
  if (!el) return;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayRecords = records.filter(r => new Date(r.createdAt) >= today);

  // 空状态：AI 待命
  if (!todayRecords.length) {
    el.innerHTML = `
      <div class="emotion-panel-empty">
        <span class="ep-blink"></span>
        等待你的第一笔输入… <span style="opacity:.6">AI 待命中</span>
      </div>
      <span class="emotion-panel-badge idle">AI 待命</span>
    `;
    return;
  }

  // 统计各情绪出现次数
  const counts = {};
  todayRecords.forEach(r => {
    const e = r.emotion || 'calm';
    counts[e] = (counts[e] || 0) + 1;
  });
  // 找主导情绪
  let topEmotion = 'calm', topCount = 0;
  Object.entries(counts).forEach(([k, c]) => {
    if (c > topCount) { topEmotion = k; topCount = c; }
  });
  const info = EMOTIONS[topEmotion] || EMOTIONS.calm;
  // 情绪值：主导情绪占比 × 100，加上记录次数微调
  const ratio = topCount / todayRecords.length;
  const value = Math.min(100, Math.round(ratio * 80 + Math.min(todayRecords.length, 5) * 4));
  const period = new Date().getHours() < 12 ? '上午' : (new Date().getHours() < 18 ? '下午' : '晚上');

  el.innerHTML = `
    <div class="emotion-panel-row">
      <div class="emotion-panel-emoji">${info.emoji}</div>
      <div class="emotion-panel-info">
        <div class="emotion-panel-label">
          今日主导：${info.label}
          <span class="emotion-panel-value">${value}/100</span>
        </div>
        <div class="emotion-panel-sub">${period}已识别 ${todayRecords.length} 条情绪信号</div>
        <div class="emotion-panel-bar">
          <div class="emotion-panel-bar-fill" style="width:${value}%;background:${info.color}"></div>
        </div>
      </div>
    </div>
    <span class="emotion-panel-badge">AI 已分析</span>
  `;
}

// ========================================================================
// 实用性维度新增组件
// ========================================================================

// ---- 今日情绪温度计 ----
// 综合今日所有记录的情绪值，输出一个 0-100 的"情绪温度"
// 温度越高代表越积极（joy/calm 高分；sadness/anger/anxiety/fatigue 低分）
function renderTodayMoodThermometer(records) {
  const el = document.getElementById('home-mood-thermometer');
  if (!el) return;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayRecords = records.filter(r => new Date(r.createdAt) >= today);

  // 各情绪对温度的贡献（-50 ~ +50）
  const MOOD_SCORE = {
    joy: 50, calm: 30, fatigue: -10, anxiety: -25, anger: -40, sadness: -45,
  };

  let temp;
  if (!todayRecords.length) {
    temp = 50; // 中性
  } else {
    const sum = todayRecords.reduce((acc, r) => acc + (MOOD_SCORE[r.emotion] || 0) * (r.intensity || 0.5), 0);
    temp = Math.round(50 + sum / todayRecords.length);
    temp = Math.max(0, Math.min(100, temp));
  }

  // 温度档位
  let level, label, emoji;
  if (temp >= 75)      { level = 'hot';  label = '今天心情很棒';   emoji = '☀️'; }
  else if (temp >= 55) { level = 'warm'; label = '今天还算不错';   emoji = '🌤'; }
  else if (temp >= 35) { level = 'cool'; label = '今天有点低落';   emoji = '⛅'; }
  else                 { level = 'cold'; label = '今天需要抱抱';   emoji = '🌧'; }

  // 温度条颜色按档位渐变
  const barColor = level === 'hot'  ? 'linear-gradient(90deg,#F7B267,#FF8E53)'
                : level === 'warm' ? 'linear-gradient(90deg,#FFD4B8,#FFB48A)'
                : level === 'cool' ? 'linear-gradient(90deg,#A8D8EA,#6B9BD2)'
                :                    'linear-gradient(90deg,#6B9BD2,#B9A8D9)';

  el.innerHTML = `
    <div class="thermometer-head">
      <span class="thermometer-title">🌡 今日情绪温度</span>
      <span class="thermometer-value">${temp}°</span>
    </div>
    <div class="thermometer-bar">
      <div class="thermometer-bar-fill ${level}" style="width:${temp}%;background:${barColor}"></div>
    </div>
    <div class="thermometer-foot">
      <span class="thermometer-emoji">${emoji}</span>
      <span class="thermometer-label">${label}</span>
      <span class="thermometer-count">${todayRecords.length} 条记录</span>
    </div>
  `;
}

// ---- 团子回信卡 ----
// 显示最近一条"写日记"记录的团子回信
// 数据来源：write 页保存时把 reply 存进 record.reply
function renderReplyCard() {
  const el = document.getElementById('home-reply-card');
  if (!el) return;
  const records = store.get().records;
  const lastWithReply = records.find(r => r.type === 'write' && r.reply);

  if (!lastWithReply) {
    el.innerHTML = `
      <div class="reply-card-empty">
        <span class="reply-card-emoji">✉️</span>
        <span class="reply-card-hint">还没有团子的回信<br>去「写一写」倾诉一下</span>
      </div>`;
    return;
  }

  const sprite = store.get().sprite;
  const time = new Date(lastWithReply.createdAt);
  const timeStr = `${time.getMonth() + 1}/${time.getDate()} ${String(time.getHours()).padStart(2,'0')}:${String(time.getMinutes()).padStart(2,'0')}`;
  // 截断超长回信
  const reply = lastWithReply.reply.length > 80
    ? lastWithReply.reply.slice(0, 80) + '…'
    : lastWithReply.reply;

  el.innerHTML = `
    <div class="reply-card-head">
      <span class="reply-card-title">✉ 团子的回信</span>
      <span class="reply-card-time">${timeStr}</span>
    </div>
    <div class="reply-card-body">${reply}</div>
    <div class="reply-card-foot">—— ${sprite.name}</div>
  `;
}

// ---- 情绪建议小卡 ----
// 根据今日主导情绪给一个温柔的建议（实用性：引导用户做点什么）
function renderMoodAdvice(records) {
  const el = document.getElementById('home-mood-advice');
  if (!el) return;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayRecords = records.filter(r => new Date(r.createdAt) >= today);
  if (!todayRecords.length) {
    el.innerHTML = `
      <div class="advice-card-empty">
        <span class="advice-emoji">💡</span>
        <span>记录一下心情，团子会给你小建议</span>
      </div>`;
    return;
  }
  // 主导情绪
  const counts = {};
  todayRecords.forEach(r => { counts[r.emotion] = (counts[r.emotion] || 0) + 1; });
  let topEmo = 'calm', topCnt = 0;
  Object.entries(counts).forEach(([k, c]) => { if (c > topCnt) { topEmo = k; topCnt = c; } });

  const ADVICE = {
    joy:      { emoji: '🌻', title: '享受这份开心', tip: '把今天的好心情写下来或画下来，以后回看也会笑出声。' },
    calm:     { emoji: '🍃', title: '保持这个节奏', tip: '平静的今天很难得，可以做一个深呼吸，让自己再多待一会儿。' },
    sadness:  { emoji: '🌧', title: '允许自己难过', tip: '难过不是错。喝杯热水，找一个让你安心的人待一会儿。' },
    anger:    { emoji: '🔥', title: '先深呼吸三下', tip: '生气说明你在乎。试着把愤怒写下来，再决定要不要回应。' },
    anxiety:  { emoji: '🌫', title: '把担心拆小一点', tip: '只看眼前这一步。最坏会怎样？你比想象中更能扛。' },
    fatigue:  { emoji: '🌙', title: '该歇一歇了', tip: '今天的你已经够努力了。放下手机，做点不用脑的事。' },
  };
  const a = ADVICE[topEmo] || ADVICE.calm;

  el.innerHTML = `
    <div class="advice-card-head">
      <span class="advice-emoji">${a.emoji}</span>
      <span class="advice-title">${a.title}</span>
    </div>
    <div class="advice-card-body">${a.tip}</div>
  `;
}

export {
  WEEKDAYS,
  getTimePeriod,
  renderWeather,
  renderCalendar,
  renderMoodQuick,
  renderEmotionPanel,
  renderTodayMoodThermometer,
  renderReplyCard,
  renderMoodAdvice,
};
