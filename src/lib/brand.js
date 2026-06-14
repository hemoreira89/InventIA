// Identidade da marca — FONTE ÚNICA DE VERDADE.
// Para renomear o app, altere `name` (e, se quiser, `accent`/`domain`) abaixo.
//
// Wordmark com duas cores: `base` (cor normal) + `accent` (cor de destaque).
//   - "Cauril" com accent "ril" → renderiza  Cau + [ril destacado]
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

const name = "Cauril";   // ← wordmark (texto puro)
const accent = "ril";    // ← trecho final destacado no logo ("" desliga o destaque)
const domain = "cauril.com.br"; // domínio de produção (migração em andamento)

const base = accent && name.endsWith(accent) ? name.slice(0, -accent.length) : name;

export const BRAND = {
  name,                                            // "Cauril" (texto puro, alt de imagem)
  base,                                            // "Cau"  (parte sem destaque do logo)
  accent,                                          // "ril"  (parte destacada do logo)
  full: name,                                      // alias p/ textos puros (email, footer, title)
  tagline: "sua carteira da B3 analisada por IA",  // subtítulo / SEO
  domain,
  url: `https://${domain}`,
};
