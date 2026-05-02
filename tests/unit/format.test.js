import { describe, it, expect } from 'vitest';
import { fmt, fmtBRL, fmtK } from '../../src/lib/calc';

describe('fmt - formatação numérica', () => {
  it('formata número com 2 casas decimais por padrão', () => {
    expect(fmt(10.567)).toBe('10.57');
    expect(fmt(0)).toBe('0.00');
  });

  it('respeita número de casas decimais', () => {
    expect(fmt(10.567, 0)).toBe('11');
    expect(fmt(10.567, 4)).toBe('10.5670');
  });

  it('retorna "–" para null/undefined/NaN', () => {
    expect(fmt(null)).toBe('–');
    expect(fmt(undefined)).toBe('–');
    expect(fmt(NaN)).toBe('–');
  });

  it('aceita strings numéricas', () => {
    expect(fmt('10.5')).toBe('10.50');
  });
});

describe('fmtBRL - formatação Real brasileiro', () => {
  it('formata corretamente em BRL', () => {
    const resultado = fmtBRL(1234.56);
    // Pode variar entre "R$ 1.234,56" e "R$\u00A01.234,56" (non-breaking space)
    expect(resultado).toMatch(/R\$\s?1\.234,56/);
  });

  it('formata zero', () => {
    expect(fmtBRL(0)).toMatch(/R\$\s?0,00/);
  });

  it('retorna "–" para valores inválidos', () => {
    expect(fmtBRL(null)).toBe('–');
    expect(fmtBRL(undefined)).toBe('–');
    expect(fmtBRL(NaN)).toBe('–');
  });

  it('formata valores negativos', () => {
    const resultado = fmtBRL(-100);
    expect(resultado).toMatch(/R\$/);
    expect(resultado).toContain('100');
  });
});

describe('fmtK - formatação compacta', () => {
  it('formata milhões com sufixo M', () => {
    expect(fmtK(1500000)).toBe('R$1.5M');
    expect(fmtK(2000000)).toBe('R$2.0M');
  });

  it('formata milhares com sufixo k', () => {
    expect(fmtK(1500)).toBe('R$2k'); // arredonda
    expect(fmtK(5000)).toBe('R$5k');
    expect(fmtK(12000)).toBe('R$12k');
  });

  it('valores < 1000 usam fmtBRL completo', () => {
    expect(fmtK(500)).toMatch(/R\$\s?500,00/);
    expect(fmtK(0)).toMatch(/R\$\s?0,00/);
  });

  it('retorna "–" para valores inválidos', () => {
    expect(fmtK(null)).toBe('–');
    expect(fmtK(NaN)).toBe('–');
  });
});
