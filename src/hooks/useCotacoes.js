import { useState, useEffect, useRef } from "react";
import { buscarCotacoes } from "../lib/cotacoes";

/**
 * Hook que busca e mantém atualizadas as cotações de um conjunto de tickers.
 * Atualiza a cada 60 segundos por padrão.
 *
 * @param {string[]} tickers - Lista de tickers a monitorar
 * @param {Object} options - { intervalMs, enabled, comFundamentos }
 * @returns {{ cotacoes, loading, atualizadoEm, refetch }}
 */
export function useCotacoes(tickers, options = {}) {
  const { intervalMs = 60000, enabled = true, comFundamentos = false } = options;
  const [cotacoes, setCotacoes] = useState({});
  const [loading, setLoading] = useState(false);
  const [atualizadoEm, setAtualizadoEm] = useState(null);
  const tickersRef = useRef([]);

  // Atualiza a ref para uso dentro do interval
  tickersRef.current = tickers;

  const fetchData = async () => {
    if (!tickersRef.current || tickersRef.current.length === 0) return;
    setLoading(true);
    try {
      const data = await buscarCotacoes(tickersRef.current, { comFundamentos });
      if (Object.keys(data).length > 0) {
        setCotacoes(prev => ({ ...prev, ...data }));
        setAtualizadoEm(new Date());
      }
    } catch (e) {
      console.error("Erro ao buscar cotações:", e);
    } finally {
      setLoading(false);
    }
  };

  // Busca inicial + intervalo
  useEffect(() => {
    if (!enabled) return;
    if (!tickers || tickers.length === 0) return;

    fetchData();

    const interval = setInterval(fetchData, intervalMs);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickers.join(","), intervalMs, enabled, comFundamentos]);

  return { cotacoes, loading, atualizadoEm, refetch: fetchData };
}
