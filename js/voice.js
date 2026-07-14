/**
 * voice.js — 语音记录模块
 * Web Audio API（音量/波形） + Web Speech API（转文字）
 */

import { analyzeVoiceData } from './emotion.js';
import { EMOTIONS } from './store.js';

let audioContext = null;
let analyser = null;
let mediaStream = null;
let recognition = null;
let isRecording = false;
let waveContainer = null;
let transcriptContainer = null;
let emotionContainer = null;
let waveBars = [];
let animationId = null;

// 录音数据收集
let volumeData = [];
let pauseCount = 0;
let lastVolume = 0;
let recordStartTime = 0;
let finalTranscript = '';

// ---- 初始化语音模块 ----
export function initVoice(waveEl, transcriptEl, emotionEl, recordBtn) {
  waveContainer = waveEl;
  transcriptContainer = transcriptEl;
  emotionContainer = emotionEl;

  // 创建波形条
  waveContainer.innerHTML = '';
  waveBars = [];
  for (let i = 0; i < 32; i++) {
    const bar = document.createElement('div');
    bar.className = 'wave-bar';
    bar.style.height = '4px';
    waveContainer.appendChild(bar);
    waveBars.push(bar);
  }

  // 绑定录音按钮
  let pressTimer = null;

  const startRec = (e) => {
    e.preventDefault();
    startRecording();
  };

  const stopRec = (e) => {
    e.preventDefault();
    stopRecording();
  };

  recordBtn.addEventListener('pointerdown', startRec);
  recordBtn.addEventListener('pointerup', stopRec);
  recordBtn.addEventListener('pointerleave', stopRec);
  recordBtn.addEventListener('pointercancel', stopRec);

  // 初始化语音识别
  initSpeechRecognition();
}

// ---- 初始化语音识别 ----
function initSpeechRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    console.warn('浏览器不支持语音识别');
    return;
  }

  recognition = new SR();
  recognition.lang = 'zh-CN';
  recognition.continuous = true;
  recognition.interimResults = true;

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interim += transcript;
      }
    }
    if (transcriptContainer) {
      transcriptContainer.innerHTML = `<p>${finalTranscript + interim}</p>`;
    }
  };

  recognition.onerror = (e) => {
    console.warn('语音识别错误', e.error);
  };

  recognition.onend = () => {
    // 如果还在录音，自动重启
    if (isRecording) {
      try { recognition.start(); } catch(_) {}
    }
  };
}

// ---- 开始录音 ----
async function startRecording() {
  if (isRecording) return;
  isRecording = true;
  finalTranscript = '';
  volumeData = [];
  pauseCount = 0;
  recordStartTime = Date.now();

  // UI 状态
  const btn = document.getElementById('voice-record');
  if (btn) btn.classList.add('recording');
  if (transcriptContainer) {
    transcriptContainer.innerHTML = '<p>正在聆听...</p>';
  }
  if (emotionContainer) emotionContainer.classList.add('hidden');

  try {
    // 启动麦克风
    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;

    const source = audioContext.createMediaStreamSource(mediaStream);
    source.connect(analyser);

    // 启动波形动画
    updateWaveform();

    // 启动语音识别
    if (recognition) {
      try { recognition.start(); } catch(_) {}
    }

  } catch (e) {
    console.warn('麦克风访问失败', e);
    if (transcriptContainer) {
      transcriptContainer.innerHTML = '<p>无法访问麦克风，请检查权限</p>';
    }
    stopRecording();
  }
}

// ---- 波形更新 ----
function updateWaveform() {
  if (!isRecording || !analyser) return;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteTimeDomainData(dataArray);

  // 计算 RMS 音量
  let sum = 0;
  for (let i = 0; i < bufferLength; i++) {
    const val = (dataArray[i] - 128) / 128;
    sum += val * val;
  }
  const rms = Math.sqrt(sum / bufferLength);
  const volume = Math.min(rms * 2, 1);

  volumeData.push(volume);

  // 检测停顿（音量突然很低）
  if (lastVolume > 0.15 && volume < 0.05) {
    pauseCount++;
  }
  lastVolume = volume;

  // 更新波形条
  const barCount = waveBars.length;
  const step = Math.floor(bufferLength / barCount);
  for (let i = 0; i < barCount; i++) {
    const val = (dataArray[i * step] - 128) / 128;
    const height = Math.max(4, Math.abs(val) * 80 + volume * 60);
    waveBars[i].style.height = `${height}px`;
  }

  animationId = requestAnimationFrame(updateWaveform);
}

// ---- 停止录音 ----
function stopRecording() {
  if (!isRecording) return;
  isRecording = false;

  const btn = document.getElementById('voice-record');
  if (btn) btn.classList.remove('recording');

  // 停止波形
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  // 恢复波形条
  waveBars.forEach(bar => bar.style.height = '4px');

  // 停止语音识别
  if (recognition) {
    try { recognition.stop(); } catch(_) {}
  }

  // 停止麦克风
  if (mediaStream) {
    mediaStream.getTracks().forEach(t => t.stop());
    mediaStream = null;
  }
  if (audioContext) {
    try { audioContext.close(); } catch(_) {}
    audioContext = null;
  }

  // 分析情绪
  if (volumeData.length > 0) {
    const avgVolume = volumeData.reduce((s, v) => s + v, 0) / volumeData.length;
    const volumeVariance = volumeData.reduce((s, v) => s + (v - avgVolume) ** 2, 0) / volumeData.length;

    // 估算语速（通过文字长度/录音时长）
    const duration = (Date.now() - recordStartTime) / 1000;
    const wordCount = finalTranscript.length;
    const rate = wordCount / Math.max(duration, 1);
    let speechRate = 'normal';
    if (rate > 4) speechRate = 'fast';
    else if (rate < 1.5) speechRate = 'slow';

    const voiceData = {
      avgVolume: Number(avgVolume.toFixed(3)),
      volumeVariance: Number(volumeVariance.toFixed(3)),
      speechRate,
      pauses: pauseCount,
      transcript: finalTranscript,
    };

    const result = analyzeVoiceData(voiceData);

    // 显示情绪结果
    if (emotionContainer) {
      const info = EMOTIONS[result.emotion];
      emotionContainer.innerHTML = `
        <span style="font-size:20px">${info.emoji}</span>
        <span>${info.label}</span>
        <span style="opacity:0.6;font-size:12px">强度 ${Math.round(result.intensity * 100)}%</span>
      `;
      emotionContainer.classList.remove('hidden');
    }

    // 更新文字转录
    if (transcriptContainer) {
      if (finalTranscript) {
        transcriptContainer.innerHTML = `<p>${finalTranscript}</p>`;
      } else {
        transcriptContainer.innerHTML = '<p class="voice-hint">没有识别到语音内容</p>';
      }
    }

    // 显示保存按钮
    const saveBtn = document.getElementById('voice-save');
    if (saveBtn && finalTranscript) {
      saveBtn.classList.remove('hidden');
    }

    // 存储结果供保存使用
    window._voiceResult = { ...voiceData, emotion: result.emotion, intensity: result.intensity, transcript: finalTranscript };

  } else {
    if (transcriptContainer) {
      transcriptContainer.innerHTML = '<p class="voice-hint">按住按钮说话</p>';
    }
  }
}

// ---- 获取语音结果 ----
export function getVoiceResult() {
  return window._voiceResult || null;
}
