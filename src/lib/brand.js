// Identidade da marca — FONTE ÚNICA DE VERDADE.
// Para renomear o app, altere `name` (e, se quiser, `accent`/`domain`) abaixo.
//
// Wordmark com duas cores: `base` (cor normal) + `accent` (cor de destaque).
//   - "Invetoria" com accent "oria" → renderiza  Invet + [oria destacado]
//   - "Carteira Nobre" com accent "Nobre" → Carteira + [Nobre destacado]
//   - accent "" → nome inteiro em uma cor só
//
// ⚠️ Lugares FORA do bundle React (atualizar à mão ao rebrandar):
//   - index.html ............ <title> + meta og:/twitter: (NOME ok; URLs após migrar domínio)
//   - public/manifest.json .. name / short_name (PWA)
//   - api/*.js .............. APP_URL (mp-criar-pagamento.js, cron-emails.js) — trocar após comprar domínio
//   - scripts/*.{mjs,js} .... gen-seo.mjs, gen-og.mjs, seed-test-user.js (BASE/URL)
//   - .github/workflows/*.yml SITE_URL / BASE_URL / URLs de cron
//   - README.md / CLAUDE.md . menções de produção

const name = "Invetoria";   // ← wordmark (texto puro)
const accent = "oria";      // ← trecho final destacado no logo ("" desliga o destaque)
const domain = "invent-ia.vercel.app"; // ⚠️ trocar p/ "invetoria.com" depois de comprar o domínio

const base = accent && name.endsWith(accent) ? name.slice(0, -accent.length) : name;

export const BRAND = {
  name,                                            // "Invetoria" (texto puro, alt de imagem)
  base,                                            // "Invet"  (parte sem destaque do logo)
  accent,                                          // "oria"   (parte destacada do logo)
  full: name,                                      // alias p/ textos puros (email, footer, title)
  tagline: "sua carteira da B3 analisada por IA",  // subtítulo / SEO
  domain,
  url: `https://${domain}`,
};
