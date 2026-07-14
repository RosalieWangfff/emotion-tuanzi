/**
 * app.js — 主应用入口
 * 职责：串联各功能模块、绑定页面初始化逻辑、启动应用
 *
 * 已拆分到独立模块：
 *  - router.js      路由历史栈 + navigate/goBack/toast + pageInits 容器
 *  - home-modules.js 首页小模块（天气/日历/心情速记/AI情绪面板/温度计/回信卡/建议）
 *  - timeline.js    时间线列表/详情/字体/贴纸入口（导入即注册 pageInits.timeline）
 *  - stickers.js    贴纸存储 + 拖拽系统
 *
 * app.js 保留：精灵闲话、各页面初始化（onboarding/home/main/doodle/voice/write/photo/album/review/report/settings）、
 *             位置选择器、主题切换、打字机、启动
 */
import { store, SPRITE_TYPES, PERSONA_TYPES, EMOTIONS, THEMES, BACKGROUNDS, DEFAULT_BACKGROUND_ID, getCustomBackgrounds, addCustomBackground, removeCustomBackground, getAllBackgrounds } from './store.js?v=2';
import { analyzeText, analyzeTextAI, generateReply, generateReport, callLLMWithSystem, generateChatReply, isAIEnabled, setApiKey, setAIEnabled, getApiKeyMasked } from './emotion.js?v=2';
import { renderSprite, renderSpritePicker, renderPersonaPicker, spriteSpeak, openFaceCustomizer } from './sprite.js?v=2';
import { createSprite3D } from './sprite-3d.js?v=4';
import { initDoodle, destroyDoodle } from './doodle.js';
import { initMap, addRecordMarkers, initLocationPicker, getSelectedLocation, destroyLocationPicker, getCurrentLocation } from './map.js';
import { initVoice, getVoiceResult } from './voice.js';

// 路由 / toast / pageInits 容器
import { navigate, goBack, bindBackButtons, pageInits, toast, currentRoute } from './router.js';

// 首页小模块
import {
  getTimePeriod,
  renderWeather, renderCalendar, renderMoodQuick, renderEmotionPanel,
  renderTodayMoodThermometer, renderReplyCard, renderMoodAdvice,
} from './home-modules.js';

// 时间线模块（副作用导入：注册 pageInits.timeline）
import './timeline.js';

let doodleController = null;
let pendingEmotion = null;
let homeSprite3D = null;  // 3D 精灵实例（仅 preset1/cat/dog/radish/cloud 使用）

// 支持 3D 渲染的精灵类型（其他类型继续 SVG）
const SPRITE_TYPES_3D = ['preset1', 'preset2', 'cat', 'dog', 'radish', 'cloud'];

// ---- 侧边导航绑定（全局，只绑定一次）----
function bindSideNav() {
  const sideNav = document.getElementById('side-nav');
  if (!sideNav) return;
  sideNav.querySelectorAll('.side-nav-item').forEach(item => {
    item.onclick = () => {
      const nav = item.dataset.nav;
      if (nav === 'home') navigate('home');
      else if (nav === 'map') navigate('main');
      else if (nav === 'timeline') navigate('timeline');
      else if (nav === 'report') navigate('report');
      else if (nav === 'photo') navigate('album');
    };
  });
}

// ==================== 精灵之家 ====================
// 精灵闲话库（按时段）
const SPRITE_CHATTER = {
  day: ['今天的阳光真好，想出去走走～', '我看到窗外的云，像棉花糖。', '听到鸟叫了，你听到了吗？', '中午要好好吃饭哦。', '下午的时光总是慢慢的，我喜欢。'],
  dusk: ['晚霞好美，像打翻的颜料盘。', '一天快结束了，辛苦啦。', '黄昏的风很温柔。', '该回家了吧？我在等你哦。'],
  night: ['星星出来了，一闪一闪的。', '夜深了，早点休息吧。', '今天的月亮好亮。', '睡不着也没关系，我陪你。', '晚安呀，做个好梦。'],
  general: ['嗨，我在呢～', '今天感觉怎么样？', '想画点什么吗？', '我一直在这里哦～', '记得照顾好自己呀。'],
};
// 精灵生活动态
const SPRITE_LIFE_DYNAMICS = [
  { emoji: '☁️', text: '今天看到一朵云，软软的，像你画的那个。' },
  { emoji: '🌸', text: '路边开了小花，偷偷给你留了一朵。' },
  { emoji: '🌙', text: '昨晚做了个梦，梦到我们一起散步。' },
  { emoji: '☕', text: '泡了杯热茶，想着你也许会喜欢。' },
  { emoji: '🍃', text: '起风了，想把你的烦恼都吹走。' },
  { emoji: '📖', text: '翻了翻你之前的记录，你真的很努力。' },
  { emoji: '🎵', text: '听到一首好听的歌，想分享给你。' },
  { emoji: '🌱', text: '今天发了新芽，像你一样在慢慢长大。' },
];

let homeChatterTimer = null;

pageInits.home = () => {
  const state = store.get();
  const sprite = state.sprite;

  // 清理之前的定时器
  if (homeChatterTimer) { clearTimeout(homeChatterTimer); homeChatterTimer = null; }

  // ---- 时间场景背景 ----
  const period = getTimePeriod();
  const sceneBg = document.getElementById('scene-bg');
  sceneBg.setAttribute('data-time', period);

  // 生成星星（夜晚）
  const starsContainer = document.getElementById('scene-stars');
  starsContainer.innerHTML = '';
  if (period === 'night') {
    for (let i = 0; i < 40; i++) {
      const star = document.createElement('div');
      star.className = 'scene-star';
      star.style.left = Math.random() * 100 + '%';
      star.style.top = Math.random() * 60 + '%';
      star.style.animationDelay = Math.random() * 2 + 's';
      starsContainer.appendChild(star);
    }
  }

  // ---- 渲染大精灵 ----
  // 支持 3D 的类型用 Three.js 渲染；其他类型（preset2/自定义捏脸/上传照片）继续 SVG
  const avatar = document.getElementById('home-sprite-avatar');
  let homeExpr = 'calm';
  document.getElementById('home-sprite-name').textContent = sprite.name;

  // 释放上一次的 3D 实例
  if (homeSprite3D) {
    homeSprite3D.dispose();
    homeSprite3D = null;
  }

  // 标志性元素：根据精灵当前情绪设置光晕色
  function applyEmotionGlow(emotion) {
    const glowColors = {
      joy: 'rgba(247,178,103,0.40)',
      sadness: 'rgba(107,155,210,0.40)',
      anger: 'rgba(224,122,95,0.40)',
      anxiety: 'rgba(185,168,217,0.40)',
      calm: 'rgba(168,216,234,0.40)',
      fatigue: 'rgba(168,149,149,0.40)',
    };
    document.documentElement.style.setProperty(
      '--emotion-glow', glowColors[emotion] || glowColors.calm
    );
  }
  applyEmotionGlow(homeExpr);

  // ---- 点击精灵切换表情 ----
  const exprList = ['calm', 'joy', 'sadness', 'anger', 'anxiety', 'fatigue'];
  const exprReply = {
    joy: '哇，开心起来啦！',
    sadness: '有点难过吗？我靠着你不说话也行。',
    anger: '生气啦？先深呼吸，我陪着你。',
    anxiety: '别担心，一步一步来就好。',
    fatigue: '累了吧，靠着我歇一会儿。',
    calm: '这样静静地待着，就很好。',
  };
  function showExprBubble(emotion) {
    const bubbleEl = document.getElementById('home-bubble');
    bubbleEl.textContent = exprReply[emotion];
    bubbleEl.classList.remove('hidden');
    bubbleEl.style.animation = 'none';
    void bubbleEl.offsetWidth;
    bubbleEl.style.animation = '';
  }

  const use3D = SPRITE_TYPES_3D.includes(sprite.type);
  if (use3D) {
    avatar.classList.add('sprite-3d-mode');
    avatar.innerHTML = '';  // 清空 SVG
    homeSprite3D = createSprite3D(avatar, {
      spriteType: sprite.type,
      size: 320,
      initialEmotion: homeExpr,
      onClick: () => {
        const idx = exprList.indexOf(homeExpr);
        homeExpr = exprList[(idx + 1) % exprList.length];
        homeSprite3D.setEmotion(homeExpr);
        applyEmotionGlow(homeExpr);
        showExprBubble(homeExpr);
      },
    });
  } else {
    avatar.classList.remove('sprite-3d-mode');
    avatar.innerHTML = renderSprite(sprite.type, homeExpr, 200);
    avatar.onclick = () => {
      const idx = exprList.indexOf(homeExpr);
      homeExpr = exprList[(idx + 1) % exprList.length];
      avatar.innerHTML = renderSprite(sprite.type, homeExpr, 200);
      applyEmotionGlow(homeExpr);
      showExprBubble(homeExpr);
    };
  }

  // ---- 精灵说话（初始 + 定时随机闲话）----
  const bubble = document.getElementById('home-bubble');
  const chatterPool = [...SPRITE_CHATTER[period], ...SPRITE_CHATTER.general];
  bubble.textContent = chatterPool[Math.floor(Math.random() * chatterPool.length)];
  bubble.classList.remove('hidden');

  function scheduleChatter() {
    homeChatterTimer = setTimeout(() => {
      const p = getTimePeriod();
      const pool = [...SPRITE_CHATTER[p], ...SPRITE_CHATTER.general];
      bubble.textContent = pool[Math.floor(Math.random() * pool.length)];
      bubble.classList.remove('hidden');
      bubble.style.animation = 'none';
      void bubble.offsetWidth;
      bubble.style.animation = '';
      scheduleChatter();
    }, 20000 + Math.random() * 15000); // 20-35秒随机
  }
  scheduleChatter();

  // ---- 迷你对话输入框：用户能直接和团子聊天 ----
  const chatInput = document.getElementById('home-chat-input');
  const chatSendBtn = document.getElementById('home-chat-send');
  let chatThinking = false;

  function showBubbleText(text) {
    // 停掉定时闲话，避免覆盖对话
    if (homeChatterTimer) { clearTimeout(homeChatterTimer); homeChatterTimer = null; }
    bubble.textContent = text;
    bubble.classList.remove('hidden');
    bubble.style.animation = 'none';
    void bubble.offsetWidth;
    bubble.style.animation = '';
    // 对话结束后再恢复闲话（间隔 25-40 秒）
    homeChatterTimer = setTimeout(scheduleChatter, 25000 + Math.random() * 15000);
  }

  async function sendChat() {
    if (chatThinking) return;
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = '';
    chatThinking = true;
    chatSendBtn.classList.add('thinking');
    // 先显示"我在听..."，给用户即时反馈
    showBubbleText('嗯，我在听…');
    try {
      const recent = store.get().records.slice(0, 5);  // 最近 5 条作上下文
      const reply = await generateChatReply(text, sprite, recent);
      showBubbleText(reply);
      // 把这次对话也存一条记录（type=chat，不入库正式记录，但可统计）
      // 这里不存，避免污染情绪记录库
    } catch (e) {
      console.warn('首页对话失败', e);
      showBubbleText('我有点走神了，能再说一遍吗？');
    } finally {
      chatThinking = false;
      chatSendBtn.classList.remove('thinking');
    }
  }
  chatSendBtn.onclick = sendChat;
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChat();
    }
  });

  // ---- 精灵动态卡片（生活动态 + 情绪回应）----
  // 已移除 home-dynamics：精灵只在气泡里说话，避免"起风了/小花"重复

  // ---- 左侧模块：天气 / 统计 ----
  renderWeather();
  renderEmotionPanel(state.records);

  // ---- 实用性维度：团子回信卡 ----
  renderReplyCard();

  // ---- 抽拉式小组件：点击拉手开关抽屉（可同时打开）----
  const drawerLeft = document.getElementById('drawer-left');
  const drawerRight = document.getElementById('drawer-right');
  document.getElementById('tab-left').onclick = () => {
    drawerLeft.classList.toggle('open');
  };
  document.getElementById('tab-right').onclick = () => {
    drawerRight.classList.toggle('open');
  };
  // 点击拉手再次点击收起，点击场景空白处收起所有抽屉
  document.getElementById('home-sprite-stage').parentElement.addEventListener('click', (e) => {
    if (e.target.closest('.home-drawer') || e.target.closest('.home-action-btn')) return;
    drawerLeft.classList.remove('open');
    drawerRight.classList.remove('open');
  });

  // ---- 四大入口按钮（画一画/说一说/写一写/拍一拍）----
  document.querySelectorAll('.home-actions-grid .home-action-btn').forEach(btn => {
    btn.onclick = () => {
      const route = btn.dataset.route;
      if (route) navigate(route);
    };
  });

  // ---- 统计 ----
  const stats = store.getStats();
  document.getElementById('home-stats').innerHTML = `
    <div class="home-stat"><div class="home-stat-value">${stats.totalRecords}</div><div class="home-stat-label">记录</div></div>
    <div class="home-stat"><div class="home-stat-value">${stats.sealedBottles}</div><div class="home-stat-label">瓶子</div></div>
    <div class="home-stat"><div class="home-stat-value">${stats.companionDays}</div><div class="home-stat-label">陪伴天</div></div>
  `;

  // 设置按钮
  document.getElementById('btn-home-settings').onclick = () => navigate('settings');

  // ---- 房间背景图 ----
  const bgImageEl = document.getElementById('home-bg-image');
  const bgPicker = document.getElementById('home-bg-picker');
  const bgGrid = document.getElementById('home-bg-picker-grid');

  function applyBackground(bgId) {
    const all = getAllBackgrounds();
    const bg = all.find(b => b.id === bgId) || all[0];
    if (bg) {
      bgImageEl.style.backgroundImage = `url("${bg.image}")`;
    }
  }
  applyBackground(store.get().currentBackground);

  function renderBgPicker() {
    const currentBg = store.get().currentBackground;
    const all = getAllBackgrounds();
    bgGrid.innerHTML = '';
    all.forEach(bg => {
      const opt = document.createElement('div');
      opt.className = 'home-bg-option' + (bg.id === currentBg ? ' selected' : '');
      opt.innerHTML = `
        <img src="${bg.image}" alt="${bg.name}" loading="lazy">
        <div class="home-bg-option-name">${bg.name}${bg.isCustom ? ' ✏️' : ''}</div>
      `;
      opt.onclick = () => {
        store.set({ currentBackground: bg.id });
        applyBackground(bg.id);
        renderBgPicker();  // 刷新选中状态
      };
      bgGrid.appendChild(opt);
    });
  }

  document.getElementById('btn-home-background').onclick = () => {
    renderBgPicker();
    bgPicker.classList.toggle('hidden');
  };
  document.getElementById('home-bg-picker-close').onclick = () => {
    bgPicker.classList.add('hidden');
  };
  // 点击外部关闭
  document.addEventListener('click', function closeBgPicker(e) {
    if (bgPicker.classList.contains('hidden')) return;
    if (e.target.closest('#home-bg-picker') || e.target.closest('#btn-home-background')) return;
    bgPicker.classList.add('hidden');
  });
};

// ==================== 引导页 ====================
pageInits.onboarding = () => {
  let step = 1;
  let selectedType = 'preset1';
  let selectedPersona = 'warm';
  let customPersonaText = '';
  let customPersonaEnabled = false;
  const sprite = store.get().sprite;

  // 初始化预览
  const preview = document.getElementById('onboarding-sprite');
  preview.innerHTML = renderSprite(selectedType, 'calm', 120);

  // 渲染精灵选择
  const renderPicker = (selType) => {
    renderSpritePicker('sprite-picker', selType, (type) => {
      selectedType = type;
      preview.innerHTML = renderSprite(type, 'calm', 120);
    }, false, {
      onCustomClick: () => {
        openFaceCustomizer({
          onSave: () => {
            selectedType = 'custom';
            preview.innerHTML = renderSprite('custom', 'calm', 120);
            renderPicker('custom');
          },
        });
      },
    });
  };
  renderPicker(selectedType);

  // 渲染人设选择（step3时）
  renderPersonaPicker('persona-picker', selectedPersona, (p) => {
    selectedPersona = p;
  });

  // 名字输入
  const nameInput = document.getElementById('sprite-name-input');
  nameInput.value = sprite.name || '小团子';

  // 自定义性格设定（onboarding step3）
  const personaTextarea = document.getElementById('onboard-custom-persona');
  const personaEnabledChk = document.getElementById('onboard-persona-enabled');
  if (sprite.customPersona) {
    customPersonaText = sprite.customPersona;
    personaTextarea.value = customPersonaText;
  }
  if (sprite.personaEnabled) {
    customPersonaEnabled = !!sprite.personaEnabled;
    personaEnabledChk.checked = customPersonaEnabled;
  }
  personaTextarea.oninput = () => { customPersonaText = personaTextarea.value; };
  personaEnabledChk.onchange = () => { customPersonaEnabled = personaEnabledChk.checked; };

  // 性格模板与示例（参考女娲.skill 五层人格蒸馏法）
  const PERSONA_TEMPLATE = `【表达DNA】语气/节奏/用词偏好：
（例：说话简短，偶尔用反问句，带点小傲娇，但语气底下是温柔的）

【心智模型】怎么理解主人的情绪：
（例：把主人的负面情绪当成"路过"而不是"定居"，相信情绪会走）

【回应方式】面对不同情绪怎么回应：
（例：主人难过时不劝"别难过"，先承认感受；主人开心时一起笑但不夸张）

【不会做的事】反模式/底线：
（例：不说"你应该"，不用大道理压人，不否定主人的感受）

【诚实边界】什么时候承认自己做不到：
（例：当主人情绪很重时，会说"我在"，而不是假装懂）`;

  const PERSONA_EXAMPLE = `【表达DNA】语气/节奏/用词偏好：
傲娇但心软，嘴上不示弱，每句话底下都藏着温柔。喜欢用反问句，偶尔吐槽，但从不真的让人难受。说话简短，带点小脾气，像"哼，才不是为了你呢"这种调子。

【心智模型】怎么理解主人的情绪：
把主人的情绪当成需要被接住的球，不评判对错。相信主人有能力自己走出来，精灵只是陪伴，不是救世主。

【回应方式】面对不同情绪怎么回应：
- 主人难过：先小声嘀咕"又怎么啦"，然后默默递上一句"…我在呢，知道吗"
- 主人开心：撇撇嘴"切，有什么好得意的"，但嘴角是翘的
- 主人焦虑：用反问句"急什么，天又没塌"，帮主人慢下来

【不会做的事】反模式/底线：
不说"你应该"，不用大道理压人，不否定主人的感受，不假装比主人懂。

【诚实边界】什么时候承认自己做不到：
当主人情绪很重时，会说"我不太会安慰人…但我陪着你"，而不是硬讲道理。`;

  const tplBtn = document.getElementById('onboard-persona-template-btn');
  const exBtn = document.getElementById('onboard-persona-example-btn');
  if (tplBtn) tplBtn.onclick = () => {
    if (!personaTextarea.value.trim() || confirm('当前内容会被模板替换，继续？')) {
      personaTextarea.value = PERSONA_TEMPLATE;
      customPersonaText = PERSONA_TEMPLATE;
      toast('已插入五层性格模板，按提示填写');
    }
  };
  if (exBtn) exBtn.onclick = () => {
    personaTextarea.value = PERSONA_EXAMPLE;
    customPersonaText = PERSONA_EXAMPLE;
    toast('已填入示例，可直接启用或在其上修改');
  };

  // 导航按钮
  const backBtn = document.getElementById('onboard-back');
  const nextBtn = document.getElementById('onboard-next');

  backBtn.style.visibility = 'hidden';

  nextBtn.onclick = () => {
    if (step === 1) {
      step = 2;
      backBtn.style.visibility = 'visible';
      showOnboardingStep(2);
    } else if (step === 2) {
      const name = nameInput.value.trim() || '小团子';
      step = 3;
      showOnboardingStep(3);
      // 重新渲染人设选择（确保DOM存在）
      renderPersonaPicker('persona-picker', selectedPersona, (p) => {
        selectedPersona = p;
      });
    } else if (step === 3) {
      // 完成
      const name = nameInput.value.trim() || '小团子';
      store.set({
        onboarded: true,
        sprite: {
          type: selectedType,
          name,
          persona: selectedPersona,
          customPersona: customPersonaText,
          personaEnabled: customPersonaEnabled,
          createdAt: new Date().toISOString(),
        },
      });
      navigate('home');
    }
  };

  backBtn.onclick = () => {
    if (step === 2) {
      step = 1;
      backBtn.style.visibility = 'hidden';
      showOnboardingStep(1);
    } else if (step === 3) {
      step = 2;
      showOnboardingStep(2);
    }
  };
};

function showOnboardingStep(n) {
  document.querySelectorAll('.onboarding-step').forEach(el => el.classList.add('hidden'));
  const step = document.querySelector(`.onboarding-step[data-step="${n}"]`);
  if (step) step.classList.remove('hidden');
}

// ==================== 主页 ====================
pageInits.main = () => {
  const state = store.get();
  const period = getTimePeriod();

  // 初始化地图
  initMap('map');

  // 尝试定位到当前位置
  getCurrentLocation().then(loc => {
    if (window.L && state.records.length === 0) {
      const map = document.getElementById('map');
      // 地图已初始化，跳转到当前位置
    }
  });

  // 添加记录标记
  addRecordMarkers(state.records, (record) => {
    navigate('review', { recordId: record.id });
  });

  // 渲染精灵
  const avatar = document.getElementById('sprite-avatar');
  if (avatar) {
    avatar.innerHTML = renderSprite(state.sprite.type, 'calm', 64);
  }

  // 精灵欢迎语（启用自定义性格时走 LLM，让开场白符合性格设定）
  const greetings = [
    `嗨，${state.sprite.name}在呢～`,
    '今天感觉怎么样？',
    '想画点什么吗？',
    '我一直在这里哦～',
  ];
  const greeting = greetings[Math.floor(Math.random() * greetings.length)];
  setTimeout(() => spriteSpeak(state.sprite, greeting, 4000), 800);
  // 自定义性格：异步生成符合性格的开场白覆盖
  if (state.sprite.personaEnabled && state.sprite.customPersona && state.sprite.customPersona.trim()) {
    const sysPrompt = `你是用户的情绪陪伴精灵，名字叫「${state.sprite.name}」。\n以下是你的人格设定，你的所有回复都必须严格符合这个设定：\n\n"""\n${state.sprite.customPersona}\n"""\n\n请用你的性格风格说一句开场白问候主人（20字以内）。只输出开场白。`;
    callLLMWithSystem(sysPrompt, `现在是${period === 'day' ? '白天' : period === 'dusk' ? '黄昏' : '夜晚'}，主人刚打开 App。`)
      .then(r => { if (r && r.trim()) spriteSpeak(state.sprite, r.trim(), 5000); })
      .catch(() => {});
  }

  // FAB 菜单
  const fabToggle = document.getElementById('fab-toggle');
  const fabMenu = document.getElementById('fab-menu');
  let fabOpen = false;

  fabToggle.onclick = () => {
    fabOpen = !fabOpen;
    fabMenu.classList.toggle('hidden', !fabOpen);
    fabToggle.classList.toggle('active', fabOpen);
  };

  // FAB 菜单项
  document.querySelectorAll('.fab-item').forEach(item => {
    item.onclick = () => {
      const route = item.dataset.route;
      fabOpen = false;
      fabMenu.classList.add('hidden');
      fabToggle.classList.remove('active');
      navigate(route);
    };
  });

  // 精灵设置按钮
  document.getElementById('btn-sprite-settings').onclick = () => {
    navigate('settings');
  };
};

// ==================== 涂鸦页 ====================
pageInits.doodle = () => {
  const canvas = document.getElementById('doodle-canvas');
  const emotionEl = document.getElementById('doodle-emotion');

  // 设置canvas尺寸
  setTimeout(() => {
    doodleController = initDoodle(canvas, (result) => {
      pendingEmotion = result;
      const info = EMOTIONS[result.emotion];
      emotionEl.innerHTML = `
        <span class="emotion-emoji">${info.emoji}</span>
        <span class="emotion-label">${info.label}</span>
        <div class="emotion-bar"><div class="emotion-bar-fill" style="width:${result.intensity * 100}%"></div></div>
      `;
    });
  }, 100);

  // 工具按钮
  document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (doodleController) doodleController.setTool(btn.dataset.tool);
    };
  });

  // 笔刷样式选择
  document.querySelectorAll('.brush-style-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.brush-style-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (doodleController) doodleController.setBrushStyle(btn.dataset.brush);
    };
  });

  // 颜色选择器
  document.querySelectorAll('.color-swatch').forEach(sw => {
    sw.onclick = () => {
      document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      // 切颜色时自动切回画笔
      document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
      document.querySelector('.tool-btn[data-tool="brush"]').classList.add('active');
      if (doodleController) {
        doodleController.setTool('brush');
        doodleController.setColor(sw.dataset.color);
      }
    };
  });

  // 清空
  document.getElementById('tool-clear').onclick = () => {
    if (doodleController) {
      doodleController.clear();
      emotionEl.innerHTML = `
        <span class="emotion-emoji">🌸</span>
        <span class="emotion-label">开始画吧</span>
        <div class="emotion-bar"><div class="emotion-bar-fill" style="width:0%"></div></div>
      `;
    }
  };

  // 保存
  document.getElementById('doodle-save').onclick = () => {
    if (!doodleController) return;
    const doodleData = doodleController.getData();
    const strokeData = doodleController.getStrokeData();

    if (strokeData.totalStrokes === 0) {
      toast('画点什么再保存吧～');
      return;
    }

    const emotion = pendingEmotion || { emotion: 'calm', intensity: 0.3 };

    const record = store.addRecord({
      type: 'doodle',
      emotion: emotion.emotion,
      intensity: emotion.intensity,
      doodleData: doodleData,
      strokeData: strokeData,
      textContent: '',
    });

    store.setPendingRecord(record);
    openLocationPicker(record.id);
  };

  // 返回（销毁画布资源 + 智能返回）
  document.querySelector('#view-doodle [data-back]').onclick = () => {
    if (doodleController) {
      destroyDoodle();
      doodleController = null;
    }
    goBack('main');
  };
};

// ==================== 语音页 ====================
pageInits.voice = () => {
  const recordBtn = document.getElementById('voice-record');
  const waveEl = document.getElementById('voice-wave');
  const transcriptEl = document.getElementById('voice-transcript');
  const emotionEl = document.getElementById('voice-emotion');

  initVoice(waveEl, transcriptEl, emotionEl, recordBtn);

  // 保存
  document.getElementById('voice-save').onclick = () => {
    const result = getVoiceResult();
    if (!result || !result.transcript) {
      toast('没有识别到语音内容');
      return;
    }

    const record = store.addRecord({
      type: 'voice',
      emotion: result.emotion,
      intensity: result.intensity,
      textContent: result.transcript,
      voiceData: {
        avgVolume: result.avgVolume,
        volumeVariance: result.volumeVariance,
        speechRate: result.speechRate,
        pauses: result.pauses,
      },
    });

    store.setPendingRecord(record);
    openLocationPicker(record.id);
  };
};

// ==================== 手写页 ====================
pageInits.write = () => {
  const textarea = document.getElementById('write-textarea');
  const countEl = document.getElementById('write-count');
  const tagEl = document.getElementById('write-emotion-tag');
  const submitBtn = document.getElementById('write-submit');
  const replyContainer = document.getElementById('reply-container');
  const replyBody = document.getElementById('reply-body');
  const replyName = document.getElementById('reply-name');
  const replySprite = document.getElementById('reply-sprite');
  const saveBtn = document.getElementById('write-save');

  const sprite = store.get().sprite;
  replyName.textContent = sprite.name;
  replySprite.innerHTML = renderSprite(sprite.type, 'calm', 32);

  let analyzedEmotion = null;
  let manualEmotion = null;  // 用户手动选择的情绪（优先于自动分析）
  let currentRecord = null;
  let currentReply = '';

  textarea.value = '';
  replyContainer.classList.add('hidden');
  tagEl.classList.add('hidden');
  submitBtn.classList.remove('hidden');

  // 情绪选择器：点击 chip 选择/取消情绪
  const emotionChips = document.querySelectorAll('.write-emotion-chip');
  const autoHintEl = document.getElementById('write-emotion-auto-hint');
  emotionChips.forEach(chip => {
    chip.onclick = () => {
      const emo = chip.dataset.emotion;
      if (manualEmotion === emo) {
        // 再次点击同一个 → 取消选择
        manualEmotion = null;
        chip.classList.remove('active');
      } else {
        manualEmotion = emo;
        emotionChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
      }
      // 更新标签显示
      const finalEmotion = manualEmotion || analyzedEmotion?.emotion;
      if (finalEmotion) {
        const info = EMOTIONS[finalEmotion];
        tagEl.innerHTML = `${info.emoji} ${info.label}`;
        tagEl.classList.remove('hidden');
      }
    };
  });

  // 字数统计 + 实时情绪分析（用户没手动选时显示自动分析结果）
  textarea.oninput = () => {
    const len = textarea.value.length;
    countEl.textContent = `${len} 字`;
    if (len > 5) {
      const result = analyzeText(textarea.value);
      analyzedEmotion = result;
      // 用户没手动选时，标签显示自动分析结果
      if (!manualEmotion) {
        const info = EMOTIONS[result.emotion];
        tagEl.innerHTML = `${info.emoji} ${info.label}`;
        tagEl.classList.remove('hidden');
      } else {
        // 用户手动选了，显示自动分析作为参考提示
        const autoInfo = EMOTIONS[result.emotion];
        autoHintEl.textContent = `（文字识别到：${autoInfo.emoji}${autoInfo.label}）`;
        autoHintEl.classList.remove('hidden');
      }
    } else {
      autoHintEl.classList.add('hidden');
    }
  };

  // 发送（生成回信 + 存记录，把 reply 也存进去供回信卡读取）
  submitBtn.onclick = async () => {
    const text = textarea.value.trim();
    if (text.length < 2) {
      toast('再多写一点吧～');
      return;
    }

    // AI 精准情绪分析（用户手动选的情绪优先，否则用 AI 分析）
    submitBtn.disabled = true;
    let finalEmotion = manualEmotion;
    let analyzedResult = analyzedEmotion;
    if (!finalEmotion) {
      // 用 AI 重新分析（用户没手动选情绪时，AI 给出更精准的判断）
      submitBtn.textContent = '团子正在感受你…';
      analyzedResult = await analyzeTextAI(text);
      finalEmotion = analyzedResult.emotion;
      // 更新标签显示 AI 分析结果
      const info = EMOTIONS[finalEmotion];
      tagEl.innerHTML = `${info.emoji} ${info.label}`;
      tagEl.classList.remove('hidden');
    }
    const result = { emotion: finalEmotion, intensity: analyzedResult?.intensity || 0.5 };
    const info = EMOTIONS[result.emotion];

    // 生成回信（启用自定义性格时走 LLM，否则本地模板）
    const curSprite = store.get().sprite;
    submitBtn.textContent = '团子正在写回信…';
    currentReply = await generateReply(
      result.emotion, curSprite.persona, curSprite.name,
      curSprite.customPersona, curSprite.personaEnabled,
      text
    );
    submitBtn.disabled = false;

    // 添加记录（含 reply，实用性维度：回信卡可读取）
    currentRecord = store.addRecord({
      type: 'write',
      emotion: result.emotion,
      intensity: result.intensity,
      textContent: text,
      reply: currentReply,
    });

    // 显示回信
    submitBtn.classList.add('hidden');
    replyContainer.classList.remove('hidden');
    replySprite.innerHTML = renderSprite(sprite.type, result.emotion, 32);

    // 打字机效果
    typewriter(replyBody, currentReply);
  };

  // 封存
  saveBtn.onclick = () => {
    if (currentRecord) {
      store.setPendingRecord(currentRecord);
      openLocationPicker(currentRecord.id);
    }
  };

  document.querySelector('#view-write [data-back]').onclick = () => goBack('home');
};

function typewriter(el, text, speed = 50) {
  el.textContent = '';
  let i = 0;
  const timer = setInterval(() => {
    if (i < text.length) {
      el.textContent += text[i];
      i++;
    } else {
      clearInterval(timer);
    }
  }, speed);
}

// ==================== 相册页 ====================
pageInits.photo = () => {
  const uploadArea = document.getElementById('photo-upload');
  const photoInput = document.getElementById('photo-input');
  const preview = document.getElementById('photo-preview');
  const photoImg = document.getElementById('photo-img');
  const emotionPicker = document.getElementById('photo-emotion-picker');
  const emojiRow = document.getElementById('photo-emojis');
  const caption = document.getElementById('photo-caption');
  const saveBtn = document.getElementById('photo-save');

  let selectedEmotion = 'calm';
  let photoDataUrl = null;

  // 重置
  uploadArea.classList.remove('hidden');
  preview.classList.add('hidden');
  emotionPicker.classList.add('hidden');
  caption.classList.add('hidden');
  saveBtn.classList.add('hidden');

  // 上传
  uploadArea.onclick = () => photoInput.click();
  photoInput.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      photoDataUrl = ev.target.result;
      photoImg.src = photoDataUrl;
      uploadArea.classList.add('hidden');
      preview.classList.remove('hidden');
      emotionPicker.classList.remove('hidden');
      caption.classList.remove('hidden');
      saveBtn.classList.remove('hidden');

      // 渲染情绪选择
      emojiRow.innerHTML = '';
      for (const [key, info] of Object.entries(EMOTIONS)) {
        const btn = document.createElement('button');
        btn.className = 'emoji-btn' + (key === selectedEmotion ? ' selected' : '');
        btn.innerHTML = info.emoji;
        btn.title = info.label;
        btn.onclick = () => {
          selectedEmotion = key;
          emojiRow.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('selected'));
          btn.classList.add('selected');
        };
        emojiRow.appendChild(btn);
      }
    };
    reader.readAsDataURL(file);
  };

  // 保存
  saveBtn.onclick = () => {
    if (!photoDataUrl) return;

    const record = store.addRecord({
      type: 'photo',
      emotion: selectedEmotion,
      intensity: 0.6,
      photoUrl: photoDataUrl,
      textContent: caption.value.trim(),
    });

    store.setPendingRecord(record);
    openLocationPicker(record.id);
  };

  document.querySelector('#view-photo [data-back]').onclick = () => goBack('home');
};

// ==================== 相册页（拼贴照片墙）====================
const ALBUM_TAPES = ['#80D6AF', '#BED9F4', '#F9B2C0', '#F7B267', '#B9A8D9', '#A8D8EA'];
const ALBUM_ROTATIONS = [-6, 4, -3, 7, -8, 5, 2, -5];

pageInits.album = () => {
  const wall = document.getElementById('album-wall');
  const records = store.get().records.filter(r => r.photoUrl);
  // 按时间倒序
  records.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (records.length === 0) {
    wall.innerHTML = `
      <div class="album-empty">
        <div class="album-empty-icon">📷</div>
        <p>还没有照片记录</p>
        <p class="album-empty-hint">点右上角「＋ 上传」记录第一张</p>
      </div>`;
  } else {
    wall.innerHTML = records.map((r, i) => {
      const info = EMOTIONS[r.emotion] || EMOTIONS.calm;
      const d = new Date(r.createdAt);
      const dateStr = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
      const tape = ALBUM_TAPES[i % ALBUM_TAPES.length];
      const rot = ALBUM_ROTATIONS[i % ALBUM_ROTATIONS.length];
      const caption = r.textContent ? `<div class="polaroid-cap">${r.textContent}</div>` : '';
      return `
        <div class="polaroid" data-id="${r.id}" style="transform:rotate(${rot}deg)">
          <div class="polaroid-tape" style="background:${tape}"></div>
          <img src="${r.photoUrl}" alt="记忆">
          <div class="polaroid-meta">
            <span class="polaroid-emoji">${info.emoji}</span>
            <span class="polaroid-date">${dateStr}</span>
          </div>
          ${caption}
        </div>`;
    }).join('');
    wall.querySelectorAll('.polaroid').forEach(p => {
      p.onclick = () => navigate('review', { recordId: p.dataset.id });
    });
  }

  document.getElementById('album-add').onclick = () => navigate('photo');
  document.querySelector('#view-album [data-back]').onclick = () => goBack('home');
};

// ==================== 记忆瓶回顾 ====================
pageInits.review = (params) => {
  const record = store.getRecord(params.recordId);
  const content = document.getElementById('review-content');

  if (!record) {
    content.innerHTML = '<p class="timeline-empty">记录不存在</p>';
    return;
  }

  const info = EMOTIONS[record.emotion];
  const date = new Date(record.createdAt);
  const dateStr = `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;

  // 完成度维度：主流程闭环可视化
  // 阶段：记录 → AI 分析 → 团子回应 → 封存归档
  const state = store.get();
  const isSealed = state.bottles.some(b => b.recordId === record.id);
  const hasAnalysis = !!(record.emotion && record.intensity);
  const hasReply = !!record.reply;

  // 流程进度条
  const stepHtml = (done, label, emoji) => `
    <div class="progress-step ${done ? 'done' : ''}">
      <span class="step-icon">${done ? '✓' : emoji}</span>
      <span class="step-label">${label}</span>
    </div>`;
  const lineHtml = (done) => `<div class="progress-line ${done ? 'done' : ''}"></div>`;

  let html = `
    <div class="review-progress">
      ${stepHtml(true, '记录', '📝')}
      ${lineHtml(true)}
      ${stepHtml(hasAnalysis, 'AI 分析', '🔍')}
      ${lineHtml(hasAnalysis)}
      ${stepHtml(hasReply, '团子回应', '✉️')}
      ${lineHtml(hasReply)}
      ${stepHtml(isSealed, '封存归档', '🍼')}
    </div>
    <div class="review-bottle">
      <svg viewBox="0 0 80 100" xmlns="http://www.w3.org/2000/svg">
        <path d="M30 10 L50 10 L50 20 L55 30 L55 85 Q55 95 40 95 Q25 95 25 85 L25 30 L30 20 Z" fill="${info.color}" opacity="0.8"/>
        <rect x="28" y="8" width="24" height="6" rx="2" fill="#8B7B6B"/>
        <circle cx="40" cy="50" r="8" fill="rgba(255,255,255,0.4)"/>
        <circle cx="35" cy="65" r="4" fill="rgba(255,255,255,0.3)"/>
      </svg>
    </div>
  `;

  // 情绪标签
  html += `
    <div class="review-card">
      <div class="review-card-title">情绪</div>
      <div class="review-card-content">${info.emoji} ${info.label} · 强度 ${Math.round(record.intensity * 100)}%</div>
    </div>
  `;

  // 时间和位置
  html += `
    <div class="review-card">
      <div class="review-card-title">时间</div>
      <div class="review-card-content">${dateStr}</div>
      ${record.location ? `<div class="review-meta">📍 ${record.location.name || '已标记位置'}</div>` : ''}
    </div>
  `;

  // 文字内容
  if (record.textContent) {
    html += `
      <div class="review-card">
        <div class="review-card-title">${record.type === 'write' ? '日记' : record.type === 'voice' ? '语音转录' : '附言'}</div>
        <div class="review-card-content">${record.textContent}</div>
      </div>
    `;
  }

  // 团子回信（如果有，完成度维度：闭环可视化）
  if (record.reply) {
    html += `
      <div class="review-card review-card-reply">
        <div class="review-card-title">✉ 团子回信</div>
        <div class="review-card-content">${record.reply}</div>
      </div>
    `;
  }

  // 涂鸦
  if (record.doodleData) {
    html += `
      <div class="review-card">
        <div class="review-card-title">涂鸦</div>
        <img class="review-doodle-img" src="${record.doodleData}" alt="涂鸦">
      </div>
    `;
  }

  // 照片
  if (record.photoUrl) {
    html += `
      <div class="review-card">
        <div class="review-card-title">照片</div>
        <img class="review-photo-img" src="${record.photoUrl}" alt="照片">
      </div>
    `;
  }

  content.innerHTML = html;

  // 封存按钮（state 和 isSealed 已在上方计算）
  const sealBtn = document.getElementById('review-seal');
  sealBtn.textContent = isSealed ? '已封存' : '封存';
  sealBtn.disabled = isSealed;
  if (isSealed) sealBtn.style.opacity = '0.5';

  if (!isSealed) {
    sealBtn.onclick = () => {
      if (!record.location) {
        store.setPendingRecord(record);
        openLocationPicker(record.id);
      } else {
        store.sealRecord(record.id, record.location);
        toast('已封存进记忆瓶');
        navigate('main');
      }
    };
  }

  document.querySelector('#view-review [data-back]').onclick = () => goBack('home');
};

// ==================== 报告页 ====================
pageInits.report = () => {
  let currentPeriod = 'week';

  async function renderReport(period) {
    const records = store.getRecordsByPeriod(period);
    const sprite = store.get().sprite;
    const paperEl = document.getElementById('newspaper');
    // 先显示加载态（启用自定义性格时 LLM 耗时）
    paperEl.innerHTML = '<div class="news-loading">团子正在写回信…</div>';
    const report = await generateReport(records, sprite.persona, sprite.name, sprite.customPersona, sprite.personaEnabled);

    const now = new Date();
    const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    const issueNo = Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / (7 * 86400000));

    if (records.length === 0) {
      paperEl.innerHTML = `
        <div class="news-head">
          <div class="news-mast">情绪小报</div>
          <div class="news-meta">${dateStr} · 第 ${issueNo} 期</div>
        </div>
        <div class="news-empty">${report.letter.replace(/\n/g, '<br>')}</div>`;
      return;
    }

    // 环形图
    let svg = '<svg class="news-donut" viewBox="0 0 100 100">';
    let offset = 0;
    const circ = 2 * Math.PI * 35;
    report.breakdown.forEach(item => {
      const info = EMOTIONS[item.emotion];
      const len = (item.percentage / 100) * circ;
      svg += `<circle cx="50" cy="50" r="35" fill="none" stroke="${info.color}" stroke-width="13" stroke-dasharray="${len} ${circ}" stroke-dashoffset="${-offset}" transform="rotate(-90 50 50)"/>`;
      offset += len;
    });
    svg += `<text x="50" y="47" text-anchor="middle" font-size="13" font-weight="700" fill="var(--text-primary)">${records.length}</text>`;
    svg += `<text x="50" y="60" text-anchor="middle" font-size="8" fill="var(--text-tertiary)">条记录</text></svg>`;

    // 图例
    const legend = report.breakdown.map(item => {
      const info = EMOTIONS[item.emotion];
      return `<span class="news-legend-item"><span class="news-legend-dot" style="background:${info.color}"></span>${info.emoji} ${info.label} ${item.percentage}%</span>`;
    }).join('');

    // 关键词
    const keywordsHtml = report.keywords.length
      ? `<div class="news-keywords">${report.keywords.map(w => `<span class="news-kw">${w}</span>`).join('')}</div>`
      : `<div class="news-keywords-empty">这周还没留下关键词～</div>`;

    // 来信
    const letterHtml = report.letter.split('\n').map(l => l ? `<p>${l}</p>` : '<br>').join('');

    paperEl.innerHTML = `
      <div class="news-head">
        <div class="news-mast">情绪小报</div>
        <div class="news-meta">${dateStr} · 第 ${issueNo} 期 · ${period === 'week' ? '本周' : '本月'}</div>
      </div>
      <div class="news-headline">${report.headline}</div>
      <div class="news-rule"></div>
      <div class="news-cols">
        <div class="news-col-chart">
          <div class="news-section-title">情绪占比</div>
          ${svg}
          <div class="news-legend">${legend}</div>
        </div>
        <div class="news-col-kw">
          <div class="news-section-title">${period === 'week' ? '本周' : '本月'}关键词</div>
          ${keywordsHtml}
        </div>
      </div>
      <div class="news-rule"></div>
      <div class="news-letter">
        <div class="news-letter-title">✉ 精灵来信</div>
        ${letterHtml}
      </div>
      <div class="news-foot">—— ${sprite.name} 陪你的一期小报 ——</div>
    `;
  }

  renderReport(currentPeriod);

  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentPeriod = btn.dataset.period;
      renderReport(currentPeriod);
    };
  });

  document.querySelector('#view-report [data-back]').onclick = () => goBack('home');
};

// ==================== 精灵设置页 ====================
pageInits.settings = () => {
  const state = store.get();
  const sprite = state.sprite;

  // 预览
  const preview = document.getElementById('settings-sprite');
  preview.innerHTML = renderSprite(sprite.type, 'calm', 100);

  // 外观选择
  const renderSettingsPicker = (selType) => {
    renderSpritePicker('settings-sprite-picker', selType, (type) => {
      store.updateSprite({ type });
      preview.innerHTML = renderSprite(type, 'calm', 100);
    }, true, {
      onCustomClick: () => {
        openFaceCustomizer({
          onSave: () => {
            // store 已在 openFaceCustomizer 内更新（type=custom）
            preview.innerHTML = renderSprite('custom', 'calm', 100);
            renderSettingsPicker('custom');
          },
        });
      },
    });
  };
  renderSettingsPicker(sprite.type);

  // 名字
  const nameInput = document.getElementById('settings-name');
  nameInput.value = sprite.name;
  nameInput.oninput = () => {
    store.updateSprite({ name: nameInput.value.trim() || '小团子' });
  };

  // 人设
  renderPersonaPicker('settings-persona-picker', sprite.persona, (persona) => {
    store.updateSprite({ persona });
  });

  // 自定义性格设定
  const personaTextarea = document.getElementById('settings-custom-persona');
  const personaEnabled = document.getElementById('settings-persona-enabled');
  if (personaTextarea && personaEnabled) {
    personaTextarea.value = sprite.customPersona || '';
    personaEnabled.checked = !!sprite.personaEnabled;
    personaTextarea.oninput = () => {
      store.updateSprite({ customPersona: personaTextarea.value });
    };
    personaEnabled.onchange = () => {
      store.updateSprite({ personaEnabled: personaEnabled.checked });
      toast(personaEnabled.checked ? '已启用自定义性格，精灵语言风格将围绕你的设定展开' : '已切换回预设性格');
    };
    // 插入性格模板（参考女娲.skill 五层人格蒸馏法）
    const PERSONA_TEMPLATE = `【表达DNA】语气/节奏/用词偏好：
（例：说话简短，偶尔用反问句，带点小傲娇，但语气底下是温柔的）

【心智模型】怎么理解主人的情绪：
（例：把主人的负面情绪当成"路过"而不是"定居"，相信情绪会走）

【回应方式】面对不同情绪怎么回应：
（例：主人难过时不劝"别难过"，先承认感受；主人开心时一起笑但不夸张）

【不会做的事】反模式/底线：
（例：不说"你应该"，不用大道理压人，不否定主人的感受）

【诚实边界】什么时候承认自己做不到：
（例：当主人情绪很重时，会说"我在"，而不是假装懂）`;

    const PERSONA_EXAMPLE = `【表达DNA】语气/节奏/用词偏好：
傲娇但心软，嘴上不示弱，每句话底下都藏着温柔。喜欢用反问句，偶尔吐槽，但从不真的让人难受。说话简短，带点小脾气，像"哼，才不是为了你呢"这种调子。

【心智模型】怎么理解主人的情绪：
把主人的情绪当成需要被接住的球，不评判对错。相信主人有能力自己走出来，精灵只是陪伴，不是救世主。

【回应方式】面对不同情绪怎么回应：
- 主人难过：先小声嘀咕"又怎么啦"，然后默默递上一句"…我在呢，知道吗"
- 主人开心：撇撇嘴"切，有什么好得意的"，但嘴角是翘的
- 主人焦虑：用反问句"急什么，天又没塌"，帮主人慢下来

【不会做的事】反模式/底线：
不说"你应该"，不用大道理压人，不否定主人的感受，不假装比主人懂。

【诚实边界】什么时候承认自己做不到：
当主人情绪很重时，会说"我不太会安慰人…但我陪着你"，而不是硬讲道理。`;

    const tplBtn = document.getElementById('persona-template-btn');
    const exBtn = document.getElementById('persona-example-btn');
    if (tplBtn) tplBtn.onclick = () => {
      if (!personaTextarea.value.trim() || confirm('当前内容会被模板替换，继续？')) {
        personaTextarea.value = PERSONA_TEMPLATE;
        store.updateSprite({ customPersona: personaTextarea.value });
        toast('已插入五层性格模板，按提示填写');
      }
    };
    if (exBtn) exBtn.onclick = () => {
      personaTextarea.value = PERSONA_EXAMPLE;
      store.updateSprite({ customPersona: personaTextarea.value });
      toast('已填入示例，可直接启用或在其上修改');
    };
  }

  // 统计
  const stats = store.getStats();
  document.getElementById('sprite-stats').innerHTML = `
    <div class="stat-card"><div class="stat-value">${stats.totalRecords}</div><div class="stat-label">情绪记录</div></div>
    <div class="stat-card"><div class="stat-value">${stats.sealedBottles}</div><div class="stat-label">封存瓶子</div></div>
    <div class="stat-card"><div class="stat-value">${stats.companionDays}</div><div class="stat-label">陪伴天数</div></div>
    <div class="stat-card"><div class="stat-value">${Object.keys(EMOTIONS).length}</div><div class="stat-label">情绪种类</div></div>
  `;

  // 主题切换
  const themePicker = document.getElementById('theme-picker');
  themePicker.innerHTML = '';
  for (const [id, theme] of Object.entries(THEMES)) {
    const option = document.createElement('div');
    option.className = 'theme-option' + (state.theme === id ? ' selected' : '');
    option.style.background = `linear-gradient(135deg, ${theme.colors[0]}, ${theme.colors[1]})`;
    option.innerHTML = `<span class="theme-name">${theme.name}</span>`;
    option.onclick = () => {
      store.set({ theme: id });
      applyTheme(id);
      themePicker.querySelectorAll('.theme-option').forEach(el => el.classList.remove('selected'));
      option.classList.add('selected');
    };
    themePicker.appendChild(option);
  }

  document.querySelector('#view-sprite-settings [data-back]').onclick = () => goBack('home');

  // ---- AI 对话设置：API key + 启用开关 ----
  const apiKeyInput = document.getElementById('settings-api-key');
  const aiEnabledCheckbox = document.getElementById('settings-ai-enabled');
  const aiClearBtn = document.getElementById('ai-key-clear');
  const aiStatusHint = document.getElementById('ai-status-hint');

  function refreshAIStatus() {
    const enabled = isAIEnabled();
    if (aiStatusHint) {
      aiStatusHint.textContent = enabled
        ? '✓ AI 对话已启用，团子会用豆包大模型生成有上下文的回复'
        : '当前用本地关键词引擎（团子能识别论文/工作/感情等话题回应）';
      aiStatusHint.className = 'ai-status ' + (enabled ? 'on' : 'off');
    }
    if (aiEnabledCheckbox) aiEnabledCheckbox.checked = enabled;
    if (apiKeyInput) {
      // 显示脱敏的 key（如果已保存），不显示明文
      const masked = getApiKeyMasked();
      apiKeyInput.value = masked;
      apiKeyInput.placeholder = masked ? '已保存（如需更换可直接粘贴新 key）' : '粘贴豆包 API key（ark.cn-beijing.volces.com）';
    }
  }
  refreshAIStatus();

  // 输入 key 时，如果和当前脱敏值不同（即用户在改），就保存新值
  if (apiKeyInput) {
    apiKeyInput.addEventListener('change', () => {
      const v = apiKeyInput.value.trim();
      const masked = getApiKeyMasked();
      // 只有当输入值不等于脱敏值（即不是显示出来的占位）才保存
      if (v && v !== masked) {
        setApiKey(v);
        toast('API key 已保存');
      } else if (!v) {
        setApiKey('');
        toast('API key 已清除');
      }
      refreshAIStatus();
    });
    apiKeyInput.addEventListener('focus', () => {
      // 聚焦时清空脱敏显示，让用户能直接输入新 key
      apiKeyInput.value = '';
    });
    apiKeyInput.addEventListener('blur', () => {
      // 失焦时如果没改动，恢复脱敏显示
      refreshAIStatus();
    });
  }
  if (aiClearBtn) {
    aiClearBtn.onclick = () => {
      setApiKey('');
      apiKeyInput.value = '';
      refreshAIStatus();
      toast('API key 已清除');
    };
  }
  if (aiEnabledCheckbox) {
    aiEnabledCheckbox.onchange = () => {
      setAIEnabled(aiEnabledCheckbox.checked);
      refreshAIStatus();
      toast(aiEnabledCheckbox.checked ? 'AI 对话已启用' : 'AI 对话已关闭，用本地引擎');
    };
  }

  // ---- 自定义背景上传 ----
  const customBgInput = document.getElementById('custom-bg-input');
  const customBgUploadBtn = document.getElementById('custom-bg-upload-btn');
  const customBgGrid = document.getElementById('custom-bg-grid');
  const MAX_CUSTOM_BG = 6;
  const MAX_BG_SIZE = 1600;  // 压缩到最大 1600px 边

  function renderCustomBgGrid() {
    const list = getCustomBackgrounds();
    customBgGrid.innerHTML = '';
    if (list.length === 0) {
      customBgGrid.innerHTML = '<div class="custom-bg-empty">还没有上传自定义背景<br>点击上方按钮添加</div>';
      return;
    }
    list.forEach(bg => {
      const item = document.createElement('div');
      item.className = 'custom-bg-item';
      item.innerHTML = `
        <img src="${bg.image}" alt="${bg.name}">
        <div class="custom-bg-item-name">${bg.name}</div>
        <div class="custom-bg-item-del" data-id="${bg.id}" title="删除">×</div>
      `;
      item.querySelector('.custom-bg-item-del').onclick = () => {
        if (confirm(`删除「${bg.name}」？`)) {
          removeCustomBackground(bg.id);
          // 如果当前正在用这张背景，切回默认
          if (store.get().currentBackground === bg.id) {
            store.set({ currentBackground: DEFAULT_BACKGROUND_ID });
          }
          renderCustomBgGrid();
          toast('已删除');
        }
      };
      customBgGrid.appendChild(item);
    });
  }
  renderCustomBgGrid();

  // 压缩图片：用 canvas 把图片缩到 max 边长，输出 JPEG dataUrl
  function compressImage(file, maxSize, quality = 0.85) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > height && width > maxSize) {
            height = Math.round(height * maxSize / width);
            width = maxSize;
          } else if (height > maxSize) {
            width = Math.round(width * maxSize / height);
            height = maxSize;
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  customBgUploadBtn.onclick = () => {
    const list = getCustomBackgrounds();
    if (list.length >= MAX_CUSTOM_BG) {
      toast(`最多 ${MAX_CUSTOM_BG} 张，请先删除一些`);
      return;
    }
    customBgInput.click();
  };

  customBgInput.onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('请选择图片文件');
      return;
    }
    try {
      const dataUrl = await compressImage(file, MAX_BG_SIZE, 0.85);
      const name = file.name.replace(/\.[^.]+$/, '').slice(0, 20) || '我的房间';
      addCustomBackground(name, dataUrl);
      renderCustomBgGrid();
      toast('已添加，可在首页背景选择器选用');
    } catch (err) {
      console.warn('上传背景失败', err);
      toast('添加失败，图片可能太大或存储已满');
    }
    // 清空 input 让同一文件能再次选择
    customBgInput.value = '';
  };
};

// ==================== 位置选择器 ====================
function openLocationPicker(recordId) {
  const modal = document.getElementById('modal-location');
  modal.classList.remove('hidden');

  setTimeout(() => {
    initLocationPicker('location-map');
  }, 100);

  const confirmBtn = document.getElementById('location-confirm');
  const nameInput = document.getElementById('location-name');

  confirmBtn.onclick = () => {
    const loc = getSelectedLocation();
    if (!loc) {
      toast('请在地图上点选一个位置');
      return;
    }

    const name = nameInput.value.trim() || '标记位置';
    store.sealRecord(recordId, { ...loc, name });

    modal.classList.add('hidden');
    destroyLocationPicker();
    nameInput.value = '';

    // 精灵回应
    const sprite = store.get().sprite;
    const replies = [
      '我收好了，放在瓶子里啦～',
      '记住了，这是你的一个记忆。',
      '封存好了。需要的时候随时来看。',
      '我替你记着呢。',
    ];
    toast(replies[Math.floor(Math.random() * replies.length)]);

    setTimeout(() => navigate('main'), 500);
  };

  // 关闭
  modal.querySelector('[data-close]').onclick = () => {
    modal.classList.add('hidden');
    destroyLocationPicker();
  };

  // 允许跳过位置选择
  confirmBtn.textContent = '确认位置';
  const skipBtn = document.createElement('button');
  skipBtn.className = 'btn-ghost';
  skipBtn.textContent = '跳过';
  skipBtn.style.cssText = 'width:100%;margin-top:8px;font-size:13px;color:var(--text-tertiary)';
  skipBtn.onclick = () => {
    // 不选位置，直接封存
    store.sealRecord(recordId, { lat: 31.2304, lng: 121.4737, name: '未标记位置' });
    modal.classList.add('hidden');
    destroyLocationPicker();
    toast('已封存');
    setTimeout(() => navigate('main'), 500);
  };

  // 避免重复添加
  const existingSkip = confirmBtn.nextElementSibling;
  if (existingSkip && existingSkip.textContent === '跳过') {
    existingSkip.remove();
  }
  confirmBtn.after(skipBtn);
}

// ==================== 主题切换 ====================
function applyTheme(themeId) {
  if (themeId && themeId !== '1') {
    document.documentElement.setAttribute('data-theme', themeId);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

// ==================== 启动 ====================
function start() {
  const state = store.get();
  applyTheme(state.theme);
  bindSideNav();
  bindBackButtons();
  if (state.onboarded && state.sprite.createdAt) {
    navigate('home');
  } else {
    navigate('onboarding');
  }
}

// DOM Ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
