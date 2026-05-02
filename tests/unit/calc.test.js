import { describe, it, expect } from 'vitest';
import {
  juroCompostos,
  gerarProjecao,
  calcularIR,
  calcularPesos,
  novoPrecoMedio,
  quantidadeComprável,
  dyMedioCarteira,
  alertasRebalanceamento
} from '../../src/lib/calc';

describe('juroCompostos', () => {
  it('calcula corretamente sem juros (taxa 0)', () => {
    // R$1000 + R$100/mês × 12 meses = R$2200
    expect(juroCompostos(1000, 100, 0, 12)).toBe(2200);
  });

  it('calcula valor futuro com aporte mensal e taxa anual', () => {
    // R$10k inicial + R$500/mês × 60 meses (5 anos) a 13.75% a.a.
    const resultado = juroCompostos(10000, 500, 13.75, 60);
    // Esperado em torno de R$ 63 mil (cálculo financeiro padrão)
    expect(resultado).toBeGreaterThan(60000);
    expect(resultado).toBeLessThan(70000);
  });

  it('sem aportes, só capitaliza o valor presente', () => {
    // R$10k a 10% a.a. por 12 meses ≈ R$11.047 (juros mensais compostos)
    const resultado = juroCompostos(10000, 0, 10, 12);
    expect(resultado).toBeCloseTo(11047, -1); // tolerância de 10
  });

  it('só aportes, sem capital inicial', () => {
    // R$100/mês por 12 meses sem juros = R$1200
    expect(juroCompostos(0, 100, 0, 12)).toBe(1200);
  });
});

describe('gerarProjecao', () => {
  it('gera pontos a cada 3 meses', () => {
    const pts = gerarProjecao(1000, 100, 10, 5);
    // 5 anos = 60 meses, ponto a cada 3 meses = 21 pontos (0, 3, 6, ..., 60)
    expect(pts.length).toBe(21);
  });

  it('primeiro ponto é o valor inicial', () => {
    const pts = gerarProjecao(5000, 100, 10, 1);
    expect(pts[0].valor).toBe(5000);
    expect(pts[0].meses).toBe(0);
    expect(pts[0].ano).toBe('0.0a');
  });

  it('último ponto representa o final do período', () => {
    const pts = gerarProjecao(1000, 100, 0, 1);
    const ultimo = pts[pts.length - 1];
    expect(ultimo.valor).toBe(2200); // 1000 + 100*12
    expect(ultimo.meses).toBe(12);
  });
});

describe('calcularIR', () => {
  it('retorna isento quando não há vendas', () => {
    expect(calcularIR([])).toEqual({
      isento: true, ir: 0, totalVendido: 0, lucro: 0
    });
  });

  it('isenta quando vendeu menos de R$20k em ações', () => {
    const vendas = [{ ticker: 'PETR4', qtd: 100, preco: 50, pm: 30 }];
    // Total vendido: R$ 5000, lucro R$ 2000
    const r = calcularIR(vendas, 'acoes');
    expect(r.isento).toBe(true);
    expect(r.ir).toBe(0);
    expect(r.lucro).toBe(2000);
  });

  it('cobra 15% sobre lucro quando vendas > R$20k em ações', () => {
    // Total: R$ 25.000, custo: R$ 15.000, lucro: R$ 10.000
    const vendas = [{ ticker: 'PETR4', qtd: 500, preco: 50, pm: 30 }];
    const r = calcularIR(vendas, 'acoes');
    expect(r.isento).toBe(false);
    expect(r.aliquota).toBe(15);
    expect(r.ir).toBe(10000 * 0.15);
  });

  it('FIIs sempre tributam 20% sobre lucro', () => {
    const vendas = [{ ticker: 'MXRF11', qtd: 50, preco: 11, pm: 10 }];
    // Vendido R$ 550, lucro R$ 50
    const r = calcularIR(vendas, 'fii');
    expect(r.isento).toBe(false);
    expect(r.aliquota).toBe(20);
    expect(r.ir).toBe(50 * 0.20);
  });

  it('não cobra IR se houver prejuízo', () => {
    const vendas = [{ ticker: 'PETR4', qtd: 500, preco: 30, pm: 50 }];
    // Vendido R$15k (isento por ser <20k), prejuízo R$10k
    const r = calcularIR(vendas, 'acoes');
    expect(r.ir).toBe(0);
    expect(r.lucro).toBe(-10000);
  });

  it('considera taxas de corretagem', () => {
    const vendas = [{ ticker: 'ITUB4', qtd: 100, preco: 50, pm: 30, taxas: 100 }];
    const r = calcularIR(vendas, 'acoes');
    // Lucro: 5000 - 3000 - 100 = 1900
    expect(r.lucro).toBe(1900);
  });
});

describe('calcularPesos', () => {
  it('retorna array vazio para carteira vazia', () => {
    expect(calcularPesos([])).toEqual([]);
    expect(calcularPesos(null)).toEqual([]);
  });

  it('calcula pesos baseado em qtd × preço', () => {
    const carteira = [
      { ticker: 'PETR4', qtd: 100, pm: 50 }, // R$ 5000
      { ticker: 'ITUB4', qtd: 100, pm: 30 }  // R$ 3000
    ];
    const pesos = calcularPesos(carteira);
    // Total: R$ 8000
    expect(pesos[0].peso).toBeCloseTo(62.5, 1); // 5000/8000
    expect(pesos[1].peso).toBeCloseTo(37.5, 1); // 3000/8000
  });

  it('usa preço atual do mapa de preços quando disponível', () => {
    const carteira = [{ ticker: 'PETR4', qtd: 100, pm: 30 }];
    const precos = { PETR4: 50 };
    const pesos = calcularPesos(carteira, precos);
    expect(pesos[0].valor).toBe(5000); // 100 × 50 (preço atual, não pm)
  });

  it('soma de todos os pesos é 100%', () => {
    const carteira = [
      { ticker: 'A', qtd: 10, pm: 100 },
      { ticker: 'B', qtd: 20, pm: 50 },
      { ticker: 'C', qtd: 5, pm: 200 }
    ];
    const pesos = calcularPesos(carteira);
    const soma = pesos.reduce((s, p) => s + p.peso, 0);
    expect(soma).toBeCloseTo(100, 1);
  });
});

describe('novoPrecoMedio', () => {
  it('calcula PM corretamente após nova compra', () => {
    // Tinha 100 cotas a R$ 50 = R$ 5000
    // Compra mais 50 a R$ 60 = R$ 3000
    // Total: 150 cotas a R$ 53.33
    expect(novoPrecoMedio(100, 50, 50, 60)).toBeCloseTo(53.33, 2);
  });

  it('PM permanece igual se compra ao mesmo preço', () => {
    expect(novoPrecoMedio(100, 50, 50, 50)).toBe(50);
  });

  it('primeira compra (sem posição anterior)', () => {
    expect(novoPrecoMedio(0, 0, 100, 30)).toBe(30);
  });

  it('retorna 0 se quantidade total for zero', () => {
    expect(novoPrecoMedio(0, 0, 0, 100)).toBe(0);
  });
});

describe('quantidadeComprável', () => {
  it('calcula qtd inteira que cabe no valor', () => {
    expect(quantidadeComprável(500, 47)).toBe(10); // 10 × 47 = 470
    expect(quantidadeComprável(100, 25)).toBe(4);
    expect(quantidadeComprável(1000, 33.33)).toBe(30);
  });

  it('retorna 0 se preço inválido', () => {
    expect(quantidadeComprável(500, 0)).toBe(0);
    expect(quantidadeComprável(500, null)).toBe(0);
    expect(quantidadeComprável(500, -10)).toBe(0);
  });

  it('retorna 0 se valor < preço', () => {
    expect(quantidadeComprável(50, 100)).toBe(0);
  });
});

describe('dyMedioCarteira', () => {
  it('calcula DY ponderado pelos pesos', () => {
    const posicoes = [
      { dy: 8, peso: 50 },  // contribui 4
      { dy: 4, peso: 50 }   // contribui 2
    ];
    expect(dyMedioCarteira(posicoes)).toBe(6);
  });

  it('retorna 0 para carteira vazia', () => {
    expect(dyMedioCarteira([])).toBe(0);
    expect(dyMedioCarteira(null)).toBe(0);
  });

  it('ignora ativos sem DY', () => {
    const posicoes = [
      { peso: 50 }, // sem DY
      { dy: 10, peso: 50 } // contribui 5
    ];
    expect(dyMedioCarteira(posicoes)).toBe(5);
  });
});

describe('alertasRebalanceamento', () => {
  it('alerta quando desvio > 5%', () => {
    const posicoes = [
      { ticker: 'PETR4', peso: 30 }, // alvo 20% — desvio 10%
      { ticker: 'ITUB4', peso: 18 }  // alvo 20% — desvio 2%
    ];
    const alvo = { PETR4: 20, ITUB4: 20 };
    const alertas = alertasRebalanceamento(posicoes, alvo);
    expect(alertas).toHaveLength(1);
    expect(alertas[0].ticker).toBe('PETR4');
  });

  it('respeita o desvio customizado', () => {
    const posicoes = [{ ticker: 'PETR4', peso: 22 }];
    const alvo = { PETR4: 20 };
    expect(alertasRebalanceamento(posicoes, alvo, 1)).toHaveLength(1);
    expect(alertasRebalanceamento(posicoes, alvo, 5)).toHaveLength(0);
  });

  it('ignora ativos sem peso alvo', () => {
    const posicoes = [{ ticker: 'PETR4', peso: 50 }];
    const alvo = {}; // nenhum alvo definido
    expect(alertasRebalanceamento(posicoes, alvo)).toHaveLength(0);
  });
});
