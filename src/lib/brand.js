// Identidade da marca — FONTE ÚNICA DE VERDADE.
// Para renomear o app (nome, sufixo, domínio, URL), altere SÓ os valores abaixo.
// No app o nome é exibido como `name` + `suffix` (este último destacado na cor de acento).
//
// ⚠️ Lugares FORA do bundle React (não importam este arquivo — atualizar à mão ao rebrandar):
//   - index.html ............ <title> + meta og:/twitter:
//   - public/manifest.json .. name / short_name (PWA)
//   - api/*.js .............. APP_URL (mp-criar-pagamento.js, cron-emails.js)
//   - scripts/*.{mjs,js} .... gen-seo.mjs, gen-og.mjs, seed-test-user.js (BASE/URL)
//   - .github/workflows/*.yml SITE_URL / BASE_URL / URLs de cron
//   - README.md / CLAUDE.md . menções de produção

const name = "InvestIA";   // ← troque aqui pra renomear (wordmark base)
const suffix = "Pro";      // ← sufixo destacado (deixe "" para remover)
const domain = "invent-ia.vercel.app"; // ← troque aqui pra trocar o domínio

export const BRAND = {
  name,
  suffix,
  full: suffix ? `${name} ${suffix}` : name,          // nome completo em texto puro
  tagline: "sua carteira da B3 analisada por IA",      // subtítulo / SEO
  domain,
  url: `https://${domain}`,
};
