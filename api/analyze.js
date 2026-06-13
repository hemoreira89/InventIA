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

const TIMEOUT_MS = 30000; // 30s - sem Google Search, Gemini responde em 5-15s normalmente

// ─── Gate de plano/trial ──────────────────────────────────────────────────────
// Antes de gastar Gemini, checa o plano do usuário lendo profiles via PostgREST
// com o PRÓPRIO token do usuário (RLS garante que só lê a própria linha).
// Fail-open de propósito: sem token, perfil ausente ou erro de infra deixam
// passar — o bloqueio duro é na UI; aqui é só a trava de custo para contas
// sabidamente expiradas.
const SUPABASE_URL = process.env.SUPABASE_URL
  || process.env.VITE_SUPABASE_URL
  || 'https://bjghaqtyijvlnwlesrst.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqZ2hhcXR5aWp2bG53bGVzcnN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3NTQwOTUsImV4cCI6MjA5MzMzMDA5NX0.wugciBsGln_K5kkWi479M6KpFV32e8Vyd51bjkhc2vE';

async function verificarPlano(req, log) {
  try {
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) return { ok: true, motivo: 'sem-token' };

    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?select=plano,trial_fim,plano_expira_em`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } }
    );
    if (!r.ok) return { ok: true, motivo: `rest-${r.status}` };

    const perfil = (await r.json())?.[0];
    if (!perfil) return { ok: true, motivo: 'sem-perfil' };

    if (perfil.plano === 'vitalicio') return { ok: true, motivo: 'vitalicio' };
    if (perfil.plano === 'mensal' || perfil.plano === 'anual') {
      if (!perfil.plano_expira_em || new Date(perfil.plano_expira_em) > new Date()) {
        return { ok: true, motivo: perfil.plano };
      }
      return { ok: false, motivo: 'assinatura-expirada' };
    }
    // trial
    if (perfil.trial_fim && new Date(perfil.trial_fim) <= new Date()) {
      return { ok: false, motivo: 'trial-expirado' };
    }
    return { ok: true, motivo: 'trial' };
  } catch (e) {
    log?.(`PLANO check falhou (fail-open): ${e.message}`);
    return { ok: true, motivo: `erro:${e.message}` };
  }
}

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
      return { ok: false, error: `${modelId} indisponível (${geminiRes.status})`, detail, retryable: true, rateLimited: geminiRes.status === 429 };
    }

    if (!geminiRes.ok) {
      const err = await geminiRes.json().catch(() => ({}));
      const errMsg = err?.error?.message || `Erro ${geminiRes.status}`;
      const detail = JSON.stringify(err).slice(0, 500);
      // 404 = modelo inexistente → não aborta a cascata, cai pro próximo modelo
      return { ok: false, error: `${modelId}: ${errMsg}`, detail, retryable: geminiRes.status === 404 };
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

    // Rede de segurança: /api/analyze só serve respostas JSON. Se o modelo
    // respondeu mas sem JSON parseável, trata como falha retentável → a cascata
    // cai no próximo modelo (fallback p/ o 2.5-flash comprovado) em vez de
    // devolver algo que o front não consegue interpretar.
    const limpoJson = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "");
    const blocoJson = limpoJson.match(/\{[\s\S]*\}/) || limpoJson.match(/\[[\s\S]*\]/);
    let jsonOk = false;
    if (blocoJson) {
      try { JSON.parse(blocoJson[0]); jsonOk = true; }
      catch {
        try { JSON.parse(blocoJson[0].replace(/,\s*([}\]])/g, "$1")); jsonOk = true; }
        catch { jsonOk = false; }
      }
    }
    if (!jsonOk) {
      log(`${modelId} respondeu sem JSON parseável (${text.length} chars)`);
      return { ok: false, error: `${modelId} retornou resposta sem JSON válido`, detail: text.slice(0, 200), retryable: true };
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const plano = await verificarPlano(req, log);
    log(`PLANO ${plano.ok ? 'OK' : 'BLOQUEADO'} (${plano.motivo})`);
    if (!plano.ok) {
      return res.status(402).json({
        error: plano.motivo === 'trial-expirado'
          ? 'Seu teste grátis de 7 dias terminou. Assine um plano para continuar usando a análise com IA.'
          : 'Sua assinatura expirou. Renove o plano para continuar usando a análise com IA.',
        planoBloqueado: true
      });
    }

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

    // Estratégia: tenta com search se pedido, depois sem search.
    // Sem search é rápido (5-15s), então cabem várias tentativas em 60s.
    // Com search é lento (30-50s), então só 1 tentativa.
    // Cada item: [modelId, useSearch]
    // Modelo principal configurável por env (GEMINI_MODEL); default = 3.5-flash
    // (avaliado A/B: mais rápido, menos tokens e tese levemente melhor que o 2.5).
    // 2.5-flash e 2.5-flash-lite ficam como fallback automático (rede de segurança).
    const PRIMARY = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
    const tentativas = useSearch
      ? [
          // Search: tentamos só uma vez (lento). Se falhar, cai pra sem search.
          [PRIMARY, true],
          [PRIMARY, false],
          ['gemini-2.5-flash', false]
        ]
      : [
          // Sem search: principal → fallback 2.5 → fallback leve
          [PRIMARY, false],
          ['gemini-2.5-flash', false],
          ['gemini-2.5-flash-lite', false]
        ];

    log('Sequência de tentativas', tentativas.map(([m, s]) => `${m}${s ? '+search' : ''}`));

    let lastError = null;
    let rateLimited = false;
    const erros = []; // motivo de CADA tentativa (diagnóstico — não só a última)

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
      const linha = `${modelId}${comSearch ? '+search' : ''}: ${r.error}${r.detail ? ` — ${String(r.detail).slice(0, 220)}` : ''}`;
      erros.push(linha);
      log(`FALHA ${linha}`);
      if (r.rateLimited) rateLimited = true;

      // Erros não-retentáveis (auth, prompt malformado): para imediatamente
      if (!r.retryable) {
        log(`STOP: erro não-retentável em ${modelId}`);
        break;
      }
    }

    log(`ALL_FAILED → ${erros.length} tentativa(s)`, { erros, rateLimited });
    // Mensagem model-agnóstica quando é limite de cota: evita citar "pro" só
    // por ele ter sido a última tentativa, e orienta o tempo de espera.
    const msg = rateLimited
      ? "Limite de uso da IA atingido (cota do Gemini). Aguarde cerca de 1 minuto e tente novamente."
      : `IA temporariamente indisponível. ${lastError}. Tente novamente em alguns segundos.`;
    return res.status(503).json({
      error: msg,
      rateLimited,
      _debug: erros // array com o motivo de cada modelo (visível no console do navegador)
    });

  } catch (err) {
    log(`UNHANDLED_ERROR: ${err.message}`, { stack: err.stack?.split('\n').slice(0, 5).join(' | ') });
    return res.status(500).json({ error: err.message || 'Erro interno' });
  }
}
