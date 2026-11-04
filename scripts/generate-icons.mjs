// Gera todos os ícones do aplicativo a partir da imagem do logotipo (assets/logo-iasd.jpg):
//   - PWA: public/icons/*.png
//   - Aplicativo: src/components/ui/logo-mask.png (emblema branco com transparência; a tela pinta com a cor do texto)
//   - Android: ícone do aplicativo (mipmap-*), ícone adaptativo, imagens de abertura (drawable*/splash.png) e o ícone
//     da abertura do Android 12+ (drawable-nodpi/ic_splash_logo.png)
// Uso: npm run icons   (depois, `npm run build:apk` já leva os ícones novos para o APK)
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SOURCE = join(root, 'assets', 'logo-iasd.jpg')
const iconDir = join(root, 'public', 'icons')
const res = join(root, 'android', 'app', 'src', 'main', 'res')
const maskFile = join(root, 'src', 'components', 'ui', 'logo-mask.png')
const NAVY = '#0a2468' // fundo da abertura e das telas do aplicativo
const WHITE = '#ffffff'

await mkdir(iconDir, { recursive: true })

// ---------------------------------------------------------------------------------------------------------------------
// 1. Emblema com transparência: o original é azul sobre fundo branco; a "quantidade de azul" de cada ponto vira opacidade.
// ---------------------------------------------------------------------------------------------------------------------
const { data: rgb, info } = await sharp(SOURCE).removeAlpha().raw().toBuffer({ resolveWithObject: true })
const { width, height } = info
const luminance = (i) => 0.299 * rgb[3 * i] + 0.587 * rgb[3 * i + 1] + 0.114 * rgb[3 * i + 2]

let sumR = 0
let sumG = 0
let sumB = 0
let sumL = 0
let solid = 0
for (let i = 0; i < width * height; i++) {
  const l = luminance(i)
  if (l < 90) {
    sumR += rgb[3 * i]
    sumG += rgb[3 * i + 1]
    sumB += rgb[3 * i + 2]
    sumL += l
    solid++
  }
}
if (solid < 1000) throw new Error('Não achei o emblema na imagem do logotipo.')
const ink = [sumR / solid, sumG / solid, sumB / solid].map(Math.round) // azul do emblema
const inkLuminance = sumL / solid

const alpha = new Uint8Array(width * height)
let minX = width
let minY = height
let maxX = 0
let maxY = 0
for (let i = 0; i < width * height; i++) {
  const a = Math.min(1, Math.max(0, (250 - luminance(i)) / (250 - inkLuminance)))
  alpha[i] = Math.round(a * 255)
  if (alpha[i] > 12) {
    const x = i % width
    const y = Math.floor(i / width)
    minX = Math.min(minX, x)
    maxX = Math.max(maxX, x)
    minY = Math.min(minY, y)
    maxY = Math.max(maxY, y)
  }
}
const crop = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 }

/** Emblema recortado rente às bordas, com a cor pedida e fundo transparente. */
async function emblem(color) {
  const rgba = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    rgba[4 * i] = color[0]
    rgba[4 * i + 1] = color[1]
    rgba[4 * i + 2] = color[2]
    rgba[4 * i + 3] = alpha[i]
  }
  return sharp(rgba, { raw: { width, height, channels: 4 } }).extract(crop).png().toBuffer()
}
const navyEmblem = await emblem(ink)
const whiteEmblem = await emblem([255, 255, 255])

/**
 * Imagem `w`×`h` com o emblema centralizado, cabendo em `fraction` da menor dimensão.
 * `background`: cor de fundo (ou transparente quando omitido); `circle`: recorta em círculo.
 */
async function artwork(w, h, emblemBuffer, fraction, { background, circle } = {}) {
  const box = Math.round(Math.min(w, h) * fraction)
  const mark = await sharp(emblemBuffer).resize(box, box, { fit: 'inside', kernel: 'lanczos3' }).png().toBuffer()
  let image = sharp({
    create: { width: w, height: h, channels: 4, background: background ?? { r: 0, g: 0, b: 0, alpha: 0 } },
  }).composite([{ input: mark, gravity: 'center' }])
  if (circle) {
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 2}"/></svg>`)
    image = sharp(await image.png().toBuffer()).composite([{ input: mask, blend: 'dest-in' }])
  }
  return image.png({ compressionLevel: 9 })
}

// ---------------------------------------------------------------------------------------------------------------------
// 2. Aplicativo e PWA
// ---------------------------------------------------------------------------------------------------------------------
const meta = await sharp(whiteEmblem).metadata()
const maskSide = 512
await (await sharp(whiteEmblem).resize(maskSide, maskSide, { fit: 'inside', kernel: 'lanczos3' }).png({ compressionLevel: 9 })).toFile(maskFile)

for (const [name, size, fraction] of [
  ['icon-192.png', 192, 0.68],
  ['icon-512.png', 512, 0.68],
  ['apple-touch-icon.png', 180, 0.68],
  // "maskable": o sistema recorta o ícone (círculo, gota...), então o emblema fica dentro da zona segura
  ['icon-maskable-512.png', 512, 0.54],
]) {
  await (await artwork(size, size, navyEmblem, fraction, { background: WHITE })).toFile(join(iconDir, name))
}
await writeFile(join(iconDir, '.generated'), 'Gerado por scripts/generate-icons.mjs\n')

// ---------------------------------------------------------------------------------------------------------------------
// 3. Android
// ---------------------------------------------------------------------------------------------------------------------
// densidade: [tamanho do ícone clássico, lado da imagem do ícone adaptativo exibida (72dp na densidade)]
const DENSITIES = { ldpi: [36, 54], mdpi: [48, 72], hdpi: [72, 108], xhdpi: [96, 144], xxhdpi: [144, 216], xxxhdpi: [192, 288] }
for (const [density, [legacy, adaptive]] of Object.entries(DENSITIES)) {
  const dir = join(res, `mipmap-${density}`)
  await mkdir(dir, { recursive: true })
  await (await artwork(legacy, legacy, navyEmblem, 0.7, { background: WHITE })).toFile(join(dir, 'ic_launcher.png'))
  await (await artwork(legacy, legacy, navyEmblem, 0.6, { background: WHITE, circle: true })).toFile(join(dir, 'ic_launcher_round.png'))
  await (await artwork(adaptive, adaptive, navyEmblem, 0.78)).toFile(join(dir, 'ic_launcher_foreground.png'))
  await sharp({ create: { width: adaptive, height: adaptive, channels: 4, background: WHITE } })
    .png({ compressionLevel: 9 })
    .toFile(join(dir, 'ic_launcher_background.png'))
}

// Abertura do Android 12+: só o emblema branco (o fundo azul-marinho vem do tema)
await mkdir(join(res, 'drawable-nodpi'), { recursive: true })
await (await artwork(960, 960, whiteEmblem, 0.48)).toFile(join(res, 'drawable-nodpi', 'ic_splash_logo.png'))

// Imagens de abertura: mantém os tamanhos que o projeto já tem (retrato, paisagem, escuro, cada densidade)
let splashes = 0
for (const name of await readdir(res)) {
  const file = join(res, name, 'splash.png')
  if (!name.startsWith('drawable') || !(await stat(file).catch(() => null))) continue
  const { width: w, height: h } = await sharp(file).metadata()
  await (await artwork(w, h, whiteEmblem, 0.38, { background: NAVY })).toFile(file)
  splashes++
}

console.log(
  `Ícones gerados: PWA (${iconDir}), máscara do aplicativo, Android (${Object.keys(DENSITIES).length} densidades, ${splashes} imagens de abertura).`,
)
console.log(`Emblema: ${meta.width}x${meta.height} px, cor ${ink.join(',')}`)
