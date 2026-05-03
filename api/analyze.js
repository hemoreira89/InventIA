// Vercel Serverless Function com timeout estendido
// Usa Node runtime com maxDuration = 60s (limite do plano Hobby)
//
// LOGGING: cada etapa imprime prefixo [GEMINI] para facilitar grep nos logs.
// Para diagnosticar: na UI do Vercel, em Logs, filtra por "GEMINI" ou clica
// na linha do POST /api/analyze para ver a sequência completa.
//
// ESTRATÉGIA DE FALLBACK (em ordem):
//   1. gemini-2.5-flash + Google Search (qualidade alta, lento)
//   2. gemini-2.5-flash-lite + Google Search (rápido, ocasionalmente vazio com STOP)
//   3. gemini-2.5-flash SEM search (sem grounding, mais confiável)
//   4. gemini-2.5-flash-lite SEM search (último recurso)
//
// Sem search é mais confiável mas IA não consulta cotações reais. Tudo bem
// porque o frontend já enriquece com dados reais do bolsai/brapi depois.

export const config = {
  maxDuration: 60
};

const TIMEOUT_MS = 55000; // 55s - margem de 5s sobre o limite do Vercel Hobby

async function chamarGemini(modelId, prompt, useSearch, apiKey, log) {
  const tStart = Date.now();
  log(`>>> Tentando ${modelId} (search=${useSearch})`);

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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    const elapsed = Date.now() - tStart;
    log(`<<< ${modelId} respondeu HTTP ${geminiRes.status} em ${elapsed}ms`);

    if (geminiRes.status === 429 || geminiRes.status === 503) {
      const errBody = await geminiRes.json().catch(() => ({}));
      const detail = errBody?.error?.message || JSON.stringify(errBody).slice(0, 300);
      return { ok: false, error: `${modelId} indisponível (${geminiRes.status})`, detail, retryable: true };
    }

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}));
      const errMsg = err?.error?.message || `Erro ${geminiRes.status}`;
      const detail = JSON.stringify(err).slice(0, 500);
      return { ok: false, error: `${modelId}: ${errMsg}`, detail, retryable: false };
    }

    const data = await geminiRes.json();
    const candidate = data.candidates?.[0];
    const finishReason = candidate?.finishReason || 'unknown';
    const text = candidate?.content?.parts?.map(p => p.text || '').join('') || '';

    log(`${modelId} parseou`, { finishReason, textLength: text.length, hasText: !!text.trim() });

    if (!text.trim()) {
      // Bug conhecido: gemini-2.5-flash-lite com Search às vezes retorna texto
      // vazio com finishReason=STOP (não é erro, mas inútil para nós).
      // SAFETY/RECITATION também produzem texto vazio mas com finishReason diferente.
      const detail = JSON.stringify({
        finishReason,
        safetyRatings: candidate?.safetyRatings,
        promptFeedback: data.promptFeedback
      }).slice(0, 500);
      return {
        ok: false,
        error: `${modelId} retornou vazio (finishReason=${finishReason})`,
        detail,
        retryable: true
      };
    }

    log(`SUCCESS ${modelId} (${text.length} chars, ${Date.now() - tStart}ms total)`);
    return { ok: true, text, modelId };

  } catch (e) {
    clearTimeout(timeoutId);
    const elapsed = Date.now() - tStart;
    if (e.name === 'AbortError') {
      log(`TIMEOUT ${modelId} após ${elapsed}ms`);
      return { ok: false, error: `${modelId} timeout (>${TIMEOUT_MS / 1000}s)`, detail: `aborted após ${elapsed}ms`, retryable: true };
    }
    log(`EXCEPTION ${modelId}: ${e.message}`);
    return { ok: false, error: `${modelId}: ${e.message}`, detail: e.stack?.split('\n').slice(0, 3).join(' | ') || '', retryable: false };
  }
}

export default async function handler(req, res) {
  const reqId = Math.random().toString(36).slice(2, 8);
  const log = (msg, extra) => {
    if (extra !== undefined) {
      console.log(`[GEMINI ${reqId}] ${msg}`, JSON.stringify(extra).slice(0, 500));
    } else {
      console.log(`[GEMINI ${reqId}] ${msg}`);
    }
  };

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { prompt, useSearch = true, model = 'flash' } = req.body || {};

    log('REQUEST recebido', {
      hasPrompt: !!prompt,
      promptLength: prompt?.length || 0,
      useSearch,
      model
    });

    if (!prompt) {
      log('ABORT: prompt ausente');
      return res.status(400).json({ error: 'Prompt obrigatório' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      log('ABORT: GEMINI_API_KEY não configurada');
      return res.status(500).json({ error: 'API key não configurada' });
    }

    // Estratégia: tenta com search primeiro (melhor resultado), depois sem
    // search como fallback (se modelo travar com STOP+vazio ou der timeout).
    // Cada item: [modelId, useSearch]
    const tentativas = model === 'pro'
      ? [
          ['gemini-2.5-flash', true],
          ['gemini-2.5-pro', true],
          ['gemini-2.5-flash', false],
          ['gemini-2.5-flash-lite', false]
        ]
      : [
          ['gemini-2.5-flash', useSearch],
          ['gemini-2.5-flash-lite', useSearch],
          // Fallbacks SEM search (mais confiáveis quando os outros falham)
          ['gemini-2.5-flash', false],
          ['gemini-2.5-flash-lite', false]
        ];

    log('Sequência de tentativas', tentativas.map(([m, s]) => `${m}${s ? '+search' : ''}`));

    let lastError = null;
    let lastDetail = null;

    for (const [modelId, comSearch] of tentativas) {
      const r = await chamarGemini(modelId, prompt, comSearch, apiKey, log);

      if (r.ok) {
        return res.status(200).json({
          text: r.text,
          modelUsado: r.modelId,
          searchUsado: comSearch
        });
      }

      lastError = r.error;
      lastDetail = r.detail;

      // Erros não-retentáveis (auth, prompt malformado): para imediatamente
      if (!r.retryable) {
        log(`STOP: erro não-retentável em ${modelId}`);
        break;
      }
    }

    log(`ALL_FAILED → último erro: ${lastError}`, { detail: lastDetail });
    return res.status(503).json({
      error: `IA temporariamente indisponível. ${lastError}. Tente novamente em alguns segundos.`,
      _debug: lastDetail
    });

  } catch (err) {
    log(`UNHANDLED_ERROR: ${err.message}`, { stack: err.stack?.split('\n').slice(0, 5).join(' | ') });
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
}
