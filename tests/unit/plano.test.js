import { describe, it, expect } from "vitest";
import { statusPlano, TRIAL_DIAS, PLANOS } from "../../src/lib/plano";

const AGORA = new Date("2026-06-12T12:00:00Z");
const dias = (n) => new Date(AGORA.getTime() + n * 86400000).toISOString();

describe("statusPlano", () => {
  it("perfil ausente → fail-open como trial cheio (nunca tranca por bug nosso)", () => {
    const s = statusPlano(null, AGORA);
    expect(s.ativo).toBe(true);
    expect(s.expirado).toBe(false);
    expect(s.trial).toBe(true);
    expect(s.diasRestantes).toBe(TRIAL_DIAS);
  });

  it("vitalício nunca expira", () => {
    const s = statusPlano({ plano: "vitalicio", trial_fim: dias(-100) }, AGORA);
    expect(s.ativo).toBe(true);
    expect(s.expirado).toBe(false);
    expect(s.trial).toBe(false);
  });

  it("trial em andamento: ativo, com dias restantes (ceil)", () => {
    const s = statusPlano({ plano: "trial", trial_fim: dias(3.5) }, AGORA);
    expect(s.ativo).toBe(true);
    expect(s.trial).toBe(true);
    expect(s.diasRestantes).toBe(4);
  });

  it("trial no último dia: ainda ativo", () => {
    const s = statusPlano({ plano: "trial", trial_fim: dias(0.25) }, AGORA);
    expect(s.ativo).toBe(true);
    expect(s.diasRestantes).toBe(1);
  });

  it("trial expirado: bloqueia", () => {
    const s = statusPlano({ plano: "trial", trial_fim: dias(-1) }, AGORA);
    expect(s.ativo).toBe(false);
    expect(s.expirado).toBe(true);
    expect(s.diasRestantes).toBe(0);
  });

  it("trial exatamente agora: expirado (ms <= 0)", () => {
    const s = statusPlano({ plano: "trial", trial_fim: AGORA.toISOString() }, AGORA);
    expect(s.expirado).toBe(true);
  });

  it("trial com trial_fim inválida/ausente → fail-open", () => {
    expect(statusPlano({ plano: "trial", trial_fim: null }, AGORA).ativo).toBe(true);
    expect(statusPlano({ plano: "trial", trial_fim: "data-podre" }, AGORA).ativo).toBe(true);
  });

  it("mensal vigente: ativo, não é trial", () => {
    const s = statusPlano({ plano: "mensal", plano_expira_em: dias(20), trial_fim: dias(-30) }, AGORA);
    expect(s.ativo).toBe(true);
    expect(s.trial).toBe(false);
    expect(s.plano).toBe("mensal");
  });

  it("mensal sem data de expiração: ativo (renovação gerida fora)", () => {
    const s = statusPlano({ plano: "mensal", plano_expira_em: null }, AGORA);
    expect(s.ativo).toBe(true);
  });

  it("anual expirado: bloqueia como assinatura (não como trial)", () => {
    const s = statusPlano({ plano: "anual", plano_expira_em: dias(-1), trial_fim: dias(-400) }, AGORA);
    expect(s.expirado).toBe(true);
    expect(s.trial).toBe(false);
    expect(s.plano).toBe("anual");
  });

  it("plano desconhecido cai na regra do trial (usa trial_fim)", () => {
    const ok = statusPlano({ plano: "beta", trial_fim: dias(2) }, AGORA);
    expect(ok.ativo).toBe(true);
    const ruim = statusPlano({ plano: "beta", trial_fim: dias(-2) }, AGORA);
    expect(ruim.expirado).toBe(true);
  });
});

describe("PLANOS (catálogo de venda)", () => {
  it("tem mensal e anual com preço positivo", () => {
    const ids = PLANOS.map(p => p.id);
    expect(ids).toContain("mensal");
    expect(ids).toContain("anual");
    PLANOS.forEach(p => expect(p.preco).toBeGreaterThan(0));
  });

  it("anual sai mais barato por mês que o mensal", () => {
    const mensal = PLANOS.find(p => p.id === "mensal");
    const anual = PLANOS.find(p => p.id === "anual");
    expect(anual.preco / 12).toBeLessThan(mensal.preco);
  });
});
