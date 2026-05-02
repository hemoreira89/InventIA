// Vercel Serverless Function com timeout estendido
// Usa Node runtime com maxDuration = 60s (limite do plano Hobby)

export const config = {
  maxDuration: 60
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, useSearch = true, model = 'flash' } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt obrigatório' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key não configurada' });

    // Tenta modelos em ordem de preferência
    // Para queries com search, começa pelo flash (mais rápido) para evitar timeout
    const modelos = model === 'pro'
      ? ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro']
      : ['gemini-2.5-flash', 'gemini-2.0-flash'];

    let lastError = null;

    for (const modelId of modelos) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
        const body = {
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            maxOutputTokens: 8192,
            temperature: 0.3,
            responseMimeType: 'text/plain'
          }
        };
        if (useSearch) body.tools = [{ googleSearch: {} }];

        // Timeout de 50s por modelo (deixa 10s de margem para o Vercel)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 50000);

        const geminiRes = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (geminiRes.status === 429 || geminiRes.status === 503) {
          lastError = `${modelId} indisponível (${geminiRes.status})`;
          continue;
        }

        if (!geminiRes.ok) {
          const err = await geminiRes.json().catch(() => ({}));
          lastError = err?.error?.message || `Erro ${geminiRes.status}`;
          continue;
        }

        const data = await geminiRes.json();
        const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
        if (!text.trim()) { lastError = `${modelId} retornou vazio`; continue; }

        return res.status(200).json({ text, modelUsado: modelId });

      } catch (e) {
        if (e.name === 'AbortError') {
          lastError = `${modelId} timeout (>50s)`;
        } else {
          lastError = e.message;
        }
        continue;
      }
    }

    return res.status(503).json({ error: `IA temporariamente indisponível. ${lastError}. Tente novamente em alguns segundos.` });

  } catch (err) {
    console.error('Erro proxy:', err);
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
}
