/**
 * Tomodachi Life 风格 Q版捏脸渲染器（纯 JavaScript 版本）
 *
 * 从 face 项目（Next.js/React + TypeScript）移植而来。
 * 原文件：
 *   - face/src/components/avatar-canvas.tsx  (SVG 角色渲染器，1244 行 JSX)
 *   - face/src/lib/character-types.ts       (CharacterState 接口、颜色预设、默认值)
 *
 * 本模块不依赖 React/JSX/TypeScript，导出 renderAvatarSVG(state) 返回完整 SVG 字符串。
 *
 * 渲染层级（从底到顶）：
 *   展台 → 身体 → 发型后层 → 耳朵 → 脸型 → 腮红 → 眼睛 → 眉毛 → 鼻子 → 嘴巴 → 发型前层 → 眼镜
 *
 * @module avatar-render
 */

/* eslint-disable */

// 坐标常量
const CX = 150; // 头部中心X
const CY = 140; // 头部中心Y（上移给身体更多空间）

// ==================== 颜色预设 ====================

export const SKIN_COLORS = [
  '#FFDFC4', '#FFE0BD', '#FFCD94', '#E8B67A',
  '#D49A5C', '#C68642', '#8D5524', '#6B3A1F',
];

export const EYE_COLORS = [
  '#4A3728', '#2E5A4B', '#2E86AB', '#5D7B4A',
  '#8B6914', '#6B4C8A', '#1A1A2E', '#C1440E',
];

export const HAIR_COLORS = [
  '#4A3728', '#1A1A2E', '#D4A373', '#C1440E',
  '#E8C547', '#FF6B9D', '#7EC8E3', '#8B5CF6',
  '#F5F5DC', '#C0C0C0', '#FF4444', '#2D5016',
];

export const BLUSH_COLORS = [
  '#FF6B9D', '#FF8FAB', '#FFB3C6', '#E8829B',
  '#FFA07A', '#FF7F7F',
];

export const CLOTHING_COLORS = [
  '#7EC8E3', '#FF6B9D', '#A8E6CF', '#FFD93D',
  '#C4B5FD', '#F97316', '#FFFFFF', '#4A3728',
  '#1A1A2E', '#E8C547', '#2E86AB', '#8B5CF6',
];

export const GLASSES_COLORS = [
  '#4A3728', '#1A1A2E', '#C1440E', '#8B5CF6',
  '#FF6B9D', '#2E86AB', '#D4A373',
];

// ==================== 默认角色状态 ====================

/**
 * CharacterState 角色状态对象（从 TypeScript 接口移植为 JSDoc 说明）。
 *
 * @typedef {Object} CharacterState
 * @property {('round'|'oval'|'heart')} faceShape        - 脸型
 * @property {number} faceWidth                            - 0-100 脸宽
 * @property {number} faceHeight                           - 0-100 脸高
 * @property {string} skinColor                            - 肤色
 * @property {('round'|'cute'|'oval'|'sharp')} eyeStyle   - 眼型
 * @property {number} eyeWidth                             - 0-100 眼睛宽度
 * @property {number} eyeHeight                            - 0-100 眼睛高度（纵向大小）
 * @property {number} eyeSpacing                           - 0-100 两眼间距
 * @property {number} eyeVerticalPos                       - 0-100 眼睛垂直位置
 * @property {string} eyeColor                             - 眼睛颜色
 * @property {number} eyeTilt                              - -30 to 30 眼角倾斜
 * @property {('natural'|'arched'|'straight'|'angry')} eyebrowStyle - 眉型
 * @property {number} eyebrowThickness                     - 0-100 粗细
 * @property {number} eyebrowHeight                        - 0-100 眉毛垂直位置
 * @property {number} eyebrowLength                        - 0-100 眉毛长度
 * @property {string} eyebrowColor                         - 眉毛颜色
 * @property {('dot'|'small'|'round'|'pointed')} noseStyle - 鼻型
 * @property {number} noseWidth                            - 0-100 鼻子宽度
 * @property {number} noseHeight                           - 0-100 鼻子高度（垂直位置）
 * @property {('smile'|'grin'|'neutral'|'open'|'cat')} mouthStyle - 嘴型
 * @property {number} mouthWidth                            - 0-100
 * @property {number} mouthHeight                           - 0-100 嘴巴垂直位置
 * @property {('buzz'|'short-messy'|'side-sweep'|'spiky'|'wavy'|'long-straight'|'long-wavy'|'pigtails'|'ponytail'|'bun'|'bald')} hairStyle - 发型
 * @property {string} hairColor                            - 发色
 * @property {string} clothingColor                        - 服装颜色
 * @property {boolean} hasBlush                            - 是否有腮红
 * @property {number} blushIntensity                       - 0-100 腮红强度
 * @property {string} blushColor                           - 腮红颜色
 * @property {('none'|'round'|'square'|'sunglasses')} glasses - 眼镜样式
 * @property {string} glassesColor                         - 眼镜颜色
 */

/**
 * 默认角色状态
 * @type {CharacterState}
 */
export const DEFAULT_CHARACTER = {
  faceShape: 'round',
  faceWidth: 50,
  faceHeight: 50,
  skinColor: '#FFE0BD',

  eyeStyle: 'cute',
  eyeWidth: 55,
  eyeHeight: 50,
  eyeSpacing: 50,
  eyeVerticalPos: 45,
  eyeColor: '#4A3728',
  eyeTilt: 0,

  eyebrowStyle: 'natural',
  eyebrowThickness: 50,
  eyebrowHeight: 50,
  eyebrowLength: 50,
  eyebrowColor: '#4A3728',

  noseStyle: 'dot',
  noseWidth: 30,
  noseHeight: 50,

  mouthStyle: 'smile',
  mouthWidth: 50,
  mouthHeight: 50,

  hairStyle: 'side-sweep',
  hairColor: '#4A3728',

  clothingColor: '#7EC8E3',

  hasBlush: true,
  blushIntensity: 40,
  blushColor: '#FF6B9D',

  glasses: 'none',
  glassesColor: '#4A3728',
};

// ==================== 特征分类 ====================

/**
 * 捏脸特征类别
 * @typedef {('face'|'eyes'|'eyebrows'|'nose'|'mouth'|'hair'|'clothing'|'blush'|'glasses')} FeatureCategory
 */

/**
 * @typedef {Object} FeatureCategoryLabels
 * @property {string} face
 * @property {string} eyes
 * @property {string} eyebrows
 * @property {string} nose
 * @property {string} mouth
 * @property {string} hair
 * @property {string} clothing
 * @property {string} blush
 * @property {string} glasses
 */

/**
 * 特征类别标签（中文），供捏脸界面使用。
 * @type {Record<FeatureCategory, string>}
 */
export const CATEGORY_LABELS = {
  face: '脸型',
  eyes: '眼睛',
  eyebrows: '眉毛',
  nose: '鼻子',
  mouth: '嘴巴',
  hair: '发型',
  clothing: '服装',
  blush: '腮红',
  glasses: '眼镜',
};

// ==================== 辅助函数 ====================

/** 根据参数计算头部尺寸 */
function getHeadSize(state) {
  const baseRx = 72;
  const baseRy = 82;
  const widthFactor = 0.5 + (state.faceWidth / 100) * 0.7; // 0.5-1.2
  const heightFactor = 0.5 + (state.faceHeight / 100) * 0.7;
  return {
    rx: baseRx * widthFactor,
    ry: baseRy * heightFactor,
  };
}

/** 根据脸型计算实际轮廓的等效半径（发型需要包裹的实际脸边界） */
function getFaceBounds(state) {
  const { rx, ry } = getHeadSize(state);
  switch (state.faceShape) {
    case 'oval':
      return { rx: rx * 0.85, ry: ry * 1.1 };
    case 'heart':
      return { rx: rx * 1.0, ry: ry * 1.05 }; // 心形脸上部宽、下部窄
    case 'round':
    default:
      return { rx, ry };
  }
}

/** 根据参数计算眼睛位置（基于脸型边界自适应） */
function getEyePositions(state) {
  const { rx, ry } = getFaceBounds(state);
  const spacing = rx * (0.2 + (state.eyeSpacing / 100) * 0.35); // 间距随脸宽缩放
  const verticalPos = -0.05 + (state.eyeVerticalPos / 100) * 0.25; // -0.05-0.2
  const eyeY = CY - ry * 0.15 + ry * verticalPos;
  const eyeW = rx * (0.12 + (state.eyeWidth / 100) * 0.22); // 眼宽随脸宽缩放
  const eyeH = ry * (0.1 + (state.eyeHeight / 100) * 0.18); // 眼高随脸高缩放
  return {
    leftX: CX - spacing,
    rightX: CX + spacing,
    y: eyeY,
    width: eyeW,
    height: eyeH,
  };
}

// ==================== 脸型 ====================

function renderFace(state) {
  const { rx, ry } = getHeadSize(state);
  const { skinColor, faceShape } = state;

  switch (faceShape) {
    case 'round':
      return `<ellipse cx="${CX}" cy="${CY}" rx="${rx}" ry="${ry}" fill="${skinColor}" stroke="#4A3728" stroke-width="3" />`;
    case 'oval':
      return `<ellipse cx="${CX}" cy="${CY}" rx="${rx * 0.85}" ry="${ry * 1.1}" fill="${skinColor}" stroke="#4A3728" stroke-width="3" />`;
    case 'heart': {
      const w = rx;
      const h = ry * 1.05;
      return `<path d="M ${CX} ${CY + h}
              C ${CX - w * 0.2} ${CY + h * 0.7} ${CX - w * 1.1} ${CY + h * 0.2} ${CX - w} ${CY - h * 0.2}
              C ${CX - w * 0.9} ${CY - h * 0.9} ${CX - w * 0.3} ${CY - h} ${CX} ${CY - h * 0.7}
              C ${CX + w * 0.3} ${CY - h} ${CX + w * 0.9} ${CY - h * 0.9} ${CX + w} ${CY - h * 0.2}
              C ${CX + w * 1.1} ${CY + h * 0.2} ${CX + w * 0.2} ${CY + h * 0.7} ${CX} ${CY + h} Z" fill="${skinColor}" stroke="#4A3728" stroke-width="3" stroke-linejoin="round" />`;
    }
    default:
      return '';
  }
}

// ==================== 耳朵 ====================

function renderEars(state) {
  const { rx, ry } = getFaceBounds(state);
  const { skinColor } = state;
  const earW = rx * 0.2;
  const earH = ry * 0.22;
  const earY = CY + 5;

  return `<g>` +
    `<ellipse cx="${CX - rx - earW * 0.3}" cy="${earY}" rx="${earW}" ry="${earH}" fill="${skinColor}" stroke="#4A3728" stroke-width="3" />` +
    `<ellipse cx="${CX + rx + earW * 0.3}" cy="${earY}" rx="${earW}" ry="${earH}" fill="${skinColor}" stroke="#4A3728" stroke-width="3" />` +
    // 耳内
    `<ellipse cx="${CX - rx - earW * 0.3}" cy="${earY}" rx="${earW * 0.5}" ry="${earH * 0.5}" fill="#F0C8A8" />` +
    `<ellipse cx="${CX + rx + earW * 0.3}" cy="${earY}" rx="${earW * 0.5}" ry="${earH * 0.5}" fill="#F0C8A8" />` +
    `</g>`;
}

// ==================== 眼睛 ====================

function renderEyes(state) {
  const { leftX, rightX, y, width, height } = getEyePositions(state);
  const { eyeStyle, eyeColor, eyeTilt } = state;
  const w = width;
  const h = height;

  const renderSingleEye = (cx, cy, isLeft) => {
    const flipX = isLeft ? 1 : -1;

    switch (eyeStyle) {
      case 'round':
        return `<g>` +
          `<ellipse cx="${cx}" cy="${cy}" rx="${w}" ry="${h}" fill="white" stroke="#4A3728" stroke-width="2.5" />` +
          `<circle cx="${cx + flipX * 2}" cy="${cy + 1}" r="${Math.min(w, h) * 0.6}" fill="${eyeColor}" />` +
          `<circle cx="${cx + flipX * 2}" cy="${cy + 2}" r="${Math.min(w, h) * 0.35}" fill="#1A1A2E" />` +
          `<circle cx="${cx + flipX * w * 0.25}" cy="${cy - h * 0.2}" r="${Math.min(w, h) * 0.18}" fill="white" />` +
          `<circle cx="${cx - flipX * w * 0.15}" cy="${cy + h * 0.15}" r="${Math.min(w, h) * 0.08}" fill="white" />` +
          `</g>`;

      case 'cute':
        return `<g>` +
          `<ellipse cx="${cx}" cy="${cy}" rx="${w * 1.1}" ry="${h * 1.2}" fill="white" stroke="#4A3728" stroke-width="2.5" />` +
          `<circle cx="${cx + flipX * 2}" cy="${cy + 2}" r="${Math.min(w, h) * 0.75}" fill="${eyeColor}" />` +
          `<circle cx="${cx + flipX * 2}" cy="${cy + 3}" r="${Math.min(w, h) * 0.45}" fill="#1A1A2E" />` +
          `<circle cx="${cx + flipX * w * 0.3}" cy="${cy - h * 0.25}" r="${Math.min(w, h) * 0.22}" fill="white" />` +
          `<circle cx="${cx - flipX * w * 0.2}" cy="${cy + h * 0.2}" r="${Math.min(w, h) * 0.12}" fill="white" />` +
          `<ellipse cx="${cx + flipX * 1}" cy="${cy + h * 0.4}" rx="${w * 0.25}" ry="${h * 0.06}" fill="rgba(255,255,255,0.5)" />` +
          `<path d="M ${cx - w * 1.1} ${cy - h * 0.2} Q ${cx} ${cy - h * 1.4} ${cx + w * 1.1} ${cy - h * 0.2}" fill="none" stroke="#4A3728" stroke-width="3" stroke-linecap="round" />` +
          `</g>`;

      case 'oval':
        return `<g>` +
          `<ellipse cx="${cx}" cy="${cy}" rx="${w * 0.8}" ry="${h * 1.1}" fill="white" stroke="#4A3728" stroke-width="2.5" />` +
          `<ellipse cx="${cx + flipX * 1}" cy="${cy + 1}" rx="${w * 0.5}" ry="${h * 0.7}" fill="${eyeColor}" />` +
          `<ellipse cx="${cx + flipX * 1}" cy="${cy + 2}" rx="${w * 0.25}" ry="${h * 0.4}" fill="#1A1A2E" />` +
          `<circle cx="${cx + flipX * w * 0.2}" cy="${cy - h * 0.25}" r="${Math.min(w, h) * 0.15}" fill="white" />` +
          `</g>`;

      case 'sharp':
        return `<g>` +
          `<path d="M ${cx - w * 1.2} ${cy + h * 0.3}
                  Q ${cx - w * 0.5} ${cy - h * 1.1} ${cx + w * 0.2} ${cy - h * 0.5}
                  Q ${cx + w * 1.2} ${cy - h * 0.2} ${cx + w * 0.5} ${cy + h * 0.5}
                  Q ${cx} ${cy + h * 0.2} ${cx - w * 1.2} ${cy + h * 0.3} Z" fill="white" stroke="#4A3728" stroke-width="2.5" />` +
          `<ellipse cx="${cx}" cy="${cy}" rx="${w * 0.45}" ry="${h * 0.55}" fill="${eyeColor}" />` +
          `<circle cx="${cx}" cy="${cy + 1}" r="${Math.min(w, h) * 0.28}" fill="#1A1A2E" />` +
          `<circle cx="${cx + w * 0.15}" cy="${cy - h * 0.2}" r="${Math.min(w, h) * 0.12}" fill="white" />` +
          `</g>`;

      default:
        return '';
    }
  };

  return `<g style="transform: rotate(${eyeTilt}deg); transform-origin: ${CX}px ${y}px;">` +
    renderSingleEye(leftX, y, true) +
    renderSingleEye(rightX, y, false) +
    `</g>`;
}

// ==================== 眉毛 ====================

function renderEyebrows(state) {
  const { leftX, rightX, y, height: eyeH } = getEyePositions(state);
  const { rx, ry } = getFaceBounds(state);
  const { eyebrowStyle, eyebrowThickness, eyebrowHeight, eyebrowLength, eyebrowColor } = state;
  const thick = ry * (0.02 + (eyebrowThickness / 100) * 0.05); // 粗细随脸缩放
  const heightGap = ry * (0.05 + (eyebrowHeight / 100) * 0.2); // 眉毛离眼睛的距离随脸高缩放
  const browY = y - eyeH - heightGap;
  const browLen = rx * (0.18 + (eyebrowLength / 100) * 0.22); // 眉毛长度随脸宽缩放

  const renderSingleBrow = (cx, cy, isLeft) => {
    const flip = isLeft ? 1 : -1;
    const w = browLen; // 眉毛半宽

    switch (eyebrowStyle) {
      case 'natural':
        return `<path d="M ${cx - w * flip} ${cy + 3} Q ${cx} ${cy - 5} ${cx + w * 0.5 * flip} ${cy}" fill="none" stroke="${eyebrowColor}" stroke-width="${thick}" stroke-linecap="round" />`;
      case 'arched':
        return `<path d="M ${cx - w * flip} ${cy + 5} Q ${cx - w * 0.3 * flip} ${cy - 8} ${cx + w * 0.5 * flip} ${cy + 2}" fill="none" stroke="${eyebrowColor}" stroke-width="${thick}" stroke-linecap="round" />`;
      case 'straight':
        return `<line x1="${cx - w * flip}" y1="${cy}" x2="${cx + w * 0.5 * flip}" y2="${cy + 1}" stroke="${eyebrowColor}" stroke-width="${thick}" stroke-linecap="round" />`;
      case 'angry':
        return `<path d="M ${cx - w * flip} ${cy - 3} Q ${cx} ${cy + 4} ${cx + w * 0.5 * flip} ${cy + 6}" fill="none" stroke="${eyebrowColor}" stroke-width="${thick}" stroke-linecap="round" />`;
      default:
        return '';
    }
  };

  return `<g>` +
    renderSingleBrow(leftX, browY, true) +
    renderSingleBrow(rightX, browY, false) +
    `</g>`;
}

// ==================== 鼻子 ====================

function renderNose(state) {
  const { noseStyle, noseWidth, noseHeight } = state;
  const { rx, ry } = getFaceBounds(state);
  const noseY = CY + ry * (0.05 + (noseHeight / 100) * 0.2); // 鼻子垂直位置随noseHeight变化
  const nw = rx * (0.04 + (noseWidth / 100) * 0.1); // 鼻子宽度随脸宽缩放

  switch (noseStyle) {
    case 'dot':
      return `<circle cx="${CX}" cy="${noseY}" r="${nw * 0.6}" fill="#D4A373" />`;
    case 'small':
      return `<path d="M ${CX} ${noseY - nw * 0.5} L ${CX - nw * 0.5} ${noseY + nw * 0.5} L ${CX + nw * 0.5} ${noseY + nw * 0.5} Z" fill="#D4A373" stroke="#C4956A" stroke-width="1" />`;
    case 'round':
      return `<circle cx="${CX}" cy="${noseY}" r="${nw}" fill="#E8C5A0" stroke="#D4A373" stroke-width="1.5" />`;
    case 'pointed':
      return `<path d="M ${CX - nw * 0.8} ${noseY - nw * 0.3} L ${CX} ${noseY + nw} L ${CX + nw * 0.8} ${noseY - nw * 0.3}" fill="none" stroke="#D4A373" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />`;
    default:
      return '';
  }
}

// ==================== 嘴巴 ====================

function renderMouth(state) {
  const { mouthStyle, mouthWidth, mouthHeight } = state;
  const { rx, ry } = getFaceBounds(state);
  const mouthY = CY + ry * (0.25 + (mouthHeight / 100) * 0.2); // 嘴巴垂直位置随mouthHeight变化
  const w = rx * (0.12 + (mouthWidth / 100) * 0.3); // 嘴宽随脸宽缩放

  switch (mouthStyle) {
    case 'smile':
      return `<path d="M ${CX - w} ${mouthY} Q ${CX} ${mouthY + w * 0.7} ${CX + w} ${mouthY}" fill="none" stroke="#4A3728" stroke-width="2.5" stroke-linecap="round" />`;
    case 'grin':
      return `<g>` +
        `<path d="M ${CX - w * 1.1} ${mouthY} Q ${CX} ${mouthY + w * 0.9} ${CX + w * 1.1} ${mouthY}" fill="#4A3728" stroke="#4A3728" stroke-width="2" stroke-linecap="round" />` +
        `<path d="M ${CX - w * 0.8} ${mouthY} Q ${CX} ${mouthY + w * 0.3} ${CX + w * 0.8} ${mouthY}" fill="white" />` +
        `</g>`;
    case 'neutral':
      return `<line x1="${CX - w * 0.6}" y1="${mouthY}" x2="${CX + w * 0.6}" y2="${mouthY + 1}" stroke="#4A3728" stroke-width="2.5" stroke-linecap="round" />`;
    case 'open':
      return `<g>` +
        `<ellipse cx="${CX}" cy="${mouthY + 5}" rx="${w * 0.6}" ry="${w * 0.5}" fill="#4A3728" stroke="#3A2718" stroke-width="1.5" />` +
        `<ellipse cx="${CX}" cy="${mouthY + w * 0.5 + 2}" rx="${w * 0.35}" ry="${w * 0.25}" fill="#FF8FAB" />` +
        `</g>`;
    case 'cat':
      return `<path d="M ${CX - w} ${mouthY} Q ${CX - w * 0.4} ${mouthY + w * 0.5} ${CX} ${mouthY + 2}
              Q ${CX + w * 0.4} ${mouthY + w * 0.5} ${CX + w} ${mouthY}" fill="none" stroke="#4A3728" stroke-width="2.5" stroke-linecap="round" />`;
    default:
      return '';
  }
}

// ==================== 腮红 ====================

function renderBlush(state) {
  if (!state.hasBlush) return '';
  const { leftX, rightX, y, height } = getEyePositions(state);
  const { rx, ry } = getFaceBounds(state);
  const { blushIntensity, blushColor } = state;
  const opacity = 0.15 + (blushIntensity / 100) * 0.5;
  const blushY = y + height + ry * 0.12;
  const blushRx = rx * (0.12 + (blushIntensity / 100) * 0.1);
  const blushRy = ry * (0.07 + (blushIntensity / 100) * 0.05);

  return `<g>` +
    `<ellipse cx="${leftX - 5}" cy="${blushY}" rx="${blushRx}" ry="${blushRy}" fill="${blushColor}" opacity="${opacity}" />` +
    `<ellipse cx="${rightX + 5}" cy="${blushY}" rx="${blushRx}" ry="${blushRy}" fill="${blushColor}" opacity="${opacity}" />` +
    `</g>`;
}

// ==================== 发型后层 ====================

function renderHairBack(state) {
  const { rx, ry } = getFaceBounds(state);
  const { hairStyle, hairColor } = state;

  switch (hairStyle) {
    case 'long-straight': {
      // 左侧长发 + 右侧长发
      return `<g>` +
        `<path d="M ${CX - rx - 8} ${CY - ry * 0.4}
                Q ${CX - rx - 14} ${CY + ry * 0.3} ${CX - rx - 6} ${CY + ry * 1.6}
                Q ${CX - rx + 5} ${CY + ry * 1.7} ${CX - rx + 15} ${CY + ry * 1.3}
                Q ${CX - rx + 12} ${CY + ry * 0.4} ${CX - rx + 10} ${CY - ry * 0.2} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        `<path d="M ${CX + rx + 8} ${CY - ry * 0.4}
                Q ${CX + rx + 14} ${CY + ry * 0.3} ${CX + rx + 6} ${CY + ry * 1.6}
                Q ${CX + rx - 5} ${CY + ry * 1.7} ${CX + rx - 15} ${CY + ry * 1.3}
                Q ${CX + rx - 12} ${CY + ry * 0.4} ${CX + rx - 10} ${CY - ry * 0.2} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        `</g>`;
    }
    case 'long-wavy': {
      // 左侧波浪长发 + 右侧波浪长发
      return `<g>` +
        `<path d="M ${CX - rx - 8} ${CY - ry * 0.4}
                Q ${CX - rx - 16} ${CY} ${CX - rx - 10} ${CY + ry * 0.5}
                Q ${CX - rx - 20} ${CY + ry * 1.0} ${CX - rx - 8} ${CY + ry * 1.5}
                Q ${CX - rx + 5} ${CY + ry * 1.6} ${CX - rx + 15} ${CY + ry * 1.2}
                Q ${CX - rx + 5} ${CY + ry * 0.8} ${CX - rx + 12} ${CY + ry * 0.4}
                Q ${CX - rx + 8} ${CY} ${CX - rx + 10} ${CY - ry * 0.2} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        `<path d="M ${CX + rx + 8} ${CY - ry * 0.4}
                Q ${CX + rx + 16} ${CY} ${CX + rx + 10} ${CY + ry * 0.5}
                Q ${CX + rx + 20} ${CY + ry * 1.0} ${CX + rx + 8} ${CY + ry * 1.5}
                Q ${CX + rx - 5} ${CY + ry * 1.6} ${CX + rx - 15} ${CY + ry * 1.2}
                Q ${CX + rx - 5} ${CY + ry * 0.8} ${CX + rx - 12} ${CY + ry * 0.4}
                Q ${CX + rx - 8} ${CY} ${CX + rx - 10} ${CY - ry * 0.2} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        `</g>`;
    }
    case 'pigtails': {
      // 左马尾 + 右马尾 + 发圈
      return `<g>` +
        `<path d="M ${CX - rx - 5} ${CY - ry * 0.45}
                Q ${CX - rx - 22} ${CY - ry * 0.2} ${CX - rx - 18} ${CY + ry * 0.3}
                Q ${CX - rx - 14} ${CY + ry * 1.2} ${CX - rx - 22} ${CY + ry * 1.6}
                Q ${CX - rx - 32} ${CY + ry * 1.4} ${CX - rx - 28} ${CY + ry * 0.8}
                Q ${CX - rx - 22} ${CY + ry * 0.2} ${CX - rx - 12} ${CY - ry * 0.15}
                Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        `<path d="M ${CX + rx + 5} ${CY - ry * 0.45}
                Q ${CX + rx + 22} ${CY - ry * 0.2} ${CX + rx + 18} ${CY + ry * 0.3}
                Q ${CX + rx + 14} ${CY + ry * 1.2} ${CX + rx + 22} ${CY + ry * 1.6}
                Q ${CX + rx + 32} ${CY + ry * 1.4} ${CX + rx + 28} ${CY + ry * 0.8}
                Q ${CX + rx + 22} ${CY + ry * 0.2} ${CX + rx + 12} ${CY - ry * 0.15}
                Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        `<circle cx="${CX - rx - 6}" cy="${CY - ry * 0.3}" r="5" fill="#FF6B9D" stroke="#E5568A" stroke-width="1.5" />` +
        `<circle cx="${CX + rx + 6}" cy="${CY - ry * 0.3}" r="5" fill="#FF6B9D" stroke="#E5568A" stroke-width="1.5" />` +
        `</g>`;
    }
    case 'ponytail': {
      // 马尾 + 发圈
      return `<g>` +
        `<path d="M ${CX + 8} ${CY - ry * 0.75}
                Q ${CX + rx + 18} ${CY - ry * 0.6} ${CX + rx + 14} ${CY + ry * 0.1}
                Q ${CX + rx + 10} ${CY + ry * 1.0} ${CX + rx + 5} ${CY + ry * 1.6}
                Q ${CX + rx - 3} ${CY + ry * 1.4} ${CX + rx + 2} ${CY + ry * 0.6}
                Q ${CX + rx + 6} ${CY} ${CX + rx - 3} ${CY - ry * 0.3}
                Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        `<circle cx="${CX + rx - 2}" cy="${CY - ry * 0.35}" r="5" fill="#FF6B9D" stroke="#E5568A" stroke-width="1.5" />` +
        `</g>`;
    }
    case 'bun': {
      // 丸子后部 - 在头顶圆球的后半 + 丸子高光
      return `<g>` +
        `<circle cx="${CX}" cy="${CY - ry * 1.25}" r="${rx * 0.55}" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" />` +
        `<circle cx="${CX - rx * 0.15}" cy="${CY - ry * 1.35}" r="${rx * 0.15}" fill="rgba(255,255,255,0.2)" />` +
        `</g>`;
    }
    case 'wavy': {
      // 微卷中发后层 - 两侧卷曲
      return `<g>` +
        `<path d="M ${CX - rx - 10} ${CY - ry * 0.2}
                Q ${CX - rx - 16} ${CY + ry * 0.3} ${CX - rx - 8} ${CY + ry * 0.8}
                Q ${CX - rx - 14} ${CY + ry * 1.0} ${CX - rx - 6} ${CY + ry * 1.15}
                Q ${CX - rx + 8} ${CY + ry * 1.1} ${CX - rx + 14} ${CY + ry * 0.8}
                Q ${CX - rx + 8} ${CY + ry * 0.3} ${CX - rx + 12} ${CY - ry * 0.1} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        `<path d="M ${CX + rx + 10} ${CY - ry * 0.2}
                Q ${CX + rx + 16} ${CY + ry * 0.3} ${CX + rx + 8} ${CY + ry * 0.8}
                Q ${CX + rx + 14} ${CY + ry * 1.0} ${CX + rx + 6} ${CY + ry * 1.15}
                Q ${CX + rx - 8} ${CY + ry * 1.1} ${CX + rx - 14} ${CY + ry * 0.8}
                Q ${CX + rx - 8} ${CY + ry * 0.3} ${CX + rx - 12} ${CY - ry * 0.1} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        `</g>`;
    }
    case 'side-sweep': {
      // 斜刘海后层 - 轻薄侧发
      return `<path d="M ${CX - rx - 6} ${CY - ry * 0.15}
              Q ${CX - rx - 10} ${CY - ry * 0.6} ${CX - rx * 0.4} ${CY - ry * 1.05}
              Q ${CX} ${CY - ry * 1.15} ${CX + rx * 0.5} ${CY - ry * 1.0}
              Q ${CX + rx + 8} ${CY - ry * 0.5} ${CX + rx + 6} ${CY - ry * 0.05}
              Q ${CX + rx * 0.5} ${CY - ry * 0.45} ${CX} ${CY - ry * 0.5}
              Q ${CX - rx * 0.6} ${CY - ry * 0.4} ${CX - rx - 6} ${CY - ry * 0.15} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />`;
    }
    case 'short-messy':
    case 'buzz':
    case 'spiky':
      // 短发类无后层
      return '';
    case 'bald':
      return '';
    default:
      return '';
  }
}

// ==================== 发型前层 ====================
// 核心原则：刘海下沿不超过 CY - ry * 0.28，确保不遮挡眼睛

function renderHairFront(state) {
  const { rx, ry } = getFaceBounds(state);
  const { hairStyle, hairColor } = state;
  // 刘海最低点（眉毛以上），确保不遮挡眼睛
  const bangsBottom = CY - ry * 0.28;

  switch (hairStyle) {
    // === 寸头 ===
    case 'buzz': {
      return `<g>` +
        // 紧贴头皮的短发 - 只比头大一圈
        `<path d="M ${CX - rx - 3} ${CY - ry * 0.1}
                Q ${CX - rx - 5} ${CY - ry * 0.6} ${CX - rx * 0.4} ${CY - ry * 1.02}
                Q ${CX} ${CY - ry * 1.1} ${CX + rx * 0.4} ${CY - ry * 1.02}
                Q ${CX + rx + 5} ${CY - ry * 0.6} ${CX + rx + 3} ${CY - ry * 0.1}
                Q ${CX + rx * 0.5} ${CY - ry * 0.5} ${CX} ${CY - ry * 0.55}
                Q ${CX - rx * 0.5} ${CY - ry * 0.5} ${CX - rx - 3} ${CY - ry * 0.1} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        // 寸头纹理 - 细小的点状
        `<circle cx="${CX - rx * 0.3}" cy="${CY - ry * 0.72}" r="1.5" fill="rgba(255,255,255,0.3)" />` +
        `<circle cx="${CX + rx * 0.1}" cy="${CY - ry * 0.78}" r="1.5" fill="rgba(255,255,255,0.3)" />` +
        `<circle cx="${CX + rx * 0.35}" cy="${CY - ry * 0.68}" r="1.5" fill="rgba(255,255,255,0.3)" />` +
        `</g>`;
    }

    // === 凌乱短发 ===
    case 'short-messy': {
      return `<g>` +
        // 主体 - 蓬松的短发轮廓
        `<path d="M ${CX - rx - 8} ${CY - ry * 0.05}
                Q ${CX - rx - 12} ${CY - ry * 0.7} ${CX - rx * 0.5} ${CY - ry * 1.1}
                Q ${CX} ${CY - ry * 1.25} ${CX + rx * 0.5} ${CY - ry * 1.1}
                Q ${CX + rx + 12} ${CY - ry * 0.7} ${CX + rx + 8} ${CY - ry * 0.05}
                Q ${CX + rx * 0.5} ${CY - ry * 0.5} ${CX} ${CY - ry * 0.55}
                Q ${CX - rx * 0.5} ${CY - ry * 0.5} ${CX - rx - 8} ${CY - ry * 0.05} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        // 凌乱碎发 - 几缕翘起
        `<path d="M ${CX - rx * 0.5} ${CY - ry * 1.05}
                Q ${CX - rx * 0.65} ${CY - ry * 1.35} ${CX - rx * 0.4} ${CY - ry * 1.3}
                Q ${CX - rx * 0.3} ${CY - ry * 1.1} ${CX - rx * 0.35} ${CY - ry * 1.0}" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` +
        `<path d="M ${CX + rx * 0.1} ${CY - ry * 1.15}
                Q ${CX + rx * 0.2} ${CY - ry * 1.45} ${CX + rx * 0.35} ${CY - ry * 1.35}
                Q ${CX + rx * 0.25} ${CY - ry * 1.15} ${CX + rx * 0.2} ${CY - ry * 1.05}" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` +
        `<path d="M ${CX + rx * 0.45} ${CY - ry * 0.95}
                Q ${CX + rx * 0.7} ${CY - ry * 1.25} ${CX + rx * 0.65} ${CY - ry * 1.1}
                Q ${CX + rx * 0.55} ${CY - ry * 0.95} ${CX + rx * 0.5} ${CY - ry * 0.85}" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` +
        // 轻薄碎刘海
        `<path d="M ${CX - rx * 0.6} ${CY - ry * 0.6}
                Q ${CX - rx * 0.45} ${CY - ry * 0.35} ${CX - rx * 0.2} ${bangsBottom + 2}
                Q ${CX - rx * 0.05} ${CY - ry * 0.4} ${CX + rx * 0.15} ${CY - ry * 0.35}
                Q ${CX + rx * 0.05} ${CY - ry * 0.6} ${CX - rx * 0.35} ${CY - ry * 0.65}
                Z" fill="${hairColor}" stroke="#4A3728" stroke-width="1.5" stroke-linejoin="round" />` +
        `</g>`;
    }

    // === 斜刘海 ===
    case 'side-sweep': {
      return `<g>` +
        // 头顶轮廓
        `<path d="M ${CX - rx - 6} ${CY - ry * 0.1}
                Q ${CX - rx - 10} ${CY - ry * 0.65} ${CX - rx * 0.4} ${CY - ry * 1.05}
                Q ${CX} ${CY - ry * 1.18} ${CX + rx * 0.5} ${CY - ry * 1.05}
                Q ${CX + rx + 8} ${CY - ry * 0.55} ${CX + rx + 6} ${CY - ry * 0.05}
                Q ${CX + rx * 0.5} ${CY - ry * 0.48} ${CX} ${CY - ry * 0.52}
                Q ${CX - rx * 0.5} ${CY - ry * 0.45} ${CX - rx - 6} ${CY - ry * 0.1} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        // 斜刘海 - 从右往左扫
        `<path d="M ${CX + rx * 0.7} ${CY - ry * 0.55}
                Q ${CX + rx * 0.5} ${CY - ry * 0.32} ${CX + rx * 0.2} ${bangsBottom}
                Q ${CX} ${CY - ry * 0.3} ${CX - rx * 0.3} ${bangsBottom - 2}
                Q ${CX - rx * 0.5} ${CY - ry * 0.38} ${CX - rx * 0.65} ${CY - ry * 0.35}
                Q ${CX - rx * 0.3} ${CY - ry * 0.6} ${CX + rx * 0.4} ${CY - ry * 0.6}
                Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2" stroke-linejoin="round" />` +
        // 侧发尾翘
        `<path d="M ${CX + rx + 4} ${CY - ry * 0.45}
                Q ${CX + rx + 12} ${CY - ry * 0.35} ${CX + rx + 10} ${CY - ry * 0.15}
                Q ${CX + rx + 8} ${CY - ry * 0.25} ${CX + rx + 5} ${CY - ry * 0.3}" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />` +
        `</g>`;
    }

    // === 刺猬头 ===
    case 'spiky': {
      const spikes = [
        { x: -rx * 0.65, y: -ry * 1.15, tipX: -rx * 0.75, tipY: -ry * 1.75 },
        { x: -rx * 0.3, y: -ry * 1.1, tipX: -rx * 0.35, tipY: -ry * 2.0 },
        { x: rx * 0.05, y: -ry * 1.05, tipX: rx * 0.0, tipY: -ry * 2.15 },
        { x: rx * 0.35, y: -ry * 1.1, tipX: rx * 0.45, tipY: -ry * 1.85 },
        { x: rx * 0.65, y: -ry * 1.15, tipX: rx * 0.8, tipY: -ry * 1.6 },
      ];
      // 刺 - 圆头端点让它不那么锐利
      const spikesSvg = spikes.map((sp) => {
        return `<path d="M ${CX + sp.x - rx * 0.12} ${CY + sp.y + ry * 0.1}
                  Q ${CX + sp.tipX - rx * 0.02} ${CY + sp.tipY + ry * 0.02} ${CX + sp.tipX} ${CY + sp.tipY}
                  Q ${CX + sp.tipX + rx * 0.02} ${CY + sp.tipY + ry * 0.02} ${CX + sp.x + rx * 0.12} ${CY + sp.y + ry * 0.1} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />`;
      }).join('');

      return `<g>` +
        // 头顶底色
        `<path d="M ${CX - rx - 6} ${CY - ry * 0.15}
                Q ${CX - rx} ${CY - ry * 0.75} ${CX} ${CY - ry * 1.05}
                Q ${CX + rx} ${CY - ry * 0.75} ${CX + rx + 6} ${CY - ry * 0.15}
                Q ${CX + rx * 0.5} ${CY - ry * 0.5} ${CX} ${CY - ry * 0.52}
                Q ${CX - rx * 0.5} ${CY - ry * 0.5} ${CX - rx - 6} ${CY - ry * 0.15} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        spikesSvg +
        // 短刘海
        `<path d="M ${CX - rx * 0.6} ${CY - ry * 0.55}
                Q ${CX - rx * 0.4} ${CY - ry * 0.35} ${CX - rx * 0.15} ${bangsBottom + 3}
                Q ${CX + rx * 0.1} ${CY - ry * 0.38} ${CX + rx * 0.25} ${CY - ry * 0.33}
                Q ${CX + rx * 0.1} ${CY - ry * 0.55} ${CX - rx * 0.3} ${CY - ry * 0.6}
                Z" fill="${hairColor}" stroke="#4A3728" stroke-width="1.5" stroke-linejoin="round" />` +
        `</g>`;
    }

    // === 微卷中发 ===
    case 'wavy': {
      return `<g>` +
        // 头顶 + 侧发
        `<path d="M ${CX - rx - 10} ${CY + ry * 0.15}
                Q ${CX - rx - 14} ${CY - ry * 0.5} ${CX - rx * 0.5} ${CY - ry * 1.08}
                Q ${CX} ${CY - ry * 1.22} ${CX + rx * 0.5} ${CY - ry * 1.08}
                Q ${CX + rx + 14} ${CY - ry * 0.5} ${CX + rx + 10} ${CY + ry * 0.15}
                Q ${CX + rx * 0.7} ${CY - ry * 0.4} ${CX + rx * 0.3} ${CY - ry * 0.38}
                Q ${CX} ${CY - ry * 0.5} ${CX - rx * 0.3} ${CY - ry * 0.38}
                Q ${CX - rx * 0.7} ${CY - ry * 0.4} ${CX - rx - 10} ${CY + ry * 0.15} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        // 微卷刘海 - 带波浪弧度
        `<path d="M ${CX - rx * 0.75} ${CY - ry * 0.52}
                Q ${CX - rx * 0.55} ${CY - ry * 0.28} ${CX - rx * 0.3} ${bangsBottom}
                Q ${CX - rx * 0.15} ${CY - ry * 0.35} ${CX + rx * 0.05} ${bangsBottom + 2}
                Q ${CX + rx * 0.2} ${CY - ry * 0.32} ${CX + rx * 0.35} ${CY - ry * 0.35}
                Q ${CX + rx * 0.2} ${CY - ry * 0.55} ${CX - rx * 0.4} ${CY - ry * 0.6}
                Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2" stroke-linejoin="round" />` +
        // 侧发卷曲装饰
        `<path d="M ${CX - rx - 8} ${CY - ry * 0.1}
                Q ${CX - rx - 14} ${CY + ry * 0.1} ${CX - rx - 10} ${CY + ry * 0.3}
                Q ${CX - rx - 6} ${CY + ry * 0.15} ${CX - rx - 5} ${CY - ry * 0.05}" fill="none" stroke="${hairColor}" stroke-width="3" stroke-linecap="round" />` +
        `<path d="M ${CX + rx + 8} ${CY - ry * 0.1}
                Q ${CX + rx + 14} ${CY + ry * 0.1} ${CX + rx + 10} ${CY + ry * 0.3}
                Q ${CX + rx + 6} ${CY + ry * 0.15} ${CX + rx + 5} ${CY - ry * 0.05}" fill="none" stroke="${hairColor}" stroke-width="3" stroke-linecap="round" />` +
        `</g>`;
    }

    // === 长直发 ===
    case 'long-straight': {
      return `<g>` +
        // 头顶 + 侧发
        `<path d="M ${CX - rx - 10} ${CY + ry * 0.25}
                Q ${CX - rx - 14} ${CY - ry * 0.5} ${CX - rx * 0.5} ${CY - ry * 1.08}
                Q ${CX} ${CY - ry * 1.22} ${CX + rx * 0.5} ${CY - ry * 1.08}
                Q ${CX + rx + 14} ${CY - ry * 0.5} ${CX + rx + 10} ${CY + ry * 0.25}
                Q ${CX + rx * 0.7} ${CY - ry * 0.38} ${CX} ${CY - ry * 0.5}
                Q ${CX - rx * 0.7} ${CY - ry * 0.38} ${CX - rx - 10} ${CY + ry * 0.25} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        // 顺滑刘海
        `<path d="M ${CX - rx * 0.75} ${CY - ry * 0.52}
                Q ${CX - rx * 0.55} ${CY - ry * 0.28} ${CX - rx * 0.3} ${bangsBottom}
                Q ${CX - rx * 0.08} ${CY - ry * 0.33} ${CX + rx * 0.1} ${bangsBottom + 2}
                Q ${CX + rx * 0.28} ${CY - ry * 0.3} ${CX + rx * 0.42} ${CY - ry * 0.33}
                Q ${CX + rx * 0.35} ${CY - ry * 0.55} ${CX} ${CY - ry * 0.62}
                Q ${CX - rx * 0.45} ${CY - ry * 0.6} ${CX - rx * 0.75} ${CY - ry * 0.52} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2" stroke-linejoin="round" />` +
        // 发丝光泽
        `<line x1="${CX - rx * 0.15}" y1="${CY - ry * 0.65}" x2="${CX - rx * 0.1}" y2="${CY - ry * 0.45}" stroke="rgba(255,255,255,0.25)" stroke-width="2" stroke-linecap="round" />` +
        `</g>`;
    }

    // === 长波浪 ===
    case 'long-wavy': {
      return `<g>` +
        // 头顶 + 侧发 - 更蓬松
        `<path d="M ${CX - rx - 12} ${CY + ry * 0.3}
                Q ${CX - rx - 18} ${CY - ry * 0.45} ${CX - rx * 0.5} ${CY - ry * 1.1}
                Q ${CX} ${CY - ry * 1.25} ${CX + rx * 0.5} ${CY - ry * 1.1}
                Q ${CX + rx + 18} ${CY - ry * 0.45} ${CX + rx + 12} ${CY + ry * 0.3}
                Q ${CX + rx * 0.7} ${CY - ry * 0.35} ${CX} ${CY - ry * 0.5}
                Q ${CX - rx * 0.7} ${CY - ry * 0.35} ${CX - rx - 12} ${CY + ry * 0.3} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        // 波浪刘海
        `<path d="M ${CX - rx * 0.75} ${CY - ry * 0.5}
                Q ${CX - rx * 0.55} ${CY - ry * 0.28} ${CX - rx * 0.3} ${bangsBottom}
                Q ${CX - rx * 0.1} ${CY - ry * 0.35} ${CX + rx * 0.08} ${bangsBottom + 2}
                Q ${CX + rx * 0.25} ${CY - ry * 0.3} ${CX + rx * 0.4} ${CY - ry * 0.35}
                Q ${CX + rx * 0.3} ${CY - ry * 0.55} ${CX} ${CY - ry * 0.62}
                Q ${CX - rx * 0.45} ${CY - ry * 0.58} ${CX - rx * 0.75} ${CY - ry * 0.5} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2" stroke-linejoin="round" />` +
        `</g>`;
    }

    // === 双马尾 ===
    case 'pigtails': {
      return `<g>` +
        // 头顶
        `<path d="M ${CX - rx - 6} ${CY - ry * 0.2}
                Q ${CX - rx - 10} ${CY - ry * 0.7} ${CX - rx * 0.4} ${CY - ry * 1.08}
                Q ${CX} ${CY - ry * 1.2} ${CX + rx * 0.4} ${CY - ry * 1.08}
                Q ${CX + rx + 10} ${CY - ry * 0.7} ${CX + rx + 6} ${CY - ry * 0.2}
                Q ${CX + rx * 0.5} ${CY - ry * 0.52} ${CX} ${CY - ry * 0.58}
                Q ${CX - rx * 0.5} ${CY - ry * 0.52} ${CX - rx - 6} ${CY - ry * 0.2} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        // 中分刘海（左）
        `<path d="M ${CX} ${CY - ry * 0.68}
                Q ${CX - rx * 0.25} ${CY - ry * 0.42} ${CX - rx * 0.5} ${bangsBottom + 2}
                Q ${CX - rx * 0.35} ${CY - ry * 0.5} ${CX} ${CY - ry * 0.68} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="1.5" stroke-linejoin="round" />` +
        // 中分刘海（右）
        `<path d="M ${CX} ${CY - ry * 0.68}
                Q ${CX + rx * 0.25} ${CY - ry * 0.42} ${CX + rx * 0.5} ${bangsBottom + 2}
                Q ${CX + rx * 0.35} ${CY - ry * 0.5} ${CX} ${CY - ry * 0.68} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="1.5" stroke-linejoin="round" />` +
        `</g>`;
    }

    // === 单马尾 ===
    case 'ponytail': {
      return `<g>` +
        // 头顶
        `<path d="M ${CX - rx - 6} ${CY - ry * 0.08}
                Q ${CX - rx - 10} ${CY - ry * 0.65} ${CX - rx * 0.4} ${CY - ry * 1.08}
                Q ${CX} ${CY - ry * 1.2} ${CX + rx * 0.5} ${CY - ry * 1.0}
                Q ${CX + rx + 8} ${CY - ry * 0.5} ${CX + rx + 5} ${CY - ry * 0.05}
                Q ${CX + rx * 0.5} ${CY - ry * 0.45} ${CX} ${CY - ry * 0.5}
                Q ${CX - rx * 0.5} ${CY - ry * 0.42} ${CX - rx - 6} ${CY - ry * 0.08} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        // 偏分刘海
        `<path d="M ${CX - rx * 0.65} ${CY - ry * 0.52}
                Q ${CX - rx * 0.45} ${CY - ry * 0.3} ${CX - rx * 0.2} ${bangsBottom}
                Q ${CX - rx * 0.02} ${CY - ry * 0.33} ${CX + rx * 0.12} ${bangsBottom + 2}
                Q ${CX + rx * 0.25} ${CY - ry * 0.35} ${CX + rx * 0.35} ${CY - ry * 0.32}
                Q ${CX + rx * 0.2} ${CY - ry * 0.55} ${CX} ${CY - ry * 0.6}
                Q ${CX - rx * 0.4} ${CY - ry * 0.58} ${CX - rx * 0.65} ${CY - ry * 0.52} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2" stroke-linejoin="round" />` +
        `</g>`;
    }

    // === 丸子头 ===
    case 'bun': {
      return `<g>` +
        // 头顶底色
        `<path d="M ${CX - rx - 6} ${CY - ry * 0.08}
                Q ${CX - rx - 8} ${CY - ry * 0.65} ${CX - rx * 0.4} ${CY - ry * 1.05}
                Q ${CX} ${CY - ry * 1.15} ${CX + rx * 0.4} ${CY - ry * 1.05}
                Q ${CX + rx + 8} ${CY - ry * 0.65} ${CX + rx + 6} ${CY - ry * 0.08}
                Q ${CX + rx * 0.5} ${CY - ry * 0.48} ${CX} ${CY - ry * 0.52}
                Q ${CX - rx * 0.5} ${CY - ry * 0.48} ${CX - rx - 6} ${CY - ry * 0.08} Z" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
        // 丸子前部 - 头顶的圆球
        `<circle cx="${CX}" cy="${CY - ry * 1.2}" r="${rx * 0.45}" fill="${hairColor}" stroke="#4A3728" stroke-width="2.5" />` +
        // 丸子高光
        `<circle cx="${CX - rx * 0.12}" cy="${CY - ry * 1.3}" r="${rx * 0.12}" fill="rgba(255,255,255,0.25)" />` +
        // 短刘海
        `<path d="M ${CX - rx * 0.65} ${CY - ry * 0.5}
                Q ${CX - rx * 0.45} ${CY - ry * 0.3} ${CX - rx * 0.2} ${bangsBottom + 2}
                Q ${CX} ${CY - ry * 0.35} ${CX + rx * 0.15} ${CY - ry * 0.32}
                Q ${CX + rx * 0.05} ${CY - ry * 0.5} ${CX - rx * 0.3} ${CY - ry * 0.55}
                Z" fill="${hairColor}" stroke="#4A3728" stroke-width="1.5" stroke-linejoin="round" />` +
        // 发圈
        `<ellipse cx="${CX}" cy="${CY - ry * 0.95}" rx="${rx * 0.18}" ry="5" fill="#FF6B9D" stroke="#E5568A" stroke-width="1.5" />` +
        `</g>`;
    }

    // === 光头 ===
    case 'bald':
      return '';

    default:
      return '';
  }
}

// ==================== 眼镜 ====================

function renderGlasses(state) {
  if (state.glasses === 'none') return '';
  const { leftX, rightX, y, width, height } = getEyePositions(state);
  const { rx } = getFaceBounds(state);
  const { glasses, glassesColor } = state;
  const lensR = Math.min(width, height) + 5;
  const legLen = rx * 0.2; // 眼镜腿长度随脸宽缩放

  switch (glasses) {
    case 'round':
      return `<g>` +
        `<circle cx="${leftX}" cy="${y}" r="${lensR}" fill="none" stroke="${glassesColor}" stroke-width="3" />` +
        `<circle cx="${rightX}" cy="${y}" r="${lensR}" fill="none" stroke="${glassesColor}" stroke-width="3" />` +
        `<path d="M ${leftX + lensR} ${y} Q ${CX} ${y - 5} ${rightX - lensR} ${y}" fill="none" stroke="${glassesColor}" stroke-width="2.5" />` +
        `<line x1="${leftX - lensR}" y1="${y}" x2="${leftX - lensR - legLen}" y2="${y - 3}" stroke="${glassesColor}" stroke-width="2.5" stroke-linecap="round" />` +
        `<line x1="${rightX + lensR}" y1="${y}" x2="${rightX + lensR + legLen}" y2="${y - 3}" stroke="${glassesColor}" stroke-width="2.5" stroke-linecap="round" />` +
        `</g>`;
    case 'square':
      return `<g>` +
        `<rect x="${leftX - lensR}" y="${y - lensR * 0.7}" width="${lensR * 2}" height="${lensR * 1.4}" rx="5" fill="none" stroke="${glassesColor}" stroke-width="3" />` +
        `<rect x="${rightX - lensR}" y="${y - lensR * 0.7}" width="${lensR * 2}" height="${lensR * 1.4}" rx="5" fill="none" stroke="${glassesColor}" stroke-width="3" />` +
        `<path d="M ${leftX + lensR} ${y} Q ${CX} ${y - 5} ${rightX - lensR} ${y}" fill="none" stroke="${glassesColor}" stroke-width="2.5" />` +
        `<line x1="${leftX - lensR}" y1="${y}" x2="${leftX - lensR - legLen}" y2="${y - 3}" stroke="${glassesColor}" stroke-width="2.5" stroke-linecap="round" />` +
        `<line x1="${rightX + lensR}" y1="${y}" x2="${rightX + lensR + legLen}" y2="${y - 3}" stroke="${glassesColor}" stroke-width="2.5" stroke-linecap="round" />` +
        `</g>`;
    case 'sunglasses':
      return `<g>` +
        `<ellipse cx="${leftX}" cy="${y}" rx="${lensR * 1.1}" ry="${lensR * 0.8}" fill="rgba(30,30,60,0.7)" stroke="${glassesColor}" stroke-width="3" />` +
        `<ellipse cx="${rightX}" cy="${y}" rx="${lensR * 1.1}" ry="${lensR * 0.8}" fill="rgba(30,30,60,0.7)" stroke="${glassesColor}" stroke-width="3" />` +
        `<ellipse cx="${leftX - lensR * 0.3}" cy="${y - lensR * 0.2}" rx="${lensR * 0.25}" ry="${lensR * 0.15}" fill="rgba(255,255,255,0.3)" />` +
        `<ellipse cx="${rightX - lensR * 0.3}" cy="${y - lensR * 0.2}" rx="${lensR * 0.25}" ry="${lensR * 0.15}" fill="rgba(255,255,255,0.3)" />` +
        `<path d="M ${leftX + lensR * 1.1} ${y} Q ${CX} ${y - 5} ${rightX - lensR * 1.1} ${y}" fill="none" stroke="${glassesColor}" stroke-width="3" />` +
        `<line x1="${leftX - lensR * 1.1}" y1="${y}" x2="${leftX - lensR * 1.1 - legLen}" y2="${y - 3}" stroke="${glassesColor}" stroke-width="2.5" stroke-linecap="round" />` +
        `<line x1="${rightX + lensR * 1.1}" y1="${y}" x2="${rightX + lensR * 1.1 + legLen}" y2="${y - 3}" stroke="${glassesColor}" stroke-width="2.5" stroke-linecap="round" />` +
        `</g>`;
    default:
      return '';
  }
}

// ==================== 身体 ====================

function renderBody(state) {
  const { ry } = getFaceBounds(state);
  const bodyTop = CY + ry - 5;
  const clothColor = state.clothingColor;

  return `<g>` +
    // 脖子
    `<rect x="${CX - 13}" y="${bodyTop - 5}" width="26" height="20" rx="8" fill="${state.skinColor}" />` +
    // 身体/衣服 - Q版圆润短粗
    `<path d="M ${CX - 50} ${bodyTop + 18}
            Q ${CX - 55} ${bodyTop + 12} ${CX - 22} ${bodyTop + 6}
            Q ${CX} ${bodyTop + 3} ${CX + 22} ${bodyTop + 6}
            Q ${CX + 55} ${bodyTop + 12} ${CX + 50} ${bodyTop + 18}
            Q ${CX + 52} ${bodyTop + 50} ${CX + 48} ${bodyTop + 72}
            L ${CX - 48} ${bodyTop + 72}
            Q ${CX - 52} ${bodyTop + 50} ${CX - 50} ${bodyTop + 18} Z" fill="${clothColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
    // 左手臂 - 短粗Q版
    `<path d="M ${CX - 50} ${bodyTop + 20}
            Q ${CX - 66} ${bodyTop + 22} ${CX - 62} ${bodyTop + 42}
            Q ${CX - 60} ${bodyTop + 55} ${CX - 52} ${bodyTop + 58}
            Q ${CX - 44} ${bodyTop + 55} ${CX - 46} ${bodyTop + 40}
            Q ${CX - 44} ${bodyTop + 28} ${CX - 44} ${bodyTop + 20} Z" fill="${clothColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
    // 左手 - 小圆手
    `<circle cx="${CX - 55}" cy="${bodyTop + 60}" r="8" fill="${state.skinColor}" stroke="#4A3728" stroke-width="2" />` +
    // 右手臂
    `<path d="M ${CX + 50} ${bodyTop + 20}
            Q ${CX + 66} ${bodyTop + 22} ${CX + 62} ${bodyTop + 42}
            Q ${CX + 60} ${bodyTop + 55} ${CX + 52} ${bodyTop + 58}
            Q ${CX + 44} ${bodyTop + 55} ${CX + 46} ${bodyTop + 40}
            Q ${CX + 44} ${bodyTop + 28} ${CX + 44} ${bodyTop + 20} Z" fill="${clothColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
    // 右手
    `<circle cx="${CX + 55}" cy="${bodyTop + 60}" r="8" fill="${state.skinColor}" stroke="#4A3728" stroke-width="2" />` +
    // 领口
    `<path d="M ${CX - 14} ${bodyTop + 6} Q ${CX} ${bodyTop + 18} ${CX + 14} ${bodyTop + 6}" fill="none" stroke="#4A3728" stroke-width="2" stroke-linecap="round" />` +
    // 左腿 - 短粗Q版
    `<path d="M ${CX - 35} ${bodyTop + 72}
            Q ${CX - 38} ${bodyTop + 85} ${CX - 35} ${bodyTop + 105}
            Q ${CX - 30} ${bodyTop + 115} ${CX - 18} ${bodyTop + 115}
            Q ${CX - 12} ${bodyTop + 115} ${CX - 12} ${bodyTop + 105}
            Q ${CX - 15} ${bodyTop + 85} ${CX - 15} ${bodyTop + 72} Z" fill="${state.skinColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
    // 右腿
    `<path d="M ${CX + 35} ${bodyTop + 72}
            Q ${CX + 38} ${bodyTop + 85} ${CX + 35} ${bodyTop + 105}
            Q ${CX + 30} ${bodyTop + 115} ${CX + 18} ${bodyTop + 115}
            Q ${CX + 12} ${bodyTop + 115} ${CX + 12} ${bodyTop + 105}
            Q ${CX + 15} ${bodyTop + 85} ${CX + 15} ${bodyTop + 72} Z" fill="${state.skinColor}" stroke="#4A3728" stroke-width="2.5" stroke-linejoin="round" />` +
    // 左鞋
    `<ellipse cx="${CX - 24}" cy="${bodyTop + 120}" rx="18" ry="10" fill="#4A3728" stroke="#3A2718" stroke-width="2" />` +
    `<ellipse cx="${CX - 24}" cy="${bodyTop + 117}" rx="16" ry="6" fill="#5C4033" />` +
    // 右鞋
    `<ellipse cx="${CX + 24}" cy="${bodyTop + 120}" rx="18" ry="10" fill="#4A3728" stroke="#3A2718" stroke-width="2" />` +
    `<ellipse cx="${CX + 24}" cy="${bodyTop + 117}" rx="16" ry="6" fill="#5C4033" />` +
    `</g>`;
}

// ==================== 展台 ====================

function renderStage() {
  return `<g>` +
    `<ellipse cx="${CX}" cy="410" rx="90" ry="14" fill="#F5E6D3" stroke="#E8D5C0" stroke-width="2" />` +
    `<ellipse cx="${CX}" cy="407" rx="85" ry="11" fill="#FBF0E4" stroke="#F5E6D3" stroke-width="1.5" />` +
    `</g>`;
}

// ==================== 主渲染入口 ====================

/**
 * 渲染 SVG 内部元素字符串（不含外层 <svg> 标签），方便嵌入其他 SVG。
 *
 * 渲染层级（从底到顶）：
 *   展台 → 身体 → 发型后层 → 耳朵 → 脸型 → 腮红 → 眼睛 → 眉毛 → 鼻子 → 嘴巴 → 发型前层 → 眼镜
 *
 * @param {CharacterState} state 角色状态
 * @returns {string} SVG 内部元素字符串
 */
export function renderAvatarSVGInner(state) {
  return [
    renderBody(state),
    renderHairBack(state),
    renderEars(state),
    renderFace(state),
    renderBlush(state),
    renderEyes(state),
    renderEyebrows(state),
    renderNose(state),
    renderMouth(state),
    renderHairFront(state),
    renderGlasses(state),
  ].join('');
}

/**
 * 渲染完整的 SVG 字符串（包含外层 <svg> 标签）。
 *
 * @param {CharacterState} state 角色状态
 * @returns {string} 完整的 <svg>...</svg> 字符串，viewBox="0 0 300 380"
 */
export function renderAvatarSVG(state) {
  return `<svg id="avatar-svg" viewBox="0 0 300 380" xmlns="http://www.w3.org/2000/svg">${renderAvatarSVGInner(state)}</svg>`;
}

export default renderAvatarSVG;
