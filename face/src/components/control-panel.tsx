'use client';

import React from 'react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import type {
  CharacterState,
  FeatureCategory,
  FaceShape,
  EyeStyle,
  EyebrowStyle,
  NoseStyle,
  MouthStyle,
  HairStyle,
  GlassesStyle,
} from '@/lib/character-types';
import {
  CATEGORY_LABELS,
  SKIN_COLORS,
  EYE_COLORS,
  HAIR_COLORS,
  CLOTHING_COLORS,
  BLUSH_COLORS,
  GLASSES_COLORS,
} from '@/lib/character-types';

// ---- 通用子组件 ----

interface StyleOptionProps<T extends string> {
  options: ReadonlyArray<{ value: T; label: string; icon: string }>;
  current: T;
  onChange: (value: T) => void;
}

function StyleSelector<T extends string>({ options, current, onChange }: StyleOptionProps<T>) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex flex-col items-center gap-1 rounded-xl p-2 text-xs transition-all duration-200 ${
            current === opt.value
              ? 'bg-[#FF6B9D] text-white shadow-md scale-105'
              : 'bg-[#FFF0E8] text-[#4A3728] hover:bg-[#FFE0D0] hover:scale-102'
          }`}
        >
          <span className="text-lg">{opt.icon}</span>
          <span className="font-medium leading-tight">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

interface SliderControlProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

function SliderControl({ label, value, min = 0, max = 100, step = 1, onChange }: SliderControlProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 shrink-0 text-xs font-medium text-[#4A3728]">{label}</span>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={([v]) => onChange(v)}
        className="flex-1"
      />
      <span className="w-8 text-right text-xs text-[#8B7355]">{value}</span>
    </div>
  );
}

interface ColorPickerProps {
  label: string;
  colors: readonly string[];
  current: string;
  onChange: (color: string) => void;
}

function ColorPicker({ label, colors, current, onChange }: ColorPickerProps) {
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-[#4A3728]">{label}</span>
      <div className="flex flex-wrap gap-2">
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => onChange(color)}
            className={`w-7 h-7 rounded-full border-2 transition-all duration-200 ${
              current === color
                ? 'border-[#FF6B9D] scale-125 shadow-md'
                : 'border-[#E8D5C0] hover:scale-110 hover:border-[#D4A373]'
            }`}
            style={{ backgroundColor: color }}
          />
        ))}
      </div>
    </div>
  );
}

// ---- 样式选项定义 ----

const FACE_SHAPES: ReadonlyArray<{ value: FaceShape; label: string; icon: string }> = [
  { value: 'round', label: '圆脸', icon: '🔴' },
  { value: 'oval', label: '鹅蛋脸', icon: '🥚' },
  { value: 'heart', label: '心形脸', icon: '💜' },
];

const EYE_STYLES: ReadonlyArray<{ value: EyeStyle; label: string; icon: string }> = [
  { value: 'round', label: '圆眼', icon: '👁️' },
  { value: 'cute', label: '萌眼', icon: '✨' },
  { value: 'oval', label: '杏眼', icon: '🫒' },
  { value: 'sharp', label: '凤眼', icon: '🦅' },
];

const EYEBROW_STYLES: ReadonlyArray<{ value: EyebrowStyle; label: string; icon: string }> = [
  { value: 'natural', label: '自然', icon: '〰️' },
  { value: 'arched', label: '拱形', icon: '⌒' },
  { value: 'straight', label: '一字眉', icon: '➖' },
  { value: 'angry', label: '八字眉', icon: '😠' },
];

const NOSE_STYLES: ReadonlyArray<{ value: NoseStyle; label: string; icon: string }> = [
  { value: 'dot', label: '豆鼻', icon: '•' },
  { value: 'small', label: '三角鼻', icon: '△' },
  { value: 'round', label: '圆鼻', icon: '⚪' },
  { value: 'pointed', label: '尖鼻', icon: '▼' },
];

const MOUTH_STYLES: ReadonlyArray<{ value: MouthStyle; label: string; icon: string }> = [
  { value: 'smile', label: '微笑', icon: '😊' },
  { value: 'grin', label: '大笑', icon: '😄' },
  { value: 'neutral', label: '平静', icon: '😐' },
  { value: 'open', label: '张嘴', icon: '😮' },
  { value: 'cat', label: '猫嘴', icon: '😺' },
];

const HAIR_STYLES: ReadonlyArray<{ value: HairStyle; label: string; icon: string }> = [
  { value: 'buzz', label: '寸头', icon: '💇‍♂️' },
  { value: 'short-messy', label: '凌乱短发', icon: '💨' },
  { value: 'side-sweep', label: '斜刘海', icon: '🌊' },
  { value: 'spiky', label: '刺猬头', icon: '🦔' },
  { value: 'wavy', label: '微卷中发', icon: '🌀' },
  { value: 'long-straight', label: '长直发', icon: '👩' },
  { value: 'long-wavy', label: '长波浪', icon: '🌊' },
  { value: 'pigtails', label: '双马尾', icon: '🎀' },
  { value: 'ponytail', label: '单马尾', icon: '🏇' },
  { value: 'bun', label: '丸子头', icon: '🍡' },
  { value: 'bald', label: '光头', icon: '👨‍🦲' },
];

const GLASSES_STYLES: ReadonlyArray<{ value: GlassesStyle; label: string; icon: string }> = [
  { value: 'none', label: '无', icon: '❌' },
  { value: 'round', label: '圆框', icon: '🤓' },
  { value: 'square', label: '方框', icon: '🧐' },
  { value: 'sunglasses', label: '墨镜', icon: '😎' },
];

// ---- 分类面板内容 ----

interface CategoryPanelProps {
  category: FeatureCategory;
  state: CharacterState;
  onChange: (partial: Partial<CharacterState>) => void;
}

function CategoryPanel({ category, state, onChange }: CategoryPanelProps) {
  switch (category) {
    case 'face':
      return (
        <div className="space-y-4">
          <StyleSelector
            options={FACE_SHAPES}
            current={state.faceShape}
            onChange={(v) => onChange({ faceShape: v })}
          />
          <SliderControl
            label="脸宽"
            value={state.faceWidth}
            onChange={(v) => onChange({ faceWidth: v })}
          />
          <SliderControl
            label="脸长"
            value={state.faceHeight}
            onChange={(v) => onChange({ faceHeight: v })}
          />
          <ColorPicker
            label="肤色"
            colors={SKIN_COLORS}
            current={state.skinColor}
            onChange={(v) => onChange({ skinColor: v })}
          />
        </div>
      );

    case 'eyes':
      return (
        <div className="space-y-4">
          <StyleSelector
            options={EYE_STYLES}
            current={state.eyeStyle}
            onChange={(v) => onChange({ eyeStyle: v })}
          />
          <SliderControl
            label="宽度"
            value={state.eyeWidth}
            onChange={(v) => onChange({ eyeWidth: v })}
          />
          <SliderControl
            label="高度"
            value={state.eyeHeight}
            onChange={(v) => onChange({ eyeHeight: v })}
          />
          <SliderControl
            label="间距"
            value={state.eyeSpacing}
            onChange={(v) => onChange({ eyeSpacing: v })}
          />
          <SliderControl
            label="位置"
            value={state.eyeVerticalPos}
            onChange={(v) => onChange({ eyeVerticalPos: v })}
          />
          <SliderControl
            label="倾斜"
            value={state.eyeTilt}
            min={-30}
            max={30}
            onChange={(v) => onChange({ eyeTilt: v })}
          />
          <ColorPicker
            label="瞳色"
            colors={EYE_COLORS}
            current={state.eyeColor}
            onChange={(v) => onChange({ eyeColor: v })}
          />
        </div>
      );

    case 'eyebrows':
      return (
        <div className="space-y-4">
          <StyleSelector
            options={EYEBROW_STYLES}
            current={state.eyebrowStyle}
            onChange={(v) => onChange({ eyebrowStyle: v })}
          />
          <SliderControl
            label="粗细"
            value={state.eyebrowThickness}
            onChange={(v) => onChange({ eyebrowThickness: v })}
          />
          <SliderControl
            label="高度"
            value={state.eyebrowHeight}
            onChange={(v) => onChange({ eyebrowHeight: v })}
          />
          <SliderControl
            label="长度"
            value={state.eyebrowLength}
            onChange={(v) => onChange({ eyebrowLength: v })}
          />
          <ColorPicker
            label="眉色"
            colors={[...HAIR_COLORS.slice(0, 6), '#8B7355', '#C0C0C0']}
            current={state.eyebrowColor}
            onChange={(v) => onChange({ eyebrowColor: v })}
          />
        </div>
      );

    case 'nose':
      return (
        <div className="space-y-4">
          <StyleSelector
            options={NOSE_STYLES}
            current={state.noseStyle}
            onChange={(v) => onChange({ noseStyle: v })}
          />
          <SliderControl
            label="宽度"
            value={state.noseWidth}
            onChange={(v) => onChange({ noseWidth: v })}
          />
          <SliderControl
            label="高度"
            value={state.noseHeight}
            onChange={(v) => onChange({ noseHeight: v })}
          />
        </div>
      );

    case 'mouth':
      return (
        <div className="space-y-4">
          <StyleSelector
            options={MOUTH_STYLES}
            current={state.mouthStyle}
            onChange={(v) => onChange({ mouthStyle: v })}
          />
          <SliderControl
            label="宽度"
            value={state.mouthWidth}
            onChange={(v) => onChange({ mouthWidth: v })}
          />
          <SliderControl
            label="高度"
            value={state.mouthHeight}
            onChange={(v) => onChange({ mouthHeight: v })}
          />
        </div>
      );

    case 'hair':
      return (
        <div className="space-y-4">
          <StyleSelector
            options={HAIR_STYLES}
            current={state.hairStyle}
            onChange={(v) => onChange({ hairStyle: v })}
          />
          <ColorPicker
            label="发色"
            colors={HAIR_COLORS}
            current={state.hairColor}
            onChange={(v) => onChange({ hairColor: v })}
          />
        </div>
      );

    case 'clothing':
      return (
        <div className="space-y-4">
          <ColorPicker
            label="服装颜色"
            colors={CLOTHING_COLORS}
            current={state.clothingColor}
            onChange={(v) => onChange({ clothingColor: v })}
          />
        </div>
      );

    case 'blush':
      return (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#4A3728]">启用腮红</span>
            <Switch
              checked={state.hasBlush}
              onCheckedChange={(v) => onChange({ hasBlush: v })}
            />
          </div>
          {state.hasBlush && (
            <>
              <SliderControl
                label="浓度"
                value={state.blushIntensity}
                onChange={(v) => onChange({ blushIntensity: v })}
              />
              <ColorPicker
                label="腮红颜色"
                colors={BLUSH_COLORS}
                current={state.blushColor}
                onChange={(v) => onChange({ blushColor: v })}
              />
            </>
          )}
        </div>
      );

    case 'glasses':
      return (
        <div className="space-y-4">
          <StyleSelector
            options={GLASSES_STYLES}
            current={state.glasses}
            onChange={(v) => onChange({ glasses: v })}
          />
          {state.glasses !== 'none' && (
            <ColorPicker
              label="镜框颜色"
              colors={GLASSES_COLORS}
              current={state.glassesColor}
              onChange={(v) => onChange({ glassesColor: v })}
            />
          )}
        </div>
      );

    default:
      return null;
  }
}

// ---- 主控制面板 ----

interface ControlPanelProps {
  state: CharacterState;
  onChange: (partial: Partial<CharacterState>) => void;
  onReset: () => void;
  onRandom: () => void;
}

const CATEGORIES: FeatureCategory[] = ['face', 'eyes', 'eyebrows', 'nose', 'mouth', 'hair', 'clothing', 'blush', 'glasses'];

const CATEGORY_ICONS: Record<FeatureCategory, string> = {
  face: '😊',
  eyes: '👁️',
  eyebrows: '〰️',
  nose: '👃',
  mouth: '👄',
  hair: '💇',
  clothing: '👕',
  blush: '🩷',
  glasses: '👓',
};

export default function ControlPanel({ state, onChange, onReset, onRandom }: ControlPanelProps) {
  const [activeCategory, setActiveCategory] = React.useState<FeatureCategory>('face');

  return (
    <div className="flex h-full flex-col bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg border border-[#F5E6D3] overflow-hidden">
      {/* 分类标签栏 */}
      <div className="flex overflow-x-auto gap-1 p-2 bg-[#FFF8F0] border-b border-[#F5E6D3] scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`flex shrink-0 flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[10px] font-medium transition-all duration-200 ${
              activeCategory === cat
                ? 'bg-[#FF6B9D] text-white shadow-sm scale-105'
                : 'bg-white/60 text-[#8B7355] hover:bg-white hover:scale-102'
            }`}
          >
            <span className="text-sm">{CATEGORY_ICONS[cat]}</span>
            <span>{CATEGORY_LABELS[cat]}</span>
          </button>
        ))}
      </div>

      {/* 控制内容 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <CategoryPanel
          category={activeCategory}
          state={state}
          onChange={onChange}
        />
      </div>

      {/* 底部操作栏 */}
      <div className="flex gap-2 p-3 border-t border-[#F5E6D3] bg-[#FFF8F0]">
        <button
          onClick={onRandom}
          className="flex-1 rounded-xl bg-[#7EC8E3] py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#6BB8D3] transition-all duration-200 active:scale-95"
        >
          🎲 随机生成
        </button>
        <button
          onClick={onReset}
          className="flex-1 rounded-xl bg-[#FFE8D6] py-2.5 text-sm font-bold text-[#4A3728] shadow-sm hover:bg-[#FFD5B8] transition-all duration-200 active:scale-95"
        >
          🔄 重置
        </button>
      </div>
    </div>
  );
}
