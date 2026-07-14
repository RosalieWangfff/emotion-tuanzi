/**
 * sprite.js — 精灵 SVG 系统
 * 5种外观 + 自定义捏脸、情绪变色、人设展示
 */

import { store, SPRITE_TYPES, PERSONA_TYPES, EMOTIONS, DEFAULT_CUSTOM_CONFIG } from './store.js?v=2';
import {
  renderAvatarSVG, DEFAULT_CHARACTER,
  SKIN_COLORS, EYE_COLORS, HAIR_COLORS, BLUSH_COLORS, CLOTHING_COLORS, GLASSES_COLORS,
} from './avatar-render.js?v=2';

// ---- 情绪 → 精灵色彩映射 ----
const EMOTION_SPRITE_COLORS = {
  joy:     { body: '#F7B267', cheek: '#FF9966', glow: 'rgba(247,178,103,0.4)' },
  sadness: { body: '#8AB4D8', cheek: '#6B9BD2', glow: 'rgba(107,155,210,0.3)' },
  anger:   { body: '#E07A5F', cheek: '#D85F3F', glow: 'rgba(224,122,95,0.4)' },
  anxiety: { body: '#B9A8D9', cheek: '#A899D0', glow: 'rgba(185,168,217,0.35)' },
  calm:    { body: '#A8D8EA', cheek: '#90C8DC', glow: 'rgba(168,216,234,0.3)' },
  fatigue: { body: '#B8A8A0', cheek: '#A89595', glow: 'rgba(168,149,149,0.25)' },
};

// ---- 情绪 → 精灵表情（SVG 内置精灵用）----
function getEyes(emotion) {
  switch (emotion) {
    case 'joy':     return '<circle cx="36" cy="38" r="4" fill="#3a2a2a"/><circle cx="56" cy="38" r="4" fill="#3a2a2a"/><path d="M33 34 Q36 31 39 34" stroke="#3a2a2a" stroke-width="1.5" fill="none"/><path d="M53 34 Q56 31 59 34" stroke="#3a2a2a" stroke-width="1.5" fill="none"/>';
    case 'sadness': return '<circle cx="36" cy="40" r="3.5" fill="#3a2a2a"/><circle cx="56" cy="40" r="3.5" fill="#3a2a2a"/><path d="M33 35 Q36 37 39 35" stroke="#3a2a2a" stroke-width="1.5" fill="none"/><path d="M53 35 Q56 37 59 35" stroke="#3a2a2a" stroke-width="1.5" fill="none"/>';
    case 'anger':   return '<line x1="30" y1="34" x2="40" y2="38" stroke="#3a2a2a" stroke-width="2"/><line x1="62" y1="34" x2="52" y2="38" stroke="#3a2a2a" stroke-width="2"/><circle cx="36" cy="39" r="3" fill="#3a2a2a"/><circle cx="56" cy="39" r="3" fill="#3a2a2a"/>';
    case 'anxiety': return '<circle cx="36" cy="38" r="4" fill="#3a2a2a"/><circle cx="56" cy="38" r="4" fill="#3a2a2a"/><circle cx="36" cy="38" r="6" fill="none" stroke="#3a2a2a" stroke-width="0.5" stroke-dasharray="2 1"/><circle cx="56" cy="38" r="6" fill="none" stroke="#3a2a2a" stroke-width="0.5" stroke-dasharray="2 1"/>';
    case 'calm':    return '<path d="M33 38 Q36 40 39 38" stroke="#3a2a2a" stroke-width="2" fill="none"/><path d="M53 38 Q56 40 59 38" stroke="#3a2a2a" stroke-width="2" fill="none"/>';
    case 'fatigue': return '<line x1="32" y1="38" x2="40" y2="38" stroke="#3a2a2a" stroke-width="2"/><line x1="52" y1="38" x2="60" y2="38" stroke="#3a2a2a" stroke-width="2"/>';
    default:        return '<circle cx="36" cy="38" r="3.5" fill="#3a2a2a"/><circle cx="56" cy="38" r="3.5" fill="#3a2a2a"/>';
  }
}

function getMouth(emotion) {
  switch (emotion) {
    case 'joy':     return '<path d="M40 54 Q46 60 52 54" stroke="#3a2a2a" stroke-width="2" fill="none" stroke-linecap="round"/>';
    case 'sadness': return '<path d="M40 58 Q46 54 52 58" stroke="#3a2a2a" stroke-width="2" fill="none" stroke-linecap="round"/>';
    case 'anger':   return '<path d="M40 56 L52 56" stroke="#3a2a2a" stroke-width="2.5" stroke-linecap="round"/>';
    case 'anxiety': return '<ellipse cx="46" cy="56" rx="3" ry="4" fill="#3a2a2a"/>';
    case 'calm':    return '<path d="M42 55 Q46 57 50 55" stroke="#3a2a2a" stroke-width="1.5" fill="none" stroke-linecap="round"/>';
    case 'fatigue': return '<ellipse cx="46" cy="56" rx="4" ry="2" fill="#3a2a2a"/>';
    default:        return '<path d="M42 55 Q46 57 50 55" stroke="#3a2a2a" stroke-width="1.5" fill="none" stroke-linecap="round"/>';
  }
}

// ---- 情绪 → CSS滤镜（图片精灵用）----
function getEmotionFilter(emotion) {
  switch (emotion) {
    case 'joy':     return 'saturate(1.3) brightness(1.08)';
    case 'sadness': return 'saturate(0.5) brightness(0.88) hue-rotate(190deg)';
    case 'anger':   return 'saturate(1.4) brightness(0.95) hue-rotate(-15deg)';
    case 'anxiety': return 'saturate(0.7) brightness(0.93) contrast(1.1)';
    case 'calm':    return 'saturate(1) brightness(1)';
    case 'fatigue': return 'saturate(0.4) brightness(0.82) opacity(0.88)';
    default:        return '';
  }
}

/* =========================================================
 *  捏脸部件库 —— 每个部件都是返回 SVG 字符串的函数
 *  参考 d:\trae-project\example.jpg 的立体形状组合风格
 * ========================================================= */
const CX = 46, CY = 44, R = 28; // 默认中心 + 半径

const FACE_PARTS = {
  bodyShape: {
    round:  { name: '圆圆', body: (fill) => `<circle cx="${CX}" cy="${CY}" r="${R}" fill="${fill}"/>` },
    oval:   { name: '椭圆', body: (fill) => `<ellipse cx="${CX}" cy="${CY}" rx="${R*0.92}" ry="${R*1.15}" fill="${fill}"/>` },
    square: { name: '方方', body: (fill) => `<rect x="${CX-R}" y="${CY-R}" width="${R*2}" height="${R*2}" rx="${R*0.55}" fill="${fill}"/>` },
    blob:   { name: '团子', body: (fill) => `<path d="M ${CX-R} ${CY+2} Q ${CX-R-2} ${CY-R*1.1} ${CX} ${CY-R*1.15} Q ${CX+R+2} ${CY-R*1.1} ${CX+R} ${CY+2} Q ${CX+R*0.95} ${CY+R*1.1} ${CX} ${CY+R*1.1} Q ${CX-R*0.95} ${CY+R*1.1} ${CX-R} ${CY+2} Z" fill="${fill}"/>` },
  },
  eyes: {
    dot:     { name: '圆点', draw: (color) => `<circle cx="${CX-10}" cy="38" r="4" fill="${color}"/><circle cx="${CX+10}" cy="38" r="4" fill="${color}"/>` },
    sparkle: { name: '亮闪闪', draw: (color) => `<circle cx="${CX-10}" cy="38" r="4.5" fill="${color}"/><circle cx="${CX+10}" cy="38" r="4.5" fill="${color}"/><circle cx="${CX-12}" cy="36" r="1.4" fill="#fff"/><circle cx="${CX+8}" cy="36" r="1.4" fill="#fff"/>` },
    sleepy:  { name: '瞌睡', draw: (color) => `<path d="M ${CX-15} 38 Q ${CX-10} 41 ${CX-5} 38" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M ${CX+5} 38 Q ${CX+10} 41 ${CX+15} 38" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>` },
    happy:   { name: '笑眯眯', draw: (color) => `<path d="M ${CX-14} 39 Q ${CX-10} 34 ${CX-6} 39" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M ${CX+6} 39 Q ${CX+10} 34 ${CX+14} 39" stroke="${color}" stroke-width="2" fill="none" stroke-linecap="round"/>` },
    star:    { name: '星星眼', draw: (color) => `<text x="${CX-10}" y="42" text-anchor="middle" font-size="11" fill="${color}">★</text><text x="${CX+10}" y="42" text-anchor="middle" font-size="11" fill="${color}">★</text>` },
  },
  mouth: {
    smile: { name: '微笑', draw: () => `<path d="M ${CX-6} 54 Q ${CX} 60 ${CX+6} 54" stroke="#3a2a2a" stroke-width="2" fill="none" stroke-linecap="round"/>` },
    open:  { name: '张嘴', draw: () => `<ellipse cx="${CX}" cy="56" rx="4" ry="5" fill="#3a2a2a"/><ellipse cx="${CX}" cy="58" rx="2.5" ry="2" fill="#FF9966" opacity="0.6"/>` },
    line:  { name: '一字嘴', draw: () => `<line x1="${CX-5}" y1="56" x2="${CX+5}" y2="56" stroke="#3a2a2a" stroke-width="2" stroke-linecap="round"/>` },
    cat:   { name: '猫嘴', draw: () => `<path d="M ${CX-6} 54 Q ${CX-3} 58 ${CX} 54 Q ${CX+3} 58 ${CX+6} 54" stroke="#3a2a2a" stroke-width="2" fill="none" stroke-linecap="round"/>` },
    pout:  { name: '嘟嘴', draw: () => `<ellipse cx="${CX}" cy="56" rx="3" ry="2.5" fill="#E07A5F"/>` },
  },
  blush: {
    none:   { name: '无', draw: () => '' },
    circle: { name: '圆腮红', draw: (color) => `<ellipse cx="${CX-16}" cy="50" rx="6" ry="4" fill="${color}" opacity="0.5"/><ellipse cx="${CX+16}" cy="50" rx="6" ry="4" fill="${color}" opacity="0.5"/>` },
    heart:  { name: '爱心', draw: (color) => `<text x="${CX-16}" y="53" text-anchor="middle" font-size="11" fill="${color}" opacity="0.75">♥</text><text x="${CX+16}" y="53" text-anchor="middle" font-size="11" fill="${color}" opacity="0.75">♥</text>` },
    stripe: { name: '线条', draw: (color) => `<line x1="${CX-20}" y1="50" x2="${CX-12}" y2="50" stroke="${color}" stroke-width="2.5" opacity="0.6" stroke-linecap="round"/><line x1="${CX+12}" y1="50" x2="${CX+20}" y2="50" stroke="${color}" stroke-width="2.5" opacity="0.6" stroke-linecap="round"/>` },
  },
  accessory: {
    none:     { name: '无', draw: () => '' },
    bow:      { name: '蝴蝶结', draw: (color) => `<path d="M ${CX-12} 18 L ${CX-2} 22 L ${CX-12} 26 Z" fill="${color}"/><path d="M ${CX+12} 18 L ${CX+2} 22 L ${CX+12} 26 Z" fill="${color}"/><rect x="${CX-3}" y="20" width="6" height="5" rx="1.5" fill="${color}"/>` },
    hat:      { name: '小帽子', draw: (color) => `<ellipse cx="${CX}" cy="14" rx="14" ry="3" fill="${color}" opacity="0.9"/><rect x="${CX-8}" y="4" width="16" height="11" rx="2" fill="${color}"/><ellipse cx="${CX}" cy="4" rx="8" ry="2" fill="${color}" opacity="0.7"/>` },
    glasses:  { name: '眼镜', draw: (color) => `<circle cx="${CX-10}" cy="38" r="6.5" fill="none" stroke="${color}" stroke-width="2"/><circle cx="${CX+10}" cy="38" r="6.5" fill="none" stroke="${color}" stroke-width="2"/><line x1="${CX-4}" y1="38" x2="${CX+4}" y2="38" stroke="${color}" stroke-width="2"/>` },
    flower:   { name: '小花', draw: (color) => `<circle cx="${CX-12}" cy="20" r="3" fill="${color}"/><circle cx="${CX-15}" cy="17" r="2.5" fill="${color}" opacity="0.7"/><circle cx="${CX-9}" cy="17" r="2.5" fill="${color}" opacity="0.7"/><circle cx="${CX-15}" cy="23" r="2.5" fill="${color}" opacity="0.7"/><circle cx="${CX-9}" cy="23" r="2.5" fill="${color}" opacity="0.7"/><circle cx="${CX-12}" cy="20" r="1.5" fill="#FFD040"/>` },
    antenna:  { name: '天线', draw: (color) => `<line x1="${CX-6}" y1="14" x2="${CX-6}" y2="4" stroke="${color}" stroke-width="1.5"/><line x1="${CX+6}" y1="14" x2="${CX+6}" y2="4" stroke="${color}" stroke-width="1.5"/><circle cx="${CX-6}" cy="3" r="2.5" fill="${color}"/><circle cx="${CX+6}" cy="3" r="2.5" fill="${color}"/>` },
  },
};

// 预设颜色板（给颜色选择器用）
const COLOR_PALETTE = [
  '#F7C08A', '#F7B267', '#FFB7B2', '#F9B2C0',
  '#B9A8D9', '#A8D8EA', '#A8E0C8', '#80D6AF',
  '#FFE08A', '#FFD040', '#C8E8D8', '#BED9F4',
  '#E07A5F', '#8AB4D8', '#A89595', '#FFFFFF',
];

// ---- 根据捏脸配置生成精灵 SVG ----
export function renderCustomSprite(config, emotion = 'calm', size = 64) {
  const cfg = { ...DEFAULT_CUSTOM_CONFIG, ...(config || {}) };
  const colors = EMOTION_SPRITE_COLORS[emotion] || EMOTION_SPRITE_COLORS.calm;
  // 平静时用配置色，情绪化时混入情绪色
  const bodyColor = emotion === 'calm' ? cfg.bodyColor : colors.body;
  const scale = Math.max(0.8, Math.min(1.2, cfg.size || 1.0));

  // 按比例缩放部件位置
  const cx = CX, cy = CY;
  const r = R * scale;
  const shape = FACE_PARTS.bodyShape[cfg.bodyShape] || FACE_PARTS.bodyShape.round;
  // 用闭包注入缩放后的 r
  const bodySVG = (scale !== 1.0)
    ? shape.body.call(null, bodyColor).replace(/r="\d+(\.\d+)?"/g, `r="${r}"`)
    : shape.body(bodyColor);

  const eyesSVG = FACE_PARTS.eyes[cfg.eyes]?.draw(cfg.eyeColor) || '';
  const mouthSVG = FACE_PARTS.mouth[cfg.mouth]?.draw() || '';
  const blushSVG = FACE_PARTS.blush[cfg.blush]?.draw(cfg.blushColor) || '';
  const accSVG = FACE_PARTS.accessory[cfg.accessory]?.draw(cfg.accessoryColor) || '';

  return `<svg viewBox="0 0 92 80" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="custLight${Math.random().toString(36).slice(2,7)}" cx="38%" cy="32%">
        <stop offset="0%" stop-color="rgba(255,255,255,0.45)"/>
        <stop offset="60%" stop-color="rgba(255,255,255,0.1)"/>
        <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
      </radialGradient>
    </defs>
    <ellipse cx="${cx}" cy="${cy+22}" rx="${r*0.9}" ry="6" fill="rgba(0,0,0,0.12)"/>
    ${accSVG}
    ${bodySVG}
    <ellipse cx="${cx-8}" cy="${cy-8}" rx="12" ry="8" fill="rgba(255,255,255,0.35)"/>
    ${eyesSVG}
    ${mouthSVG}
    ${blushSVG}
  </svg>`;
}

// ---- Tomodachi 风 Q版角色（含身体）渲染 ----
// 包装 avatar-render.js 的 renderAvatarSVG，设置宽高并保持 300:440 比例
export function renderCustomAvatar(avatarConfig, size = 160) {
  const cfg = { ...DEFAULT_CHARACTER, ...(avatarConfig || {}) };
  const svg = renderAvatarSVG(cfg);
  // viewBox 是 0 0 300 380（竖向），按比例计算高度
  const height = Math.round(size * 380 / 300);
  // 在 <svg 标签中插入 width/height
  return svg.replace('<svg ', `<svg width="${size}" height="${height}" `);
}

// ---- 生成精灵 SVG/图片 ----
export function renderSprite(type, emotion = 'calm', size = 64) {
  const spriteType = SPRITE_TYPES[type];

  // 图片精灵：用 <img> + CSS滤镜表达情绪
  if (spriteType?.image) {
    const filter = getEmotionFilter(emotion);
    return `<img src="${spriteType.image}" alt="${spriteType.name}" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;filter:${filter};transition:filter .5s ease;box-shadow:0 4px 12px rgba(0,0,0,0.08)">`;
  }

  // 自定义精灵：优先使用上传照片，否则用新版 Q版捏脸
  if (type === 'custom') {
    const sprite = store.get().sprite || {};
    if (sprite.customImage) {
      const filter = getEmotionFilter(emotion);
      return `<img src="${sprite.customImage}" alt="自定义精灵" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;filter:${filter};transition:filter .5s ease;box-shadow:0 4px 12px rgba(0,0,0,0.08)">`;
    }
    // 新版 Tomodachi 风 Q版角色（含身体），竖向比例
    return renderCustomAvatar(sprite.avatarConfig, size);
  }

  // SVG精灵（原有逻辑）
  const colors = EMOTION_SPRITE_COLORS[emotion] || EMOTION_SPRITE_COLORS.calm;
  const eyes = getEyes(emotion);
  const mouth = getMouth(emotion);
  const baseColor = spriteType?.color || colors.body;

  // 根据情绪混合颜色（情绪强时用情绪色，弱时用精灵原色）
  const bodyColor = emotion === 'calm' ? baseColor : colors.body;

  let ears = '';
  let extra = '';

  switch (type) {
    case 'cat':
      ears = `<path d="M28 18 L22 8 L34 16 Z" fill="${bodyColor}"/><path d="M64 18 L70 8 L58 16 Z" fill="${bodyColor}"/>`;
      break;
    case 'dog':
      ears = `<ellipse cx="22" cy="22" rx="8" ry="12" fill="${bodyColor}" transform="rotate(-20 22 22)"/><ellipse cx="70" cy="22" rx="8" ry="12" fill="${bodyColor}" transform="rotate(20 70 22)"/>`;
      break;
    case 'radish':
      extra = `<path d="M38 12 Q42 2 46 8 Q50 2 54 12" fill="#8FBC8F"/>`;
      break;
    case 'cloud':
      return `<svg viewBox="0 0 92 80" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
        <ellipse cx="30" cy="44" rx="18" ry="16" fill="${bodyColor}" opacity="0.9"/>
        <ellipse cx="46" cy="36" rx="22" ry="20" fill="${bodyColor}"/>
        <ellipse cx="62" cy="44" rx="18" ry="16" fill="${bodyColor}" opacity="0.9"/>
        ${eyes.replace(/cx="36"/g, 'cx="36"').replace(/cx="56"/g, 'cx="56"')}
        ${mouth}
        <ellipse cx="30" cy="48" rx="5" ry="3" fill="${colors.cheek}" opacity="0.5"/>
        <ellipse cx="62" cy="48" rx="5" ry="3" fill="${colors.cheek}" opacity="0.5"/>
      </svg>`;
  }

  return `<svg viewBox="0 0 92 76" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    ${ears}
    ${extra}
    <circle cx="46" cy="42" r="28" fill="${bodyColor}" opacity="0.9"/>
    <circle cx="46" cy="42" r="28" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="1"/>
    ${eyes}
    ${mouth}
    <ellipse cx="30" cy="50" rx="6" ry="4" fill="${colors.cheek}" opacity="0.45"/>
    <ellipse cx="62" cy="50" rx="6" ry="4" fill="${colors.cheek}" opacity="0.45"/>
  </svg>`;
}

// ---- 渲染精灵选项列表 ----
// options.onCustomClick: 点击 custom 时调用（用于打开捏脸弹窗）
export function renderSpritePicker(containerId, selectedType, onSelect, small = false, options = {}) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';
  container.className = small ? 'sprite-picker small' : 'sprite-picker';

  for (const [type, info] of Object.entries(SPRITE_TYPES)) {
    const option = document.createElement('div');
    option.className = 'sprite-option' + (type === selectedType ? ' selected' : '') + (type === 'custom' ? ' sprite-option-custom' : '');
    option.innerHTML = `
      <div class="sprite-svg">${renderSprite(type, 'calm', small ? 44 : 56)}</div>
      <div class="sprite-name">${info.name}</div>
    `;
    option.addEventListener('click', () => {
      // custom 入口走特殊流程：打开捏脸弹窗
      if (type === 'custom' && options.onCustomClick) {
        options.onCustomClick();
        return;
      }
      container.querySelectorAll('.sprite-option').forEach(el => el.classList.remove('selected'));
      option.classList.add('selected');
      if (onSelect) onSelect(type);
    });
    container.appendChild(option);
  }
}

// ---- 渲染人设选项列表 ----
export function renderPersonaPicker(containerId, selectedPersona, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '';
  container.className = 'persona-picker';

  for (const [type, info] of Object.entries(PERSONA_TYPES)) {
    const option = document.createElement('div');
    option.className = 'persona-option' + (type === selectedPersona ? ' selected' : '');
    option.innerHTML = `
      <span class="persona-icon">${info.icon}</span>
      <div class="persona-info">
        <div class="persona-name">${info.name}</div>
        <div class="persona-desc">${info.desc}</div>
      </div>
    `;
    option.addEventListener('click', () => {
      container.querySelectorAll('.persona-option').forEach(el => el.classList.remove('selected'));
      option.classList.add('selected');
      if (onSelect) onSelect(type);
    });
    container.appendChild(option);
  }
}

// ---- 精灵说话 ----
export function spriteSpeak(sprite, message, duration = 4000) {
  const bubble = document.getElementById('sprite-speech-bubble');
  const avatar = document.getElementById('sprite-avatar');
  if (!bubble || !avatar) return;

  // 更新精灵表情
  avatar.innerHTML = renderSprite(sprite.type, sprite.currentEmotion || 'calm', 64);

  // 显示气泡
  bubble.textContent = message;
  bubble.classList.remove('hidden');

  // 自动隐藏
  if (duration > 0) {
    clearTimeout(bubble._timer);
    bubble._timer = setTimeout(() => bubble.classList.add('hidden'), duration);
  }
}

// ---- 更新精灵状态 ----
export function updateSpriteEmotion(emotion) {
  const avatar = document.getElementById('sprite-avatar');
  const sprite = store.get().sprite;
  if (avatar) {
    avatar.innerHTML = renderSprite(sprite.type, emotion, 64);
  }
}

/* =========================================================
 *  捏脸弹窗 —— openFaceCustomizer
 *  打开 #modal-face，管理临时 config，保存时写入 store
 * ========================================================= */
/* =========================================================
 *  Tomodachi 风捏脸控件配置
 *  9 个分类：脸型/眼睛/眉毛/鼻子/嘴巴/发型/服装/腮红/眼镜
 * ========================================================= */
const STYLE_OPTIONS = {
  faceShape: [
    { value: 'round', label: '圆圆' }, { value: 'oval', label: '椭圆' }, { value: 'heart', label: '心形' },
  ],
  eyeStyle: [
    { value: 'round', label: '圆眼' }, { value: 'cute', label: '可爱' }, { value: 'oval', label: '椭圆' }, { value: 'sharp', label: '锐利' },
  ],
  eyebrowStyle: [
    { value: 'natural', label: '自然' }, { value: 'arched', label: '拱形' }, { value: 'straight', label: '平直' }, { value: 'angry', label: '英气' },
  ],
  noseStyle: [
    { value: 'dot', label: '小点' }, { value: 'small', label: '小巧' }, { value: 'round', label: '圆润' }, { value: 'pointed', label: '尖尖' },
  ],
  mouthStyle: [
    { value: 'smile', label: '微笑' }, { value: 'grin', label: '咧嘴' }, { value: 'neutral', label: '平静' }, { value: 'open', label: '张嘴' }, { value: 'cat', label: '猫嘴' },
  ],
  hairStyle: [
    { value: 'buzz', label: '寸头' }, { value: 'short-messy', label: '凌乱短发' }, { value: 'side-sweep', label: '斜刘海' },
    { value: 'spiky', label: '刺猬头' }, { value: 'wavy', label: '微卷' }, { value: 'long-straight', label: '长直发' },
    { value: 'long-wavy', label: '长卷' }, { value: 'pigtails', label: '双马尾' }, { value: 'ponytail', label: '单马尾' },
    { value: 'bun', label: '丸子头' }, { value: 'bald', label: '光头' },
  ],
  glasses: [
    { value: 'none', label: '无' }, { value: 'round', label: '圆框' }, { value: 'square', label: '方框' }, { value: 'sunglasses', label: '墨镜' },
  ],
};

const CATEGORY_DEFS = [
  { key: 'face',     label: '脸型', styleField: 'faceShape',    sliders: [{ key: 'faceWidth', label: '脸宽', min: 0, max: 100 }, { key: 'faceHeight', label: '脸长', min: 0, max: 100 }], colors: [{ key: 'skinColor', label: '肤色', palette: SKIN_COLORS }] },
  { key: 'eyes',     label: '眼睛', styleField: 'eyeStyle',      sliders: [{ key: 'eyeWidth', label: '眼宽', min: 0, max: 100 }, { key: 'eyeHeight', label: '眼高', min: 0, max: 100 }, { key: 'eyeSpacing', label: '眼距', min: 0, max: 100 }, { key: 'eyeVerticalPos', label: '眼位', min: 0, max: 100 }, { key: 'eyeTilt', label: '眼倾斜', min: -30, max: 30 }], colors: [{ key: 'eyeColor', label: '瞳色', palette: EYE_COLORS }] },
  { key: 'eyebrows', label: '眉毛', styleField: 'eyebrowStyle',  sliders: [{ key: 'eyebrowThickness', label: '眉粗', min: 0, max: 100 }, { key: 'eyebrowHeight', label: '眉位', min: 0, max: 100 }, { key: 'eyebrowLength', label: '眉长', min: 0, max: 100 }], colors: [{ key: 'eyebrowColor', label: '眉色', palette: HAIR_COLORS }] },
  { key: 'nose',     label: '鼻子', styleField: 'noseStyle',     sliders: [{ key: 'noseWidth', label: '鼻宽', min: 0, max: 100 }, { key: 'noseHeight', label: '鼻位', min: 0, max: 100 }], colors: [] },
  { key: 'mouth',    label: '嘴巴', styleField: 'mouthStyle',    sliders: [{ key: 'mouthWidth', label: '嘴宽', min: 0, max: 100 }, { key: 'mouthHeight', label: '嘴位', min: 0, max: 100 }], colors: [] },
  { key: 'hair',     label: '发型', styleField: 'hairStyle',     sliders: [], colors: [{ key: 'hairColor', label: '发色', palette: HAIR_COLORS }] },
  { key: 'clothing', label: '服装', styleField: null,            sliders: [], colors: [{ key: 'clothingColor', label: '服装色', palette: CLOTHING_COLORS }] },
  { key: 'blush',    label: '腮红', styleField: null, toggle: 'hasBlush', sliders: [{ key: 'blushIntensity', label: '浓度', min: 0, max: 100 }], colors: [{ key: 'blushColor', label: '腮红色', palette: BLUSH_COLORS }] },
  { key: 'glasses',  label: '眼镜', styleField: 'glasses',       sliders: [], colors: [{ key: 'glassesColor', label: '镜框色', palette: GLASSES_COLORS }] },
];

export function openFaceCustomizer({ onSave, allowUpload = true } = {}) {
  const modal = document.getElementById('modal-face');
  if (!modal) return;

  const sprite = store.get().sprite || {};
  // 临时 CharacterState（弹窗内编辑，未点保存前不影响 store）
  let avatarCfg = { ...DEFAULT_CHARACTER, ...(sprite.avatarConfig || {}) };
  let customImage = sprite.customImage || null;
  let mode = customImage ? 'photo' : 'parts';

  const $ = (id) => document.getElementById(id);
  const previewEl = $('face-preview-sprite');
  const modeParts = $('face-mode-parts');
  const modePhoto = $('face-mode-photo');
  const partsPanel = $('face-parts-panel');
  const photoPanel = $('face-photo-panel');

  // ---- 渲染预览（新版 Q版角色，竖向含身体）----
  const renderPreview = () => {
    if (mode === 'photo' && customImage) {
      previewEl.innerHTML = `<img src="${customImage}" alt="自定义" style="width:200px;height:200px;border-radius:50%;object-fit:cover;border:4px solid rgba(255,255,255,0.7);box-shadow:0 8px 24px rgba(0,0,0,0.15)">`;
    } else {
      previewEl.innerHTML = renderCustomAvatar(avatarCfg, 260);
    }
  };

  // ---- 渲染分类标签栏 + 各分类面板 ----
  const renderControls = () => {
    const tabsEl = $('face-category-tabs');
    const panelsEl = $('face-cat-panels');
    if (!tabsEl || !panelsEl) return;
    tabsEl.innerHTML = '';
    panelsEl.innerHTML = '';

    CATEGORY_DEFS.forEach((cat, idx) => {
      // 分类标签
      const tab = document.createElement('button');
      tab.className = 'face-cat-tab' + (idx === 0 ? ' active' : '');
      tab.textContent = cat.label;
      tab.dataset.cat = cat.key;
      tab.onclick = () => switchCategory(cat.key);
      tabsEl.appendChild(tab);

      // 分类面板
      const panel = document.createElement('div');
      panel.className = 'face-cat-panel' + (idx === 0 ? ' active' : '');
      panel.dataset.cat = cat.key;

      // 样式选择 chip
      if (cat.styleField && STYLE_OPTIONS[cat.styleField]) {
        const title = document.createElement('div');
        title.className = 'face-section-title';
        title.textContent = cat.label + '样式';
        panel.appendChild(title);
        const chips = document.createElement('div');
        chips.className = 'face-chips';
        STYLE_OPTIONS[cat.styleField].forEach(opt => {
          const chip = document.createElement('button');
          chip.className = 'face-chip' + (avatarCfg[cat.styleField] === opt.value ? ' selected' : '');
          chip.textContent = opt.label;
          chip.onclick = () => {
            avatarCfg[cat.styleField] = opt.value;
            chips.querySelectorAll('.face-chip').forEach(c => c.classList.remove('selected'));
            chip.classList.add('selected');
            renderPreview();
          };
          chips.appendChild(chip);
        });
        panel.appendChild(chips);
      }

      // 开关（腮红 hasBlush）
      if (cat.toggle) {
        const toggle = document.createElement('label');
        toggle.className = 'face-toggle';
        toggle.innerHTML = `<input type="checkbox" ${avatarCfg[cat.toggle] ? 'checked' : ''}><span>启用${cat.label}</span>`;
        toggle.querySelector('input').onchange = (e) => {
          avatarCfg[cat.toggle] = e.target.checked;
          renderPreview();
        };
        panel.appendChild(toggle);
      }

      // 滑块
      cat.sliders.forEach(sl => {
        const sec = document.createElement('div');
        sec.className = 'face-section';
        const title = document.createElement('div');
        title.className = 'face-section-title';
        title.innerHTML = `${sl.label} <span class="face-slider-val">${avatarCfg[sl.key]}</span>`;
        sec.appendChild(title);
        const input = document.createElement('input');
        input.type = 'range';
        input.min = sl.min;
        input.max = sl.max;
        input.value = avatarCfg[sl.key];
        input.className = 'face-slider';
        input.oninput = () => {
          avatarCfg[sl.key] = parseFloat(input.value);
          title.querySelector('.face-slider-val').textContent = input.value;
          renderPreview();
        };
        sec.appendChild(input);
        panel.appendChild(sec);
      });

      // 颜色板
      cat.colors.forEach(col => {
        const sec = document.createElement('div');
        sec.className = 'face-section';
        const title = document.createElement('div');
        title.className = 'face-section-title';
        title.textContent = col.label;
        sec.appendChild(title);
        const palette = document.createElement('div');
        palette.className = 'color-palette';
        col.palette.forEach(color => {
          const sw = document.createElement('button');
          sw.className = 'color-swatch' + (color.toLowerCase() === (avatarCfg[col.key] || '').toLowerCase() ? ' selected' : '');
          sw.style.background = color;
          sw.onclick = () => {
            avatarCfg[col.key] = color;
            palette.querySelectorAll('.color-swatch').forEach(o => o.classList.remove('selected'));
            sw.classList.add('selected');
            renderPreview();
          };
          palette.appendChild(sw);
        });
        sec.appendChild(palette);
        panel.appendChild(sec);
      });

      panelsEl.appendChild(panel);
    });
  };

  // ---- 切换分类 ----
  const switchCategory = (catKey) => {
    $('face-category-tabs').querySelectorAll('.face-cat-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === catKey));
    $('face-cat-panels').querySelectorAll('.face-cat-panel').forEach(p => p.classList.toggle('active', p.dataset.cat === catKey));
  };

  // ---- 模式切换 ----
  const switchMode = (m) => {
    mode = m;
    modeParts.classList.toggle('active', m === 'parts');
    modePhoto.classList.toggle('active', m === 'photo');
    partsPanel.classList.toggle('hidden', m !== 'parts');
    photoPanel.classList.toggle('hidden', m !== 'photo');
    renderPreview();
  };
  modeParts.onclick = () => switchMode('parts');
  modePhoto.onclick = () => switchMode('photo');

  // ---- 上传照片 ----
  const photoInput = $('face-photo-input');
  const photoHint = $('face-photo-hint');
  if (photoInput) {
    photoInput.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        customImage = reader.result;
        if (photoHint) photoHint.textContent = '已上传 ✓（动森风转换 API 待接入，目前直接使用原图）';
        renderPreview();
      };
      reader.readAsDataURL(file);
    };
  }
  const photoClear = $('face-photo-clear');
  if (photoClear) {
    photoClear.onclick = () => {
      customImage = null;
      if (photoInput) photoInput.value = '';
      if (photoHint) photoHint.textContent = '选择一张照片，未来会通过 seedream 等 API 转成动森风';
      renderPreview();
    };
  }

  // ---- 随机按钮 ----
  const randomBtn = $('face-random');
  if (randomBtn) {
    randomBtn.onclick = () => {
      avatarCfg = { ...DEFAULT_CHARACTER };
      // 随机化所有样式选择字段
      Object.keys(STYLE_OPTIONS).forEach(field => {
        const opts = STYLE_OPTIONS[field];
        avatarCfg[field] = opts[Math.floor(Math.random() * opts.length)].value;
      });
      // 随机化颜色
      avatarCfg.skinColor = SKIN_COLORS[Math.floor(Math.random() * SKIN_COLORS.length)];
      avatarCfg.eyeColor = EYE_COLORS[Math.floor(Math.random() * EYE_COLORS.length)];
      const hairC = HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)];
      avatarCfg.hairColor = hairC;
      avatarCfg.eyebrowColor = hairC;
      avatarCfg.clothingColor = CLOTHING_COLORS[Math.floor(Math.random() * CLOTHING_COLORS.length)];
      avatarCfg.blushColor = BLUSH_COLORS[Math.floor(Math.random() * BLUSH_COLORS.length)];
      avatarCfg.glassesColor = GLASSES_COLORS[Math.floor(Math.random() * GLASSES_COLORS.length)];
      avatarCfg.hasBlush = Math.random() > 0.3;
      // 随机化滑块
      avatarCfg.faceWidth = 30 + Math.floor(Math.random() * 40);
      avatarCfg.faceHeight = 30 + Math.floor(Math.random() * 40);
      avatarCfg.eyeWidth = 30 + Math.floor(Math.random() * 40);
      avatarCfg.eyeHeight = 30 + Math.floor(Math.random() * 40);
      avatarCfg.eyeSpacing = 30 + Math.floor(Math.random() * 40);
      avatarCfg.eyeVerticalPos = 30 + Math.floor(Math.random() * 40);
      avatarCfg.eyebrowThickness = 30 + Math.floor(Math.random() * 40);
      avatarCfg.blushIntensity = 20 + Math.floor(Math.random() * 50);
      switchMode('parts');
      renderControls();
      renderPreview();
    };
  }

  // ---- 保存 / 关闭 ----
  const saveBtn = $('face-save');
  const closeBtns = modal.querySelectorAll('[data-close]');
  const doSave = () => {
    store.updateSprite({
      type: 'custom',
      avatarConfig: avatarCfg,
      customImage: mode === 'photo' ? customImage : null,
    });
    modal.classList.add('hidden');
    if (onSave) onSave({ avatarConfig: avatarCfg, customImage });
  };
  if (saveBtn) saveBtn.onclick = doSave;
  closeBtns.forEach(b => b.onclick = () => modal.classList.add('hidden'));

  // ---- 初始化 ----
  try {
    renderControls();
    switchMode(customImage ? 'photo' : 'parts');
    modal.classList.remove('hidden');
    console.log('[openFaceCustomizer] 弹窗已打开');
  } catch (e) {
    console.error('[openFaceCustomizer] 初始化失败:', e);
    modal.classList.remove('hidden');
  }
}
