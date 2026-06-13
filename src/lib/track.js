// Camada fina de eventos de funil (analytics).
// Hoje envia para o Vercel Analytics (custom events). É seguro chamar em
// qualquer lugar: se o analytics não estiver disponível, vira no-op.
//
// Eventos de funil padronizados (use estes nomes para montar funis):
//   landing_cta        { local }      visitante clicou num CTA da landing
//   signup_started                    abriu/enviou o formulário de cadastro
//   signup_success                    cadastro concluído (= trial iniciado)
//   login_success                     login concluído
//   analyze_clicked    { tipo }       clicou para rodar uma análise de IA
//   paywall_view       { motivo }     viu a tela de planos (bloqueio/overlay)
//   plan_clicked       { plano }      clicou em "Assinar" um plano
//
// Para funis completos no futuro (free): basta plugar um PostHog key — a
// função já tenta window.posthog.capture se existir.
import { track as vercelTrack } from "@vercel/analytics";

export function track(evento, props = {}) {
  try {
    vercelTrack(evento, props);
  } catch { /* analytics indisponível: ignora */ }
  try {
    if (typeof window !== "undefined" && window.posthog?.capture) {
      window.posthog.capture(evento, props);
    }
  } catch { /* idem */ }
  if (import.meta.env?.DEV) console.debug("[track]", evento, props);
}
