// Gera os ícones PNG do PWA e as imagens-fonte do Android a partir de public/icons/icon.svg.
// Uso: npm run icons
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const iconDir = join(root, 'public', 'icons')
const assetDir = join(root, 'assets')
const svg = await readFile(join(iconDir, 'icon.svg'))
await mkdir(assetDir, { recursive: true })

const NAVY = '#0a2468'
const png = (size) => sharp(svg, { density: 384 }).resize(size, size).png()

/** Ícone "maskable": fundo cheio e logotipo dentro da zona segura (80%). */
async function maskable(size) {
  const inner = Math.round(size * 0.74)
  const logo = await sharp(svg, { density: 384 }).resize(inner, inner).png().toBuffer()
  return sharp({ create: { width: size, height: size, channels: 4, background: NAVY } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
}

await png(192).toFile(join(iconDir, 'icon-192.png'))
await png(512).toFile(join(iconDir, 'icon-512.png'))
await png(180).toFile(join(iconDir, 'apple-touch-icon.png'))
await (await maskable(512)).toFile(join(iconDir, 'icon-maskable-512.png'))

// Fontes para @capacitor/assets (ícone adaptativo e tela de abertura do Android)
await png(1024).toFile(join(assetDir, 'icon-only.png'))
await (await maskable(1024)).toFile(join(assetDir, 'icon-foreground.png'))
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: NAVY } })
  .png()
  .toFile(join(assetDir, 'icon-background.png'))

const splashLogo = await sharp(svg, { density: 384 }).resize(720, 720).png().toBuffer()
for (const name of ['splash.png', 'splash-dark.png']) {
  await sharp({ create: { width: 2732, height: 2732, channels: 4, background: NAVY } })
    .composite([{ input: splashLogo, gravity: 'center' }])
    .png()
    .toFile(join(assetDir, name))
}

await writeFile(join(iconDir, '.generated'), `Gerado por scripts/generate-icons.mjs\n`)
console.log('Ícones gerados em public/icons e assets/')
