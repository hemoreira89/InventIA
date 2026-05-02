import { describe, it, expect } from 'vitest';
import { extrairJSON } from '../../src/lib/calc';

describe('extrairJSON', () => {
  it('parseia JSON puro', () => {
    const json = '{"ticker":"PETR4","preco":50}';
    expect(extrairJSON(json)).toEqual({ ticker: 'PETR4', preco: 50 });
  });

  it('extrai JSON dentro de markdown ```json', () => {
    const text = '```json\n{"a":1,"b":2}\n```';
    expect(extrairJSON(text)).toEqual({ a: 1, b: 2 });
  });

  it('extrai JSON dentro de markdown ``` simples', () => {
    const text = '```\n{"a":1}\n```';
    expect(extrairJSON(text)).toEqual({ a: 1 });
  });

  it('extrai JSON com texto explicativo ao redor', () => {
    const text = 'Aqui está a análise: {"ticker":"VALE3","score":80} Espero ter ajudado!';
    expect(extrairJSON(text)).toEqual({ ticker: 'VALE3', score: 80 });
  });

  it('extrai array JSON', () => {
    const text = 'Resultados: [1, 2, 3]';
    expect(extrairJSON(text)).toEqual([1, 2, 3]);
  });

  it('lida com JSON aninhado', () => {
    const text = '{"a":{"b":{"c":1}}, "arr":[1,2,3]}';
    expect(extrairJSON(text)).toEqual({ a: { b: { c: 1 } }, arr: [1, 2, 3] });
  });

  it('lança erro para texto vazio', () => {
    expect(() => extrairJSON('')).toThrow('Resposta vazia');
    expect(() => extrairJSON(null)).toThrow('Resposta vazia');
    expect(() => extrairJSON('   ')).toThrow('Resposta vazia');
  });

  it('lança erro para texto sem JSON', () => {
    expect(() => extrairJSON('Olá, tudo bem?')).toThrow('Não foi possível extrair JSON');
  });

  it('extrai JSON real do formato Gemini', () => {
    const respostaTipica = `Vou analisar PETR4 para você.

\`\`\`json
{
  "ticker": "PETR4",
  "preco": 47.50,
  "indicadores": {
    "dy": 10.5,
    "pl": 4.5
  },
  "tese": {
    "tipo": "comprar",
    "score": 82
  }
}
\`\`\`

Espero que ajude!`;
    const r = extrairJSON(respostaTipica);
    expect(r.ticker).toBe('PETR4');
    expect(r.preco).toBe(47.50);
    expect(r.indicadores.dy).toBe(10.5);
    expect(r.tese.tipo).toBe('comprar');
  });
});
