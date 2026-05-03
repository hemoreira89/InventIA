// Vercel Serverless Function com timeout estendido
// Usa Node runtime com maxDuration = 60s (limite do plano Hobby)
//
// LOGGING: cada etapa imprime prefixo [GEMINI] para facilitar grep nos logs.
// Para diagnosticar: na UI do Vercel, em Logs, filtra por "GEMINI" ou clica
// na linha do POST /api/analyze para ver a sequência completa.

export const config = {
  maxDuration: 60
};

export default async function handler(req, res) {
  const reqId = Math.random().toString(36).slice(2, 8); // pequeno id pra correlacionar logs
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

    // Tenta modelos em ordem de preferência
    // 2025-05: gemini-2.0-flash foi descontinuado (shutdown 1/junho/2026 mas
    // já bloqueia usuários novos). Migramos para 2.5-flash + 2.5-flash-lite
    // (este último é GA, mais rápido e custa 4x menos que o flash).
    const modelos = model === 'pro'
      ? ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.5-pro']
      : ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

    log('Modelos a tentar (ordem)', modelos);

    let lastError = null;
    let lastErrorDetail = null;

    for (const modelId of modelos) {
      const tStart = Date.now();
      log(`>>> Tentando ${modelId} (search=${useSearch})`);

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

        const elapsed = Date.now() - tStart;
        log(`<<< ${modelId} respondeu HTTP ${geminiRes.status} em ${elapsed}ms`);

        if (geminiRes.status === 429 || geminiRes.status === 503) {
          // Tenta ler corpo do erro pra detalhar (quota? overload?)
          const errBody = await geminiRes.json().catch(() => ({}));
          lastError = `${modelId} indisponível (${geminiRes.status})`;
          lastErrorDetail = errBody?.error?.message || JSON.stringify(errBody).slice(0, 300);
          log(`SKIP ${modelId} → ${lastError}`, { detail: lastErrorDetail });
          continue;
        }

        if (!geminiRes.ok) {
          const err = await geminiRes.json().catch(() => ({}));
          lastError = err?.error?.message || `Erro ${geminiRes.status}`;
          lastErrorDetail = JSON.stringify(err).slice(0, 500);
          log(`FAIL ${modelId} → ${lastError}`, { detail: lastErrorDetail });
          continue;
        }

        const data = await geminiRes.json();
        const candidate = data.candidates?.[0];
        const finishReason = candidate?.finishReason || 'unknown';
        const text = candidate?.content?.parts?.map(p => p.text || '').join('') || '';

        log(`${modelId} parseou resposta`, {
          finishReason,
          textLength: text.length,
          hasText: !!text.trim()
        });

        if (!text.trim()) {
          // Pode ser SAFETY filter, output truncado, etc
          lastError = `${modelId} retornou vazio (finishReason=${finishReason})`;
          lastErrorDetail = JSON.stringify({
            finishReason,
            safetyRatings: candidate?.safetyRatings,
            promptFeedback: data.promptFeedback
          }).slice(0, 500);
          log(`EMPTY ${modelId} → ${lastError}`, { detail: lastErrorDetail });
          continue;
        }

        log(`SUCCESS ${modelId} (${text.length} chars, ${Date.now() - tStart}ms total)`);
        return res.status(200).json({ text, modelUsado: modelId });

      } catch (e) {
        const elapsed = Date.now() - tStart;
        if (e.name === 'AbortError') {
          lastError = `${modelId} timeout (>50s)`;
          lastErrorDetail = `aborted após ${elapsed}ms`;
          log(`TIMEOUT ${modelId} após ${elapsed}ms`);
        } else {
          lastError = e.message;
          lastErrorDetail = e.stack?.split('\n').slice(0, 3).join(' | ') || '';
          log(`EXCEPTION ${modelId}: ${e.message}`, { stack: lastErrorDetail });
        }
        continue;
      }
    }

    log(`ALL_FAILED → último erro: ${lastError}`, { detail: lastErrorDetail });
    return res.status(503).json({
      error: `IA temporariamente indisponível. ${lastError}. Tente novamente em alguns segundos.`,
      // Inclui detalhe técnico no response para debug (frontend pode logar)
      _debug: lastErrorDetail
    });

  } catch (err) {
    log(`UNHANDLED_ERROR: ${err.message}`, { stack: err.stack?.split('\n').slice(0, 5).join(' | ') });
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
}
