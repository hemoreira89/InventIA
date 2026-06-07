// Gera todos os tamanhos de ícone a partir da arte-mestre do logo (touro).
// Uso: node scripts/gen-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const SRC = "src/premium_bull_icon.png"; // arte-mestre 2048x2048 RGBA
const OUT = "public/icons";
mkdirSync(OUT, { recursive: true });

// nome de saída -> tamanho (px)
const ALVOS = {
  "icon-16.png": 16,
  "icon-32.png": 32,
  "icon-48.png": 48,
  "apple-touch-icon.png": 180,
  "icon-192.png": 192,
  "icon-512.png": 512,
};

const transparente = { r: 0, g: 0, b: 0, alpha: 0 };

for (const [nome, tam] of Object.entries(ALVOS)) {
  await sharp(SRC)
    .trim({ threshold: 10 })                 // remove a margem transparente (centraliza)
    .resize(tam, tam, { fit: "contain", background: transparente })
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/${nome}`);
  console.log(`✓ ${OUT}/${nome} (${tam}x${tam})`);
}
console.log("Ícones gerados.");
