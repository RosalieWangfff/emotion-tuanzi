// /api/chat.js — Vercel Serverless Function
// 转发前端请求到火山引擎 Agent Plan 端点
// API key 存在 Vercel 环境变量 ARK_API_KEY 中，不会泄露到前端代码

const ARK_URL = 'https://ark.cn-beijing.volces.com/api/plan/v3/chat/completions';

export default async function handler(req, res) {
  // 处理 CORS 预检（虽然同域用不上，但保险）
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: 'ARK_API_KEY 环境变量未配置',
      hint: '在 Vercel 项目设置 → Environment Variables 中添加 ARK_API_KEY',
    });
  }

  try {
    const body = {
      model: 'ark-code-latest',
      thinking: { type: 'disabled' },
      temperature: 0.65,
      top_p: 0.9,
      ...req.body,
    };

    const upstream = await fetch(ARK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();
    return res.status(upstream.status).json(data);
  } catch (e) {
    console.error('Upstream error:', e);
    return res.status(502).json({
      error: 'Upstream error',
      message: e.message,
    });
  }
}
