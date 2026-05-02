// Vercel Serverless Function — proxy seguro para Gemini API
// A chave GEMINI_API_KEY fica nas variáveis de ambiente do Vercel (nunca no frontend)

export default async function handler(req, res) {
  // CORS — permite requisições do frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, useSearch = true, model = 'pro' } = req.body;
    if (!prompt) return res.status(400).json({ error: 'Prompt obrigatório' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'API key não configurada' });

    const modelId = model === 'flash'
      ? 'gemini-2.5-flash'
      : 'gemini-2.5-pro';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: model === 'flash' ? 4096 : 8192,
        temperature: model === 'flash' ? 0.2 : 0.3,
        responseMimeType: 'text/plain'
      }
    };

    // Adiciona Google Search para o modelo pro
    if (useSearch) {
      body.tools = [{ googleSearch: {} }];
    }

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}));
      return res.status(geminiRes.status).json({
        error: err?.error?.message || `Gemini API error ${geminiRes.status}`
      });
    }

    const data = await geminiRes.json();
    const text = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';

    if (!text.trim()) {
      return res.status(500).json({ error: 'Gemini não retornou resposta' });
    }

    return res.status(200).json({ text });

  } catch (err) {
    console.error('Erro no proxy Gemini:', err);
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
}
