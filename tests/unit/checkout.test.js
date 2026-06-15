import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock do cliente Supabase — controlamos a sessão retornada por getSession.
vi.mock("../../src/supabase", () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));

import { supabase } from "../../src/supabase";
import { iniciarCheckout } from "../../src/lib/plano";

const semSessao = () => supabase.auth.getSession.mockResolvedValue({ data: { session: null } });
const comSessao = (user) => supabase.auth.getSession.mockResolvedValue({
  data: { session: { access_token: "tok", user } },
});

describe("iniciarCheckout — exige conta e atrela a compra", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    supabase.auth.getSession.mockReset();
  });

  it("sem sessão e sem email → lança login_required (não compra deslogado)", async () => {
    semSessao();
    await expect(iniciarCheckout({ id: "mensal", nome: "Mensal" }, undefined))
      .rejects.toThrow("login_required");
  });

  it("link estático: anexa email e ref(userId) da conta logada", async () => {
    comSessao({ email: "cliente@ex.com", id: "user-123" });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    await iniciarCheckout(
      { id: "mensal", nome: "Mensal", checkoutUrl: "https://pay.example.com/checkout" },
      "cliente@ex.com"
    );

    expect(openSpy).toHaveBeenCalledTimes(1);
    const url = new URL(openSpy.mock.calls[0][0]);
    expect(url.searchParams.get("email")).toBe("cliente@ex.com");
    expect(url.searchParams.get("ref")).toBe("user-123");
  });

  it("link estático preserva params já existentes na URL configurada", async () => {
    comSessao({ email: "a@b.com", id: "u9" });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    await iniciarCheckout(
      { id: "anual", nome: "Anual", checkoutUrl: "https://pay.example.com/c?plano=anual" },
      "a@b.com"
    );

    const url = new URL(openSpy.mock.calls[0][0]);
    expect(url.searchParams.get("plano")).toBe("anual");
    expect(url.searchParams.get("email")).toBe("a@b.com");
    expect(url.searchParams.get("ref")).toBe("u9");
  });

  it("usa o email da sessão mesmo se o param vier vazio", async () => {
    comSessao({ email: "sessao@ex.com", id: "u1" });
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    await iniciarCheckout(
      { id: "mensal", nome: "Mensal", checkoutUrl: "https://pay.example.com/x" },
      null
    );

    const url = new URL(openSpy.mock.calls[0][0]);
    expect(url.searchParams.get("email")).toBe("sessao@ex.com");
  });
});
