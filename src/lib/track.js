// Camada fina de eventos de funil (analytics).
// Envia para o Vercel Analytics (custom events) e, se configurado, para o
// Meta Pixel (tráfego pago). É seguro chamar em qualquer lugar: sem analytics
// ou sem Pixel, vira no-op.
//
// Eventos de funil padronizados (use estes nomes para montar funis):
//   landing_cta        { local }      visitante clicou num CTA da landing
//   signup_started                    abriu/enviou o formulário de cadastro   → Meta: Lead
//   signup_success                    cadastro concluído (= trial iniciado)   → Meta: CompleteRegistration
//   login_success                     login concluído
//   analyze_clicked    { tipo }       clicou para rodar uma análise de IA
//   paywall_view       { motivo }     viu a tela de planos (bloqueio/overlay)
//   plan_clicked       { plano,valor} clicou em "Assinar" um plano            → Meta: InitiateCheckout
//   purchase_success   { plano,valor} pagamento confirmado (volta do MP)      → Meta: Purchase
//
// Atribuição (tráfego pago): na 1ª visita capturamos utm_* / fbclid / gclid e
// guardamos (first-touch) no localStorage. A origem (source/campaign) é
// anexada automaticamente aos eventos, pra montar funil por campanha.
//
// Para funis completos no futuro (free): basta plugar um PostHog key — a
// função já tenta window.posthog.capture se existir.
import { track as vercelTrack } from "@vercel/analytics";

// ID do Pixel do Meta — só no .env (Vercel). Sem ele, nada do Meta é carregado.
const META_PIXEL_ID = import.meta.env?.VITE_META_PIXEL_ID || "";

// Google Ads (conta Cauril). Rótulos vêm do painel: Metas → Conversões.
const GOOGLE_ADS_ID = "AW-18257647048";
const GADS_CONV_SIGNUP = `${GOOGLE_ADS_ID}/X7IjCKnd2MIcEMir9oFE`;
const GADS_CONV_PURCHASE = `${GOOGLE_ADS_ID}/h1A0CKzd2MIcEMir9oFE`;

// Preço por plano (fallback quando o evento não traz `valor`).
const PRECOS = { mensal: 24.9, anual: 199 };

// Mapa: evento interno → evento padrão do Meta (o resto continua custom).
const META_STD = {
  signup_started: "Lead",
  signup_success: "CompleteRegistration",
  plan_clicked: "InitiateCheckout",
};

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
const ATTRIB_KEY = "cauril_attrib";

// ── Atribuição (UTM/click ids) ───────────────────────────────────────────────
function captureAttribution() {
  try {
    const p = new URLSearchParams(window.location.search);
    const attrib = {};
    UTM_KEYS.forEach(k => { const v = p.get(k); if (v) attrib[k] = v.slice(0, 120); });
    const fbclid = p.get("fbclid"); if (fbclid) attrib.fbclid = fbclid.slice(0, 255);
    const gclid = p.get("gclid"); if (gclid) attrib.gclid = gclid.slice(0, 255);
    if (Object.keys(attrib).length === 0) return;
    // first-touch: não sobrescreve a primeira origem que trouxe o visitante.
    if (!localStorage.getItem(ATTRIB_KEY)) {
      attrib.ts = new Date().toISOString();
      localStorage.setItem(ATTRIB_KEY, JSON.stringify(attrib));
    }
  } catch { /* sem localStorage/URL: ignora */ }
}

/** Atribuição first-touch guardada (ou null). Útil pra gravar no cadastro. */
export function getAttribution() {
  try { return JSON.parse(localStorage.getItem(ATTRIB_KEY) || "null"); }
  catch { return null; }
}

// ── Meta Pixel ───────────────────────────────────────────────────────────────
function loadMetaPixel() {
  if (!META_PIXEL_ID || typeof window === "undefined" || window.fbq) return;
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  /* eslint-enable */
  try { window.fbq("init", META_PIXEL_ID); window.fbq("track", "PageView"); }
  catch { /* ignora */ }
}

function metaTrack(name, params, opts) {
  try {
    if (typeof window !== "undefined" && window.fbq) {
      if (opts?.eventID) window.fbq("track", name, params, { eventID: opts.eventID });
      else window.fbq("track", name, params);
    }
  } catch { /* ignora */ }
}

// ── Google Ads (gtag) ────────────────────────────────────────────────────────
function loadGoogleAds() {
  if (!GOOGLE_ADS_ID || typeof window === "undefined" || window.gtag) return;
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", GOOGLE_ADS_ID);
}

function gtagConversion(sendTo, params = {}) {
  try {
    if (typeof window !== "undefined" && window.gtag) {
      window.gtag("event", "conversion", { send_to: sendTo, ...params });
    }
  } catch { /* ignora */ }
}

/** Inicializa analytics no boot do app: captura atribuição + carrega Pixel + gtag. */
export function initAnalytics() {
  captureAttribution();
  loadMetaPixel();
  loadGoogleAds();
}

// ── API principal ─────────────────────────────────────────────────────────────
export function track(evento, props = {}) {
  // Anexa a origem (source/campaign) pra montar funil por campanha no Vercel.
  const attrib = getAttribution();
  const enriched = attrib
    ? { ...props, ...(attrib.utm_source ? { src: attrib.utm_source } : {}), ...(attrib.utm_campaign ? { camp: attrib.utm_campaign } : {}) }
    : props;

  try { vercelTrack(evento, enriched); } catch { /* indisponível: ignora */ }
  try {
    if (typeof window !== "undefined" && window.posthog?.capture) {
      window.posthog.capture(evento, enriched);
    }
  } catch { /* idem */ }

  // Espelha no Meta os eventos padronizados (pra otimização do tráfego pago).
  const stdName = META_STD[evento];
  if (stdName) {
    const params = {};
    if (evento === "plan_clicked") {
      params.value = Number(props.valor) || PRECOS[props.plano] || 0;
      params.currency = "BRL";
      if (props.plano) params.content_name = props.plano;
    }
    metaTrack(stdName, params);
  }

  // Google Ads: dispara conversão de Cadastro no signup concluído.
  if (evento === "signup_success") gtagConversion(GADS_CONV_SIGNUP);

  if (import.meta.env?.DEV) console.debug("[track]", evento, enriched);
}

/**
 * Compra confirmada (volta do Mercado Pago). Dispara Purchase no Meta.
 * `event_id` (gerado no checkout) é passado como eventID pra o Meta deduplicar
 * contra o Purchase server-side (Conversions API) com o mesmo id.
 */
export function trackPurchase({ plano, valor, tipo, event_id } = {}) {
  const value = Number(valor) || PRECOS[plano] || 0;
  track("purchase_success", { plano, tipo, valor: value });
  metaTrack("Purchase", { value, currency: "BRL", ...(plano ? { content_name: plano } : {}) },
    event_id ? { eventID: event_id } : undefined);
  gtagConversion(GADS_CONV_PURCHASE, {
    value, currency: "BRL", ...(event_id ? { transaction_id: event_id } : {}),
  });
}
