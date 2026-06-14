// Gera o OG share card (1200x630) usado quando o link é compartilhado no
// WhatsApp / Instagram / Twitter / LinkedIn. Estética alinhada à landing
// (dark, terminal de mercado). Uso: node scripts/gen-og.mjs
import sharp from "sharp";

const W = 1200, H = 630;
const LOGO = "assets-src/cauril-shell.png";

// Linha de "patrimônio" (área) em SVG — mesma vibe do mock da landing.
// Mantém a curva baixa onde há texto (x<900) e só sobe na área direita vazia.
const chart =
  "M0,505 C150,498 300,502 500,488 C650,478 780,482 900,462 " +
  "C1010,444 1090,395 1200,322";
const chartArea = chart + " L1200,630 L0,630 Z";

const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0b0d24"/>
      <stop offset="100%" stop-color="#070713"/>
    </linearGradient>
    <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#00e5a0" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#00e5a0" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="glow" cx="78%" cy="18%" r="55%">
      <stop offset="0%" stop-color="#7b61ff" stop-opacity="0.30"/>
      <stop offset="100%" stop-color="#7b61ff" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>

  <!-- chart -->
  <path d="${chartArea}" fill="url(#area)"/>
  <path d="${chart}" fill="none" stroke="#00e5a0" stroke-width="3"/>

  <!-- brand (o logo é composto por cima via sharp) -->
  <text x="178" y="92" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="800" fill="#e8e8f2">Cau<tspan fill="#7b61ff">ril</tspan></text>

  <!-- badge -->
  <g>
    <rect x="64" y="150" rx="22" ry="22" width="430" height="44" fill="#00e5a01a" stroke="#00e5a04d"/>
    <text x="86" y="179" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="#00e5a0" letter-spacing="1">7 DIAS GRÁTIS · SEM CARTÃO</text>
  </g>

  <!-- headline -->
  <text x="60" y="290" font-family="Arial, Helvetica, sans-serif" font-size="74" font-weight="800" fill="#e8e8f2" letter-spacing="-2">Sua carteira da B3</text>
  <text x="60" y="372" font-family="Arial, Helvetica, sans-serif" font-size="74" font-weight="800" letter-spacing="-2"><tspan fill="#7b61ff">analisada por IA</tspan></text>

  <!-- subline -->
  <text x="62" y="430" font-family="Arial, Helvetica, sans-serif" font-size="27" font-weight="500" fill="#9a9ab0">Tese, risco, rebalanceamento e renda passiva — em 60 segundos.</text>

  <!-- stats -->
  <text x="64" y="560" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#cfcfe0">1.400+ tickers</text>
  <text x="300" y="560" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#cfcfe0">16 ferramentas</text>
  <text x="560" y="560" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#cfcfe0">cotações ao vivo</text>
</svg>`;

const base = await sharp(Buffer.from(svg)).png().toBuffer();
const logo = await sharp(LOGO).trim({ threshold: 10 }).resize(96, 96, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();

await sharp(base)
  .composite([{ input: logo, left: 64, top: 36 }])
  .png({ compressionLevel: 9 })
  .toFile("public/og-image.png");

console.log("og ✓ public/og-image.png (1200x630)");
