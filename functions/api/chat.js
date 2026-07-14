// Cloudflare Pages Function — 转发到火山引擎 Agent Plan
const ARK_URL = 'https://ark.cn-beijing.volces.com/api/plan/v3/chat/completions';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const apiKey = env.ARK_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'ARK_API_KEY 未配置' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }

  try {
    const reqBody = await request.json();
    const body = {
      model: 'ark-code-latest',
      thinking: { type: 'disabled' },
      temperature: 0.65,
      top_p: 0.9,
      ...reqBody,
    };

    const upstream = await fetch(ARK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.text();
    return new Response(data, {
      status: upstream.status,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Upstream error', message: e.message }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });
  }
}
