// ─── Proxy para histórico de preços via brapi ────────────────────────────────
// brapi free retorna histórico OHLCV diário com ?range=1y&interval=1d
//
// Usage:
//   GET /api/historico?ticker=PETR4&range=1mo
//   GET /api/historico?ticker=PETR4&range=3mo
//
// Ranges válidos: 1mo, 3mo, 6mo, 1y (free), 2y/5y/10y/max (Pro)
// Para sparkline pequena (12-30 pontos) range=1mo é o ideal.

export const config = {
  maxDuration: 8
};

const BRAPI_BASE = "https://brapi.dev/api";

// Cache em memória 6h - histórico diário não muda mais que isso
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map(); // chave: "ticker|range" → { data, ts }

const RANGES_VALIDOS = ['1mo', '3mo', '6mo', '1y'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = process.env.BRAPI_TOKEN;
  if (!token) {
    return res.status(500).json({ error: 'BRAPI_TOKEN não configurado' });
  }

  const ticker = (req.query.ticker || '').trim().toUpperCase();
  const range = (req.query.range || '1mo').toLowerCase();

  if (!ticker) {
    return res.status(400).json({ error: 'Parâmetro ticker é obrigatório' });
  }
  if (!RANGES_VALIDOS.includes(range)) {
    return res.status(400).json({ error: `Range inválido. Use: ${RANGES_VALIDOS.join(', ')}` });
  }

  const cacheKey = `${ticker}|${range}`;
  const cached = cache.get(cacheKey);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
    return res.status(200).json({ ...cached.data, fromCache: true });
  }

  try {
    const url = `${BRAPI_BASE}/quote/${ticker}?range=${range}&interval=1d&token=${token}`;
    const r = await fetch(url, { signal: AbortSignal.timeout(7000) });

    if (!r.ok) {
      return res.status(r.status).json({
        error: `brapi retornou HTTP ${r.status}`,
        ticker,
        range
      });
    }

    const data = await r.json();
    const result = data.results?.[0];
    if (!result) {
      return res.status(404).json({ error: 'Sem resultados para este ticker', ticker });
    }

    const histRaw = result.historicalDataPrice || [];
    // Reduz tamanho do payload - frontend só precisa close para sparkline
    const pontos = histRaw.map(p => ({
      d: p.date,           // unix timestamp
      c: p.close,          // close (suficiente para sparkline)
    })).filter(p => p.c != null);

    const resposta = {
      ticker: result.symbol,
      range,
      precoAtual: result.regularMarketPrice,
      min52: result.fiftyTwoWeekLow,
      max52: result.fiftyTwoWeekHigh,
      total: pontos.length,
      pontos
    };

    cache.set(cacheKey, { data: resposta, ts: Date.now() });
    return res.status(200).json({ ...resposta, fromCache: false });

  } catch (err) {
    console.error(`/api/historico ${ticker}:`, err.message);
    return res.status(500).json({ error: err.message || 'Erro interno', ticker });
  }
}
