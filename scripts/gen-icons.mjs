// Gera todos os tamanhos de ícone a partir da arte-mestre do logo (touro).
// Uso: node scripts/gen-icons.mjs
//
// Duas variantes:
//  - TILE  (apple-touch / PWA): squircle completo, centralizado.
//  - FAVICON (aba do navegador): crop fechado no touro + realce, para
//    permanecer legível em 16/32px (detalhe da tile vira borrão nesse tamanho).
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "assets-src/logo-bull-master.png"; // arte-mestre 2048x2048 RGBA
const OUT = "public/icons";
mkdirSync(OUT, { recursive: true });

const transparente = { r: 0, g: 0, b: 0, alpha: 0 };

// ── Ícones "tile" (squircle completo) ──────────────────────────────────────
const TILE = { "apple-touch-icon.png": 180, "icon-192.png": 192, "icon-512.png": 512 };
for (const [nome, tam] of Object.entries(TILE)) {
  await sharp(SRC)
    .trim({ threshold: 10 })                 // remove a margem transparente (centraliza)
    .resize(tam, tam, { fit: "contain", background: transparente })
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/${nome}`);
  console.log(`tile    ✓ ${OUT}/${nome} (${tam}x${tam})`);
}

// ── Favicons (crop fechado no touro + realce) ──────────────────────────────
const meta = await sharp(SRC).metadata();
const f = 0.08;                              // zoom: 8% de cada lado
const left = Math.round(meta.width * f);
const top = Math.round(meta.height * f);
const favBase = () => sharp(SRC)
  .extract({ left, top, width: meta.width - 2 * left, height: meta.height - 2 * top })
  .modulate({ saturation: 1.2 })            // cor mais viva
  .linear(1.15, -12);                       // leve contraste

const FAV = { "icon-16.png": 16, "icon-32.png": 32, "icon-48.png": 48 };
for (const [nome, tam] of Object.entries(FAV)) {
  await favBase()
    .resize(tam, tam, { fit: "cover" })
    .sharpen()                              // nitidez nas bordas em tamanho mínimo
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/${nome}`);
  console.log(`favicon ✓ ${OUT}/${nome} (${tam}x${tam})`);
}

console.log("Ícones gerados.");
