'use client';

import React, { useState, useCallback } from 'react';
import AvatarCanvas from '@/components/avatar-canvas';
import ControlPanel from '@/components/control-panel';
import type { CharacterState } from '@/lib/character-types';
import {
  DEFAULT_CHARACTER,
  SKIN_COLORS,
  EYE_COLORS,
  HAIR_COLORS,
  CLOTHING_COLORS,
  BLUSH_COLORS,
  GLASSES_COLORS,
} from '@/lib/character-types';
import type {
  FaceShape,
  EyeStyle,
  EyebrowStyle,
  NoseStyle,
  MouthStyle,
  HairStyle,
  GlassesStyle,
} from '@/lib/character-types';

// 随机选取
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateRandomCharacter(): CharacterState {
  return {
    faceShape: pick<FaceShape>(['round', 'oval', 'heart']),
    faceWidth: rand(30, 80),
    faceHeight: rand(30, 80),
    skinColor: pick(SKIN_COLORS),

    eyeStyle: pick<EyeStyle>(['round', 'cute', 'oval', 'sharp']),
    eyeWidth: rand(30, 80),
    eyeHeight: rand(30, 80),
    eyeSpacing: rand(30, 75),
    eyeVerticalPos: rand(25, 65),
    eyeColor: pick(EYE_COLORS),
    eyeTilt: rand(-15, 15),

    eyebrowStyle: pick<EyebrowStyle>(['natural', 'arched', 'straight', 'angry']),
    eyebrowThickness: rand(30, 80),
    eyebrowHeight: rand(30, 80),
    eyebrowLength: rand(30, 80),
    eyebrowColor: pick(HAIR_COLORS.slice(0, 6)),

    noseStyle: pick<NoseStyle>(['dot', 'small', 'round', 'pointed']),
    noseWidth: rand(20, 70),
    noseHeight: rand(20, 80),

    mouthStyle: pick<MouthStyle>(['smile', 'grin', 'neutral', 'open', 'cat']),
    mouthWidth: rand(30, 80),
    mouthHeight: rand(30, 80),

    hairStyle: pick<HairStyle>(['buzz', 'short-messy', 'side-sweep', 'spiky', 'wavy', 'long-straight', 'long-wavy', 'pigtails', 'ponytail', 'bun', 'bald']),
    hairColor: pick(HAIR_COLORS),

    clothingColor: pick(CLOTHING_COLORS),

    hasBlush: Math.random() > 0.3,
    blushIntensity: rand(20, 70),
    blushColor: pick(BLUSH_COLORS),

    glasses: pick<GlassesStyle>(['none', 'none', 'none', 'round', 'square', 'sunglasses']),
    glassesColor: pick(GLASSES_COLORS),
  };
}

export default function Home() {
  const [character, setCharacter] = useState<CharacterState>(DEFAULT_CHARACTER);
  const [isExporting, setIsExporting] = useState(false);

  const handleChange = useCallback((partial: Partial<CharacterState>) => {
    setCharacter((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleReset = useCallback(() => {
    setCharacter(DEFAULT_CHARACTER);
  }, []);

  const handleRandom = useCallback(() => {
    setCharacter(generateRandomCharacter());
  }, []);

  const handleExport = useCallback(() => {
    setIsExporting(true);
    // 使用 canvas 导出 SVG 为 PNG
    const svgElement = document.querySelector('#avatar-svg') as unknown as SVGSVGElement;
    if (!svgElement) {
      setIsExporting(false);
      return;
    }

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = 600;
      canvas.height = 840;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        setIsExporting(false);
        return;
      }
      // 白色背景
      ctx.fillStyle = '#FFF8F0';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, 600, 840);
      URL.revokeObjectURL(url);

      const pngUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = 'my-avatar.png';
      link.href = pngUrl;
      link.click();
      setIsExporting(false);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setIsExporting(false);
    };
    img.src = url;
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#FFF8F0] to-[#FFE8D6] flex flex-col">
      {/* 顶部标题 */}
      <header className="text-center py-4 px-4">
        <h1 className="text-2xl md:text-3xl font-bold text-[#4A3728] tracking-wide" style={{ fontFamily: '"ZCOOL KuaiLe", "PingFang SC", sans-serif' }}>
          捏脸工坊
        </h1>
        <p className="text-sm text-[#8B7355] mt-1">创造你的专属可爱形象</p>
      </header>

      {/* 主体内容 */}
      <main className="flex-1 flex flex-col lg:flex-row gap-4 px-4 pb-4 max-w-6xl mx-auto w-full">
        {/* 左侧：角色预览 */}
        <div className="lg:w-1/2 flex flex-col items-center justify-center">
          <div className="relative w-full max-w-sm">
            {/* 背景装饰光斑 */}
            <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
              <div className="absolute w-32 h-32 bg-[#FF6B9D]/10 rounded-full -top-8 -left-8 blur-2xl" />
              <div className="absolute w-40 h-40 bg-[#7EC8E3]/10 rounded-full -bottom-10 -right-10 blur-2xl" />
              <div className="absolute w-20 h-20 bg-[#E8C547]/10 rounded-full top-1/3 right-1/4 blur-xl" />
            </div>

            {/* 角色画布 */}
            <div className="relative z-10 animate-float">
              <AvatarCanvas
                state={character}
                className="w-full h-auto drop-shadow-lg"
              />
            </div>
          </div>

          {/* 导出按钮 */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="mt-4 rounded-full bg-[#FF6B9D] px-8 py-2.5 text-sm font-bold text-white shadow-lg hover:bg-[#E85A8A] transition-all duration-200 active:scale-95 disabled:opacity-60"
          >
            {isExporting ? '导出中...' : '📥 保存头像'}
          </button>
        </div>

        {/* 右侧：控制面板 */}
        <div className="lg:w-1/2 min-h-[400px] lg:min-h-0">
          <ControlPanel
            state={character}
            onChange={handleChange}
            onReset={handleReset}
            onRandom={handleRandom}
          />
        </div>
      </main>
    </div>
  );
}
