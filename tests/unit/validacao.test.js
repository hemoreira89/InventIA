import { describe, it, expect } from 'vitest';
import {
  tickerValido,
  tipoTicker,
  concentracaoSetor,
  temConcentracaoRisco
} from '../../src/lib/calc';

describe('tickerValido', () => {
  it('aceita tickers válidos da B3', () => {
    expect(tickerValido('PETR4')).toBe(true);
    expect(tickerValido('VALE3')).toBe(true);
    expect(tickerValido('ITUB4')).toBe(true);
    expect(tickerValido('BBAS3')).toBe(true);
    expect(tickerValido('MXRF11')).toBe(true);
    expect(tickerValido('SANB11')).toBe(true);
  });

  it('aceita lowercase (faz uppercase internamente)', () => {
    expect(tickerValido('petr4')).toBe(true);
    expect(tickerValido('vale3')).toBe(true);
  });

  it('aceita com espaços ao redor', () => {
    expect(tickerValido('  PETR4  ')).toBe(true);
  });

  it('rejeita tickers inválidos', () => {
    expect(tickerValido('')).toBe(false);
    expect(tickerValido(null)).toBe(false);
    expect(tickerValido('PE4')).toBe(false);          // poucas letras
    expect(tickerValido('PETRO4')).toBe(false);       // muitas letras
    expect(tickerValido('PETR')).toBe(false);         // sem número
    expect(tickerValido('PETR456')).toBe(false);      // muitos números
    expect(tickerValido('PE6R4')).toBe(false);        // número no meio
    expect(tickerValido('PETR4-XYZ')).toBe(false);    // caracteres extras
  });
});

describe('tipoTicker', () => {
  it('identifica FII (terminação 11)', () => {
    expect(tipoTicker('MXRF11')).toBe('FII');
    expect(tipoTicker('HGLG11')).toBe('FII');
    expect(tipoTicker('XPLG11')).toBe('FII');
  });

  it('identifica BDR (terminação 32-35)', () => {
    expect(tipoTicker('AAPL34')).toBe('BDR');
    expect(tipoTicker('MSFT34')).toBe('BDR');
  });

  it('identifica ações ON (terminação 3)', () => {
    expect(tipoTicker('VALE3')).toBe('acao_on');
    expect(tipoTicker('BBAS3')).toBe('acao_on');
  });

  it('identifica ações PN (terminação 4)', () => {
    expect(tipoTicker('PETR4')).toBe('acao_pn');
    expect(tipoTicker('ITUB4')).toBe('acao_pn');
  });

  it('retorna desconhecido para input vazio', () => {
    expect(tipoTicker('')).toBe('desconhecido');
    expect(tipoTicker(null)).toBe('desconhecido');
  });
});

describe('concentracaoSetor', () => {
  it('agrupa por setor e soma os pesos', () => {
    const posicoes = [
      { ticker: 'ITUB4', setor: 'Bancos', peso: 20 },
      { ticker: 'BBAS3', setor: 'Bancos', peso: 15 },
      { ticker: 'PETR4', setor: 'Petróleo', peso: 30 }
    ];
    const concentracao = concentracaoSetor(posicoes);
    expect(concentracao).toHaveLength(2);
    expect(concentracao[0]).toEqual({ setor: 'Bancos', peso: 35 });
    expect(concentracao[1]).toEqual({ setor: 'Petróleo', peso: 30 });
  });

  it('ordena do maior para o menor peso', () => {
    const posicoes = [
      { setor: 'A', peso: 10 },
      { setor: 'B', peso: 50 },
      { setor: 'C', peso: 25 }
    ];
    const r = concentracaoSetor(posicoes);
    expect(r[0].setor).toBe('B');
    expect(r[1].setor).toBe('C');
    expect(r[2].setor).toBe('A');
  });

  it('agrupa "Outros" para ativos sem setor', () => {
    const posicoes = [
      { ticker: 'X', peso: 10 },
      { ticker: 'Y', setor: undefined, peso: 20 }
    ];
    const r = concentracaoSetor(posicoes);
    expect(r[0]).toEqual({ setor: 'Outros', peso: 30 });
  });

  it('retorna array vazio para entrada vazia', () => {
    expect(concentracaoSetor([])).toEqual([]);
    expect(concentracaoSetor(null)).toEqual([]);
  });
});

describe('temConcentracaoRisco', () => {
  it('detecta risco quando 1 ativo > 30%', () => {
    const posicoes = [
      { ticker: 'PETR4', peso: 35, setor: 'Petróleo' },
      { ticker: 'ITUB4', peso: 25, setor: 'Bancos' }
    ];
    expect(temConcentracaoRisco(posicoes)).toBe(true);
  });

  it('detecta risco quando 1 setor > 50%', () => {
    const posicoes = [
      { ticker: 'ITUB4', peso: 25, setor: 'Bancos' },
      { ticker: 'BBAS3', peso: 20, setor: 'Bancos' },
      { ticker: 'BBDC4', peso: 15, setor: 'Bancos' } // soma: 60% bancos
    ];
    expect(temConcentracaoRisco(posicoes)).toBe(true);
  });

  it('não acusa risco em carteira diversificada', () => {
    const posicoes = [
      { ticker: 'A', peso: 20, setor: 'Bancos' },
      { ticker: 'B', peso: 20, setor: 'Energia' },
      { ticker: 'C', peso: 20, setor: 'Petróleo' },
      { ticker: 'D', peso: 20, setor: 'FII' },
      { ticker: 'E', peso: 20, setor: 'Saúde' }
    ];
    expect(temConcentracaoRisco(posicoes)).toBe(false);
  });

  it('false para carteira vazia', () => {
    expect(temConcentracaoRisco([])).toBe(false);
    expect(temConcentracaoRisco(null)).toBe(false);
  });
});
