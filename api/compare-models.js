// ─── TEMPORÁRIO: comparação A/B de modelos Gemini ─────────────────────────────
// Objetivo: decidir por evidência se vale trocar o modelo da IA.
// Roda no servidor (a GEMINI_API_KEY nunca sai da Vercel).
// Protegido por CRON_SECRET. REMOVER após a avaliação.
//
// Uso (no navegador):
//   /api/compare-models?secret=SEU_CRON_SECRET
//   /api/compare-models?secret=...&models=gemini-2.5-flash,gemini-3-flash
//
// Retorna: lista de modelos disponíveis + saída lado a lado (texto, latência,
// se o JSON saiu válido) para o MESMO prompt de análise.

const BASE = "https://generativelanguage.googleapis.com/v1beta";

// Prompt representativo do que o app pede (tese de ticker em JSON).
const PROMPT_TESTE = `Você é analista financeiro brasileiro. Hoje: ${new Date().toLocaleDateString("pt-BR")}.

DADOS REAIS de BBAS3 (Banco do Brasil):
{
  "ticker": "BBAS3", "tipo": "Ação", "setor": "Bancos",
  "preco": 27.4, "variacaoDia": -0.9,
  "pl": 4.2, "pvp": 0.95, "roe": 18.5, "margemLiquida": 28, "dy": 9.1, "divEbitda": null
}

Sua tarefa: gerar a TESE DE INVESTIMENTO baseada nesses números.
Responda APENAS este JSON (sem markdown, sem inventar números além dos fornecidos):
{
  "fundamentos": "2-3 parágrafos sobre o ativo, vantagens e riscos (sem repetir os números)",
  "tese": { "tipo": "comprar|aguardar|evitar", "score": 80, "argumentos_positivos": ["..."], "argumentos_negativos": ["..."], "preco_alvo": 32.0, "horizonte": "12 meses" },
  "comparaveis": ["ITUB4","SANB11","BBDC4"],
  "resumo": "1-2 frases finais"
}`;

function pareceJSONValido(texto) {
  if (!texto) return false;
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) return false;
  try { JSON.parse(m[0]); return true; } catch { return false; }
}

async function rodarModelo(modelId, apiKey) {
  const url = `${BASE}/models/${modelId}:generateContent?key=${apiKey}`;
  const t0 = Date.now();
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: PROMPT_TESTE }] }],
        generationConfig: { temperature: 0.7 }
      }),
      signal: AbortSignal.timeout(25000)
    });
    const latencyMs = Date.now() - t0;
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      return { modelId, ok: false, status: r.status, latencyMs, erro: body?.error?.message?.slice(0, 300) || `HTTP ${r.status}` };
    }
    const data = await r.json();
    const cand = data?.candidates?.[0];
    const texto = cand?.content?.parts?.map(p => p.text).filter(Boolean).join("") || "";
    return {
      modelId, ok: true, status: 200, latencyMs,
      finishReason: cand?.finishReason,
      chars: texto.length,
      jsonValido: pareceJSONValido(texto),
      tokens: data?.usageMetadata || null,
      texto
    };
  } catch (e) {
    return { modelId, ok: false, latencyMs: Date.now() - t0, erro: e.name === "TimeoutError" ? "timeout (>25s)" : e.message };
  }
}

export default async function handler(req, res) {
  const secret = req.query.secret || (req.headers.authorization || "").replace("Bearer ", "");
  if (!process.env.CRON_SECRET) return res.status(500).json({ error: "CRON_SECRET não configurado" });
  if (secret !== process.env.CRON_SECRET) return res.status(401).json({ error: "Unauthorized — passe ?secret=SEU_CRON_SECRET" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY não configurada" });

  // 1) Descobre modelos disponíveis (para sabermos os IDs exatos)
  let disponiveis = [];
  try {
    const lr = await fetch(`${BASE}/models?key=${apiKey}&pageSize=1000`, { signal: AbortSignal.timeout(15000) });
    const lj = await lr.json();
    disponiveis = (lj?.models || [])
      .filter(m => (m.supportedGenerationMethods || []).includes("generateContent"))
      .map(m => m.name.replace(/^models\//, ""))
      .filter(n => /flash|pro/i.test(n) && !/tts|image|audio|vision/i.test(n))
      .sort();
  } catch (e) {
    disponiveis = [`(falha ao listar: ${e.message})`];
  }

  // 2) Decide quais comparar
  const pedidos = (req.query.models || "").split(",").map(s => s.trim()).filter(Boolean);
  const candidatos = pedidos.length
    ? pedidos
    : ["gemini-2.5-flash", "gemini-3-flash", "gemini-flash-latest"].filter(c => disponiveis.includes(c) || pedidos.length === 0);

  // 3) Roda cada modelo (sequencial, para caber no timeout)
  const resultados = [];
  for (const m of candidatos) {
    resultados.push(await rodarModelo(m, apiKey));
  }

  return res.status(200).json({
    aviso: "Endpoint temporário de avaliação — remover após decidir.",
    modelosDisponiveis: disponiveis,
    comparados: candidatos,
    resultados
  });
}
