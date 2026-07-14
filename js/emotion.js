/**
 * emotion.js — 情绪识别引擎
 * 支持笔触分析、文本分析、语音分析三种输入
 * Demo阶段使用本地规则引擎，可无缝切换到LLM
 */

import { EMOTIONS } from './store.js';

// ---- 笔触情绪识别 ----
// 基于笔触速度、压力、方差推断情绪
export function analyzeStrokeData(strokeData) {
  if (!strokeData || strokeData.totalStrokes === 0) {
    return { emotion: 'calm', intensity: 0.3, confidence: 0.5 };
  }

  const { avgSpeed, avgPressure, speedVariance, totalStrokes, duration } = strokeData;

  // 高速 + 高方差 + 多笔画 → 焦虑/愤怒
  // 低速 + 低压力 → 悲伤/无力
  // 中速 + 中压 → 平静
  // 高压 + 中速 → 喜悦（用力但稳定）

  let emotion = 'calm';
  let intensity = 0.5;

  if (avgSpeed > 0.7 && speedVariance > 0.3) {
    // 快速且不稳定 → 焦虑或愤怒
    emotion = avgPressure > 0.6 ? 'anger' : 'anxiety';
    intensity = Math.min(0.95, avgSpeed * 0.8 + speedVariance * 0.5);
  } else if (avgSpeed < 0.25 && avgPressure < 0.3) {
    // 慢速且轻 → 悲伤或无力
    emotion = totalStrokes < 5 ? 'fatigue' : 'sadness';
    intensity = Math.min(0.85, (1 - avgSpeed) * 0.6 + (1 - avgPressure) * 0.4);
  } else if (avgPressure > 0.65 && avgSpeed > 0.4 && avgSpeed < 0.7) {
    // 用力但稳定 → 喜悦
    emotion = 'joy';
    intensity = Math.min(0.8, avgPressure * 0.7 + avgSpeed * 0.3);
  } else if (avgSpeed < 0.35 && avgPressure > 0.5) {
    // 慢但用力 → 愤怒（压抑的）
    emotion = 'anger';
    intensity = Math.min(0.75, avgPressure * 0.6);
  } else {
    emotion = 'calm';
    intensity = Math.min(0.6, 0.4 + avgPressure * 0.2);
  }

  return { emotion, intensity: Number(intensity.toFixed(2)), confidence: 0.75 };
}

// ---- 文本情绪识别（本地关键词引擎 + 否定词处理）----
const EMOTION_KEYWORDS = {
  joy: ['开心', '高兴', '快乐', '哈哈', '好玩', '喜欢', '棒', '赞', '幸福', '满足', '笑', '兴奋', '期待', '美好', '幸运', '感激', '温暖'],
  sadness: ['难过', '伤心', '哭', '悲伤', '失落', '孤独', '想念', '想家', '遗憾', '心痛', '不舍', '寂寞', '空虚', '低落', '抑郁', '绝望', '不开心', '不高兴', '不快乐', '郁闷', '烦闷', 'emo'],
  anger: ['生气', '愤怒', '烦', '讨厌', '气死', '受够', '无语', '恶心', '垃圾', '可恶', '凭什么', '不公平', '被欺负', '被坑', '被骗'],
  anxiety: ['焦虑', '紧张', '担心', '害怕', '恐惧', '不安', '压力', '慌', '怕', '不敢', '犹豫', '纠结', '迷茫', '不知道', '万一'],
  calm: ['平静', '还好', '一般', '没事', '正常', '放松', '舒服', '安静', '惬意', '自在', '平淡'],
  fatigue: ['累', '疲惫', '困', '撑不住', '无力', '没劲', '不想动', '倦', '耗尽', '心累', '身心俱疲', '想休息'],
};

// 否定词：出现在正面情绪词前时，翻转为负面情绪
const NEGATIONS = ['不', '没', '别', '不太', '没有', '不怎么', '并不', '不是'];
// 正面→负面 翻转映射
const FLIP_MAP = { joy: 'sadness', calm: 'sadness', fatigue: 'fatigue' };

export function analyzeText(text) {
  if (!text || text.trim().length < 2) {
    return { emotion: 'calm', intensity: 0.3, confidence: 0.4 };
  }

  const scores = {};
  let totalHits = 0;

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS)) {
    let score = 0;
    for (const kw of keywords) {
      if (text.includes(kw)) {
        // 检查前面是否有否定词（往前看 1-3 个字）
        const idx = text.indexOf(kw);
        const before = text.slice(Math.max(0, idx - 3), idx);
        const isNegated = NEGATIONS.some(neg => before.endsWith(neg));
        if (isNegated && FLIP_MAP[emotion]) {
          // 否定正面情绪 → 加到翻转后的负面情绪
          const flipped = FLIP_MAP[emotion];
          scores[flipped] = (scores[flipped] || 0) + (kw.length >= 3 ? 2 : 1);
          totalHits += kw.length >= 3 ? 2 : 1;
        } else {
          score += kw.length >= 3 ? 2 : 1;
        }
      }
    }
    scores[emotion] = (scores[emotion] || 0) + score;
    totalHits += score;
  }

  if (totalHits === 0) {
    // 没有关键词命中，用文本长度和标点推断
    const exclamations = (text.match(/！|!/g) || []).length;
    const ellipsis = (text.match(/…|\.\.\./g) || []).length;
    const questionMarks = (text.match(/？|\?/g) || []).length;

    if (exclamations >= 2) return { emotion: 'anger', intensity: 0.6, confidence: 0.5 };
    if (ellipsis >= 2) return { emotion: 'sadness', intensity: 0.5, confidence: 0.5 };
    if (questionMarks >= 2) return { emotion: 'anxiety', intensity: 0.5, confidence: 0.5 };
    return { emotion: 'calm', intensity: 0.3, confidence: 0.4 };
  }

  // 找到得分最高的情绪
  let topEmotion = 'calm';
  let topScore = 0;
  for (const [emotion, score] of Object.entries(scores)) {
    if (score > topScore) { topScore = score; topEmotion = emotion; }
  }

  const intensity = Math.min(0.95, 0.4 + (topScore / Math.max(totalHits, 1)) * 0.5);
  const confidence = Math.min(0.9, 0.5 + totalHits * 0.1);

  return { emotion: topEmotion, intensity: Number(intensity.toFixed(2)), confidence: Number(confidence.toFixed(2)) };
}

// ---- AI 情绪分析（精准版，调用 LLM）----
// 跟本地 analyzeText 不同：本地版是关键词匹配（快但粗糙），AI 版能理解上下文（精准但慢）
// 用于写一写提交时的精准情绪识别
export async function analyzeTextAI(text) {
  if (!text || text.trim().length < 2) {
    return { emotion: 'calm', intensity: 0.3, confidence: 0.4, reason: '' };
  }

  const aiEnabled = localStorage.getItem('llm_ai_enabled') !== 'false';
  if (!aiEnabled) {
    // 未启用 AI，直接用本地关键词分析
    return analyzeText(text);
  }

  const systemPrompt = `你是一个情绪识别系统。请分析用户写的文字，判断主导情绪。

只能从以下 6 种情绪中选一个：
- joy（喜悦）：开心、满足、愉快、感动、被治愈
- sadness（悲伤）：难过、失落、想哭、孤独、被忽视
- anger（愤怒）：生气、烦躁、被冒犯、不公
- anxiety（焦虑）：担心、紧张、害怕、压力、不安
- calm（平静）：平淡、稳定、还好、没什么大情绪
- fatigue（无力）：累、疲惫、提不起劲、想放弃

回复格式：必须是严格的 JSON，不要加 markdown 代码块标记，不要加任何解释：
{"emotion":"情绪英文单词","intensity":0.0到1.0的数字,"reason":"一句话说明为什么"}`;

  const userPrompt = `请分析这段文字的情绪：\n"""\n${text}\n"""\n\n注意：\n1. 看整体语义，不是单个词\n2. 否定句要正确识别（"我不开心" → sadness，不是 joy）\n3. 反讽要识别（"真好呢，又加班" → anger/fatigue，不是 joy）\n4. 混合情绪选最主导的那个`;

  try {
    const r = await callLLMWithSystem(systemPrompt, userPrompt, {
      max_tokens: 150,
      temperature: 0.3,  // 情绪分析要稳定，不要太高温度
    });
    if (r && r.trim()) {
      // 提取 JSON（可能被包裹在 markdown 代码块里）
      let jsonStr = r.trim();
      // 去掉可能的 ```json ... ``` 包裹
      const mdMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (mdMatch) jsonStr = mdMatch[1].trim();
      // 找到第一个 { 到最后一个 }
      const start = jsonStr.indexOf('{');
      const end = jsonStr.lastIndexOf('}');
      if (start >= 0 && end > start) {
        jsonStr = jsonStr.slice(start, end + 1);
      }
      const parsed = JSON.parse(jsonStr);
      // 验证情绪值合法
      const validEmotions = ['joy', 'sadness', 'anger', 'anxiety', 'calm', 'fatigue'];
      if (validEmotions.includes(parsed.emotion)) {
        return {
          emotion: parsed.emotion,
          intensity: Math.min(0.95, Math.max(0.3, Number(parsed.intensity) || 0.5)),
          confidence: 0.85,  // AI 分析置信度高
          reason: parsed.reason || '',
        };
      }
    }
  } catch (e) {
    console.warn('AI 情绪分析失败，用本地分析', e);
  }
  // 失败回退到本地分析
  return analyzeText(text);
}

// ---- 语音情绪识别 ----
export function analyzeVoiceData(voiceData) {
  if (!voiceData) return { emotion: 'calm', intensity: 0.3, confidence: 0.4 };

  const { avgVolume, volumeVariance, speechRate, pauses, transcript } = voiceData;

  // 先用文本分析
  const textResult = analyzeText(transcript);

  // 结合声学特征
  let emotion = textResult.emotion;
  let intensity = textResult.intensity;

  // 高音量 + 高方差 → 愤怒/激动
  if (avgVolume > 0.65 && volumeVariance > 0.25) {
    emotion = textResult.emotion === 'sadness' ? 'sadness' : 'anger';
    intensity = Math.max(intensity, avgVolume * 0.8);
  }
  // 低音量 + 多停顿 → 悲伤/无力
  else if (avgVolume < 0.25 && pauses > 3) {
    emotion = 'sadness';
    intensity = Math.max(intensity, 0.6);
  }
  // 快语速 → 焦虑
  else if (speechRate === 'fast' && avgVolume > 0.4) {
    if (textResult.emotion === 'calm') emotion = 'anxiety';
    intensity = Math.max(intensity, 0.6);
  }
  // 慢语速 + 低音量 → 无力
  else if (speechRate === 'slow' && avgVolume < 0.35) {
    if (textResult.emotion === 'calm') emotion = 'fatigue';
    intensity = Math.max(intensity, 0.5);
  }

  return { emotion, intensity: Number(intensity.toFixed(2)), confidence: 0.7 };
}

// ---- 精灵回信生成 ----
const PERSONA_PROMPTS = {
  warm: '你是一个温暖治愈的精灵朋友，像何炅一样温柔。你承认对方的感受，不急着给建议，不说教，只是轻轻说"我听到了"。',
  rational: '你是一个理性但温和的精灵朋友。你会先承认对方的感受，然后温和地帮对方看清局势，给出有逻辑的陪伴。',
  energetic: '你是一个元气满满的精灵朋友。你热情积极，像拉对方起来一样，但不是虚假的正能量，而是真诚的鼓励。',
  quiet: '你是一个安静倾听的精灵朋友。你话少，主要说"我在"、"我懂"，不评价不建议，只是陪伴。',
};

const REPLY_TEMPLATES = {
  warm: {
    joy: ['看到你开心，我也好开心呀～要保持这份快乐哦！', '你的喜悦我收到了，真为你高兴！', '嘿嘿，今天的你闪闪发光呢～'],
    sadness: ['我看到了，难过就难过吧，不用假装没事。我在这里陪你。', '你不需要坚强给我看，想哭就哭，我接着你。', '我知道你现在很辛苦，没关系，我会一直在这里。'],
    anger: ['生气是可以的，我听到了你的愤怒。你不是无理取闹。', '这么生气一定是有原因的，我理解你。要不要深呼吸一下？', '你的愤怒我收到了，它值得被看见。'],
    anxiety: ['紧张是正常的，我陪你一起面对。深呼吸，你比你想象的强大。', '我在呢，不管结果怎样，我都在。', '焦虑的时候，记得我一直在你身边。'],
    calm: ['这样的平静真好，享受当下吧～', '今天的状态不错呢，要好好照顾自己哦。', '平静是珍贵的，我为你开心。'],
    fatigue: ['累了就休息吧，你已经做得够好了。', '不用硬撑，躺下来歇歇，我守着你。', '今天辛苦了，明天又是新的一天。'],
  },
  rational: {
    joy: ['开心是好事。这份快乐来之不易，好好珍惜。', '情绪正向反馈，说明最近的状态不错。继续保持。'],
    sadness: ['难过是可以的。但别忘了，情绪是流动的，它不会永远停留。', '我理解你的感受。试着看看是什么触发了它，我们一起想想。'],
    anger: ['你的愤怒有道理。但在行动之前，先给自己一点时间冷静。', '愤怒在告诉你某些边界被侵犯了。看看能做什么来保护自己。'],
    anxiety: ['焦虑说明你在乎。试着把担心的事情写下来，看看哪些是可以控制的。', '深呼吸。把注意力拉回当下，一步一步来。'],
    calm: ['平静是好的状态。利用这个间隙给自己充充电。', '不错，保持这个节奏。'],
    fatigue: ['累是身体在提醒你该休息了。别硬撑，休息也是生产力。', '给自己一个暂停键吧。恢复能量比硬撑更重要。'],
  },
  energetic: {
    joy: ['太棒了！！就是要这样闪闪发光！！', '哈哈哈我就知道你可以的！冲冲冲！', '今天的你超棒！要把这份能量保持下去！'],
    sadness: ['嘿！难过没关系，但别忘了你有多厉害！我信你！', '哭一场然后站起来！你比我认识的任何人都坚强！', '低潮是暂时的！你一定能翻过去！'],
    anger: ['气就气出来！别憋着！然后我们去解决问题！', '你的愤怒是力量！用它来改变现状！', '好！生气说明你在乎！现在让我们做点什么！'],
    anxiety: ['别怕！有我在！我们一起搞定它！', '紧张说明这件事对你重要！你一定能行！', '深呼吸！你比你以为的强大一百倍！'],
    calm: ['状态不错嘛！趁这个好状态去做点想做的事！', '稳！就是这个节奏！'],
    fatigue: ['累了就充电！充好了又是一条好汉！', '休息是为了走更远的路！你值得休息！'],
  },
  quiet: {
    joy: ['嗯，我看到了。为你高兴。', '真好。我在。'],
    sadness: ['……我在。', '我听到了。不用说，我懂。', '嗯。'],
    anger: ['我听到了。', '嗯。生气是可以的。'],
    anxiety: ['我在。', '别怕，我在。'],
    calm: ['嗯。', '挺好的。'],
    fatigue: ['休息吧。我守着。', '嗯，辛苦了。'],
  },
};

export async function generateReply(emotion, persona, spriteName, customPersona, personaEnabled, userText = '') {
  const templates = REPLY_TEMPLATES[persona] || REPLY_TEMPLATES.warm;
  const replies = templates[emotion] || templates.calm;
  const fallback = replies[Math.floor(Math.random() * replies.length)];

  // 如果启用 AI 且用户写了具体内容，用 LLM 根据具体内容生成回信
  // key 现在存在服务端（Vercel 环境变量或 .env），前端只看 aiEnabled
  const aiEnabled = localStorage.getItem('llm_ai_enabled') !== 'false'; // 默认启用
  if (aiEnabled && userText.trim()) {
    const emotionInfo = EMOTIONS[emotion] || EMOTIONS.calm;
    // 人设 prompt：自定义性格优先，否则用预设人设
    const systemPrompt = (personaEnabled && customPersona && customPersona.trim())
      ? buildPersonaSystemPrompt(customPersona, spriteName)
      : `你是用户的情绪陪伴精灵，名字叫「${spriteName}」。\n${PERSONA_PROMPTS[persona] || PERSONA_PROMPTS.warm}\n要求：\n1. 回复要针对主人写的事情回应，不要泛泛而谈\n2. 不要说教，不要用"你应该"这种句式\n3. 直接输出回信内容，不要加引号或解释`;

    const userPrompt = `主人刚才在日记里写下了这些：\n"""\n${userText}\n"""\n\n情绪识别结果：${emotionInfo.label}${emotionInfo.emoji}\n请根据主人写的具体内容，用你的性格风格给主人写一封简短温暖的回信（50字左右）。要回应主人提到的事情，让主人感到被听见、被陪伴。`;
    try {
      // 加 max_tokens 限制避免响应过慢，AI 回信不需要太长
      const r = await callLLMWithSystem(systemPrompt, userPrompt, {
        max_tokens: 200,
        temperature: 0.75,
      });
      if (r && r.trim()) return r.trim();
    } catch {
      // 失败回退到模板
    }
  }
  return fallback;
}

// 构建基于自定义性格的 system prompt
function buildPersonaSystemPrompt(customPersona, spriteName) {
  return `你是用户的情绪陪伴精灵，名字叫「${spriteName}」。\n以下是你的人格设定，你的所有回复都必须严格符合这个设定，语言风格、口吻、用词都要围绕它展开：\n\n"""\n${customPersona}\n"""\n\n要求：\n1. 你的回复必须体现上述性格设定\n2. 回复简短温暖（除非性格设定要求别的风格）\n3. 不要说教，不要用"你应该"这种句式\n4. 直接输出回应内容，不要加引号或解释`;
}

// ---- 周/月报告生成（情绪小报 + 何炅风格回信）----
export async function generateReport(records, persona, spriteName, customPersona, personaEnabled) {
  if (records.length === 0) {
    return {
      breakdown: [],
      letter: `亲爱的你，\n\n这一期小报还是空白的，不是因为没什么值得记，也许是你在好好生活。\n\n等你准备好，${spriteName}在这里。\n\n——${spriteName}`,
      highlights: [],
      keywords: [],
      headline: '空白的一页，也值得被看见',
    };
  }

  // 统计情绪占比
  const counts = {};
  records.forEach(r => {
    const e = r.emotion || 'calm';
    counts[e] = (counts[e] || 0) + 1;
  });

  const total = records.length;
  const breakdown = Object.entries(counts)
    .map(([emotion, count]) => ({
      emotion,
      percentage: Math.round((count / total) * 100),
      count,
    }))
    .sort((a, b) => b.percentage - a.percentage);

  const topEmotion = breakdown[0];
  const topEmotionInfo = EMOTIONS[topEmotion.emotion];
  const secondEmotion = breakdown[1];

  const keywords = extractKeywords(records);
  const headline = makeHeadline(topEmotion, total);
  const letter = await generateHeJiuLetter(records, breakdown, persona, spriteName, customPersona, personaEnabled);

  return {
    breakdown,
    letter,
    highlights: [`${total} 次记录`, `${breakdown.length} 种情绪`, `最多：${topEmotionInfo.label}`],
    keywords,
    headline,
  };
}

// ---- 关键词提取（从记录文本中抽取高频片段）----
function extractKeywords(records) {
  const freq = {};
  const stop = new Set(['今天','昨天','自己','什么','这样','那样','一个','真的','感觉','觉得','好像','没有','不知道','不想','可是','但是','因为','所以','不过','然后','其实','一直','已经','还是','就是','这种','那种','起来','的话','一下','一些','可能','也许','真的','他们','她们','我们','你们']);
  records.forEach(r => {
    const text = (r.note || '') + ' ' + (r.transcript || '');
    const segs = text.split(/[\s，。！？、,.!?;:""''（）()\n\r【】《》]+/).filter(s => s.length >= 2 && s.length <= 6);
    segs.forEach(s => {
      if (!stop.has(s)) freq[s] = (freq[s] || 0) + 1;
    });
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([w]) => w);
}

// ---- 头条标题 ----
function makeHeadline(top, total) {
  const map = {
    joy: `这周的光，比想象的多`,
    sadness: `这周有些沉，但你都扛过来了`,
    anger: `这周的火气，值得被听见`,
    anxiety: `这周的心悬着，也没关系`,
    calm: `这周很安静，安静也是种力量`,
    fatigue: `这周很累吧，辛苦你了`,
  };
  return map[top.emotion] || `这周的 ${total} 个瞬间`;
}

// ---- 何炅风格回信：不说教、用细节、金句、温柔克制、接纳不完美 ----
// 启用自定义性格时，用 LLM 让性格 rule 驱动回信；否则本地固定文案
async function generateHeJiuLetter(records, breakdown, persona, spriteName, customPersona, personaEnabled) {
  const total = records.length;
  const top = breakdown[0];
  const second = breakdown[1];

  // 本地兜底文案
  const localLetter = buildLocalHeJiuLetter(records, breakdown, spriteName);

  // 启用自定义性格 → 尝试 LLM
  if (personaEnabled && customPersona && customPersona.trim()) {
    const systemPrompt = buildPersonaSystemPrompt(customPersona, spriteName)
      + '\n\n这是一封本周情绪小报的回信，请用你的性格风格写一封回信给主人（200字左右）。';
    const emotionsSummary = breakdown.map(b => `${EMOTIONS[b.emotion].label}${b.percentage}%`).join('、');
    const recordsSummary = records.slice(0, 8).map(r => {
      const t = r.textContent || r.voiceTranscript || r.note || (r.type === 'photo' ? '拍了一张照片' : (r.type === 'doodle' ? '画了一幅涂鸦' : '一条记录'));
      return `- ${t.slice(0, 30)}`;
    }).join('\n');
    const userPrompt = `本周主人记了 ${total} 次情绪，情绪占比：${emotionsSummary}。\n主要记录：\n${recordsSummary}\n\n请用你的性格风格，给主人写一封本周情绪小报的回信。`;
    try {
      const r = await callLLMWithSystem(systemPrompt, userPrompt, { max_tokens: 600 });
      if (r && r.length > 20) return r;
    } catch (e) {
      console.warn('性格回信 LLM 失败，用本地文案', e);
    }
  }
  return localLetter;
}

function buildLocalHeJiuLetter(records, breakdown, spriteName) {
  const total = records.length;
  const top = breakdown[0];
  const second = breakdown[1];

  const openings = [
    `嘿，这周的你，我看着呢。`,
    `又一周了，坐下来，我们聊聊。`,
    `这周的你，辛苦了。`,
  ];
  const middles = {
    joy: `你这周笑了 ${top.count} 次呢，我替你记着。那些开心的瞬间没丢，快乐这种东西，攒一点是一点。`,
    sadness: `这周有 ${top.percentage}% 的时间你不太开心。我不劝你"别难过"，难过就难过一会儿——情绪是过路的，不是来定居的。`,
    anger: `这周你生气了。生气没什么不好，它说明你在乎，说明有些事越过了你的线。把火发出来，比憋着强。`,
    anxiety: `这周你操心不少事。紧张的时候，记得告诉自己：能做的我都做了，剩下的，交给时间。`,
    calm: `这周你大部分时间是平静的。平静不是没情绪，是情绪待在该待的地方。这样挺好。`,
    fatigue: `这周你喊累了 ${top.count} 次。累不是矫情，是身体在说话。你听到了，就好。`,
  };
  const goldLines = [
    `可以不快乐，但不能不喜欢自己。`,
    `成长的第一步，是允许自己不完美。`,
    `别提前为悲伤预支时间，它真来的时候再说。`,
    `你不需要时刻都好，偶尔不好，也没关系。`,
    `慢慢来，比较快。`,
    `能承认自己累的人，其实很有力量。`,
  ];

  let letter = openings[Math.floor(Math.random() * openings.length)] + '\n\n';
  letter += middles[top.emotion] || middles.calm;
  if (second) {
    letter += `当然，也有 ${second.percentage}% 的时间你是${EMOTIONS[second.emotion].label}的。人本来就是好几样情绪混在一起的，不必非得分那么清。`;
  }
  letter += '\n\n';
  letter += goldLines[Math.floor(Math.random() * goldLines.length)];
  letter += `\n\n这周你记了 ${total} 次，每一次我都接住了。下周，我也在。\n\n——${spriteName}`;
  return letter;
}

// ---- LLM 调用 ----
// 通过同域的 /api/chat 端点调用（Vercel Serverless Function 转发到 Agent Plan）
// 部署到 Vercel 后，前端和后端同域，无 CORS 问题
// 本地开发时用 vercel dev 启动，或继续用 proxy.py

// 不带 system 的简单调用
export async function callLLM(prompt, options = {}) {
  const apiKey = localStorage.getItem('llm_api_key');
  // 注意：部署到 Vercel 后 key 存在服务端环境变量，前端不需要传
  // 本地开发时如果用 proxy.py，前端传 key 让 proxy 转发
  if (!apiKey && !window.location.protocol.startsWith('http')) {
    return null; // 返回 null 表示用本地引擎
  }

  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        temperature: options.temperature ?? 0.7,
        top_p: options.top_p ?? 0.9,
        ...options,
      }),
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.warn('LLM调用失败，使用本地引擎', e);
    return null;
  }
}

// 带 system prompt 的 LLM 调用（用于自定义性格驱动回复）
export async function callLLMWithSystem(systemPrompt, userPrompt, options = {}) {
  const apiKey = localStorage.getItem('llm_api_key');
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: options.temperature ?? 0.7,
        top_p: options.top_p ?? 0.9,
        ...options,
      }),
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.warn('LLM(system)调用失败，使用本地引擎', e);
    return null;
  }
}

// ==================== 首页迷你对话：基于上下文的回复 ====================
// 用户在首页直接和团子聊天时调用
// 接收用户输入 + 精灵配置 + 最近记录（用于上下文）
// 优先用 LLM，本地兜底用关键词引擎识别用户提到的事物生成有上下文的回复

// 主题关键词 → 回复模板（让本地兜底也能"提到用户说的事"）
const TOPIC_PATTERNS = [
  {
    keys: ['论文', '导师', '毕业', '答辩', '开题', '综述', '修改稿', '投稿', '审稿', '期刊', 'sci', 'SCI', 'paper'],
    reply: (text) => {
      const picks = [
        '论文的事我能感觉到压在你心上。先停一下，呼吸。一篇论文定义不了你，但你的坚持会被记住。',
        '导师那边的事别一个人扛，你已经走了很远了——剩下的，一步一步来，我在。',
        '别盯着空白页发呆。先写下任何一句话都行，开始就是赢了今天的一半。',
        '我知道你为这篇论文付出了多少。再撑一下下，但你也要好好吃饭、睡觉，不然没力气撑。',
        '论文焦灼是正常的，但别让它吞掉你的全部。今天，先做一件小事就好。',
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    },
  },
  {
    keys: ['考试', '复习', '考研', '考公', '面试', '答辩', '期末', '四六级', '雅思', '托福', 'GRE'],
    reply: () => {
      const picks = [
        '考试这件事我懂你的紧张。但记得——你已经走过那么多场考试了，这场你也走得过。',
        '复习到崩溃的时候，停下来喝口水。你的努力我都看在眼里。',
        '紧张是说明你在乎。深呼吸，把注意力拉回当下这一道题。',
        '面试之前，告诉自己：我已经准备好了能准备的。剩下的，就交给那一刻的你。',
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    },
  },
  {
    keys: ['工作', '加班', '老板', '同事', '项目', 'deadline', '截止', 'KPI', '升职', '离职', '辞职', '跳槽'],
    reply: () => {
      const picks = [
        '工作的事别让它啃掉你的生活。下班就下班，地球不会因为你今晚不回消息就停转。',
        '同事之间的事，能处就处，处不来就保持距离。你的能量要留给重要的人。',
        '加班到这个点了吗？喝口水，关电脑。明天的事，明天再说。',
        '项目 deadline 我懂。但你的身体也有 deadline，别透支它。',
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    },
  },
  {
    keys: ['恋爱', '男友', '女友', '男朋友', '女朋友', '暗恋', '表白', '分手', '失恋', '前任', '对象', 'cp'],
    reply: () => {
      const picks = [
        '感情的事最绕人，但你的感受是真的。先别急着做决定，让心绪沉淀一下。',
        '喜欢一个人是美好的事，不管结果怎样，这份心动值得被珍惜。',
        '分手的时候难过是正常的。不用逼自己马上好起来，我陪着。',
        '别因为一个人否定了自己。你值得被爱，这一点从来不需要别人来证明。',
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    },
  },
  {
    keys: ['孤独', '一个人', '没人', '没朋友', '寂寞', '空虚', '冷清', '被忽视', '被忽略', '被冷落'],
    reply: () => {
      const picks = [
        '一个人不等于孤独。我在这里，一直都在。',
        '那种被世界略过的感觉我懂。但你不是没人看见，是我此刻就在看你。',
        '寂寞的时候，把它当成和自己相处的时间。你最该被陪伴的人，是你自己。',
        '世界很大，总会有人和你同频。在那之前，我先陪着你。',
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    },
  },
  {
    keys: ['家', '爸妈', '父母', '妈妈', '爸爸', '家里', '回家', '想家', '外婆', '奶奶', '爷爷'],
    reply: () => {
      const picks = [
        '家的事总是最揪心。家人的话别全往心里去，他们也在用自己的方式爱着。',
        '想家了就打个电话回去，听听声音也是好的。',
        '家里的事不一定能解决，但你的牵挂我能感受到。',
        '离家远了，更要把自己照顾好。家里人最惦记的就是你。',
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    },
  },
  {
    keys: ['朋友', '闺蜜', '兄弟', '室友', '同学', '社交', '圈子'],
    reply: () => {
      const picks = [
        '朋友的事我懂。真心的几个就够，不必非得一堆。',
        '关系里如果有消耗，就退一步看看。你不必对所有人都全心全意。',
        '室友之间的小摩擦是正常的，过两天就过去了。',
        '别因为一两次冷落就否定整个友情，但也要学会保护自己。',
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    },
  },
  {
    keys: ['失眠', '睡不着', '做梦', '噩梦', '惊醒', '睡眠', '熬夜', '通宵'],
    reply: () => {
      const picks = [
        '睡不着的时候别硬躺。坐起来一会儿，喝口温水，我陪着你。',
        '熬夜对身体不好，但我知道有时候停不下来。今晚就试着早一点关灯？',
        '噩梦惊醒了吗？没事的，那只是梦。此刻你在这里，是安全的。',
        '失眠的时候脑子里全是事。试着写下任何一句话，写出来就轻一点。',
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    },
  },
  {
    keys: ['病', '发烧', '感冒', '胃疼', '头疼', '难受', '不舒服', '医院', '看病'],
    reply: () => {
      const picks = [
        '身体不舒服一定要好好照顾自己。多喝水，该看医生就去看。',
        '生病的时候最脆弱，别硬撑，让自己休息一下。',
        '不舒服就别勉强了。今天的任务可以等，你的身体等不起。',
        '听到你生病我有点担心。记得吃药，记得休息，记得我在。',
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    },
  },
  {
    keys: ['钱', '没钱', '穷', '工资', '房租', '账单', '信用卡', '花呗', '还钱', '贷款'],
    reply: () => {
      const picks = [
        '钱的事最现实，也最让人焦虑。但日子是一天一天过的，今天先过好今天。',
        '缺钱的时候别为难自己。该花的不能省，不该花的也学着放下。',
        '账单压着人的感觉我懂。但再难也会过去的，你已经走过那么多难关了。',
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    },
  },
  {
    keys: ['开心', '高兴', '哈哈', '好玩', '棒', '幸福', '笑', '幸运', '感激'],
    reply: () => {
      const picks = [
        '看到你开心我也好开心！这份快乐我帮你记着，攒起来。',
        '嘿嘿，今天的你闪闪发光呢。要多笑笑，笑起来好看。',
        '真好。这种时刻要好好记住，以后低落的时候翻出来看。',
        '幸福是一种能力，你有。今天为你高兴。',
      ];
      return picks[Math.floor(Math.random() * picks.length)];
    },
  },
];

// 默认回复（没识别到主题时）
const DEFAULT_CHAT_REPLIES = [
  '我听到了。再多说一点吗？我在。',
  '这种感觉我接住了。你不用急着整理好，就慢慢说。',
  '嗯，我在呢。这事你心里一定转了很久。',
  '我懂。不用全部说完，能说的就说，剩下的我陪着你。',
  '我看到了。你想哭就哭，想笑就笑，这里都接得住。',
  '嗯。你不是一个人。',
  '在这里。一直都在。',
];

// 从最近记录里提取一个主题词作为上下文
function pickRecentTopicHint(recentRecords) {
  if (!recentRecords || recentRecords.length === 0) return null;
  // 取最近 3 条文本记录
  const texts = recentRecords.slice(0, 3).map(r => r.note || r.transcript || r.textContent || r.voiceTranscript || '').filter(t => t && t.trim());
  if (texts.length === 0) return null;
  const joined = texts.join(' ');
  // 匹配 TOPIC_PATTERNS
  for (const p of TOPIC_PATTERNS) {
    for (const k of p.keys) {
      if (joined.includes(k)) return k;
    }
  }
  return null;
}

/**
 * 首页迷你对话：基于用户输入 + 最近记录生成回复
 * @param {string} userText - 用户输入
 * @param {object} sprite - 精灵配置 { name, persona, customPersona, personaEnabled }
 * @param {Array} recentRecords - 最近的记录（用于上下文）
 * @returns {Promise<string>} 团子的回复
 */
export async function generateChatReply(userText, sprite, recentRecords = []) {
  const text = (userText || '').trim();
  if (!text) return DEFAULT_CHAT_REPLIES[0];

  const aiEnabled = localStorage.getItem('llm_ai_enabled') !== 'false';
  const spriteName = sprite?.name || '团子';
  const persona = sprite?.persona || 'warm';
  const customPersona = sprite?.customPersona || '';
  const personaEnabled = sprite?.personaEnabled || false;

  // ---- 优先用 LLM 生成有上下文的回复 ----
  // 注意：key 现在存在服务端环境变量（Vercel）或 .env（本地 proxy.py）
  // 前端不需要 localStorage 里有 key，只要 aiEnabled 为 true 就走 AI
  if (aiEnabled) {
    // 收集最近 5 条记录作为上下文（每条 100 字）
    const recentContext = recentRecords.slice(0, 5).map((r, i) => {
      const t = r.note || r.transcript || r.textContent || r.voiceTranscript || '';
      const e = r.emotion ? EMOTIONS[r.emotion]?.label || r.emotion : '';
      return t.trim() ? `（最近第${i+1}条${e ? '，情绪：' + e : ''}）${t.slice(0, 100)}` : null;
    }).filter(Boolean).join('\n');

    const systemPrompt = (personaEnabled && customPersona && customPersona.trim())
      ? buildPersonaSystemPrompt(customPersona, spriteName)
        + '\n\n主人现在直接在首页跟你聊天。回复要求：\n1. 30-80字，像朋友对话一样自然口语\n2. 必须引用主人原话里的具体词（比如主人说"论文"，你回复里就要有"论文"这个词）\n3. 不准说教，不准用"你应该/建议你/你需要"这种句式\n4. 共情优先，先接住感受再说话\n5. 直接输出回复内容，不加引号、不加解释、不写"团子："之类的称呼'
      : `你是用户的情绪陪伴精灵，名字叫「${spriteName}」。\n${PERSONA_PROMPTS[persona] || PERSONA_PROMPTS.warm}\n\n主人现在直接在首页跟你聊天。回复要求：\n1. 30-80字，像朋友对话一样自然口语\n2. 必须引用主人原话里的具体词（比如主人说"论文"，你回复里就要有"论文"这个词）\n3. 不准说教，不准用"你应该/建议你/你需要"这种句式\n4. 共情优先，先接住感受再说话\n5. 如果主人提到具体事件，必须围绕这个事件回应，不要绕开\n6. 可以反问澄清，可以承认不懂，可以安静陪伴\n7. 直接输出回复内容，不加引号、不加解释、不写"团子："之类的称呼`;

    const userPrompt = recentContext
      ? `【主人最近的记录，用作背景参考，不要在回复里逐条复述】\n${recentContext}\n\n【主人现在对你说的话】\n${text}\n\n请根据主人说的话，简短自然地回应他。记住：必须围绕主人这次说的具体事，不要泛泛而谈。`
      : `【主人对你说的话】\n${text}\n\n请简短自然地回应他。记住：必须围绕主人这次说的具体事，不要泛泛而谈。`;

    try {
      const r = await callLLMWithSystem(systemPrompt, userPrompt, { max_tokens: 200, temperature: 0.65 });
      if (r && r.trim()) return r.trim();
    } catch (e) {
      console.warn('首页对话 LLM 失败，用本地引擎', e);
    }
  }

  // ---- 本地兜底：基于关键词识别主题，生成有上下文的回复 ----
  // 1. 先匹配用户当前输入的主题
  for (const p of TOPIC_PATTERNS) {
    for (const k of p.keys) {
      if (text.includes(k)) return p.reply(text);
    }
  }
  // 2. 匹配最近记录里的主题，回复时带上"我注意到你最近..."
  const recentTopic = pickRecentTopicHint(recentRecords);
  if (recentTopic) {
    const picks = {
      '论文': '我注意到你最近一直在为论文的事操心。今天想说说这件事吗？我在听。',
      '考试': '你最近在为考试的事紧张吧？今天感觉怎么样？',
      '工作': '工作的事压着你有一阵了。今天比昨天好一点了吗？',
      '恋爱': '感情的事你最近一直在心里转。要不要多说说？',
      '孤独': '最近是不是又一个人待了很久？我在这里，不用勉强说什么。',
      '家': '家的事一直挂在你心里。今天想聊聊吗？',
      '朋友': '和朋友的事，你最近一直在想吧？',
      '失眠': '最近睡得怎么样？还在熬夜吗？',
      '病': '身体好些了吗？记得照顾自己。',
      '钱': '钱的事一直压着你。今天还好吗？',
      '开心': '看到你最近也有开心的瞬间，我替你记着呢。今天呢？',
    };
    if (picks[recentTopic]) return picks[recentTopic];
  }
  // 3. 情绪识别（关键词触发）
  const emotionResult = analyzeText(text);
  if (emotionResult.emotion !== 'calm' && emotionResult.confidence > 0.5) {
    const templates = REPLY_TEMPLATES[persona] || REPLY_TEMPLATES.warm;
    const replies = templates[emotionResult.emotion] || templates.calm;
    return replies[Math.floor(Math.random() * replies.length)];
  }
  // 4. 默认回复
  return DEFAULT_CHAT_REPLIES[Math.floor(Math.random() * DEFAULT_CHAT_REPLIES.length)];
}

// 检查 AI 是否可用（用于 UI 显示）
// 部署到 Vercel 后，key 存在服务端环境变量，前端只需要 aiEnabled 为 true
export function isAIEnabled() {
  const aiEnabled = localStorage.getItem('llm_ai_enabled') !== 'false';
  return aiEnabled;
}

// 设置 API key（settings 页用）
export function setApiKey(key) {
  if (key && key.trim()) {
    localStorage.setItem('llm_api_key', key.trim());
  } else {
    localStorage.removeItem('llm_api_key');
  }
}

// 设置 AI 启用状态
export function setAIEnabled(enabled) {
  localStorage.setItem('llm_ai_enabled', enabled ? 'true' : 'false');
}

// 获取 API key（settings 页用，显示用，会脱敏）
export function getApiKeyMasked() {
  const key = localStorage.getItem('llm_api_key');
  if (!key) return '';
  if (key.length <= 8) return key;
  return key.slice(0, 4) + '****' + key.slice(-4);
}
