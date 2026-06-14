// Identidade da marca — FONTE ÚNICA DE VERDADE.
// Para renomear o app, altere `name` (e, se quiser, `accent`/`domain`) abaixo.
//
// Wordmark com duas cores: `base` (cor normal) + `accent` (cor de destaque).
//   - "Cauril" com accent "ril" → renderiza  Cau + [ril destacado]
//   - "Carteira Nobre" com accent "Nobre" → Carteira + [Nobre destacado]
//   - accent "" → nome inteiro em uma cor só
//
// URLs públicas/canônicas JÁ migradas para cauril.com.br:
//   index.html (og/twitter), public/manifest.json, api/*.js (APP_URL),
//   scripts/gen-seo.mjs (BASE), scripts/seed-test-user.js, README.md, CLAUDE.md
// Mantidos PROPOSITALMENTE em invent-ia.vercel.app (domínio default, sempre no ar):
//   CI (.github/workflows/ci.yml), testes (smoke.js, playwright.config.js) e os
//   triggers de cron (.github/workflows/cron-*.yml) — plumbing interno, mais robusto.

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
