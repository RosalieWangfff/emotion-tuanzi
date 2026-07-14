// 角色捏脸系统 - 类型定义与默认值

export type FaceShape = 'round' | 'oval' | 'heart';
export type EyeStyle = 'round' | 'cute' | 'oval' | 'sharp';
export type EyebrowStyle = 'natural' | 'arched' | 'straight' | 'angry';
export type NoseStyle = 'dot' | 'small' | 'round' | 'pointed';
export type MouthStyle = 'smile' | 'grin' | 'neutral' | 'open' | 'cat';
export type HairStyle = 'buzz' | 'short-messy' | 'side-sweep' | 'spiky' | 'wavy' | 'long-straight' | 'long-wavy' | 'pigtails' | 'ponytail' | 'bun' | 'bald';
export type GlassesStyle = 'none' | 'round' | 'square' | 'sunglasses';

export interface CharacterState {
  // 脸型
  faceShape: FaceShape;
  faceWidth: number; // 0-100
  faceHeight: number; // 0-100
  skinColor: string;

  // 眼睛
  eyeStyle: EyeStyle;
  eyeWidth: number; // 0-100 眼睛宽度
  eyeHeight: number; // 0-100 眼睛高度（纵向大小）
  eyeSpacing: number; // 0-100 两眼间距
  eyeVerticalPos: number; // 0-100 眼睛垂直位置（高/低）
  eyeColor: string;
  eyeTilt: number; // -30 to 30

  // 眉毛
  eyebrowStyle: EyebrowStyle;
  eyebrowThickness: number; // 0-100 粗细
  eyebrowHeight: number; // 0-100 眉毛垂直位置（离眼的距离）
  eyebrowLength: number; // 0-100 眉毛长度
  eyebrowColor: string;

  // 鼻子
  noseStyle: NoseStyle;
  noseWidth: number; // 0-100 鼻子宽度
  noseHeight: number; // 0-100 鼻子高度（垂直位置）

  // 嘴巴
  mouthStyle: MouthStyle;
  mouthWidth: number; // 0-100
  mouthHeight: number; // 0-100 嘴巴垂直位置

  // 发型
  hairStyle: HairStyle;
  hairColor: string;

  // 服装
  clothingColor: string;

  // 腮红
  hasBlush: boolean;
  blushIntensity: number; // 0-100
  blushColor: string;

  // 眼镜
  glasses: GlassesStyle;
  glassesColor: string;
}

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

export const DEFAULT_CHARACTER: CharacterState = {
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

export type FeatureCategory = 'face' | 'eyes' | 'eyebrows' | 'nose' | 'mouth' | 'hair' | 'clothing' | 'blush' | 'glasses';

export const CATEGORY_LABELS: Record<FeatureCategory, string> = {
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
