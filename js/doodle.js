/**
 * doodle.js — 涂鸦画布引擎
 * Canvas绘制 + 笔触情绪识别 + 三种笔刷样式：
 *   standard  标准：干净实心笔画
 *   material 材质：模拟木纹/金属/布料纹理（主线 + 平行偏移纹理线）
 *   pattern  花纹：沿笔画路径间隔戳印装饰图案
 */

import { analyzeStrokeData } from './emotion.js';

let canvas, ctx;
let isDrawing = false;
let lastPoint = null;
let lastTime = 0;
let currentTool = 'brush';
let strokeData = { avgSpeed: 0, avgPressure: 0, speedVariance: 0, totalStrokes: 0, duration: 0 };
let speedSum = 0, pressureSum = 0, speedCount = 0;
let speeds = [];
let startTime = 0;
let emotionCallback = null;
let strokeColor = '#3A3A3A';
let lineWidth = 3;
// 笔刷样式：standard / material / pattern
let brushStyle = 'standard';
// 花纹笔刷：累计笔画长度，达到阈值就戳印一次
let patternAccumDist = 0;
const PATTERN_STAMP_INTERVAL = 18;

// ---- 初始化画布 ----
export function initDoodle(canvasEl, onEmotion) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  emotionCallback = onEmotion;

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // 重置数据
  strokeData = { avgSpeed: 0, avgPressure: 0, speedVariance: 0, totalStrokes: 0, duration: 0 };
  speedSum = 0; pressureSum = 0; speedCount = 0; speeds = [];

  // 绑定事件
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointerleave', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);

  return { setTool, setColor, setBrushStyle, clear: clearCanvas, getData: getDoodleData, getStrokeData: getStrokeData };
}

// ---- 设置笔刷样式 ----
function setBrushStyle(style) {
  brushStyle = style;
}

// ---- 设置画笔颜色 ----
function setColor(color) {
  strokeColor = color;
  // 如果当前是橡皮，切回画笔
  if (currentTool === 'eraser') {
    currentTool = 'brush';
    ctx.globalCompositeOperation = 'source-over';
    lineWidth = 3;
  }
}

function resizeCanvas() {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  ctx.scale(dpr, dpr);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

// ---- 工具切换 ----
function setTool(tool) {
  currentTool = tool;
  if (tool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    strokeColor = 'rgba(0,0,0,1)';
    lineWidth = 20;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    lineWidth = 3;
  }
}

// ---- 指针事件 ----
function onPointerDown(e) {
  e.preventDefault();
  isDrawing = true;
  lastPoint = getPoint(e);
  lastTime = Date.now();
  startTime = startTime || Date.now();
  strokeData.totalStrokes++;
  patternAccumDist = 0;

  canvas.setPointerCapture(e.pointerId);

  // 起笔点
  if (currentTool === 'brush') {
    if (brushStyle === 'pattern') {
      stampPattern(lastPoint.x, lastPoint.y);
    } else {
      // standard / material 起笔画一个圆点
      ctx.beginPath();
      ctx.arc(lastPoint.x, lastPoint.y, lineWidth / 2, 0, Math.PI * 2);
      ctx.fillStyle = strokeColor;
      ctx.fill();
    }
  }
}

function onPointerMove(e) {
  if (!isDrawing) return;
  e.preventDefault();

  const point = getPoint(e);
  const now = Date.now();
  const dt = Math.max(now - lastTime, 1);
  const dist = Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y);
  const speed = Math.min(dist / dt, 3);
  const normalizedSpeed = Math.min(speed / 2, 1);

  let pressure = e.pressure || 0.5;
  if (pressure === 0.5 && e.width) {
    pressure = Math.min(e.width / 20, 1);
  }

  // 记录数据
  speedSum += normalizedSpeed;
  pressureSum += pressure;
  speedCount++;
  speeds.push(normalizedSpeed);

  // 按当前笔刷样式绘制
  if (currentTool === 'brush') {
    drawSegment(lastPoint, point);
  }

  // 实时更新情绪
  updateRealtimeEmotion();

  lastPoint = point;
  lastTime = now;
}

function onPointerUp(e) {
  if (!isDrawing) return;
  isDrawing = false;
  try { canvas.releasePointerCapture(e.pointerId); } catch(_) {}
}

function getPoint(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: e.clientX - rect.left, y: e.clientY - rect.top };
}

// ---- 绘制一段笔画（按笔刷样式分发） ----
function drawSegment(p1, p2) {
  if (brushStyle === 'material') {
    drawMaterialSegment(p1, p2);
  } else if (brushStyle === 'pattern') {
    drawPatternSegment(p1, p2);
  } else {
    drawStandardSegment(p1, p2);
  }
}

// 标准：干净实心笔画
function drawStandardSegment(p1, p2) {
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
}

// 材质笔刷：主线 + 平行偏移纹理线（模拟木纹/金属拉丝/布料经纬）
// 沿笔画方向叠加几条半透明偏移线，呈现材质纹理感
function drawMaterialSegment(p1, p2) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return;
  // 法线方向（垂直笔画）
  const nx = -dy / len;
  const ny = dx / len;

  // 主线（实心）
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = lineWidth;
  ctx.stroke();

  // 纹理层：两条偏移的半透明细线，营造材质拉丝感
  const offsets = [
    { off: 2.2, alpha: 0.22, width: lineWidth * 0.45 },
    { off: -2.2, alpha: 0.22, width: lineWidth * 0.45 },
    { off: 4.0, alpha: 0.12, width: lineWidth * 0.30 },
    { off: -4.0, alpha: 0.12, width: lineWidth * 0.30 },
  ];
  for (const t of offsets) {
    ctx.beginPath();
    ctx.moveTo(p1.x + nx * t.off, p1.y + ny * t.off);
    ctx.lineTo(p2.x + nx * t.off, p2.y + ny * t.off);
    ctx.strokeStyle = applyAlpha(strokeColor, t.alpha);
    ctx.lineWidth = t.width;
    ctx.stroke();
  }
}

// 花纹笔刷：沿路径累计距离，达到阈值就戳印一次装饰图案
function drawPatternSegment(p1, p2) {
  // 先画一条很淡的引导线，让笔画路径仍可见
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.strokeStyle = applyAlpha(strokeColor, 0.25);
  ctx.lineWidth = lineWidth * 0.6;
  ctx.stroke();

  // 累计距离戳印
  patternAccumDist += Math.hypot(p2.x - p1.x, p2.y - p1.y);
  while (patternAccumDist >= PATTERN_STAMP_INTERVAL) {
    patternAccumDist -= PATTERN_STAMP_INTERVAL;
    stampPattern(p2.x, p2.y);
  }
}

// 戳印一个装饰图案（四瓣小花 + 中心点）
function stampPattern(x, y) {
  const r = Math.max(lineWidth * 1.6, 4);
  ctx.save();
  ctx.fillStyle = strokeColor;
  // 四个花瓣
  for (let i = 0; i < 4; i++) {
    const ang = (i * Math.PI) / 2;
    ctx.beginPath();
    ctx.arc(
      x + Math.cos(ang) * r * 0.7,
      y + Math.sin(ang) * r * 0.7,
      r * 0.55, 0, Math.PI * 2
    );
    ctx.fill();
  }
  // 中心点（稍亮）
  ctx.beginPath();
  ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
  ctx.fillStyle = applyAlpha(strokeColor, 0.85);
  ctx.fill();
  ctx.restore();
}

// ---- 工具：给颜色叠加透明度 ----
// 支持 #RRGGBB / #RGB，返回 rgba() 字符串
function applyAlpha(color, alpha) {
  let hex = color;
  if (hex.startsWith('#')) hex = hex.slice(1);
  if (hex.length === 3) {
    hex = hex.split('').map(c => c + c).join('');
  }
  if (hex.length !== 6) return color; // 无法解析，原样返回
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ---- 实时情绪更新 ----
function updateRealtimeEmotion() {
  if (speedCount === 0) return;

  const avgSpeed = speedSum / speedCount;
  const avgPressure = pressureSum / speedCount;
  const mean = avgSpeed;
  const variance = speeds.reduce((s, v) => s + (v - mean) ** 2, 0) / speeds.length;
  const speedVariance = Math.sqrt(variance);

  const data = {
    avgSpeed,
    avgPressure,
    speedVariance,
    totalStrokes: strokeData.totalStrokes,
    duration: Date.now() - startTime,
  };

  strokeData = data;
  const result = analyzeStrokeData(data);

  if (emotionCallback) {
    emotionCallback(result);
  }
}

// ---- 清空画布 ----
function clearCanvas() {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokeData = { avgSpeed: 0, avgPressure: 0, speedVariance: 0, totalStrokes: 0, duration: 0 };
  speedSum = 0; pressureSum = 0; speedCount = 0; speeds = [];
  startTime = 0;
  patternAccumDist = 0;
  if (emotionCallback) {
    emotionCallback({ emotion: 'calm', intensity: 0.3, confidence: 0.5 });
  }
}

// ---- 获取涂鸦数据（图片）----
function getDoodleData() {
  if (!canvas) return null;
  return canvas.toDataURL('image/png');
}

// ---- 获取笔触数据 ----
function getStrokeData() {
  return { ...strokeData };
}

// ---- 销毁 ----
export function destroyDoodle() {
  if (canvas) {
    canvas.removeEventListener('pointerdown', onPointerDown);
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerup', onPointerUp);
    canvas.removeEventListener('pointerleave', onPointerUp);
    canvas.removeEventListener('pointercancel', onPointerUp);
  }
  window.removeEventListener('resize', resizeCanvas);
  canvas = null;
  ctx = null;
}
