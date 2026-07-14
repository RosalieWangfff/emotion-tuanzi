# 捏脸工坊 - 项目文档

## 项目概述

一个类似《朋友收集 梦想生活》(Tomodachi Life) 风格的网页捏脸系统，用户可以自由调整角色面部特征，创建专属的可爱卡通形象，并导出为 PNG 头像。

## 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **角色渲染**: SVG 矢量图 (纯前端渲染，无需后端)

## 目录结构

```
├── public/                 # 静态资源
├── src/
│   ├── app/
│   │   ├── layout.tsx      # 根布局 (zh-CN, metadata)
│   │   ├── page.tsx        # 主页面 (捏脸交互逻辑 + 导出)
│   │   └── globals.css     # 全局样式 (含浮动动画、字体、CSS 变量)
│   ├── components/
│   │   ├── avatar-canvas.tsx    # 核心：SVG 角色渲染器
│   │   ├── control-panel.tsx    # 核心：分类控制面板
│   │   └── ui/                  # shadcn/ui 组件库
│   │       ├── slider.tsx       # 滑块 (用于连续参数调节)
│   │       ├── switch.tsx       # 开关 (用于腮红启用)
│   │       └── ...
│   └── lib/
│       ├── character-types.ts   # 角色状态类型定义 + 默认值 + 颜色预设
│       └── utils.ts             # 通用工具函数 (cn)
├── DESIGN.md               # 设计规范 (色彩、动效、禁忌)
└── AGENTS.md               # 本文件
```

## 核心架构

### 数据流

```
CharacterState (state) → AvatarCanvas (SVG 渲染) + ControlPanel (交互控制)
                ↑_______________|
                onChange(partial) 更新部分状态
```

### CharacterState 结构

角色状态包含 9 大类、共 20+ 个可调参数：
- **脸型**: shape (4种)、width、height、skinColor
- **眼睛**: style (4种)、size、spacing、height、color、tilt
- **眉毛**: style (4种)、thickness、color
- **鼻子**: style (4种)、size
- **嘴巴**: style (5种)、width
- **发型**: style (9种)、color
- **服装**: clothingColor (12种颜色)
- **腮红**: enabled、intensity、color
- **眼镜**: style (4种)、color

### SVG 渲染层级 (从后到前)

1. 展台 → 2. 身体(含手臂) → 3. 发型后层 → 4. 耳朵 → 5. 脸型 → 6. 腮红 → 7. 眼睛 → 8. 眉毛 → 9. 鼻子 → 10. 嘴巴 → 11. 发型前层 → 12. 眼镜

### 头发渲染规范

- 所有刘海下沿不超过 `CY - ry * 0.28`（眉毛以上），确保不遮挡眼睛
- 卷发前层只在头顶区域放置卷曲圆，后层在两侧和底部
- SVG viewBox: `0 0 300 420`，头部中心 (CX=150, CY=140)

## 构建与运行命令

```bash
pnpm install       # 安装依赖
pnpm run dev       # 开发模式 (端口 5000)
pnpm run build     # 构建生产版本
pnpm run start     # 启动生产环境
pnpm ts-check      # TypeScript 类型检查
pnpm lint          # ESLint 检查
```

## 包管理规范

**仅允许使用 pnpm**，严禁 npm 或 yarn。

## 编码规范

- TypeScript strict 模式；禁止隐式 any / as any
- SVG 渲染中禁止使用 Math.random()（会导致 Hydration 不匹配），改用确定性计算如 `i % 3`
- 所有函数参数和返回值需明确类型
- 使用 'use client' 标记客户端组件

## 设计要点

- 详见 DESIGN.md：暖奶白主色调、草莓粉强调色、圆角无锐角、浮动呼吸动画
- 角色风格：Q版大头、大眼萌系、豆鼻小嘴、描边粗线+圆头端点
- 身体包含：脖子、躯干、双臂、双手，服装颜色可自定义

## 已知限制

- 导出功能使用 Canvas API 将 SVG 转为 PNG，在部分浏览器中可能受 CORS 限制
- 卷发样式使用确定性循环生成，前层 7 个顶部卷 + 后层 8 个侧卷
