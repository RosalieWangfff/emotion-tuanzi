/**
 * store.js — 状态管理层
 * 基于 localStorage 的持久化状态管理
 */
import { DEFAULT_CHARACTER } from './avatar-render.js?v=2';

const STORAGE_KEY = 'emotion-tuanzi-state';

// ---- 房间背景图列表（用户可添加更多图片到 backgrounds/ 文件夹）----
// 添加新图片只需把文件放到 backgrounds/，再在下面加一行即可
export const BACKGROUNDS = [
  { id: 'room',  name: '房间1', image: 'backgrounds/房间.png' },
  { id: 'room2', name: '房间2',    image: 'backgrounds/房间2.png' },
  { id: 'room3', name: '房间3',    image: 'backgrounds/房间3.png' },
  { id: 'room4', name: '房间4',    image: 'backgrounds/房间4.png' },
];
export const DEFAULT_BACKGROUND_ID = 'room';

// ---- 自定义背景管理（玩家上传的图，存 localStorage）----
const CUSTOM_BG_KEY = 'emotion-tuanzi-custom-backgrounds';

// 读取所有自定义背景
export function getCustomBackgrounds() {
  try {
    const raw = localStorage.getItem(CUSTOM_BG_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.warn('读取自定义背景失败', e);
    return [];
  }
}

// 保存自定义背景列表
function saveCustomBackgrounds(list) {
  try {
    localStorage.setItem(CUSTOM_BG_KEY, JSON.stringify(list));
  } catch (e) {
    console.warn('保存自定义背景失败（可能 localStorage 满了）', e);
    throw e;
  }
}

// 添加一张自定义背景（name + dataUrl）
export function addCustomBackground(name, dataUrl) {
  const list = getCustomBackgrounds();
  const item = {
    id: `custom_${Date.now()}`,
    name: name || `我的房间${list.length + 1}`,
    image: dataUrl,
    isCustom: true,
  };
  list.push(item);
  saveCustomBackgrounds(list);
  return item;
}

// 删除自定义背景
export function removeCustomBackground(id) {
  const list = getCustomBackgrounds().filter(b => b.id !== id);
  saveCustomBackgrounds(list);
}

// 获取所有背景（内置 + 自定义）
export function getAllBackgrounds() {
  return [...BACKGROUNDS, ...getCustomBackgrounds()];
}

// ---- 精灵外观定义 ----
export const SPRITE_TYPES = {
  preset1:  { name: '团子',   image: 'character/团子.jpg', emoji: '🧸' },
  preset2:  { name: '小可',   image: 'character/character1.jpg', emoji: '🎀' },
  cat:      { name: '小猫',   image: 'character/cat.jpg', emoji: '🐱' },
  dog:      { name: '小狗',   image: 'character/dog.png', emoji: '🐶' },
  radish:   { name: '小萝卜', image: 'character/carrot.jpg', emoji: '🥕' },
  cloud:    { name: '小云朵', image: 'character/cloud.jpg', emoji: '☁️' },
  custom:   { name: '自定义', image: null, emoji: '➕', isCustom: true },
};

// ---- 背景主题 ----
export const THEMES = {
  1: { name: '薄荷', colors: ['#F0F0F0', '#80D6AF'] },
  2: { name: '晴空', colors: ['#FEFDCF', '#BED9F4'] },
  3: { name: '蜜桃', colors: ['#FBFECF', '#F9B2C0'] },
  4: { name: '日落', colors: ['#DEF8FF', '#FFB48A'] },
};

// ---- 精灵人设定义 ----
export const PERSONA_TYPES = {
  warm:      { name: '温暖治愈', icon: '🌸', desc: '温柔、承认感受、不急着给建议' },
  rational:  { name: '理性陪伴', icon: '🧊', desc: '温和但会帮你看清局势' },
  energetic: { name: '元气鼓励', icon: '⚡', desc: '热情、积极、像拉你起来' },
  quiet:     { name: '安静倾听', icon: '🌙', desc: '话少，主要说"我在"' },
};

// ---- 情绪定义 ----
export const EMOTIONS = {
  joy:      { label: '喜悦', emoji: '😊', color: '#F7B267' },
  sadness:  { label: '悲伤', emoji: '😢', color: '#6B9BD2' },
  anger:    { label: '愤怒', emoji: '😠', color: '#E07A5F' },
  anxiety:  { label: '焦虑', emoji: '😰', color: '#B9A8D9' },
  calm:     { label: '平静', emoji: '😌', color: '#A8D8EA' },
  fatigue:  { label: '无力', emoji: '😮‍💨', color: '#A89595' },
};

// ---- 捏脸默认配置 ----
export const DEFAULT_CUSTOM_CONFIG = {
  bodyColor:   '#F7C08A',
  bodyShape:   'round',   // round / oval / square / blob
  eyes:        'dot',     // dot / sparkle / sleepy / happy / star
  eyeColor:    '#3a2a2a',
  mouth:       'smile',   // smile / open / line / cat / pout
  blush:       'circle',  // none / circle / heart / stripe
  blushColor:  '#FF9966',
  accessory:   'none',    // none / bow / hat / glasses / flower / antenna
  accessoryColor: '#80D6AF',
  size:        1.0,       // 整体大小倍率 0.8~1.2
};

// ---- 默认状态 ----
const defaultState = {
  onboarded: false,
  theme: '1',
  sprite: {
    type: 'preset1',
    name: '小团子',
    persona: 'warm',
    customPersona: '',
    personaEnabled: false,  // 是否启用自定义性格（覆盖预设 persona）
    customConfig: { ...DEFAULT_CUSTOM_CONFIG },   // 旧版平面捏脸（保留兼容）
    avatarConfig: { ...DEFAULT_CHARACTER },       // 新版 Tomodachi 风 Q版捏脸（含身体）
    customImage: null,     // 用户上传的照片（转动森风后的图，或原图占位）
    createdAt: null,
  },
  records: [],
  bottles: [],
  pendingRecord: null,  // 待封存的记录（选位置前）
  currentBackground: DEFAULT_BACKGROUND_ID,  // 当前房间背景 id
};

// ---- 加载状态 ----
function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // 合并 sprite 字段（确保新增的 customConfig/customImage 在旧状态中也能拿到默认值）
      const sprite = {
        ...defaultState.sprite,
        ...parsed.sprite,
        customConfig: {
          ...DEFAULT_CUSTOM_CONFIG,
          ...(parsed.sprite?.customConfig || {}),
        },
        avatarConfig: {
          ...DEFAULT_CHARACTER,
          ...(parsed.sprite?.avatarConfig || {}),
        },
      };
      return { ...defaultState, ...parsed, sprite };
    }
  } catch (e) { console.warn('加载状态失败', e); }
  return JSON.parse(JSON.stringify(defaultState));
}

// ---- 保存状态 ----
function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) { console.warn('保存状态失败', e); }
}

// ---- Store 单例 ----
let state = loadState();
const listeners = new Set();

export const store = {
  get: () => state,

  set(updater) {
    if (typeof updater === 'function') {
      state = { ...state, ...updater(state) };
    } else {
      state = { ...state, ...updater };
    }
    saveState(state);
    listeners.forEach(fn => fn(state));
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  // ---- 精灵操作 ----
  updateSprite(partial) {
    store.set(s => ({ sprite: { ...s.sprite, ...partial } }));
  },

  // ---- 记录操作 ----
  addRecord(record) {
    const fullRecord = {
      id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      ...record,
    };
    store.set(s => ({ records: [fullRecord, ...s.records] }));
    return fullRecord;
  },

  getRecord(id) {
    return state.records.find(r => r.id === id);
  },

  // ---- 更新单条记录（用于手账装饰等）----
  updateRecord(id, partial) {
    store.set(s => ({
      records: s.records.map(r => r.id === id ? { ...r, ...partial } : r),
    }));
  },

  setPendingRecord(record) {
    store.set({ pendingRecord: record });
  },

  // ---- 封存记录到瓶子（带位置） ----
  sealRecord(recordId, location) {
    const record = state.records.find(r => r.id === recordId);
    if (!record) return;

    const updated = { ...record, location };
    store.set(s => ({
      records: s.records.map(r => r.id === recordId ? updated : r),
      bottles: [...s.bottles, {
        id: `b_${Date.now()}`,
        recordId,
        sealed: true,
        sealedAt: new Date().toISOString(),
      }],
      pendingRecord: null,
    }));
  },

  // ---- 统计 ----
  getStats() {
    const records = state.records;
    const sprite = state.sprite;
    const days = sprite.createdAt
      ? Math.max(1, Math.ceil((Date.now() - new Date(sprite.createdAt).getTime()) / 86400000))
      : 1;
    return {
      totalRecords: records.length,
      sealedBottles: state.bottles.length,
      companionDays: days,
    };
  },

  // ---- 获取时间段内的记录 ----
  getRecordsByPeriod(period) {
    const now = Date.now();
    const ms = period === 'week' ? 7 * 86400000 : 30 * 86400000;
    const from = now - ms;
    return state.records.filter(r => new Date(r.createdAt).getTime() >= from);
  },

  // ---- 重置（调试用） ----
  reset() {
    state = JSON.parse(JSON.stringify(defaultState));
    saveState(state);
    listeners.forEach(fn => fn(state));
  },
};
