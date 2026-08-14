import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "public/logo.svg"));
const outDir = join(root, "public/icons");
mkdirSync(outDir, { recursive: true });
mkdirSync(join(root, "src/app"), { recursive: true });

function renderTransparent(size) {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
    background: "rgba(0,0,0,0)",
  });
  return Buffer.from(resvg.render().asPng());
}

async function whiteIcon(size, markRatio = 0.7) {
  const markSize = Math.round(size * markRatio);
  const mark = renderTransparent(markSize);
  const left = Math.round((size - markSize) / 2);
  const top = Math.round((size - markSize) / 2);
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: mark, left, top }])
    .png()
    .toBuffer();
}

writeFileSync(join(root, "public/logo.png"), renderTransparent(512));
writeFileSync(join(root, "src/app/icon.png"), renderTransparent(32));
writeFileSync(join(root, "public/favicon.png"), renderTransparent(32));

writeFileSync(join(outDir, "icon-192.png"), await whiteIcon(192, 0.72));
writeFileSync(join(outDir, "icon-512.png"), await whiteIcon(512, 0.72));
writeFileSync(join(outDir, "icon-maskable-192.png"), await whiteIcon(192, 0.62));
writeFileSync(join(outDir, "icon-maskable-512.png"), await whiteIcon(512, 0.62));
writeFileSync(join(outDir, "apple-touch-icon.png"), await whiteIcon(180, 0.72));
writeFileSync(join(root, "src/app/apple-icon.png"), await whiteIcon(180, 0.72));

console.log("logo A rendered");
