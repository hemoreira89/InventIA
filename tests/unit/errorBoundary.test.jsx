import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import ErrorBoundary from "../../src/components/ErrorBoundary.jsx";

// Componente que lança erro de propósito para acionar o boundary.
function Bomba() {
  throw new Error("Falha de teste");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    // Silencia o console.error esperado do React ao capturar o erro.
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renderiza os filhos normalmente quando não há erro", () => {
    render(
      <ErrorBoundary>
        <p>conteúdo ok</p>
      </ErrorBoundary>
    );
    expect(screen.getByText("conteúdo ok")).toBeInTheDocument();
  });

  it("mostra a tela de recuperação quando um filho lança erro", () => {
    render(
      <ErrorBoundary>
        <Bomba />
      </ErrorBoundary>
    );
    expect(screen.getByText("Algo deu errado")).toBeInTheDocument();
    expect(screen.getByText("Recarregar página")).toBeInTheDocument();
    expect(screen.getByText("Tentar de novo")).toBeInTheDocument();
  });

  it("exibe a mensagem do erro capturado", () => {
    render(
      <ErrorBoundary>
        <Bomba />
      </ErrorBoundary>
    );
    expect(screen.getByText(/Falha de teste/)).toBeInTheDocument();
  });
});
